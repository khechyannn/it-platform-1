const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { isUserOnline } = require('../services/redis');

const router = express.Router();

router.get('/rooms/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         r.id,
         r.mentor_id,
         r.junior_id,
         r.created_at,
         m.name AS mentor_name,
         j.name AS junior_name,
         COALESCE(unread.count, 0)::int AS unread_count,
         last_msg.text AS last_message,
         last_msg.created_at AS last_message_at
       FROM chat_rooms r
       JOIN users m ON m.id = r.mentor_id
       JOIN users j ON j.id = r.junior_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count
         FROM messages msg
         WHERE msg.room_id = r.id
           AND msg.sender_id != $1
           AND msg.is_read = FALSE
       ) unread ON TRUE
       LEFT JOIN LATERAL (
         SELECT text, created_at
         FROM messages msg
         WHERE msg.room_id = r.id
         ORDER BY created_at DESC
         LIMIT 1
       ) last_msg ON TRUE
       WHERE r.mentor_id = $1 OR r.junior_id = $1
       ORDER BY COALESCE(last_msg.created_at, r.created_at) DESC`,
      [req.userId]
    );

    const rooms = await Promise.all(rows.map(async (room) => {
      const partnerId = room.mentor_id === req.userId ? room.junior_id : room.mentor_id;
      const partnerName = room.mentor_id === req.userId ? room.junior_name : room.mentor_name;
      const partnerOnline = await isUserOnline(partnerId);
      return {
        id: room.id,
        partner: { id: partnerId, name: partnerName, online: partnerOnline },
        unread_count: room.unread_count,
        last_message: room.last_message,
        last_message_at: room.last_message_at,
        created_at: room.created_at,
      };
    }));

    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.get('/rooms/:id/messages/', requireAuth, async (req, res) => {
  const roomId = Number(req.params.id);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  try {
    const access = await query(
      `SELECT id FROM chat_rooms
       WHERE id = $1 AND (mentor_id = $2 OR junior_id = $2)`,
      [roomId, req.userId]
    );
    if (access.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const { rows: countRows } = await query(
      'SELECT COUNT(*)::int AS total FROM messages WHERE room_id = $1',
      [roomId]
    );

    const { rows } = await query(
      `SELECT m.id, m.room_id, m.sender_id, u.name AS sender_name,
              m.text, m.created_at, m.is_read
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [roomId, limit, offset]
    );

    res.json({
      data: rows.reverse(),
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        total_pages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.patch('/messages/:id/read/', requireAuth, async (req, res) => {
  const messageId = Number(req.params.id);

  try {
    const { rows } = await query(
      `UPDATE messages m
       SET is_read = TRUE
       FROM chat_rooms r
       WHERE m.id = $1
         AND m.room_id = r.id
         AND (r.mentor_id = $2 OR r.junior_id = $2)
         AND m.sender_id != $2
       RETURNING m.*`,
      [messageId, req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`room:${rows[0].room_id}`).emit('message:read', {
        message_id: rows[0].id,
        room_id: rows[0].room_id,
        read_by: req.userId,
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

module.exports = router;
