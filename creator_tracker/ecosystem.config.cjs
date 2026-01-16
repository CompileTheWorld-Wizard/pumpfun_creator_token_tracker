module.exports = {
  apps: [
    {
      name: 'soltrack-creator-tracker',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        CREATOR_SERVER_PORT: 5005,
        HOST: '127.0.0.1',
        USE_HTTPS: 'true'
      },
      error_file: './logs/creator_tracker-error.log',
      out_file: './logs/creator_tracker-out.log',
      log_file: './logs/creator_tracker-combined.log',
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
