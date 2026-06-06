const SKILL_TEMPLATES = {
  P01: { id: 'P01', type: 'physical', category: 'attack', cost: 0, power: 0.5, limit: 'per_turn', tags: ['物理', '攻击', '低费'], nameTemplates: { animal: ['轻咬', '爪击', '尾鞭'], weapon: ['轻击', '挑刺', '挥砍'], furniture: ['碰撞', '摩擦', '轻砸'], food: ['滚动', '弹跳', '轻撞'], electronics: ['静电', '微震', '短路'], vehicle: ['滑行', '漂移', '轻碾'], default: ['撞击', '打击', '攻击'] }, descriptionTemplate: '造成{power}倍攻击力的物理伤害' },
  P02: { id: 'P02', type: 'physical', category: 'attack', cost: 0, power: 1.0, limit: 'per_game', tags: ['物理', '攻击', '整局一次'], nameTemplates: { default: ['奋力一击', '舍身攻击', '绝地反击'] }, descriptionTemplate: '造成{power}倍攻击力的物理伤害（整局仅限一次）' },
  P03: { id: 'P03', type: 'physical', category: 'attack', cost: 1, power: 1.0, limit: 'per_turn', tags: ['物理', '攻击', '标准'], nameTemplates: { animal: ['撕咬', '抓挠', '猛扑', '蹄击'], weapon: ['突刺', '挥砍', '劈斩', '横扫'], furniture: ['重砸', '碾压', '撞击', '拍击'], food: ['砸击', '弹射', '滚动撞击'], electronics: ['电击', '撞击', '脉冲打击'], vehicle: ['冲撞', '碾压', '撞击'], default: ['打击', '攻击', '冲撞'] }, descriptionTemplate: '造成{power}倍攻击力的物理伤害' },
  P04: { id: 'P04', type: 'physical', category: 'attack', cost: 1, power: 3.0, limit: 'per_game', tags: ['物理', '攻击', '爆发', '整局一次'], nameTemplates: { default: ['致命一击', '必杀', '终结技'] }, descriptionTemplate: '造成{power}倍攻击力的物理伤害（整局仅限一次）' },
  P05: { id: 'P05', type: 'physical', category: 'attack', cost: 3, power: 1.8, limit: 'per_turn', tags: ['物理', '攻击', '中费'], nameTemplates: { default: ['重击', '猛砍', '强力打击'] }, descriptionTemplate: '造成{power}倍攻击力的物理伤害' },
  P06: { id: 'P06', type: 'physical', category: 'attack', cost: 5, power: 2.5, limit: 'per_turn', tags: ['物理', '攻击', '高费'], nameTemplates: { default: ['毁灭打击', '天崩地裂', '碎星'] }, descriptionTemplate: '造成{power}倍攻击力的物理伤害' },
  P07: { id: 'P07', type: 'physical', category: 'attack', cost: 7, power: 3.5, limit: 'per_turn', tags: ['物理', '攻击', '超高费'], nameTemplates: { default: ['毁灭一击', '碎骨', '天崩'] }, descriptionTemplate: '造成{power}倍攻击力的物理伤害' },
  P08: { id: 'P08', type: 'physical', category: 'attack', cost: 9, power: 5.0, limit: 'per_game', tags: ['物理', '攻击', '终极', '整局一次'], nameTemplates: { default: ['终极奥义', '神灭斩', '绝命'] }, descriptionTemplate: '造成{power}倍攻击力的物理伤害（整局仅限一次）' },
  M01: { id: 'M01', type: 'magic', category: 'attack', cost: 0, power: 0.5, limit: 'per_turn', tags: ['魔法', '攻击', '低费'], nameTemplates: { default: ['火花', '微光', '静电'] }, descriptionTemplate: '造成{power}倍攻击力的魔法伤害' },
  M02: { id: 'M02', type: 'magic', category: 'attack', cost: 0, power: 1.0, limit: 'per_game', tags: ['魔法', '攻击', '整局一次'], nameTemplates: { default: ['秘术', '念力', '灵击'] }, descriptionTemplate: '造成{power}倍攻击力的魔法伤害（整局仅限一次）' },
  M03: { id: 'M03', type: 'magic', category: 'attack', cost: 1, power: 1.0, limit: 'per_turn', tags: ['魔法', '攻击', '标准'], nameTemplates: { default: ['魔法弹', '能量波', '脉冲'] }, descriptionTemplate: '造成{power}倍攻击力的魔法伤害' },
  M04: { id: 'M04', type: 'magic', category: 'attack', cost: 1, power: 3.0, limit: 'per_game', tags: ['魔法', '攻击', '爆发', '整局一次'], nameTemplates: { default: ['魔力爆发', '奥术冲击', '魔法炸裂'] }, descriptionTemplate: '造成{power}倍攻击力的魔法伤害（整局仅限一次）' },
  M05: { id: 'M05', type: 'magic', category: 'attack', cost: 3, power: 1.8, limit: 'per_turn', tags: ['魔法', '攻击', '中费'], nameTemplates: { default: ['火球术', '寒冰箭', '雷击'] }, descriptionTemplate: '造成{power}倍攻击力的魔法伤害' },
  M06: { id: 'M06', type: 'magic', category: 'attack', cost: 5, power: 2.5, limit: 'per_turn', tags: ['魔法', '攻击', '高费'], nameTemplates: { default: ['炎爆术', '暴风雪', '雷霆万钧'] }, descriptionTemplate: '造成{power}倍攻击力的魔法伤害' },
  M07: { id: 'M07', type: 'magic', category: 'attack', cost: 7, power: 3.5, limit: 'per_turn', tags: ['魔法', '攻击', '超高费'], nameTemplates: { default: ['地狱火', '极寒审判', '灭世雷'] }, descriptionTemplate: '造成{power}倍攻击力的魔法伤害' },
  M08: { id: 'M08', type: 'magic', category: 'attack', cost: 9, power: 5.0, limit: 'per_game', tags: ['魔法', '攻击', '终极', '整局一次'], nameTemplates: { default: ['禁咒', '神罚', '究极魔法'] }, descriptionTemplate: '造成{power}倍攻击力的魔法伤害（整局仅限一次）' },
  D01: { id: 'D01', type: 'defense', category: 'defense', cost: 0, effect: 'half_damage_next', limit: 'per_turn', tags: ['防御', '低费'], nameTemplates: { default: ['闪避', '格挡', '侧身'] }, descriptionTemplate: '本回合下一次受到的伤害减半' },
  D02: { id: 'D02', type: 'defense', category: 'defense', cost: 1, effect: 'add_defense_layer', value: 1, limit: 'per_turn', tags: ['防御', '标准'], nameTemplates: { default: ['护盾', '硬化', '防御姿态'] }, descriptionTemplate: '获得1层防御减伤（每层20%，最多4层）' },
  D03: { id: 'D03', type: 'defense', category: 'defense', cost: 2, effect: 'add_defense_layer', value: 2, limit: 'per_turn', tags: ['防御', '中费'], nameTemplates: { default: ['铁壁', '固守', '金钟罩'] }, descriptionTemplate: '获得2层防御减伤（每层20%，最多4层）' },
  D04: { id: 'D04', type: 'defense', category: 'defense', cost: 3, effect: 'clear_debuff_and_defend', value: 1, limit: 'per_turn', tags: ['防御', '净化'], nameTemplates: { default: ['净化护盾', '圣光守护', '驱邪'] }, descriptionTemplate: '清除1个异常状态，并获得1层防御减伤' },
  D05: { id: 'D05', type: 'defense', category: 'defense', cost: 5, effect: 'invincible_one_turn', limit: 'per_game', tags: ['防御', '终极', '整局一次'], nameTemplates: { default: ['绝对防御', '无敌', '虚无'] }, descriptionTemplate: '本回合免疫所有伤害（整局仅限一次）' },
  A01: { id: 'A01', type: 'debuff', category: 'abnormal', subtype: 'poison', cost: 0, effect: 'poison_chance', chance: 0.1, limit: 'per_turn', tags: ['异常', '毒', '低费'], nameTemplates: { default: ['毒雾', '腐蚀', '污染'] }, descriptionTemplate: '10%概率使敌方中毒（每回合损失5%HP）' },
  A02: { id: 'A02', type: 'debuff', category: 'abnormal', subtype: 'poison', cost: 2, power: 0.8, effect: 'poison', limit: 'per_turn', tags: ['异常', '毒', '中费'], nameTemplates: { default: ['剧毒撕咬', '毒刺', '瘟疫'] }, descriptionTemplate: '造成{power}倍伤害，并使敌方中毒（每回合损失5%HP，持续3回合）' },
  A03: { id: 'A03', type: 'debuff', category: 'abnormal', subtype: 'weak', cost: 2, power: 0.5, effect: 'weak', limit: 'per_turn', tags: ['异常', '虚弱', '中费'], nameTemplates: { default: ['衰弱打击', '诅咒', '枯萎'] }, descriptionTemplate: '造成{power}倍伤害，并使敌方虚弱（造成伤害-20%，受到伤害+20%，持续2回合）' },
  A04: { id: 'A04', type: 'debuff', category: 'abnormal', subtype: 'fear', cost: 1, effect: 'fear', limit: 'per_turn', tags: ['异常', '恐惧', '低费'], nameTemplates: { default: ['恐吓', '威慑', '尖啸'] }, descriptionTemplate: '使敌方恐惧（每次行动50%概率跳过1个技能，持续2回合）' },
  A05: { id: 'A05', type: 'debuff', category: 'abnormal', subtype: 'sleep', cost: 3, power: 1.0, effect: 'sleep', chance: 0.5, limit: 'per_turn', tags: ['异常', '睡眠', '中费'], nameTemplates: { default: ['催眠术', '摇篮曲', '迷雾'] }, descriptionTemplate: '造成{power}倍伤害，50%概率使敌方睡眠（跳过2回合，受击苏醒）' },
  A06: { id: 'A06', type: 'debuff', category: 'abnormal', subtype: 'sleep', cost: 6, effect: 'sleep_strong', chance: 0.75, limit: 'per_game', tags: ['异常', '睡眠', '高费', '整局一次'], nameTemplates: { default: ['永恒梦境', '深度催眠', '强制关机'] }, descriptionTemplate: '75%概率使敌方睡眠（跳过2回合，受击苏醒）（整局仅限一次）' },
  H01: { id: 'H01', type: 'heal', category: 'support', cost: 0, effect: 'heal', power: 0.5, limit: 'per_turn', tags: ['治疗', '低费'], nameTemplates: { default: ['自愈', '喘息', '休整'] }, descriptionTemplate: '恢复{power}倍攻击力的生命值' },
  H02: { id: 'H02', type: 'heal', category: 'support', cost: 0, effect: 'heal', power: 1.0, limit: 'per_game', tags: ['治疗', '整局一次'], nameTemplates: { default: ['回春', '急救', '神迹'] }, descriptionTemplate: '恢复{power}倍攻击力的生命值（整局仅限一次）' },
  H03: { id: 'H03', type: 'heal', category: 'support', cost: 2, effect: 'heal', power: 1.5, limit: 'per_turn', tags: ['治疗', '标准'], nameTemplates: { default: ['治疗术', '治愈', '修复'] }, descriptionTemplate: '恢复{power}倍攻击力的生命值' },
  H04: { id: 'H04', type: 'heal', category: 'support', cost: 3, effect: 'heal', power: 2.0, clear_one_debuff: true, limit: 'per_turn', tags: ['治疗', '净化'], nameTemplates: { default: ['大治疗', '净化之光', '复苏'] }, descriptionTemplate: '恢复{power}倍攻击力的生命值，并清除1个异常状态' },
  B01: { id: 'B01', type: 'buff', category: 'support', cost: 2, effect: 'next_turn_mp_bonus', value: 2, limit: 'per_turn', tags: ['辅助', '回水晶'], nameTemplates: { default: ['蓄力', '充电', '冥想'] }, descriptionTemplate: '下回合开始时额外恢复2点法力水晶' },
  B02: { id: 'B02', type: 'buff', category: 'support', cost: 4, power: 1.5, effect: 'lifesteal', limit: 'per_turn', tags: ['辅助', '吸血'], nameTemplates: { default: ['吸血', '生命汲取', '噬魂'] }, descriptionTemplate: '造成{power}倍伤害，并恢复等量的生命值' }
};

const CATEGORY_STATS = {
  weapon: { atkMin: 25, atkMax: 40, hpMin: 60, hpMax: 90, role: '物理输出' },
  tool: { atkMin: 20, atkMax: 35, hpMin: 70, hpMax: 100, role: '物理输出' },
  furniture: { atkMin: 5, atkMax: 15, hpMin: 120, hpMax: 180, role: '坦克' },
  building: { atkMin: 5, atkMax: 20, hpMin: 150, hpMax: 220, role: '坦克' },
  animal: { atkMin: 15, atkMax: 30, hpMin: 80, hpMax: 120, role: '物理输出' },
  food: { atkMin: 5, atkMax: 15, hpMin: 60, hpMax: 90, role: '辅助' },
  plant: { atkMin: 5, atkMax: 20, hpMin: 70, hpMax: 100, role: '辅助' },
  electronics: { atkMin: 15, atkMax: 35, hpMin: 60, hpMax: 90, role: '魔法输出' },
  vehicle: { atkMin: 15, atkMax: 30, hpMin: 100, hpMax: 150, role: '坦克' },
  default: { atkMin: 10, atkMax: 25, hpMin: 80, hpMax: 120, role: '物理输出' }
};

const SIZE_COST_PREFERENCE = {
  tiny: { preferred: ['low'], allowed: ['low'], maxTotalCost: 2 },
  small: { preferred: ['low', 'medium'], allowed: ['low', 'medium'], maxTotalCost: 5 },
  medium: { preferred: ['medium'], allowed: ['low', 'medium', 'high'], maxTotalCost: 8 },
  large: { preferred: ['high'], allowed: ['medium', 'high'], maxTotalCost: 12 },
  giant: { preferred: ['high'], allowed: ['high'], maxTotalCost: 16 }
};

function getCostCategory(cost) { if (cost <= 1) return 'low'; if (cost <= 6) return 'medium'; return 'high'; }

function selectSkills(category, size, traits, role) {
  const sizePref = SIZE_COST_PREFERENCE[size] || SIZE_COST_PREFERENCE.medium;
  const allTemplates = Object.values(SKILL_TEMPLATES);
  let candidates = allTemplates.filter(t => {
    const costCat = getCostCategory(t.cost);
    return sizePref.allowed.includes(costCat);
  });
  const scored = candidates.map(template => {
    let score = 0;
    const costCat = getCostCategory(template.cost);
    if (sizePref.preferred.includes(costCat)) score += 3; else if (sizePref.allowed.includes(costCat)) score += 1;
    if (role === '物理输出' && template.type === 'physical') score += 4;
    else if (role === '魔法输出' && template.type === 'magic') score += 4;
    else if (role === '坦克' && template.category === 'defense') score += 4;
    else if (role === '辅助' && template.category === 'support') score += 4;
    if (traits && traits.length > 0) {
      traits.forEach(trait => { if (template.tags.some(tag => tag.includes(trait) || trait.includes(tag))) score += 2; });
    }
    return { template, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const topHalf = scored.slice(0, Math.max(5, Math.floor(scored.length * 0.5)));
  const selected = []; const usedIds = new Set(); let attempts = 0;

  // 阶段1：随机选择，尝试100次
  while (selected.length < 2 && attempts < 100) {
    const randomPick = topHalf[Math.floor(Math.random() * topHalf.length)];
    if (!usedIds.has(randomPick.template.id)) {
      const totalCost = selected.reduce((sum, s) => sum + s.cost, 0) + randomPick.template.cost;
      if (totalCost <= sizePref.maxTotalCost) { selected.push(randomPick.template); usedIds.add(randomPick.template.id); }
    }
    attempts++;
  }

  // 阶段2：如果不够2个，按分数顺序补充，尽量满足费用
  if (selected.length < 2) {
    for (const item of scored) {
      if (selected.length >= 2) break;
      if (usedIds.has(item.template.id)) continue;
      const totalCost = selected.reduce((sum, s) => sum + s.cost, 0) + item.template.cost;
      if (totalCost <= sizePref.maxTotalCost) {
        selected.push(item.template);
        usedIds.add(item.template.id);
      }
    }
  }

  // 阶段3：如果连费用限制都满足不了2个，强行按分数选前2个（忽略费用）
  if (selected.length < 2) {
    for (const item of scored) {
      if (selected.length >= 2) break;
      if (usedIds.has(item.template.id)) continue;
      selected.push(item.template);
      usedIds.add(item.template.id);
    }
  }

  return selected;
}

function generateSkillName(template, category) {
  const names = template.nameTemplates[category] || template.nameTemplates.default;
  if (!names || names.length === 0) return template.id;
  return names[Math.floor(Math.random() * names.length)];
}

function generateSkillDescription(template) {
  let desc = template.descriptionTemplate;
  if (template.power) desc = desc.replace('{power}', template.power);
  return desc;
}

function generateFullSkill(template, category) {
  return {
    id: template.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    templateId: template.id, name: generateSkillName(template, category),
    type: template.type, category: template.category, subtype: template.subtype || null,
    cost: template.cost, power: template.power || 0, effect: template.effect || null,
    value: template.value || 0, chance: template.chance || 1, limit: template.limit,
    clear_one_debuff: template.clear_one_debuff || false,
    description: generateSkillDescription(template), tags: template.tags, usedThisGame: false
  };
}

module.exports = { SKILL_TEMPLATES, CATEGORY_STATS, SIZE_COST_PREFERENCE, selectSkills, generateFullSkill, getCostCategory };
