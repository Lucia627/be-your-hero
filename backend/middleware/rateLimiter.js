const config = require('../config');

const requestCounts = new Map();

// 定期清理过期记录，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  const windowStart = now - config.rateLimit.windowMs;
  for (const [ip, timestamps] of requestCounts.entries()) {
    const filtered = timestamps.filter(t => t > windowStart);
    if (filtered.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, filtered);
    }
  }
}, config.rateLimit.windowMs);

function rateLimiter(req, res, next) {
  if (!config.rateLimit.enabled) return next();

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - config.rateLimit.windowMs;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip).filter(t => t > windowStart);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  res.setHeader('X-RateLimit-Limit', config.rateLimit.maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.rateLimit.maxRequests - timestamps.length));

  if (timestamps.length > config.rateLimit.maxRequests) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  next();
}

module.exports = rateLimiter;
