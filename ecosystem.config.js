// PM2 Ecosystem Config — Hostinger Node.js Hosting
// Usage: pm2 start ecosystem.config.js
// NOTE: Secrets must be set in .env (gitignored), NOT hardcoded here
module.exports = {
  apps: [
    {
      name: 'fii-dii-dashboard',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      exp_backoff_restart_delay: 100,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
