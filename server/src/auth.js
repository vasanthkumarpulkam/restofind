const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
}

function signAdminToken() {
  const secret = getJwtSecret();
  return jwt.sign(
    { role: 'admin' },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

async function verifyAdminCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USER || 'admin';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const passwordPlain = process.env.ADMIN_PASS || 'admin';

  if (username !== expectedUser) return false;

  if (passwordHash) {
    return bcrypt.compare(password, passwordHash);
  }
  return password === passwordPlain;
}

function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const payload = jwt.verify(token, getJwtSecret());
    if (!payload || payload.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdminFromQueryToken(req, res, next) {
  // For EventSource (no headers): /stream?token=...
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
      return res.status(401).end('Missing token');
    }
    const payload = jwt.verify(token, getJwtSecret());
    if (!payload || payload.role !== 'admin') {
      return res.status(403).end('Forbidden');
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).end('Invalid token');
  }
}

module.exports = {
  signAdminToken,
  verifyAdminCredentials,
  requireAdmin,
  requireAdminFromQueryToken,
};

