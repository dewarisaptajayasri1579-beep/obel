module.exports = {
  apps: [
    {
      name: "obel-backend",
      script: "npm",
      args: "run start:dev",
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      restart_delay: 2000,
    },
  ],
};
