/**
 * PM2 process file — keeps the built Admin Dashboard running on this machine.
 *
 *   npm run build
 *   npm run pm2:start        # start now
 *   pm2 save && pm2 startup  # survive reboots (auto-start at boot)
 *
 * Serves dist/ on 127.0.0.1:8090 — loopback only, never public.
 */
module.exports = {
  apps: [
    {
      name: 'highlyagent-admin',
      script: './scripts/serve-dist.mjs',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '8090',
      },
    },
  ],
};
