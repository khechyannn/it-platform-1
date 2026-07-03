const express = require('express');
const { query } = require('../db/pool');
const { verifyGithubSignature } = require('../middleware/githubWebhook');

const router = express.Router();

function mapGithubAction(action, merged) {
  if (action === 'opened') return 'open';
  if (action === 'merged' || merged) return 'merged';
  if (action === 'closed') return 'closed';
  return null;
}

router.post('/github/', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  try {
    req.body = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next();
}, verifyGithubSignature, async (req, res) => {
  const event = req.headers['x-github-event'];
  const { action, pull_request: pr } = req.body;

  if (event !== 'pull_request' || !pr) {
    return res.status(200).json({ message: 'Event ignored' });
  }

  const status = mapGithubAction(action, pr.merged);
  if (!status) {
    return res.status(200).json({ message: `Action ${action} ignored` });
  }

  const githubPrId = pr.id;
  const title = pr.title;
  const url = pr.html_url;

  try {
    const existing = await query(
      'SELECT id FROM pull_requests WHERE github_pr_id = $1',
      [githubPrId]
    );

    if (existing.rows.length > 0) {
      const { rows } = await query(
        `UPDATE pull_requests
         SET status = $1, title = $2, url = $3, updated_at = NOW()
         WHERE github_pr_id = $4
         RETURNING *`,
        [status, title, url, githubPrId]
      );
      return res.json({ updated: rows[0] });
    }

    const employeeId = pr.user?.id ? Number(pr.user.id) % 4 + 1 : 2;
    const { rows } = await query(
      `INSERT INTO pull_requests (employee_id, title, url, status, github_pr_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [employeeId, title, url, status, githubPrId]
    );

    res.status(201).json({ created: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
