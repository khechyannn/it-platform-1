const express = require('express');
const { query } = require('../db/pool');
const { login, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login/', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const result = await login(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, role, email FROM users WHERE id = $1',
      [req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
