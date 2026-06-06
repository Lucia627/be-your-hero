require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  llm: {
    mockMode: process.env.LLM_MOCK_MODE === 'true',
    provider: process.env.LLM_PROVIDER || 'openai',
    apiKey: process.env.LLM_API_KEY || '',
    apiUrl: process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.LLM_MODEL || 'gpt-4o'
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5500,http://127.0.0.1:5500').split(',').map(s => s.trim()).filter(Boolean)
  },

  data: {
    backupCount: parseInt(process.env.DATA_BACKUP_COUNT, 10) || 5,
    backupIntervalMs: parseInt(process.env.DATA_BACKUP_INTERVAL_MS, 10) || 3600000
  },

  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100
  }
};

module.exports = config;
