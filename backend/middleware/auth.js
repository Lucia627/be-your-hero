const { getUserByToken } = require('../services/userService');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.headers['x-auth-token'];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌，请先登录' });
  }

  const user = await getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: '认证令牌无效或已过期，请重新登录' });
  }

  req.user = user;
  next();
}

// 可选认证：如果提供了token则解析用户，否则req.user为null
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.headers['x-auth-token'];

  if (token) {
    const user = await getUserByToken(token);
    req.user = user || null;
  } else {
    req.user = null;
  }
  next();
}

module.exports = { authMiddleware, optionalAuth };
