const express = require('express');
const path = require('path');
const { generateBuffChoices, createBattleState, processPlayerAction, endPlayerTurn, processBossTurn } = require('../services/gameEngine');
const { loadJson, saveJson } = require('../utils/dataStore');
const { validateBody } = require('../middleware/validator');

const router = express.Router();
const PROGRESS_FILE = path.join(__dirname, '../data/progress.json');

async function loadProgress() {
  const doc = await loadJson(PROGRESS_FILE, { currentRun: null, history: [] });
  return doc.data || { currentRun: null, history: [] };
}

async function saveProgress(progress) {
  await saveJson(PROGRESS_FILE, progress);
}

router.get('/game-state', async (req, res, next) => {
  try {
    const progress = await loadProgress();
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

router.post('/game-state', validateBody({
  currentRun: { type: 'object' },
  history: { type: 'object', validator: v => Array.isArray(v), message: '必须是数组' }
}), async (req, res, next) => {
  try {
    await saveProgress(req.body);
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
      status: 'active',
      startedAt: new Date().toISOString()
    };
    const progress = await loadProgress();
    progress.currentRun = run;
    await saveProgress(progress);
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
    const progress = await loadProgress();
    if (!progress.currentRun) {
      return res.status(400).json({ error: '没有进行中的游戏' });
    }
    progress.currentRun.buffs.push(buff);
    await saveProgress(progress);
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
    const progress = await loadProgress();
    progress.currentRun = runState;
    if (progress.currentRun && progress.currentRun.currentRound >= progress.currentRun.maxRounds) {
      progress.currentRun.status = 'won';
      progress.history.push(progress.currentRun);
      progress.currentRun = null;
    }
    await saveProgress(progress);
    res.json({ success: true, run: progress.currentRun });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-run', async (req, res, next) => {
  try {
    const progress = await loadProgress();
    if (progress.currentRun) {
      progress.currentRun.status = 'lost';
      progress.history.push(progress.currentRun);
      progress.currentRun = null;
    }
    await saveProgress(progress);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

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

module.exports = router;
