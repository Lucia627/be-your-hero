require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createServer } = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const compression = require('compression');

const analyzeRoutes = require('./routes/analyze');
const cardRoutes = require('./routes/cards');
const gameRoutes = require('./routes/game');
const authRoutes = require('./routes/auth');
const pvpRoutes = require('./routes/pvp');
const rateLimiter = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const { initPvPSocket } = require('./services/pvpSocket');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  transports: ['websocket'], // Cluster 模式下禁用 long-polling，避免 sticky session 问题
  cors: {
    origin: config.isDev ? true : config.cors.origins,
    credentials: true
  }
});

// Expose io for other modules
app.set('io', io);

const PORT = config.port;

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 5000);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Security & logging middleware
app.use(rateLimiter);
app.use(requestLogger);

// Gzip compression for responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6 // balance between speed and compression
}));

// Body parsing (increased limit for concurrent photo uploads)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// CORS
const corsOptions = config.isDev
  ? { origin: true, credentials: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','x-auth-token'] }
  : {
      origin: config.cors.origins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
    };
app.use(cors(corsOptions));

// Static files from frontend (with caching for performance)
const frontendPath = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath, {
    maxAge: '1d', // Cache static assets for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Longer cache for images and assets
      if (path.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      }
    }
  }));
}

// Health check (must be before authenticated routes)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.1.0', features: ['auth', 'pvp'] });
});

// API routes - v1
app.use('/api/v1', authRoutes);
app.use('/api/v1', analyzeRoutes);
app.use('/api/v1', cardRoutes);
app.use('/api/v1', gameRoutes);
app.use('/api/v1', pvpRoutes);

// Legacy /api paths
app.use('/api', authRoutes);
app.use('/api', analyzeRoutes);
app.use('/api', cardRoutes);
app.use('/api', gameRoutes);
app.use('/api', pvpRoutes);

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('SPA fallback error:', err);
        res.status(500).send('Error loading application');
      }
    });
  } else {
    res.status(404).json({ error: 'Frontend not found' });
  }
});

// Global error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  const status = err.status || err.statusCode || 500;
  const response = {
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  };
  if (config.isDev) {
    response.stack = err.stack;
    response.detail = err.detail || null;
  }
  res.status(status).json(response);
});

// Initialize PvP WebSocket
global._pvpIo = io;
initPvPSocket(io);

// Startup config check
if (!config.llm.apiKey || config.llm.apiKey === 'your_api_key_here') {
  console.warn('\n[WARNING] LLM_API_KEY not configured. Image analysis will return mock data.');
  console.warn('          Please set LLM_API_KEY in backend/.env to enable real image recognition.\n');
}
if (config.llm.provider === 'mock') {
  console.warn('\n[WARNING] LLM_PROVIDER is set to "mock". Using simulated analysis results.');
  console.warn('          Change LLM_PROVIDER to "openai"/"claude"/"gemini" for real recognition.\n');
}

function getLanIps() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Be Your Hero server running on port ${PORT}`);
  console.log(`Local PC:     http://localhost:${PORT}`);
  const lanIps = getLanIps();
  if (lanIps.length) {
    lanIps.forEach(ip => console.log(`LAN/Mobile:   http://${ip}:${PORT}`));
  }
  console.log(`API base URL: http://localhost:${PORT}/api`);
  console.log(`API v1 URL:   http://localhost:${PORT}/api/v1`);
  console.log(`Socket.IO:    ws://localhost:${PORT}/pvp`);
  console.log(`Environment:  ${config.nodeEnv}`);
  console.log(`Rate limit:   ${config.rateLimit.enabled ? config.rateLimit.maxRequests + ' req/' + config.rateLimit.windowMs + 'ms' : 'disabled'}`);
});

// Server timeout settings for concurrent users
server.timeout = 120000; // 2 minutes
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.on('error', (err) => {
  console.error('Server error event:', err);
});

// Log concurrent connection count periodically (for debugging)
let connectionCount = 0;
server.on('connection', (socket) => {
  connectionCount++;
  socket.on('close', () => { connectionCount--; });
});
setInterval(() => {
  if (connectionCount > 0) {
    console.log(`[Connections] Active: ${connectionCount}`);
  }
}, 30000);
