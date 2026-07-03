const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('./config');
const { migrate } = require('./db/migrate');
const { getRedisPubSub } = require('./services/redis');
const { setupChatSocket } = require('./socket/chat');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const employeeRoutes = require('./routes/employees');
const pullRequestRoutes = require('./routes/pullRequests');
const webhookRoutes = require('./routes/webhooks');

async function start() {
  await migrate();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  const { pubClient, subClient } = await getRedisPubSub();
  io.adapter(createAdapter(pubClient, subClient));

  app.set('io', io);
  setupChatSocket(io);

  app.use('/api/webhooks', webhookRoutes);
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/pull-requests', pullRequestRoutes);

  app.get('/', (_req, res) => {
    res.redirect('/login');
  });

  app.get('/login', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
  });

  app.get('/chat', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'chat.html'));
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  server.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
