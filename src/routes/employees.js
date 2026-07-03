const express = require('express');
const { query } = require('../db/pool');
const { requireAuth, requireEmployeeAccess } = require('../middleware/auth');

const router = express.Router();

router.get('/:id/pull-requests/', requireAuth, requireEmployeeAccess, async (req, res) => {
  const employeeId = Number(req.params.id);

  try {
    const { rows } = await query(
      `SELECT id, employee_id, title, url, status, github_pr_id, updated_at
       FROM pull_requests
       WHERE employee_id = $1
       ORDER BY updated_at DESC`,
      [employeeId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pull requests' });
  }
});

router.post('/:id/pull-requests/', requireAuth, async (req, res) => {
  const employeeId = Number(req.params.id);
  if (req.userId !== employeeId) {
    return res.status(403).json({ error: 'You can only add PRs for yourself' });
  }

  const { title, url, status = 'open', github_pr_id } = req.body;

  if (!title || !url) {
    return res.status(400).json({ error: 'title and url are required' });
  }

  const allowed = ['open', 'closed', 'merged'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO pull_requests (employee_id, title, url, status, github_pr_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [employeeId, title, url, status, github_pr_id || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'PR with this github_pr_id already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create pull request' });
  }
});

module.exports = router;
