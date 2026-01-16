module.exports = {
  apps: [
    {
      name: 'soltrack-fund-tracker',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        FUND_SERVER_PORT: 5006,
        ALLOWED_ORIGINS: 'https://tool.dillwifit.com',
        USE_HTTPS: 'true'
      },
      error_file: './logs/fund_tracker-error.log',
      out_file: './logs/fund_tracker-out.log',
      log_file: './logs/fund_tracker-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=2048',
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true
    }
  ]
};
