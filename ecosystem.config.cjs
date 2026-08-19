/**
 * HighLyAgent Admin Dashboard — PM2 auto-start (LOCAL MACHINE ONLY)
 *
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup        ← survives reboot
 *
 * The dashboard binds 127.0.0.1:8090 — it is never reachable from the network.
 */
module.exports = {
  apps: [
    {
      name: 'highlyagent-admin',
      script: './scripts/serve-dist.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '180M',
      env: {
        NODE_ENV: 'production',
        PORT: 8090,
        HOST: '127.0.0.1',
        HLA_API_BASE: 'https://api.highlyagent.io',
      },
    },
  ],
};
