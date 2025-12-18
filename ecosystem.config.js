module.exports = {
  apps: [{
    name: 'web-service-makan',
    script: './index.js',
    instances: 1,
    exec_mode: 'fork',
    
    // PM2 settings
    autorestart: true,
    watch: false,
    max_memory_restart: '100M',
    
    // Logging
    output: './logs/out.log',
    error: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Environment
    env: {
      NODE_ENV: 'production'
    },
    
    // Process monitoring
    min_uptime: '10s',
    max_restarts: 10,
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true
  }]
};
