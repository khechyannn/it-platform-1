const { query } = require('../db/pool');
const { verifyToken } = require('../services/jwt');
const {
  addUserSocket,
  removeUserSocket,
  setTyping,
  getTypingUsers,
} = require('../services/redis');

function setupChatSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Unauthorized'));
      }
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.userRole = payload.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    let joinedRooms = new Set();

    async function joinUserRooms() {
      const { rows } = await query(
        `SELECT id FROM chat_rooms WHERE mentor_id = $1 OR junior_id = $1`,
        [userId]
      );
      for (const row of rows) {
        const roomName = `room:${row.id}`;
        socket.join(roomName);
        joinedRooms.add(row.id);
      }
    }

    (async () => {
      await addUserSocket(userId, socket.id);
      await joinUserRooms();
      io.emit('user:online', { user_id: userId, online: true });
    })();

    socket.on('message:send', async (payload, ack) => {
      try {
        const { room_id: roomId, text } = payload || {};
        if (!roomId || !text?.trim()) {
          if (ack) ack({ error: 'room_id and text required' });
          return;
        }

        const access = await query(
          `SELECT id FROM chat_rooms
           WHERE id = $1 AND (mentor_id = $2 OR junior_id = $2)`,
          [roomId, userId]
        );
        if (access.rows.length === 0) {
          if (ack) ack({ error: 'Room not found' });
          return;
        }

        const { rows } = await query(
          `WITH ins AS (
             INSERT INTO messages (room_id, sender_id, text)
             VALUES ($1, $2, $3)
             RETURNING id, room_id, sender_id, text, created_at, is_read
           )
           SELECT ins.*, u.name AS sender_name
           FROM ins
           JOIN users u ON u.id = ins.sender_id`,
          [roomId, userId, text.trim()]
        );

        const message = rows[0];
        io.to(`room:${roomId}`).emit('message:send', message);
        if (ack) ack({ ok: true, message });
      } catch (err) {
        console.error(err);
        if (ack) ack({ error: 'Failed to send message' });
      }
    });

    socket.on('message:read', async (payload) => {
      try {
        const { message_id: messageId } = payload || {};
        if (!messageId) return;

        const { rows } = await query(
          `UPDATE messages m
           SET is_read = TRUE
           FROM chat_rooms r
           WHERE m.id = $1
             AND m.room_id = r.id
             AND (r.mentor_id = $2 OR r.junior_id = $2)
             AND m.sender_id != $2
           RETURNING m.id, m.room_id`,
          [messageId, userId]
        );

        if (rows.length > 0) {
          io.to(`room:${rows[0].room_id}`).emit('message:read', {
            message_id: rows[0].id,
            room_id: rows[0].room_id,
            read_by: userId,
          });
        }
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('user:typing', async (payload) => {
      const { room_id: roomId, typing } = payload || {};
      if (!roomId) return;

      await setTyping(roomId, userId, Boolean(typing));
      const typingUsers = await getTypingUsers(roomId);
      socket.to(`room:${roomId}`).emit('user:typing', {
        room_id: roomId,
        user_id: userId,
        typing: Boolean(typing),
        typing_users: typingUsers.filter((id) => id !== userId),
      });
    });

    socket.on('disconnect', async () => {
      const wentOffline = await removeUserSocket(userId, socket.id);
      if (wentOffline) {
        io.emit('user:online', { user_id: userId, online: false });
      }
      for (const roomId of joinedRooms) {
        await setTyping(roomId, userId, false);
      }
    });
  });
}

module.exports = { setupChatSocket };
