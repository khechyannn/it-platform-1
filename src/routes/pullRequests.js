const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.patch('/:id/', requireAuth, async (req, res) => {
  const prId = Number(req.params.id);
  const { status } = req.body;

  const allowed = ['open', 'closed', 'merged'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Valid status required: open, closed, merged' });
  }

  try {
    const { rows: prRows } = await query(
      'SELECT id, employee_id FROM pull_requests WHERE id = $1',
      [prId]
    );
    if (prRows.length === 0) {
      return res.status(404).json({ error: 'Pull request not found' });
    }

    const employeeId = prRows[0].employee_id;
    let canEdit = req.userId === employeeId;

    if (!canEdit && req.userRole === 'mentor') {
      const { rows } = await query(
        'SELECT 1 FROM chat_rooms WHERE mentor_id = $1 AND junior_id = $2',
        [req.userId, employeeId]
      );
      canEdit = rows.length > 0;
    }

    if (!canEdit) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await query(
      `UPDATE pull_requests
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, prId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update pull request' });
  }
});

module.exports = router;
