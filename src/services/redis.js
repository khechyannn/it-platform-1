const { createClient } = require('redis');
const config = require('../config');

let client;
let pubClient;
let subClient;

async function getRedis() {
  if (!client) {
    client = createClient({ url: config.redisUrl });
    client.on('error', (err) => console.error('Redis error:', err));
    await client.connect();
  }
  return client;
}

async function getRedisPubSub() {
  if (!pubClient) {
    pubClient = createClient({ url: config.redisUrl });
    subClient = pubClient.duplicate();
    pubClient.on('error', (err) => console.error('Redis pub error:', err));
    subClient.on('error', (err) => console.error('Redis sub error:', err));
    await Promise.all([pubClient.connect(), subClient.connect()]);
  }
  return { pubClient, subClient };
}

const ONLINE_KEY = 'online:users';
const ONLINE_SOCKETS_PREFIX = 'online:sockets:';
const TYPING_PREFIX = 'typing:';

async function addUserSocket(userId, socketId) {
  const redis = await getRedis();
  await redis.sAdd(`${ONLINE_SOCKETS_PREFIX}${userId}`, socketId);
  await redis.sAdd(ONLINE_KEY, String(userId));
}

async function removeUserSocket(userId, socketId) {
  const redis = await getRedis();
  const key = `${ONLINE_SOCKETS_PREFIX}${userId}`;
  await redis.sRem(key, socketId);
  const remaining = await redis.sCard(key);
  if (remaining === 0) {
    await redis.del(key);
    await redis.sRem(ONLINE_KEY, String(userId));
    return true;
  }
  return false;
}

/** @deprecated use addUserSocket */
async function setUserOnline(userId) {
  const redis = await getRedis();
  await redis.sAdd(ONLINE_KEY, String(userId));
}

/** @deprecated use removeUserSocket */
async function setUserOffline(userId) {
  const redis = await getRedis();
  await redis.sRem(ONLINE_KEY, String(userId));
  const redis2 = await getRedis();
  await redis2.del(`${ONLINE_SOCKETS_PREFIX}${userId}`);
}

async function isUserOnline(userId) {
  const redis = await getRedis();
  return redis.sIsMember(ONLINE_KEY, String(userId));
}

async function getOnlineUsers() {
  const redis = await getRedis();
  const ids = await redis.sMembers(ONLINE_KEY);
  return ids.map(Number);
}

async function setTyping(roomId, userId, isTyping) {
  const redis = await getRedis();
  const key = `${TYPING_PREFIX}${roomId}`;
  if (isTyping) {
    await redis.sAdd(key, String(userId));
    await redis.expire(key, 10);
  } else {
    await redis.sRem(key, String(userId));
  }
}

async function getTypingUsers(roomId) {
  const redis = await getRedis();
  const ids = await redis.sMembers(`${TYPING_PREFIX}${roomId}`);
  return ids.map(Number);
}

module.exports = {
  getRedis,
  getRedisPubSub,
  addUserSocket,
  removeUserSocket,
  setUserOnline,
  setUserOffline,
  isUserOnline,
  getOnlineUsers,
  setTyping,
  getTypingUsers,
};
