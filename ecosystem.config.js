/**
 * PM2 Ecosystem Configuration
 *
 * Production process management configuration for Lead360 platform.
 *
 * Features:
 * - Automatic restart on crash
 * - Memory limit enforcement
 * - Graceful shutdown with 30s timeout
 * - Log rotation
 * - Health check readiness signal
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 reload ecosystem.config.js   # Zero-downtime restart
 *   pm2 stop ecosystem.config.js
 *   pm2 logs
 *   pm2 monit
 *
 * @author System
 */
module.exports = {
  apps: [
    {
      // ===== API Backend =====
      name: 'lead360-api',
      script: 'dist/src/main.js',
      cwd: '/var/www/lead360.app/api',

      // Process management
      instances: 1,
      exec_mode: 'fork',
      watch: false,

      // Memory management
      max_memory_restart: '1G', // Restart if memory exceeds 1GB

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },

      // Logging
      error_file: '/var/www/lead360.app/logs/api_error.log',
      out_file: '/var/www/lead360.app/logs/api_access.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 30000, // Wait 30s for graceful shutdown before SIGKILL
      wait_ready: true, // Wait for app.listen() before considering app ready
      listen_timeout: 10000, // Max time to wait for listen signal

      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10, // Max consecutive unstable restarts
      min_uptime: '10s', // Minimum uptime to not be considered unstable
      restart_delay: 4000, // Delay between restarts (4 seconds)

      // Crash management
      exp_backoff_restart_delay: 100, // Exponential backoff restart delay
    },

    {
      // ===== Frontend Next.js App =====
      name: 'lead360-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 7000 -H 127.0.0.1',
      cwd: '/var/www/lead360.app/app',

      // Process management
      instances: 1,
      exec_mode: 'fork',
      watch: false,

      // Memory management
      max_memory_restart: '800M',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 7000,
      },

      // Logging
      error_file: '/var/www/lead360.app/logs/app_error.log',
      out_file: '/var/www/lead360.app/logs/app_access.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 10000, // 10s for Next.js

      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
    },
  ],
};
