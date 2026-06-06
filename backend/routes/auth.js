const express = require('express');
const { findOrCreateUser } = require('../services/userService');

const router = express.Router();

// POST /login - 简易登录（仅昵称）
router.post('/login', async (req, res, next) => {
  try {
    const { nickname } = req.body;
    const user = await findOrCreateUser(nickname);
    res.json({
      success: true,
      user: {
        id: user.id,
        nickname: user.nickname,
        token: user.token,
        isNew: user.isNew
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /me - 获取当前用户信息
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({ error: '未登录' });
    }

    const { getUserByToken } = require('../services/userService');
    const user = await getUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: '登录已过期' });
    }

    res.json({ id: user.id, nickname: user.nickname });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
