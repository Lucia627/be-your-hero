const { v4: uuidv4 } = require('uuid');

const BUFF_POOL = {
  common: [
    { id: 'dmg_up_10', name: '攻击力提升', description: '全队伤害+10%', effect: { type: 'damage_up', value: 0.10 } },
    { id: 'hp_up_10', name: '生命值提升', description: '全队最大HP+10%', effect: { type: 'hp_up', value: 0.10 } },
    { id: 'init_mp_1', name: '初始水晶', description: '战斗开始时额外+1水晶', effect: { type: 'initial_mp_bonus', value: 1 } },
    { id: 'mp_regen_1', name: '水晶恢复', description: '每回合额外恢复1水晶', effect: { type: 'mp_regen_up', value: 1 } },
    { id: 'def_eff_5', name: '防御精通', description: '每层防御额外+5%减伤', effect: { type: 'defense_efficiency', value: 0.05 } }
  ],
  rare: [
    { id: 'dmg_up_20', name: '强力攻击', description: '全队伤害+20%', effect: { type: 'damage_up', value: 0.20 } },
    { id: 'hp_up_20', name: '坚韧生命', description: '全队最大HP+20%', effect: { type: 'hp_up', value: 0.20 } },
    { id: 'init_mp_2', name: '水晶充能', description: '战斗开始时额外+2水晶', effect: { type: 'initial_mp_bonus', value: 2 } },
    { id: 'poison_up', name: '剧毒强化', description: '毒伤害+50%', effect: { type: 'poison_damage_up', value: 0.50 } },
    { id: 'lifesteal_10', name: '生命偷取', description: '造成伤害的10%转化为生命恢复', effect: { type: 'lifesteal', value: 0.10 } }
  ],
  legendary: [
    { id: 'dmg_up_35', name: '毁灭之力', description: '全队伤害+35%', effect: { type: 'damage_up', value: 0.35 } },
    { id: 'hp_up_35', name: '不朽之身', description: '全队最大HP+35%', effect: { type: 'hp_up', value: 0.35 } },
    { id: 'extra_life', name: '复活重生', description: 'HP归零时恢复50%HP（一次）', effect: { type: 'extra_life', value: 0.50 } },
    { id: 'skill_reset', name: '技能重置', description: '整局限1次的技能使用次数+1', effect: { type: 'skill_reset', value: 1 } }
  ],
  curse: [
    { id: 'curse_dmg_25', name: '狂暴诅咒', description: '伤害+25%，但受到伤害+15%', effect: { type: 'damage_up', value: 0.25, curse: { type: 'damage_taken_up', value: 0.15 } } },
    { id: 'curse_hp_dmg', name: '血祭', description: '伤害+30%，但最大HP-20%', effect: { type: 'damage_up', value: 0.30, curse: { type: 'hp_down', value: 0.20 } } }
  ]
};

function generateBuffChoices() {
  const choices = []; const rarities = [];
  for (let i = 0; i < 3; i++) {
    const roll = Math.random();
    if (roll < 0.05) rarities.push('legendary');
    else if (roll < 0.30) rarities.push('rare');
    else rarities.push('common');
  }
  if (Math.random() < 0.20) { const replaceIdx = Math.floor(Math.random() * 3); rarities[replaceIdx] = 'curse'; }
  for (let i = 0; i < 3; i++) {
    const pool = BUFF_POOL[rarities[i]];
    const buff = pool[Math.floor(Math.random() * pool.length)];
    choices.push({ ...buff, rarity: rarities[i], choiceId: uuidv4() });
  }
  return choices;
}

function createBattleState(playerTeam, boss, buffs = []) {
  const teamAtk = playerTeam.reduce((sum, card) => sum + card.atk, 0);
  const teamMaxHp = playerTeam.reduce((sum, card) => sum + card.maxHp, 0);
  let hpMultiplier = 1 + buffs.filter(b => b.effect.type === 'hp_up').reduce((sum, b) => sum + b.effect.value, 0);
  // 应用血祭诅咒：最大HP-20%（可叠加，最低保留10%）
  const hpDownCurses = buffs.filter(b => b.effect.curse?.type === 'hp_down');
  if (hpDownCurses.length > 0) {
    const hpDownMultiplier = 1 - hpDownCurses.reduce((sum, b) => sum + b.effect.curse.value, 0);
    hpMultiplier *= Math.max(0.1, hpDownMultiplier);
  }
  const finalMaxHp = Math.round(teamMaxHp * hpMultiplier);
  const finalAtk = Math.round(teamAtk * (1 + buffs.filter(b => b.effect.type === 'damage_up').reduce((sum, b) => sum + b.effect.value, 0)));
  const initialMpBonus = buffs.filter(b => b.effect.type === 'initial_mp_bonus').reduce((sum, b) => sum + b.effect.value, 0);
  // 战斗状态不携带 base64 图片，避免前后端传输巨大 JSON
  const stripImages = (obj) => { const { image, sourceImage, ...rest } = obj; return rest; };
  // 深拷贝并重置技能使用状态，避免上一场战斗的 usedThisGame 污染新战斗
  const cloneSkills = (skills) => (skills || []).map(s => ({ ...s, usedThisGame: false }));
  return {
    id: uuidv4(), turn: 1, phase: 'player',
    playerTeam: playerTeam.map(c => ({ ...stripImages(c), currentHp: c.hp, isSleeping: false, sleepTurns: 0, isDead: false, skills: cloneSkills(c.skills) })),
    boss: { ...stripImages(boss), currentHp: boss.hp, maxHp: boss.hp, statusEffects: [], isSleeping: false, sleepTurns: 0 },
    teamHp: finalMaxHp, teamMaxHp: finalMaxHp, teamAtk: finalAtk,
    mp: 2 + initialMpBonus, maxMp: 10,
    mpRegen: 2 + buffs.filter(b => b.effect.type === 'mp_regen_up').reduce((sum, b) => sum + b.effect.value, 0),
    defenseLayers: 0,
    defenseEfficiency: 0.20 + buffs.filter(b => b.effect.type === 'defense_efficiency').reduce((sum, b) => sum + b.effect.value, 0),
    buffs, statusEffects: [], battleLog: ['战斗开始！'], skillsUsedThisTurn: [], gameEnded: false, winner: null
  };
}

function processPlayerAction(state, skillId, cardId) {
  if (state.phase !== 'player' || state.gameEnded) return { success: false, error: '不在玩家回合' };
  const card = state.playerTeam.find(c => c.id === cardId);
  if (!card || card.isDead || card.isSleeping) return { success: false, error: '该角色无法行动' };
  const skill = card.skills.find(s => s.id === skillId);
  if (!skill) return { success: false, error: '技能不存在' };
  if (state.skillsUsedThisTurn.includes(skillId)) return { success: false, error: '该技能本回合已使用' };
  if (skill.limit === 'per_game' && skill.usedThisGame) return { success: false, error: '该技能整局已使用' };
  if (state.mp < skill.cost) return { success: false, error: '法力水晶不足' };
  state.mp -= skill.cost;
  state.skillsUsedThisTurn.push(skillId);
  if (skill.limit === 'per_game') skill.usedThisGame = true;
  const result = applySkillEffect(state, skill, card, 'player');
  if (state.boss.currentHp <= 0) {
    state.boss.currentHp = 0; state.gameEnded = true; state.winner = 'player';
    state.battleLog.push(`${state.boss.name} 被击败了！`);
  }
  return { success: true, result, state };
}

function applySkillEffect(state, skill, source, side) {
  const logs = [];
  let actualDamage = 0;
  if (skill.power > 0) {
    let damage = Math.round(state.teamAtk * skill.power);
    // teamAtk 已在 createBattleState 中计入 damage_up 增益，此处不再重复乘算
    damage = Math.round(damage * (0.8 + Math.random() * 0.4));
    actualDamage = damage;
    if (side === 'boss') {
      if (state.invincibleThisTurn) {
        actualDamage = 0;
        logs.push('绝对防御生效，免疫了所有伤害！');
        state.invincibleThisTurn = false;
      } else {
        if (state.halfDamageNext) {
          actualDamage = Math.round(actualDamage * 0.5);
          logs.push('闪避姿态生效，伤害减半！');
          state.halfDamageNext = false;
        }
        const reduction = Math.min(state.defenseLayers * state.defenseEfficiency, 0.95);
        const curseTaken = state.buffs.filter(b => b.effect.curse?.type === 'damage_taken_up').reduce((sum, b) => sum + b.effect.curse.value, 0);
        actualDamage = Math.round(actualDamage * (1 - reduction) * (1 + curseTaken));
      }
      state.teamHp = Math.max(0, state.teamHp - actualDamage);
      logs.push(`${source.name} 使用了 ${skill.name}，造成 ${actualDamage} 点伤害！`);
      checkPlayerExtraLife(state, logs);
    } else {
      const bossWeak = state.boss.statusEffects.find(e => e.type === 'weak');
      if (bossWeak) actualDamage = Math.round(actualDamage * 1.2);
      state.boss.currentHp = Math.max(0, state.boss.currentHp - actualDamage);
      logs.push(`${source.name} 使用了 ${skill.name}，对 ${state.boss.name} 造成 ${actualDamage} 点伤害！`);
      if (state.boss.isSleeping && actualDamage > 0) { state.boss.isSleeping = false; state.boss.sleepTurns = 0; logs.push(`${state.boss.name} 从睡眠中苏醒！`); }
    }
    // 吸血效果：技能自带（如B02） + buff叠加
    let lifestealAmount = 0;
    if (skill.effect === 'lifesteal' && side === 'player') {
      lifestealAmount += actualDamage;
    }
    const buffLifesteal = state.buffs.filter(b => b.effect.type === 'lifesteal').reduce((sum, b) => sum + b.effect.value, 0);
    if (buffLifesteal > 0 && side === 'player') {
      lifestealAmount += Math.round(actualDamage * buffLifesteal);
    }
    if (lifestealAmount > 0) {
      state.teamHp = Math.min(state.teamMaxHp, state.teamHp + lifestealAmount);
      logs.push(`生命偷取恢复了 ${lifestealAmount} 点HP！`);
    }
  }
  if (skill.effect === 'heal' && side === 'player') {
    const healAmount = Math.round(state.teamAtk * skill.power);
    state.teamHp = Math.min(state.teamMaxHp, state.teamHp + healAmount);
    logs.push(`${source.name} 使用了 ${skill.name}，恢复了 ${healAmount} 点HP！`);
  }
  if (skill.effect === 'add_defense_layer') {
    state.defenseLayers = Math.min(4, state.defenseLayers + skill.value);
    logs.push(`${source.name} 使用了 ${skill.name}，防御层数提升至 ${state.defenseLayers} 层！`);
  }
  if (skill.effect === 'half_damage_next') { state.halfDamageNext = true; logs.push(`${source.name} 进入闪避姿态，下次受到伤害减半！`); }
  if (skill.effect === 'invincible_one_turn') { state.invincibleThisTurn = true; logs.push(`${source.name} 发动了 ${skill.name}，本回合免疫所有伤害！`); }
  if (skill.effect === 'clear_debuff_and_defend') {
    if (state.statusEffects.length > 0) { const removed = state.statusEffects.shift(); logs.push(`清除了异常状态：${getStatusName(removed.type)}`); }
    state.defenseLayers = Math.min(4, state.defenseLayers + (skill.value || 1));
    logs.push(`防御层数提升至 ${state.defenseLayers} 层！`);
  }
  if (skill.effect && skill.effect.includes('poison')) {
    const chance = skill.chance || 1;
    if (Math.random() < chance) {
      if (side === 'player') {
        applyStatus(state.boss, 'poison', 3);
        logs.push(`${state.boss.name} 中毒了！`);
      } else {
        applyStatus(state, 'poison', 3);
        logs.push(`全队中毒了！`);
      }
    }
  }
  if (skill.effect === 'weak') {
    if (side === 'player') {
      applyStatus(state.boss, 'weak', 2);
      logs.push(`${state.boss.name} 陷入了虚弱状态！`);
    } else {
      applyStatus(state, 'weak', 2);
      logs.push(`全队陷入了虚弱状态！`);
    }
  }
  if (skill.effect === 'fear') {
    if (side === 'player') {
      applyStatus(state.boss, 'fear', 2);
      logs.push(`${state.boss.name} 陷入了恐惧！`);
    } else {
      applyStatus(state, 'fear', 2);
      logs.push(`全队陷入了恐惧！`);
    }
  }
  if (skill.effect && skill.effect.includes('sleep')) {
    const chance = skill.chance || 0.5;
    const actualChance = side === 'player' ? chance * 0.5 : chance;
    if (Math.random() < actualChance) {
      if (side === 'player') { state.boss.isSleeping = true; state.boss.sleepTurns = 2; logs.push(`${state.boss.name} 陷入了睡眠！`); }
      else { const awakeCards = state.playerTeam.filter(c => !c.isSleeping && !c.isDead); if (awakeCards.length > 0) { const target = awakeCards[Math.floor(Math.random() * awakeCards.length)]; target.isSleeping = true; target.sleepTurns = 2; logs.push(`${target.name} 陷入了睡眠！`); } }
    } else logs.push(`睡眠效果被抵抗了！`);
  }
  if (skill.effect === 'next_turn_mp_bonus') { state.nextTurnMpBonus = (state.nextTurnMpBonus || 0) + skill.value; logs.push(`${source.name} 蓄力中，下回合额外恢复 ${skill.value} 水晶！`); }
  if (skill.clear_one_debuff && state.statusEffects.length > 0) { const removed = state.statusEffects.shift(); logs.push(`清除了异常状态：${getStatusName(removed.type)}`); }
  state.battleLog.push(...logs);
  return { damage: actualDamage, logs };
}

function checkPlayerExtraLife(state, logs) {
  if (state.teamHp <= 0) {
    const extraLife = state.buffs.find(b => b.effect.type === 'extra_life');
    if (extraLife) {
      state.teamHp = Math.round(state.teamMaxHp * extraLife.effect.value);
      state.buffs = state.buffs.filter(b => b.id !== extraLife.id);
      logs.push(`复活重生触发！恢复至 ${state.teamHp} HP！`);
    }
  }
}

function applyStatus(target, type, duration) {
  if (!target.statusEffects) target.statusEffects = [];
  target.statusEffects = target.statusEffects.filter(e => e.type !== type);
  target.statusEffects.push({ type, duration, maxDuration: duration });
}

function getStatusName(type) { const names = { poison: '毒', weak: '虚弱', fear: '恐惧', sleep: '睡眠' }; return names[type] || type; }

function endPlayerTurn(state) {
  if (state.gameEnded) return state;
  state.phase = 'boss';
  state.skillsUsedThisTurn = [];
  // 处理 Boss 异常状态（毒/虚弱/恐惧）的回合衰减
  processStatusEffects(state, 'boss');
  // Boss 中毒伤害结算
  const bossPoison = state.boss.statusEffects.find(e => e.type === 'poison');
  if (bossPoison) {
    let poisonDmg = Math.max(1, Math.round(state.boss.maxHp * 0.05));
    const poisonUp = state.buffs.find(b => b.effect.type === 'poison_damage_up');
    if (poisonUp) poisonDmg = Math.round(poisonDmg * (1 + poisonUp.effect.value));
    state.boss.currentHp = Math.max(0, state.boss.currentHp - poisonDmg);
    state.battleLog.push(`${state.boss.name} 受到 ${poisonDmg} 点中毒伤害！`);
    if (state.boss.currentHp <= 0) {
      state.boss.currentHp = 0;
      state.gameEnded = true;
      state.winner = 'player';
      state.battleLog.push(`${state.boss.name} 被毒击败了！`);
    }
  }
  // 玩家方睡眠回合在玩家回合结束时衰减（避免 Boss 施加当回合就扣减）
  state.playerTeam.forEach(card => {
    if (card.isSleeping) {
      card.sleepTurns--;
      if (card.sleepTurns <= 0) {
        card.isSleeping = false;
        state.battleLog.push(`${card.name} 从睡眠中醒来了！`);
      }
    }
  });
  return state;
}

function processBossTurn(state) {
  if (state.gameEnded) return state;

  if (!state.boss.isSleeping) {
    // Boss 正常行动
    const numSkills = Math.min(state.boss.skills.length, 1 + Math.floor(Math.random() * Math.min(2, state.boss.bossRound || 1)));
    const availableSkills = state.boss.skills.filter(s => !s.usedThisGame || s.limit !== 'per_game');
    for (let i = 0; i < numSkills && i < availableSkills.length; i++) {
      const skill = availableSkills[i];
      const bossFear = state.boss.statusEffects.find(e => e.type === 'fear');
      if (bossFear && Math.random() < 0.5) { state.battleLog.push(`${state.boss.name} 因恐惧而跳过了一个技能！`); continue; }
      applySkillEffect(state, skill, state.boss, 'boss');
      if (skill.limit === 'per_game') skill.usedThisGame = true;
      if (state.teamHp <= 0) {
        state.teamHp = 0;
        checkPlayerExtraLife(state, state.battleLog);
        if (state.teamHp <= 0) {
          state.gameEnded = true;
          state.winner = 'boss';
          state.battleLog.push('全队阵亡，战斗失败...');
          break;
        }
      }
    }
  } else {
    // Boss 睡眠中：仅衰减睡眠回合，不攻击
    state.boss.sleepTurns--;
    if (state.boss.sleepTurns <= 0) {
      state.boss.isSleeping = false;
      state.battleLog.push(`${state.boss.name} 从睡眠中醒来了！`);
    } else {
      state.battleLog.push(`${state.boss.name} 正在睡眠中...`);
    }
  }

  // 玩家方异常状态（毒/虚弱/恐惧）回合衰减
  processStatusEffects(state, 'player');
  // 玩家中毒伤害结算
  const poisonEffect = state.statusEffects.find(e => e.type === 'poison');
  if (poisonEffect) {
    let poisonDmg = Math.max(1, Math.round(state.teamMaxHp * 0.05));
    state.teamHp = Math.max(0, state.teamHp - poisonDmg);
    state.battleLog.push(`中毒造成 ${poisonDmg} 点伤害！`);
    // 中毒致死时触发复活
    checkPlayerExtraLife(state, state.battleLog);
  }
  if (state.teamHp <= 0) {
    state.teamHp = 0;
    state.gameEnded = true;
    state.winner = 'boss';
    state.battleLog.push('全队阵亡，战斗失败...');
  }

  if (!state.gameEnded) {
    state.phase = 'player';
    state.turn++;
    const mpBonus = state.nextTurnMpBonus || 0;
    state.mp = Math.min(state.maxMp, state.mp + state.mpRegen + mpBonus);
    if (mpBonus > 0) {
      state.battleLog.push(`蓄力生效，额外恢复 ${mpBonus} 水晶！`);
      state.nextTurnMpBonus = 0;
    }
    state.battleLog.push(`第 ${state.turn} 回合开始，恢复 ${state.mpRegen} 水晶！`);
  }
  return state;
}

function processStatusEffects(state, side) {
  const effects = side === 'boss' ? state.boss.statusEffects : state.statusEffects;
  if (!effects) return;
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].duration--;
    if (effects[i].duration <= 0) { const removed = effects.splice(i, 1)[0]; state.battleLog.push(`${getStatusName(removed.type)} 效果解除了！`); }
  }
}

function applyBuff(state, buff) { state.buffs.push(buff); }

module.exports = { BUFF_POOL, generateBuffChoices, createBattleState, processPlayerAction, endPlayerTurn, processBossTurn, applyBuff };
