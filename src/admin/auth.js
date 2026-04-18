import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'fiften-admin-secret-change-me';
const JWT_EXPIRES = '24h';

// Admin kullanıcıları .env'den yükle
// ADMIN_USERS=aziz:hash1,diger:hash2 formatında
function loadAdminUsers() {
  const raw = process.env.ADMIN_USERS || '';
  if (!raw) return {};
  const users = {};
  for (const entry of raw.split(',')) {
    const [username, hash] = entry.trim().split(':');
    if (username && hash) users[username.trim()] = hash.trim();
  }
  return users;
}

export async function adminLogin(username, password) {
  const users = loadAdminUsers();
  const hash = users[username];
  if (!hash) return null;
  const valid = await bcrypt.compare(password, hash);
  if (!valid) return null;
  return jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}
