const express = require('express');
const path = require('path');
const fs = require('fs');
const { generateCard, generateBoss } = require('../services/cardGenerator');
const { get, all, run } = require('../utils/db');
const { validateBody } = require('../middleware/validator');
const { authMiddleware } = require('../middleware/auth');

const LEGACY_CARDS_FILE = path.join(__dirname, '../data/cards.json');

async function migrateLegacyCards(userId) {
  try {
    const raw = await fs.promises.readFile(LEGACY_CARDS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const cards = Array.isArray(parsed) ? parsed : (parsed.data || []);
    if (cards.length === 0) return;

    // 检查该用户是否已有卡牌
    const existing = await get('SELECT COUNT(*) as count FROM cards WHERE user_id = ?', [userId]);
    if (existing && existing.count > 0) return;

    console.log(`[Migrate] Importing ${cards.length} legacy cards for user ${userId}`);
    for (const card of cards) {
      const clean = sanitizeCard(card);
      if (clean && clean.id) {
        await run('INSERT OR IGNORE INTO cards (id, user_id, card_json) VALUES (?, ?, ?)',
          [clean.id, userId, JSON.stringify(clean)]);
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Legacy cards migration error:', e.message);
  }
}

const router = express.Router();

function sanitizeCard(card) {
  if (!card || typeof card !== 'object') return null;
  return {
    id: String(card.id || ''),
    name: String(card.name || '未命名'),
    category: String(card.category || 'object'),
    size: String(card.size || 'medium'),
    role: String(card.role || '物理输出'),
    traits: Array.isArray(card.traits) ? card.traits.filter(t => typeof t === 'string') : [],
    rarity: String(card.rarity || 'common'),
    hp: Number(card.hp) || 0,
    maxHp: Number(card.maxHp || card.hp) || 0,
    atk: Number(card.atk) || 0,
    skills: Array.isArray(card.skills) ? card.skills : [],
    isBoss: Boolean(card.isBoss),
    sourceImage: card.sourceImage || null,
    image: card.image || null,
    obtainedAt: card.obtainedAt || new Date().toISOString()
  };
}

// 以下接口需要登录
router.use(authMiddleware);

router.post('/generate-card', validateBody({
  object_name: { required: true, type: 'string' },
  category: { type: 'string' },
  size: { type: 'string' },
  traits: { type: 'object', validator: v => Array.isArray(v), message: '必须是数组' },
  suggested_role: { type: 'string' }
}), async (req, res, next) => {
  try {
    const card = generateCard(req.body);
    res.json(card);
  } catch (error) {
    next(error);
  }
});

router.post('/generate-boss', validateBody({
  analysis: { required: true, type: 'object', validator: v => v && typeof v.object_name === 'string', message: '必须包含object_name' },
  roundIndex: { required: true, type: 'number', validator: v => Number.isInteger(v) && v >= 0, message: '必须是非负整数' }
}), async (req, res, next) => {
  try {
    const { analysis, roundIndex } = req.body;
    const boss = generateBoss(analysis, roundIndex);
    res.json(boss);
  } catch (error) {
    next(error);
  }
});

router.get('/collection', async (req, res, next) => {
  try {
    await migrateLegacyCards(req.user.id);
    const rows = await all('SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    const cards = rows.map(r => JSON.parse(r.card_json)).filter(c => c && c.id);
    res.json(cards);
  } catch (error) {
    next(error);
  }
});

router.post('/collection', validateBody({
  id: { required: true, type: 'string' }
}), async (req, res, next) => {
  try {
    const card = sanitizeCard(req.body);
    if (!card || !card.id) {
      return res.status(400).json({ error: '无效的卡牌数据' });
    }
    const existing = await get('SELECT id FROM cards WHERE id = ? AND user_id = ?', [card.id, req.user.id]);
    if (!existing) {
      await run('INSERT INTO cards (id, user_id, card_json) VALUES (?, ?, ?)', [card.id, req.user.id, JSON.stringify(card)]);
    }
    res.json({ success: true, card });
  } catch (error) {
    next(error);
  }
});

router.post('/collection/batch', validateBody({
  cards: { required: true, type: 'object', validator: v => Array.isArray(v), message: '必须是数组' }
}), async (req, res, next) => {
  try {
    const newCards = (req.body.cards || []).map(sanitizeCard).filter(Boolean);
    let added = 0;
    for (const card of newCards) {
      const existing = await get('SELECT id FROM cards WHERE id = ? AND user_id = ?', [card.id, req.user.id]);
      if (!existing) {
        await run('INSERT INTO cards (id, user_id, card_json) VALUES (?, ?, ?)', [card.id, req.user.id, JSON.stringify(card)]);
        added++;
      }
    }
    res.json({ success: true, count: added });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
