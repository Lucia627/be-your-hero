const { v4: uuidv4 } = require('uuid');

// 创建 PvP 战斗状态
function createPvPBattle(player1Id, player1Nickname, team1, player2Id, player2Nickname, team2) {
  const cloneSkills = (skills) => (skills || []).map(s => ({ ...s, usedThisGame: false }));
  // 剥离 base64 图片，避免 Socket 传输巨大数据
  const stripImages = (obj) => { const { image, sourceImage, ...rest } = obj; return rest; };

  const p1Team = team1.map(c => ({ ...stripImages(c), currentHp: c.hp || c.maxHp, isSleeping: false, sleepTurns: 0, isDead: false, skills: cloneSkills(c.skills) }));
  const p2Team = team2.map(c => ({ ...stripImages(c), currentHp: c.hp || c.maxHp, isSleeping: false, sleepTurns: 0, isDead: false, skills: cloneSkills(c.skills) }));

  const p1Atk = team1.reduce((sum, c) => sum + (c.atk || 0), 0);
  const p1MaxHp = team1.reduce((sum, c) => sum + (c.maxHp || c.hp || 0), 0);
  const p2Atk = team2.reduce((sum, c) => sum + (c.atk || 0), 0);
  const p2MaxHp = team2.reduce((sum, c) => sum + (c.maxHp || c.hp || 0), 0);

  // 随机先后手
  const firstPlayer = Math.random() < 0.5 ? 'player1' : 'player2';

  return {
    id: uuidv4(),
    turn: 1,
    phase: firstPlayer,
    firstPlayer,
    player1: {
      userId: player1Id,
      nickname: player1Nickname,
      team: p1Team,
      teamHp: p1MaxHp,
      teamMaxHp: p1MaxHp,
      teamAtk: p1Atk,
      mp: 2,
      maxMp: 10,
      mpRegen: 2,
      defenseLayers: 0,
      defenseEfficiency: 0.20,
      statusEffects: [],
      skillsUsedThisTurn: [],
      buffs: [],
      battleLog: []
    },
    player2: {
      userId: player2Id,
      nickname: player2Nickname,
      team: p2Team,
      teamHp: p2MaxHp,
      teamMaxHp: p2MaxHp,
      teamAtk: p2Atk,
      mp: 2,
      maxMp: 10,
      mpRegen: 2,
      defenseLayers: 0,
      defenseEfficiency: 0.20,
      statusEffects: [],
      skillsUsedThisTurn: [],
      buffs: [],
      battleLog: []
    },
    battleLog: [`战斗开始！${firstPlayer === 'player1' ? player1Nickname : player2Nickname} 获得先手！`],
    gameEnded: false,
    winner: null
  };
}

// 获取当前行动方
function getActiveSide(state) {
  return state.phase === 'player1' ? state.player1 : state.player2;
}

function getTargetSide(state) {
  return state.phase === 'player1' ? state.player2 : state.player1;
}

// 处理 PvP 玩家行动
function processPvPAction(state, skillId, cardId) {
  if (state.gameEnded) return { success: false, error: '战斗已结束' };

  const active = getActiveSide(state);
  const target = getTargetSide(state);

  const card = active.team.find(c => c.id === cardId);
  if (!card || card.isDead || card.isSleeping) return { success: false, error: '该角色无法行动' };

  const skill = card.skills.find(s => s.id === skillId);
  if (!skill) return { success: false, error: '技能不存在' };
  if (active.skillsUsedThisTurn.includes(skillId)) return { success: false, error: '该技能本回合已使用' };
  if (skill.limit === 'per_game' && skill.usedThisGame) return { success: false, error: '该技能整局已使用' };
  if (active.mp < skill.cost) return { success: false, error: '法力水晶不足' };

  active.mp -= skill.cost;
  active.skillsUsedThisTurn.push(skillId);
  if (skill.limit === 'per_game') skill.usedThisGame = true;

  const result = applyPvPSkill(active, target, skill, card, state);

  // 检查胜负
  if (target.teamHp <= 0) {
    target.teamHp = 0;
    state.gameEnded = true;
    state.winner = state.phase;
    state.battleLog.push(`${target.nickname} 的队伍被全灭了！${active.nickname} 获胜！`);
  }

  return { success: true, result, state };
}

// 处理 PvP 防御
function processPvPDefense(state) {
  if (state.gameEnded) return { success: false, error: '战斗已结束' };
  const active = getActiveSide(state);
  if (active.mp < 1) return { success: false, error: '法力水晶不足' };
  if (active.defenseLayers >= 4) return { success: false, error: '防御层数已达上限' };

  active.mp -= 1;
  active.defenseLayers += 1;
  const msg = `${active.nickname} 获得了1层防御！当前 ${active.defenseLayers} 层`;
  active.battleLog.push(msg);
  state.battleLog.push(msg);
  return { success: true, state };
}

// 结束当前玩家回合
function endPvPTurn(state) {
  if (state.gameEnded) return state;

  const active = getActiveSide(state);
  const target = getTargetSide(state);

  active.skillsUsedThisTurn = [];

  // 当前方异常状态衰减
  processStatusEffects(active, state);

  // 当前方睡眠衰减
  active.team.forEach(card => {
    if (card.isSleeping) {
      card.sleepTurns--;
      if (card.sleepTurns <= 0) {
        card.isSleeping = false;
        const msg = `${card.name} 从睡眠中醒来了！`;
        state.battleLog.push(msg);
      }
    }
  });

  // 切换回合
  state.phase = state.phase === 'player1' ? 'player2' : 'player1';
  const nextActive = getActiveSide(state);

  // 新回合开始：恢复MP
  state.turn++;
  nextActive.mp = Math.min(nextActive.maxMp, nextActive.mp + nextActive.mpRegen);

  const msg = `第 ${state.turn} 回合，轮到 ${nextActive.nickname} 行动！恢复 ${nextActive.mpRegen} 水晶`;
  state.battleLog.push(msg);

  return state;
}

function applyPvPSkill(active, target, skill, card, state) {
  let actualDamage = 0;
  const logs = [];

  if (skill.power > 0) {
    let damage = Math.round(active.teamAtk * skill.power);
    damage = Math.round(damage * (0.8 + Math.random() * 0.4));
    actualDamage = damage;

    // 目标防御减伤
    const reduction = Math.min(target.defenseLayers * target.defenseEfficiency, 0.95);
    actualDamage = Math.round(actualDamage * (1 - reduction));

    // 目标虚弱状态（受到伤害+20%）
    const targetWeak = target.statusEffects.find(e => e.type === 'weak');
    if (targetWeak) actualDamage = Math.round(actualDamage * 1.2);

    target.teamHp = Math.max(0, target.teamHp - actualDamage);
    logs.push(`${card.name} 对 ${target.nickname} 的队伍造成 ${actualDamage} 点伤害！`);

    // 伤害唤醒睡眠
    if (target.team.find(c => c.isSleeping)) {
      target.team.forEach(c => { c.isSleeping = false; c.sleepTurns = 0; });
      logs.push(`${target.nickname} 的队伍从睡眠中惊醒了！`);
    }

    // 吸血
    if (skill.effect === 'lifesteal') {
      const heal = Math.round(actualDamage);
      active.teamHp = Math.min(active.teamMaxHp, active.teamHp + heal);
      logs.push(`生命偷取恢复了 ${heal} HP！`);
    }
  }

  // 治疗
  if (skill.effect === 'heal') {
    const healAmount = Math.round(active.teamAtk * 0.3);
    active.teamHp = Math.min(active.teamMaxHp, active.teamHp + healAmount);
    logs.push(`${card.name} 恢复了 ${healAmount} HP！`);
  }

  // 防御层
  if (skill.effect === 'add_defense_layer') {
    active.defenseLayers = Math.min(4, active.defenseLayers + 1);
    logs.push(`${card.name} 获得防御！当前 ${active.defenseLayers} 层`);
  }

  // 异常状态施加
  if (skill.effect && skill.effect.includes('poison')) {
    applyStatus(target, 'poison', 3);
    logs.push(`${target.nickname} 的队伍中毒了！`);
  }
  if (skill.effect === 'weak') {
    applyStatus(target, 'weak', 2);
    logs.push(`${target.nickname} 的队伍陷入了虚弱！`);
  }
  if (skill.effect === 'fear') {
    applyStatus(target, 'fear', 2);
    logs.push(`${target.nickname} 的队伍陷入了恐惧！`);
  }
  if (skill.effect && skill.effect.includes('sleep')) {
    const awakeCards = target.team.filter(c => !c.isSleeping && !c.isDead);
    if (awakeCards.length > 0) {
      const t = awakeCards[Math.floor(Math.random() * awakeCards.length)];
      t.isSleeping = true;
      t.sleepTurns = 2;
      logs.push(`${t.name} 陷入了睡眠！`);
    }
  }

  state.battleLog.push(...logs);
  return { damage: actualDamage, logs };
}

function processStatusEffects(side, state) {
  if (!side.statusEffects) return;
  for (let i = side.statusEffects.length - 1; i >= 0; i--) {
    side.statusEffects[i].duration--;
    if (side.statusEffects[i].duration <= 0) {
      const removed = side.statusEffects.splice(i, 1)[0];
      state.battleLog.push(`${side.nickname} 的 ${getStatusName(removed.type)} 效果解除了！`);
    }
  }

  // 中毒伤害结算（回合结束时）
  const poison = side.statusEffects.find(e => e.type === 'poison');
  if (poison) {
    const dmg = Math.max(1, Math.round(side.teamMaxHp * 0.05));
    side.teamHp = Math.max(0, side.teamHp - dmg);
    state.battleLog.push(`${side.nickname} 受到 ${dmg} 点中毒伤害！`);
  }
}

function applyStatus(target, type, duration) {
  if (!target.statusEffects) target.statusEffects = [];
  target.statusEffects = target.statusEffects.filter(e => e.type !== type);
  target.statusEffects.push({ type, duration, maxDuration: duration });
}

function getStatusName(type) {
  const names = { poison: '毒', weak: '虚弱', fear: '恐惧', sleep: '睡眠' };
  return names[type] || type;
}

module.exports = {
  createPvPBattle,
  processPvPAction,
  processPvPDefense,
  endPvPTurn,
  getActiveSide,
  getTargetSide
};
