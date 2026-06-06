module.exports = {
  apps: [{
    name: 'be-your-hero',
    script: './cluster.js',
    cwd: __dirname,
    instances: 'max',           // 使用所有 CPU 核心
    exec_mode: 'cluster',
    max_memory_restart: '512M', // 内存超限自动重启
    
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    
    // 日志配置
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // 自动重启
    autorestart: true,
    min_uptime: '10s',
    max_restarts: 10,
    
    // 优雅关闭
    kill_timeout: 5000,
    listen_timeout: 10000,
    
    // 监控
    monitoring: false,
    
    // 环境变量文件
    env_file: './.env'
  }]
};
