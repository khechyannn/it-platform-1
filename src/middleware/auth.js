const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { signToken, verifyToken } = require('../services/jwt');

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userRole = payload.role;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function requireEmployeeAccess(req, res, next) {
  const employeeId = Number(req.params.id);
  if (req.userId === employeeId) {
    return next();
  }

  if (req.userRole === 'mentor') {
    const { rows } = await query(
      `SELECT 1 FROM chat_rooms WHERE mentor_id = $1 AND junior_id = $2`,
      [req.userId, employeeId]
    );
    if (rows.length > 0) {
      return next();
    }
  }

  return res.status(403).json({ error: 'Access denied' });
}

async function login(email, password) {
  const { rows } = await query(
    'SELECT id, name, role, email, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return null;
  }

  const token = signToken(user);
  return {
    token,
    user: { id: user.id, name: user.name, role: user.role, email: user.email },
  };
}

module.exports = { requireAuth, requireEmployeeAccess, getBearerToken, login };
