const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { get, run } = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || 'be-your-hero-dev-secret-change-in-production';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function findOrCreateUser(nickname) {
  if (!nickname || typeof nickname !== 'string') {
    throw new Error('昵称不能为空');
  }
  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > 20) {
    throw new Error('昵称长度必须在 1-20 字符之间');
  }

  let user = await get('SELECT * FROM users WHERE nickname = ?', [trimmed]);
  if (user) {
    // 已存在，生成新 token
    const token = generateToken(user.id);
    await run('UPDATE users SET token = ? WHERE id = ?', [token, user.id]);
    return { id: user.id, nickname: user.nickname, token, isNew: false };
  }

  // 创建新用户
  const id = uuidv4();
  const token = generateToken(id);
  await run('INSERT INTO users (id, nickname, token) VALUES (?, ?, ?)', [id, trimmed, token]);
  return { id, nickname: trimmed, token, isNew: true };
}

async function getUserById(userId) {
  return get('SELECT id, nickname, created_at FROM users WHERE id = ?', [userId]);
}

async function getUserByToken(token) {
  const payload = verifyToken(token);
  if (!payload) return null;
  return getUserById(payload.userId);
}

module.exports = {
  generateToken,
  verifyToken,
  findOrCreateUser,
  getUserById,
  getUserByToken
};
