require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgres://platform:platform@localhost:5432/it_platform',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-development',
};
