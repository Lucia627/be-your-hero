const express = require('express');
const { run, get, all } = require('../utils/db');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(authMiddleware);

// 生成6位房间号
function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /pvp/room/create - 创建房间
router.post('/room/create', async (req, res, next) => {
  try {
    const user = req.user;
    // 检查是否已在房间中
    const existingHost = await get('SELECT * FROM pvp_rooms WHERE host_id = ? AND status IN (?, ?)', [user.id, 'waiting', 'ready']);
    if (existingHost) {
      return res.json({ success: true, roomCode: existingHost.room_code, isHost: true });
    }
    const existingGuest = await get('SELECT * FROM pvp_rooms WHERE guest_id = ? AND status IN (?, ?)', [user.id, 'waiting', 'ready']);
    if (existingGuest) {
      return res.json({ success: true, roomCode: existingGuest.room_code, isHost: false });
    }

    let code = generateRoomCode();
    let exists = await get('SELECT id FROM pvp_rooms WHERE room_code = ?', [code]);
    while (exists) {
      code = generateRoomCode();
      exists = await get('SELECT id FROM pvp_rooms WHERE room_code = ?', [code]);
    }

    await run('INSERT INTO pvp_rooms (id, room_code, host_id, status) VALUES (?, ?, ?, ?)',
      [uuidv4(), code, user.id, 'waiting']);

    res.json({ success: true, roomCode: code, isHost: true });
  } catch (error) {
    next(error);
  }
});

// POST /pvp/room/join - 加入房间
router.post('/room/join', async (req, res, next) => {
  try {
    const { roomCode } = req.body;
    const user = req.user;

    if (!roomCode || !/^\d{6}$/.test(roomCode)) {
      return res.status(400).json({ error: '房间号必须是6位数字' });
    }

    const room = await get('SELECT * FROM pvp_rooms WHERE room_code = ?', [roomCode]);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }
    if (room.status !== 'waiting' && room.status !== 'ready') {
      return res.status(400).json({ error: '房间已开始或已结束' });
    }
    if (room.host_id === user.id) {
      return res.json({ success: true, roomCode, isHost: true });
    }
    if (room.guest_id && room.guest_id !== user.id) {
      return res.status(400).json({ error: '房间已满' });
    }

    if (!room.guest_id) {
      await run('UPDATE pvp_rooms SET guest_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id, 'ready', room.id]);
    }

    res.json({ success: true, roomCode, isHost: false });
  } catch (error) {
    next(error);
  }
});

// GET /pvp/room/:code - 获取房间信息
router.get('/room/:code', async (req, res, next) => {
  try {
    const room = await get('SELECT * FROM pvp_rooms WHERE room_code = ?', [req.params.code]);
    if (!room) return res.status(404).json({ error: '房间不存在' });

    const host = await get('SELECT id, nickname FROM users WHERE id = ?', [room.host_id]);
    const guest = room.guest_id ? await get('SELECT id, nickname FROM users WHERE id = ?', [room.guest_id]) : null;

    res.json({
      roomCode: room.room_code,
      status: room.status,
      host: host ? { id: host.id, nickname: host.nickname, teamSet: !!room.host_team_json } : null,
      guest: guest ? { id: guest.id, nickname: guest.nickname, teamSet: !!room.guest_team_json } : null,
      winnerId: room.winner_id
    });
  } catch (error) {
    next(error);
  }
});

// POST /pvp/room/:code/leave - 离开房间
router.post('/room/:code/leave', async (req, res, next) => {
  try {
    const room = await get('SELECT * FROM pvp_rooms WHERE room_code = ?', [req.params.code]);
    if (!room) return res.status(404).json({ error: '房间不存在' });

    const userId = req.user.id;
    if (room.host_id === userId) {
      // 房主离开，解散房间
      await run('DELETE FROM pvp_rooms WHERE id = ?', [room.id]);
    } else if (room.guest_id === userId) {
      await run('UPDATE pvp_rooms SET guest_id = NULL, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['waiting', room.id]);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
