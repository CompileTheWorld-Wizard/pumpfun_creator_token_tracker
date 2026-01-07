module.exports = {
  apps: [
    {
      name: 'creator_tracking_server',
      script: './dist/creator_tracking_server/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5005
      },
      error_file: './logs/creator_tracking_server-error.log',
      out_file: './logs/creator_tracking_server-out.log',
      log_file: './logs/creator_tracking_server-combined.log',
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
    // Server 2 configuration will be added here
    // Server 3 configuration will be added here
  ]
};

