const bcrypt = require('bcryptjs');
const { query } = require('./pool');

const DEMO_USERS = [
  { name: 'Alex Mentor', role: 'mentor', email: 'alex@platform.local', password: 'mentor123' },
  { name: 'Sam Junior', role: 'junior', email: 'sam@platform.local', password: 'junior123' },
  { name: 'Maria Mentor', role: 'mentor', email: 'maria@platform.local', password: 'mentor123' },
  { name: 'Dana Junior', role: 'junior', email: 'dana@platform.local', password: 'junior123' },
];

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('mentor', 'junior')),
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS chat_rooms (
      id SERIAL PRIMARY KEY,
      mentor_id INTEGER NOT NULL REFERENCES users(id),
      junior_id INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (mentor_id, junior_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_read BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES users(id),
      title VARCHAR(500) NOT NULL,
      url VARCHAR(1000) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'merged')),
      github_pr_id BIGINT UNIQUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pull_requests_employee ON pull_requests(employee_id);
  `);

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);

  const { rows } = await query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count === 0) {
    for (const u of DEMO_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await query(
        'INSERT INTO users (name, role, email, password_hash) VALUES ($1, $2, $3, $4)',
        [u.name, u.role, u.email, hash]
      );
    }
    await query(`
      INSERT INTO chat_rooms (mentor_id, junior_id) VALUES
        (1, 2),
        (3, 4)
    `);
    await query(`
      INSERT INTO messages (room_id, sender_id, text, is_read) VALUES
        (1, 1, 'Привет! Как дела с задачей?', true),
        (1, 2, 'Почти закончил, остался тест.', false),
        (2, 3, 'Не забудь про code review.', false)
    `);
    await query(`
      INSERT INTO pull_requests (employee_id, title, url, status, github_pr_id) VALUES
        (2, 'Add chat feature', 'https://github.com/org/repo/pull/1', 'open', 1),
        (4, 'Fix login bug', 'https://github.com/org/repo/pull/2', 'merged', 2)
    `);
    console.log('Seed data inserted');
  } else {
    for (let i = 0; i < DEMO_USERS.length; i++) {
      const u = DEMO_USERS[i];
      const hash = await bcrypt.hash(u.password, 10);
      await query(
        'UPDATE users SET email = $1, password_hash = $2 WHERE id = $3',
        [u.email, hash, i + 1]
      );
    }
    console.log('Demo logins updated for users 1-4');
  }

  console.log('Migrations complete');
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      if (err.code === '28P01') {
        console.error('PostgreSQL auth failed. For local dev run: npm run setup:db');
        console.error('Or set DATABASE_URL in .env to your existing postgres user.');
      } else if (err.code === '3D000') {
        console.error('Database does not exist. Run: npm run setup:db');
      }
      console.error(err.message || err);
      process.exit(1);
    });
}

module.exports = { migrate };
