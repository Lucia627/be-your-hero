const express = require('express');
const path = require('path');
const fs = require('fs');
const { generateBuffChoices, createBattleState, processPlayerAction, endPlayerTurn, processBossTurn } = require('../services/gameEngine');
const { generateStorySegment } = require('../services/llmService');
const { get, run: runQuery, all } = require('../utils/db');
const { validateBody } = require('../middleware/validator');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const LEGACY_PROGRESS_FILE = path.join(__dirname, '../data/progress.json');

async function migrateLegacyProgress(userId) {
  try {
    const raw = await fs.promises.readFile(LEGACY_PROGRESS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const data = parsed.data || parsed;
    if (!data || (!data.currentRun && (!data.history || data.history.length === 0))) return;

    // 检查该用户是否已有数据
    const existing = await get('SELECT id FROM runs WHERE user_id = ?', [userId]);
    if (existing) return;

    console.log(`[Migrate] Importing legacy progress for user ${userId}`);
    if (data.currentRun) {
      await runQuery('INSERT INTO runs (id, user_id, run_json, status) VALUES (?, ?, ?, ?)',
        [uuidv4(), userId, JSON.stringify(data.currentRun), data.currentRun.status || 'active']);
    }
    if (Array.isArray(data.history)) {
      for (const h of data.history) {
        await runQuery('INSERT INTO run_history (id, user_id, run_json, status) VALUES (?, ?, ?, ?)',
          [uuidv4(), userId, JSON.stringify(h), h.status || 'unknown']);
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Legacy progress migration error:', e.message);
  }
}

const router = express.Router();

// ===== 单人游戏接口（需登录）=====
router.use(authMiddleware);

router.get('/game-state', async (req, res, next) => {
  try {
    await migrateLegacyProgress(req.user.id);
    const runRow = await get('SELECT * FROM runs WHERE user_id = ?', [req.user.id]);
    // 不再返回 history 完整数据（避免传输大量 base64 图片）
    const historyCount = await get('SELECT COUNT(*) as count FROM run_history WHERE user_id = ?', [req.user.id]);
    const progress = {
      currentRun: runRow ? JSON.parse(runRow.run_json) : null,
      history: [], // 前端不需要 history 数据来恢复游戏
      historyCount: historyCount ? historyCount.count : 0
    };
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

router.post('/game-state', validateBody({
  currentRun: { type: 'object' }
}), async (req, res, next) => {
  try {
    // 保存当前冒险
    if (req.body.currentRun) {
      const existing = await get('SELECT id FROM runs WHERE user_id = ?', [req.user.id]);
      if (existing) {
        await runQuery('UPDATE runs SET run_json = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [JSON.stringify(req.body.currentRun), req.body.currentRun.status || 'active', req.user.id]);
      } else {
        await runQuery('INSERT INTO runs (id, user_id, run_json, status) VALUES (?, ?, ?, ?)',
          [uuidv4(), req.user.id, JSON.stringify(req.body.currentRun), req.body.currentRun.status || 'active']);
      }
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/start-run', validateBody({
  startingCard: { required: true, type: 'object', validator: v => v && typeof v.id === 'string', message: '必须是包含id的对象' }
}), async (req, res, next) => {
  try {
    const { startingCard } = req.body;
    const run = {
      id: Date.now().toString(),
      startingCard,
      team: [startingCard],
      currentRound: 0,
      maxRounds: 5,
      buffs: [],
      battleHistory: [],
      adventureStory: [],
      status: 'active',
      startedAt: new Date().toISOString()
    };
    // 保存或覆盖当前冒险
    const existing = await get('SELECT id FROM runs WHERE user_id = ?', [req.user.id]);
    if (existing) {
      // 把旧的存到历史
      const oldRun = await get('SELECT run_json FROM runs WHERE user_id = ?', [req.user.id]);
      if (oldRun) {
        const parsed = JSON.parse(oldRun.run_json);
        parsed.status = 'abandoned';
        await runQuery('INSERT INTO run_history (id, user_id, run_json, status) VALUES (?, ?, ?, ?)',
          [uuidv4(), req.user.id, JSON.stringify(parsed), 'abandoned']);
      }
      await runQuery('UPDATE runs SET run_json = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [JSON.stringify(run), 'active', req.user.id]);
    } else {
      await runQuery('INSERT INTO runs (id, user_id, run_json, status) VALUES (?, ?, ?, ?)',
        [uuidv4(), req.user.id, JSON.stringify(run), 'active']);
    }
    res.json(run);
  } catch (error) {
    next(error);
  }
});

router.post('/buff-choices', async (req, res, next) => {
  try {
    res.json(generateBuffChoices());
  } catch (error) {
    next(error);
  }
});

router.post('/apply-buff', validateBody({
  buff: { required: true, type: 'object', validator: v => v && typeof v.id === 'string', message: '必须是包含id的对象' }
}), async (req, res, next) => {
  try {
    const { buff } = req.body;
    const runRow = await get('SELECT * FROM runs WHERE user_id = ?', [req.user.id]);
    if (!runRow) {
      return res.status(400).json({ error: '没有进行中的游戏' });
    }
    const run = JSON.parse(runRow.run_json);
    run.buffs.push(buff);
    await runQuery('UPDATE runs SET run_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [JSON.stringify(run), req.user.id]);
    res.json({ success: true, buff });
  } catch (error) {
    next(error);
  }
});

router.post('/add-boss', validateBody({
  runState: { required: true, type: 'object', validator: v => v && typeof v.id === 'string', message: '必须是包含id的对象' }
}), async (req, res, next) => {
  try {
    const { runState } = req.body;
    const existing = await get('SELECT id FROM runs WHERE user_id = ?', [req.user.id]);
    if (existing) {
      await runQuery('UPDATE runs SET run_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [JSON.stringify(runState), req.user.id]);
    } else {
      await runQuery('INSERT INTO runs (id, user_id, run_json, status) VALUES (?, ?, ?, ?)',
        [uuidv4(), req.user.id, JSON.stringify(runState), 'active']);
    }
    res.json({ success: true, run: runState });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-run', async (req, res, next) => {
  try {
    const runRow = await get('SELECT * FROM runs WHERE user_id = ?', [req.user.id]);
    if (runRow) {
      const run = JSON.parse(runRow.run_json);
      run.status = 'lost';
      await runQuery('INSERT INTO run_history (id, user_id, run_json, status) VALUES (?, ?, ?, ?)',
        [uuidv4(), req.user.id, JSON.stringify(run), 'lost']);
      await runQuery('DELETE FROM runs WHERE user_id = ?', [req.user.id]);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ===== 战斗接口 =====
router.post('/battle/start', validateBody({
  team: { required: true, type: 'object', validator: v => Array.isArray(v) && v.length > 0, message: '必须是非空数组' },
  boss: { required: true, type: 'object', validator: v => v && typeof v.hp === 'number', message: '必须包含hp字段' }
}), async (req, res, next) => {
  try {
    const { team, boss, buffs } = req.body;
    res.json(createBattleState(team, boss, buffs || []));
  } catch (error) {
    next(error);
  }
});

router.post('/battle/action', validateBody({
  state: { required: true, type: 'object' },
  skillId: { required: true, type: 'string' },
  cardId: { required: true, type: 'string' }
}), async (req, res, next) => {
  try {
    const { state, skillId, cardId } = req.body;
    res.json(processPlayerAction(state, skillId, cardId));
  } catch (error) {
    next(error);
  }
});

router.post('/battle/end-turn', validateBody({
  state: { required: true, type: 'object' }
}), async (req, res, next) => {
  try {
    const { state } = req.body;
    endPlayerTurn(state);
    processBossTurn(state);
    res.json({ success: true, state });
  } catch (error) {
    next(error);
  }
});

// ===== 冒险故事生成接口 =====
router.post('/story/generate', async (req, res, next) => {
  try {
    const { team, newMember, round, previousStory, isFirst, isEnding } = req.body;
    const segment = await generateStorySegment({
      team: team || [],
      newMember: newMember || {},
      round: round || 1,
      previousStory: previousStory || [],
      isFirst: !!isFirst,
      isEnding: !!isEnding
    });
    res.json({ segment });
  } catch (error) {
    console.error('Story generation route error:', error);
    next(error);
  }
});

module.exports = router;
