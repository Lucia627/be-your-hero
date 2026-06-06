const { v4: uuidv4 } = require('uuid');
const { CATEGORY_STATS, selectSkills, generateFullSkill } = require('./skillLibrary');

const ADVENTURE_PREFIXES = [
  '充满魔力的', '古老的', '神秘的', '闪耀的', '诅咒的',
  '传说的', '稀有的', '强化的', '愤怒的', '神圣的',
  '暗影的', '狂野的', '冰封的', '烈焰的', '雷霆的',
  '幽深的', '狂暴的', '圣光的', '腐朽的', '迅捷的'
];

function generateAdventureName(objectName) {
  const prefix = ADVENTURE_PREFIXES[Math.floor(Math.random() * ADVENTURE_PREFIXES.length)];
  return prefix + (objectName || '未知物体');
}

function generateCard(analysis, isBoss = false) {
  const category = analysis.category || 'default';
  let size = analysis.size || 'medium';
  if (size === 'huge') size = 'giant';
  const role = analysis.suggested_role || '物理输出';
  const traits = analysis.traits || [];
  const statRange = CATEGORY_STATS[category] || CATEGORY_STATS.default;
  const atkBase = randomRange(statRange.atkMin, statRange.atkMax);
  const hpBase = randomRange(statRange.hpMin, statRange.hpMax);
  const atk = Math.round(atkBase * randomVariation());
  const hp = Math.round(hpBase * randomVariation());
  const templates = selectSkills(category, size, traits, role);
  const skills = templates.map(t => generateFullSkill(t, category));
  return {
    id: uuidv4(), name: generateAdventureName(analysis.object_name),
    category, size, role, traits, hp, maxHp: hp, atk, skills,
    isBoss, sourceImage: null, obtainedAt: new Date().toISOString()
  };
}

function generateBoss(analysis, roundIndex) {
  const multipliers = [1.0, 1.3, 1.6, 1.9, 2.2];
  const multiplier = multipliers[Math.min(roundIndex, 4)];
  const card = generateCard(analysis, true);
  card.hp = Math.round(card.hp * multiplier);
  card.maxHp = card.hp;
  card.atk = Math.round(card.atk * multiplier);
  const category = analysis.category || 'default';
  const { SKILL_TEMPLATES } = require('./skillLibrary');
  const templateList = Object.values(SKILL_TEMPLATES);
  const numSkills = 4 + Math.floor(Math.random() * 2);
  const usedTypes = new Set();
  const scored = templateList.map(t => {
    let score = 0;
    if (t.category === 'attack') score += 2;
    return { template: t, score };
  }).sort((a, b) => b.score - a.score);
  const allTemplates = [];
  for (const { template } of scored) {
    if (allTemplates.length >= numSkills) break;
    const typeKey = template.type + '_' + template.category;
    if (!usedTypes.has(typeKey) || allTemplates.length < 3) {
      allTemplates.push(template); usedTypes.add(typeKey);
    }
  }
  card.skills = allTemplates.map(t => {
    const skill = generateFullSkill(t, category);
    if (skill.power) skill.power = Math.round(skill.power * 1.2 * 10) / 10;
    return skill;
  });
  card.bossRound = roundIndex + 1;
  card.bossMultiplier = multiplier;
  return card;
}

function randomRange(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomVariation() { return 0.8 + Math.random() * 0.4; }

module.exports = { generateCard, generateBoss };
