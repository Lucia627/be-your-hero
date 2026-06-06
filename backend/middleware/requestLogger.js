const config = require('../config');

function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function(chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection.remoteAddress;

    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    const message = `[${level}] ${method} ${url} ${status} - ${duration}ms - ${ip}`;

    if (status >= 500) {
      console.error(message);
    } else if (status >= 400) {
      console.warn(message);
    } else if (config.isDev) {
      console.log(message);
    }
  };

  next();
}

module.exports = requestLogger;
