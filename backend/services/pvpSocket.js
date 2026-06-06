const { get, run } = require('../utils/db');
const { getUserByToken } = require('./userService');
const { createPvPBattle, processPvPAction, processPvPDefense, endPvPTurn } = require('./pvpEngine');
const { v4: uuidv4 } = require('uuid');

// 内存中的战斗状态
const battles = new Map(); // battleId -> battleState
const roomToBattle = new Map(); // roomCode -> battleId
const playerSockets = new Map(); // userId -> socketId

function initPvPSocket(io) {
  const pvpNamespace = io.of('/pvp');

  pvpNamespace.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('未提供认证令牌'));
    const user = await getUserByToken(token);
    if (!user) return next(new Error('认证失败'));
    socket.userId = user.id;
    socket.nickname = user.nickname;
    next();
  });

  pvpNamespace.on('connection', (socket) => {
    console.log(`[PvP] ${socket.nickname} (${socket.userId}) connected`);
    playerSockets.set(socket.userId, socket.id);

    // 加入房间
    socket.on('join_room', async ({ roomCode }) => {
      const room = await get('SELECT * FROM pvp_rooms WHERE room_code = ?', [roomCode]);
      if (!room) {
        return socket.emit('error_msg', { message: '房间不存在' });
      }
      if (room.host_id !== socket.userId && room.guest_id !== socket.userId) {
        return socket.emit('error_msg', { message: '你没有加入这个房间' });
      }

      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.isHost = room.host_id === socket.userId;

      // 通知房间内所有人
      const host = await get('SELECT id, nickname FROM users WHERE id = ?', [room.host_id]);
      const guest = room.guest_id ? await get('SELECT id, nickname FROM users WHERE id = ?', [room.guest_id]) : null;

      pvpNamespace.to(roomCode).emit('room_update', {
        roomCode,
        status: room.status,
        host: { id: host.id, nickname: host.nickname, teamSet: !!room.host_team_json },
        guest: guest ? { id: guest.id, nickname: guest.nickname, teamSet: !!room.guest_team_json } : null,
        youAreHost: room.host_id === socket.userId
      });

      // 如果战斗正在进行，发送当前状态
      const battleId = roomToBattle.get(roomCode);
      if (battleId && battles.has(battleId)) {
        const battle = battles.get(battleId);
        socket.emit('battle_state', sanitizeBattleForPlayer(battle, socket.userId));
      }
    });

    // 设置队伍
    socket.on('set_team', async ({ team }) => {
      if (!socket.roomCode) return;
      const room = await get('SELECT * FROM pvp_rooms WHERE room_code = ?', [socket.roomCode]);
      if (!room) return;

      const field = socket.isHost ? 'host_team_json' : 'guest_team_json';
      await run(`UPDATE pvp_rooms SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(team), room.id]);

      // 广播更新
      const host = await get('SELECT id, nickname FROM users WHERE id = ?', [room.host_id]);
      const guest = room.guest_id ? await get('SELECT id, nickname FROM users WHERE id = ?', [room.guest_id]) : null;
      const updatedRoom = await get('SELECT * FROM pvp_rooms WHERE room_code = ?', [socket.roomCode]);

      pvpNamespace.to(socket.roomCode).emit('room_update', {
        roomCode: socket.roomCode,
        status: updatedRoom.status,
        host: { id: host.id, nickname: host.nickname, teamSet: !!updatedRoom.host_team_json },
        guest: guest ? { id: guest.id, nickname: guest.nickname, teamSet: !!updatedRoom.guest_team_json } : null
      });
    });

    // 开始战斗（仅房主，且双方都设置了队伍）
    socket.on('start_battle', async () => {
      if (!socket.roomCode || !socket.isHost) return;
      const room = await get('SELECT * FROM pvp_rooms WHERE room_code = ?', [socket.roomCode]);
      if (!room || !room.host_team_json || !room.guest_team_json) {
        return socket.emit('error_msg', { message: '双方都需要设置队伍' });
      }

      const hostTeam = JSON.parse(room.host_team_json);
      const guestTeam = JSON.parse(room.guest_team_json);
      const hostUser = await get('SELECT id, nickname FROM users WHERE id = ?', [room.host_id]);
      const guestUser = await get('SELECT id, nickname FROM users WHERE id = ?', [room.guest_id]);

      const battle = createPvPBattle(
        hostUser.id, hostUser.nickname, hostTeam,
        guestUser.id, guestUser.nickname, guestTeam
      );

      battles.set(battle.id, battle);
      roomToBattle.set(socket.roomCode, battle.id);

      await run('UPDATE pvp_rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['battling', room.id]);

      // 广播战斗开始
      pvpNamespace.to(socket.roomCode).emit('battle_start', {
        battleId: battle.id,
        firstPlayer: battle.firstPlayer === 'player1' ? hostUser.id : guestUser.id
      });

      // 发送初始状态（分别发给双方，避免视角错乱）
      broadcastBattleState(battle, socket.roomCode);
    });

    // 释放技能
    socket.on('use_skill', ({ skillId, cardId }) => {
      if (!socket.roomCode) return;
      const battleId = roomToBattle.get(socket.roomCode);
      const battle = battles.get(battleId);
      if (!battle || battle.gameEnded) return;

      const activeSide = battle.phase === 'player1' ? battle.player1 : battle.player2;
      if (activeSide.userId !== socket.userId) {
        return socket.emit('error_msg', { message: '不是你的回合' });
      }

      const result = processPvPAction(battle, skillId, cardId);
      if (!result.success) {
        return socket.emit('error_msg', { message: result.error });
      }

      // 广播状态更新
      broadcastBattleState(battle, socket.roomCode);
    });

    // 防御
    socket.on('defend', () => {
      if (!socket.roomCode) return;
      const battleId = roomToBattle.get(socket.roomCode);
      const battle = battles.get(battleId);
      if (!battle || battle.gameEnded) return;

      const activeSide = battle.phase === 'player1' ? battle.player1 : battle.player2;
      if (activeSide.userId !== socket.userId) {
        return socket.emit('error_msg', { message: '不是你的回合' });
      }

      const result = processPvPDefense(battle);
      if (!result.success) {
        return socket.emit('error_msg', { message: result.error });
      }

      broadcastBattleState(battle, socket.roomCode);
    });

    // 结束回合
    socket.on('end_turn', () => {
      if (!socket.roomCode) return;
      const battleId = roomToBattle.get(socket.roomCode);
      const battle = battles.get(battleId);
      if (!battle || battle.gameEnded) return;

      const activeSide = battle.phase === 'player1' ? battle.player1 : battle.player2;
      if (activeSide.userId !== socket.userId) {
        return socket.emit('error_msg', { message: '不是你的回合' });
      }

      endPvPTurn(battle);
      broadcastBattleState(battle, socket.roomCode);

      // 战斗结束处理
      if (battle.gameEnded) {
        handleBattleEnd(battle, socket.roomCode);
      }
    });

    // 投降
    socket.on('surrender', async () => {
      if (!socket.roomCode) return;
      const battleId = roomToBattle.get(socket.roomCode);
      const battle = battles.get(battleId);
      if (!battle || battle.gameEnded) return;

      const p1 = battle.player1;
      const p2 = battle.player2;
      const surrenderSide = p1.userId === socket.userId ? 'player1' : 'player2';
      const winnerSide = surrenderSide === 'player1' ? 'player2' : 'player1';

      battle.gameEnded = true;
      battle.winner = winnerSide;
      battle.battleLog.push(`${surrenderSide === 'player1' ? p1.nickname : p2.nickname} 投降了！`);

      broadcastBattleState(battle, socket.roomCode);
      handleBattleEnd(battle, socket.roomCode);
    });

    // 断开连接
    socket.on('disconnect', async () => {
      console.log(`[PvP] ${socket.nickname} disconnected`);
      playerSockets.delete(socket.userId);
      if (socket.roomCode) {
        pvpNamespace.to(socket.roomCode).emit('player_disconnected', {
          userId: socket.userId,
          nickname: socket.nickname
        });
        // 断线自动判负
        const battleId = roomToBattle.get(socket.roomCode);
        const battle = battleId ? battles.get(battleId) : null;
        if (battle && !battle.gameEnded) {
          const isP1 = battle.player1.userId === socket.userId;
          battle.winner = isP1 ? 'player2' : 'player1';
          battle.gameEnded = true;
          battle.battleLog.push(`${socket.nickname} 断开连接，判负`);
          broadcastBattleState(battle, socket.roomCode);
          await handleBattleEnd(battle, socket.roomCode);
        }
      }
    });
  });
}

// 将战斗状态过滤为只包含对当前玩家可见的信息
function sanitizeBattleForPlayer(battle, viewerUserId) {
  const isPlayer1 = battle.player1.userId === viewerUserId;
  const me = isPlayer1 ? battle.player1 : battle.player2;
  const opponent = isPlayer1 ? battle.player2 : battle.player1;

  return {
    battleId: battle.id,
    turn: battle.turn,
    phase: battle.phase,
    isMyTurn: (battle.phase === 'player1' && isPlayer1) || (battle.phase === 'player2' && !isPlayer1),
    me: {
      userId: me.userId,
      nickname: me.nickname,
      team: me.team,
      teamHp: me.teamHp,
      teamMaxHp: me.teamMaxHp,
      mp: me.mp,
      maxMp: me.maxMp,
      defenseLayers: me.defenseLayers,
      statusEffects: me.statusEffects
    },
    opponent: {
      userId: opponent.userId,
      nickname: opponent.nickname,
      team: opponent.team.map(c => ({
        id: c.id,
        name: c.name,
        isDead: c.isDead,
        isSleeping: c.isSleeping
        // 不暴露对手技能详情，不传输图片
      })),
      teamHp: opponent.teamHp,
      teamMaxHp: opponent.teamMaxHp,
      defenseLayers: opponent.defenseLayers,
      statusEffects: opponent.statusEffects
    },
    battleLog: battle.battleLog,
    gameEnded: battle.gameEnded,
    winner: battle.winner ? (battle.winner === 'player1' ? battle.player1.userId : battle.player2.userId) : null
  };
}

function broadcastBattleState(battle, roomCode) {
  if (!global._pvpIo) return;
  const pvpNamespace = global._pvpIo.of('/pvp');

  const p1SocketId = playerSockets.get(battle.player1.userId);
  const p2SocketId = playerSockets.get(battle.player2.userId);

  if (p1SocketId) {
    pvpNamespace.to(p1SocketId).emit('battle_state', sanitizeBattleForPlayer(battle, battle.player1.userId));
  }
  if (p2SocketId) {
    pvpNamespace.to(p2SocketId).emit('battle_state', sanitizeBattleForPlayer(battle, battle.player2.userId));
  }
}

async function handleBattleEnd(battle, roomCode) {
  if (!global._pvpIo) return;
  const pvpNamespace = global._pvpIo.of('/pvp');

  const winnerId = battle.winner === 'player1' ? battle.player1.userId : battle.player2.userId;
  const loserId = battle.winner === 'player1' ? battle.player2.userId : battle.player1.userId;

  // 保存到历史
  const room = await get('SELECT * FROM pvp_rooms WHERE room_code = ?', [roomCode]);
  if (room) {
    await run('UPDATE pvp_rooms SET status = ?, winner_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['finished', winnerId, room.id]);
    await run('INSERT INTO pvp_history (id, room_id, host_id, guest_id, winner_id, battle_json) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), room.id, room.host_id, room.guest_id, winnerId, JSON.stringify(battle)]);
  }

  pvpNamespace.to(roomCode).emit('battle_end', {
    winnerId,
    loserId,
    battleLog: battle.battleLog
  });

  // 清理内存（延迟，允许查看结果）
  setTimeout(() => {
    battles.delete(battle.id);
    roomToBattle.delete(roomCode);
  }, 300000); // 5分钟后清理
}

module.exports = { initPvPSocket };
