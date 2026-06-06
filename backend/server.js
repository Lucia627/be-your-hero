require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const analyzeRoutes = require('./routes/analyze');
const cardRoutes = require('./routes/cards');
const gameRoutes = require('./routes/game');
const rateLimiter = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const PORT = config.port;

// Catch unhandled errors - log then exit to avoid unknown state
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

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
const corsOptions = {
  origin: config.cors.origins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Static files from frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// API routes - v1
app.use('/api/v1', analyzeRoutes);
app.use('/api/v1', cardRoutes);
app.use('/api/v1', gameRoutes);

// Legacy /api paths (backward compatible)
app.use('/api', analyzeRoutes);
app.use('/api', cardRoutes);
app.use('/api', gameRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

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

// Global error handling middleware
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

// Startup config check
if (!config.llm.apiKey || config.llm.apiKey === 'your_api_key_here') {
  console.warn('\n[WARNING] LLM_API_KEY not configured. Image analysis will return mock data.');
  console.warn('          Please set LLM_API_KEY in backend/.env to enable real image recognition.\n');
}
if (config.llm.provider === 'mock') {
  console.warn('\n[WARNING] LLM_PROVIDER is set to "mock". Using simulated analysis results.');
  console.warn('          Change LLM_PROVIDER to "openai"/"claude"/"gemini" for real recognition.\n');
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Be Your Hero server running on port ${PORT}`);
  console.log(`API base URL: http://localhost:${PORT}/api`);
  console.log(`API v1 URL:   http://localhost:${PORT}/api/v1`);
  console.log(`Environment:  ${config.nodeEnv}`);
  console.log(`Rate limit:   ${config.rateLimit.enabled ? config.rateLimit.maxRequests + ' req/' + config.rateLimit.windowMs + 'ms' : 'disabled'}`);
});

server.on('error', (err) => {
  console.error('Server error event:', err);
});
