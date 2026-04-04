/**
 * server.js — Express server with SQLite for auth & projects
 */
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Database setup ---
const db = new Database(path.join(__dirname, 'strudel.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'untitled',
    code TEXT DEFAULT '',
    cps REAL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    modified_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
`);

// --- Helpers ---
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function genId() {
  return 'p' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

// Simple token: base64(userId:username:hmac)
const SECRET = crypto.randomBytes(32).toString('hex');

function makeToken(userId, username) {
  const payload = userId + ':' + username;
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload + ':' + hmac).toString('base64');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const parts = decoded.split(':');
    if (parts.length < 3) return null;
    const hmac = parts.pop();
    const payload = parts.join(':');
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (hmac !== expected) return null;
    return { id: parseInt(parts[0]), username: parts[1] };
  } catch {
    return null;
  }
}

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = verifyToken(header.slice(7));
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

// --- Middleware ---
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname, { index: 'index.html' }));

// --- Auth routes ---
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 2) return res.status(400).json({ error: 'Username too short' });
  if (password.length < 3) return res.status(400).json({ error: 'Password too short (min 3)' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  const result = db.prepare('INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)').run(username, hash, salt);
  const token = makeToken(result.lastInsertRowid, username);
  res.json({ ok: true, token, username });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const hash = hashPassword(password, user.salt);
  if (hash !== user.password_hash) return res.status(401).json({ error: 'Wrong password' });

  const token = makeToken(user.id, user.username);
  res.json({ ok: true, token, username: user.username });
});

// --- Project routes (all require auth) ---
app.get('/api/projects', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY modified_at DESC').all(req.user.id);
  res.json(rows);
});

app.post('/api/projects', auth, (req, res) => {
  const { name, code, cps } = req.body;
  const id = genId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects (id, user_id, name, code, cps, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, name || 'untitled', code || '', cps || 1, now, now);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.json(project);
});

app.put('/api/projects/:id', auth, (req, res) => {
  const { name, code, cps } = req.body;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET name = ?, code = ?, cps = ?, modified_at = ? WHERE id = ?')
    .run(name ?? existing.name, code ?? existing.code, cps ?? existing.cps, now, req.params.id);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

app.delete('/api/projects/:id', auth, (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
  res.json({ ok: true });
});

app.put('/api/projects/:id/rename', auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE projects SET name = ?, modified_at = ? WHERE id = ? AND user_id = ?')
    .run(name, now, req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

// --- Start ---
app.listen(PORT, () => {
  console.log('[Server] Running on http://localhost:' + PORT);
});
