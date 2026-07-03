const crypto = require('crypto');
const config = require('../config');

function verifyGithubSignature(req, res, next) {
  const secret = config.githubWebhookSecret;
  if (!secret) {
    return res.status(500).json({ error: 'GITHUB_WEBHOOK_SECRET is not configured' });
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing X-Hub-Signature-256' });
  }

  const digest = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const digBuf = Buffer.from(digest);

  if (sigBuf.length !== digBuf.length || !crypto.timingSafeEqual(sigBuf, digBuf)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

module.exports = { verifyGithubSignature };
