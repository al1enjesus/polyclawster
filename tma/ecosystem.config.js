module.exports = {
  apps: [
    {
      name: 'poly-api',
      script: '/workspace/tma/api/server.js',
      restart_delay: 2000,
      max_restarts: 10,
    },
    {
      name: 'poly-bot',
      script: '/workspace/tma/bot.js',
      restart_delay: 2000,
      max_restarts: 10,
    },
    {
      name: 'cloudflared',
      script: '/usr/local/bin/cloudflared',
      args: 'tunnel --url http://127.0.0.1:3456 --no-autoupdate',
      interpreter: 'none',
      restart_delay: 5000,
    }
  ]
};
