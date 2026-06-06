const express = require('express');
const path = require('path');
const { generateCard, generateBoss } = require('../services/cardGenerator');
const { loadJson, saveJson } = require('../utils/dataStore');
const { validateBody } = require('../middleware/validator');

const router = express.Router();
const CARDS_FILE = path.join(__dirname, '../data/cards.json');

async function loadCards() {
  const doc = await loadJson(CARDS_FILE, []);
  return doc.data || [];
}

async function saveCards(cards) {
  await saveJson(CARDS_FILE, cards);
}

function sanitizeCard(card) {
  if (!card || typeof card !== 'object') return null;
  return {
    id: String(card.id || ''),
    name: String(card.name || '未命名'),
    category: String(card.category || 'object'),
    size: String(card.size || 'medium'),
    role: String(card.role || '物理输出'),
    traits: Array.isArray(card.traits) ? card.traits.filter(t => typeof t === 'string') : [],
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
    const cards = await loadCards();
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
    const cards = await loadCards();
    if (!cards.find(c => c.id === card.id)) {
      cards.push(card);
      await saveCards(cards);
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
    const cards = await loadCards();
    let added = 0;
    for (const card of newCards) {
      if (!cards.find(c => c.id === card.id)) {
        cards.push(card);
        added++;
      }
    }
    if (added > 0) {
      await saveCards(cards);
    }
    res.json({ success: true, count: added });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
