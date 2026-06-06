const { v4: uuidv4 } = require('uuid');
const { CATEGORY_STATS, selectSkills, generateFullSkill } = require('./skillLibrary');

// 根据角色定位生成后缀
const ROLE_SUFFIXES = {
  '物理输出': ['·战士', '·猎手', '·剑客', '·刺客', '·狂战'],
  '魔法输出': ['·法师', '·学者', '·术士', '·元素使', '·咒师'],
  '坦克': ['·守卫', '·盾卫', '·堡垒', '·守护者', '·铁壁'],
  '辅助': ['·祭司', '·吟游者', '·导师', '·先知', '·援护'],
  '治疗': ['·医者', '·圣手', '·灵愈师', '·守护天使', '·复苏者'],
  '平衡': ['·行者', '·旅者', '·探索者', '·漫游者']
};

// 从 traits 中选出适合作为前缀的特征词
function pickTraitPrefix(traits, objectName) {
  if (!traits || traits.length === 0 || !objectName) return '';
  
  // 如果 object_name 已经很详细（超过7个字），不加前缀避免冗余
  if (objectName.length > 7) return '';
  
  // 优先选择描述外观/颜色的 trait
  const visualTraits = traits.filter(t => {
    const lower = String(t).toLowerCase();
    return /色|毛|眼|角|翅|鳞|壳|纹|斑|点|条|红|黄|蓝|绿|白|黑|金|银|紫|橙|粉|棕|灰|大|小|长|短|圆|尖|迅捷|敏捷|强壮/.test(lower);
  });
  const pool = visualTraits.length > 0 ? visualTraits : traits;
  
  for (const trait of pool) {
    const t = String(trait).replace(/的$/, '');
    if (t.length === 0) continue;
    // 检查 trait 的核心词是否已出现在 object_name 中
    if (objectName.includes(t)) continue;
    // 检查 object_name 中是否有2字以上的词被 trait 包含
    const objWords = objectName.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    const hasOverlap = objWords.some(w => t.includes(w));
    if (hasOverlap) continue;
    
    const connector = /的$/.test(trait) ? '' : '的';
    return trait + connector;
  }
  return '';
}

function generateAdventureName(analysis) {
  const objectName = analysis.object_name || '未知物体';
  const traits = analysis.traits || [];
  const role = analysis.suggested_role || '平衡';
  
  // 1. 主体：保留 AI 识别的详细描述
  let name = objectName;
  
  // 2. 从 traits 中选一个视觉特征作为前缀修饰（智能去重）
  const traitPrefix = pickTraitPrefix(traits, objectName);
  if (traitPrefix) {
    name = traitPrefix + name;
  }
  
  // 3. 根据角色添加后缀，让名字有游戏感
  const suffixes = ROLE_SUFFIXES[role] || ROLE_SUFFIXES['平衡'];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return name + suffix;
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
    id: uuidv4(), name: generateAdventureName(analysis),
    objectName: analysis.object_name || '未知物体',
    category, size, role, traits, hp, maxHp: hp, atk, skills,
    isBoss, sourceImage: null, obtainedAt: new Date().toISOString()
  };
}

// Boss 专属后缀（威胁感）
const BOSS_SUFFIXES = ['·魔王', '·主宰', '·之影', '·领主', '·毁灭者', '·天灾', '·噩梦', '·暴君'];

function generateBoss(analysis, roundIndex) {
  const multipliers = [1.0, 1.3, 1.6, 1.9, 2.2];
  const multiplier = multipliers[Math.min(roundIndex, 4)];
  const card = generateCard(analysis, true);
  
  // Boss 名字：用详细描述 + Boss 专属后缀（替换卡牌角色后缀）
  const objectName = analysis.object_name || '未知物体';
  const traits = analysis.traits || [];
  let bossName = objectName;
  // 短名字加 trait 前缀
  if (objectName.length <= 7) {
    const prefix = pickTraitPrefix(traits, objectName);
    if (prefix) bossName = prefix + bossName;
  }
  const bossSuffix = BOSS_SUFFIXES[roundIndex % BOSS_SUFFIXES.length];
  card.name = bossName + bossSuffix;
  
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
