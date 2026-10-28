module.exports = {
  apps: [
    {
      name: 'crms-backend',
      script: 'src/server.js',
      instances: 'max', // Utilizes all available CPU cores on the host server
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '1G',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
