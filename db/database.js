const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'faithwork.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  initSchema();
  return db;
}

function saveDb() {
  if (db) fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function initSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, apellido TEXT, email TEXT UNIQUE, password TEXT, foto TEXT, bio TEXT DEFAULT '', cargo TEXT DEFAULT '', ciudad TEXT DEFAULT '', iglesia TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, user_id TEXT, contact_id TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, user_id TEXT, titulo TEXT, empresa TEXT, descripcion TEXT, requisitos TEXT DEFAULT '', tipo TEXT DEFAULT 'full-time', modalidad TEXT DEFAULT 'presencial', ciudad TEXT DEFAULT '', salario TEXT DEFAULT '', activo INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, job_id TEXT, user_id TEXT, mensaje TEXT DEFAULT '', status TEXT DEFAULT 'pendiente', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS ratings (id TEXT PRIMARY KEY, rater_id TEXT, rated_id TEXT, job_id TEXT, puntuacion INTEGER, comentario TEXT DEFAULT '', tipo TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, sender_id TEXT, receiver_id TEXT, contenido TEXT, leido INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, owner_id TEXT, nombre TEXT, logo TEXT, descripcion TEXT DEFAULT '', sector TEXT DEFAULT '', ciudad TEXT DEFAULT '', sitio_web TEXT DEFAULT '', email TEXT UNIQUE, password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (id TEXT PRIMARY KEY, account_id TEXT, account_type TEXT DEFAULT 'user', token TEXT UNIQUE, expires_at DATETIME, used INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, author_id TEXT, author_type TEXT DEFAULT 'user', contenido TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS post_media (id TEXT PRIMARY KEY, post_id TEXT, url TEXT, tipo TEXT DEFAULT 'image', orden INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS post_likes (id TEXT PRIMARY KEY, post_id TEXT, user_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS post_comments (id TEXT PRIMARY KEY, post_id TEXT, author_id TEXT, author_type TEXT DEFAULT 'user', contenido TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  // Migraciones suaves para bases existentes
  try { db.run(`ALTER TABLE jobs ADD COLUMN company_id TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE jobs ADD COLUMN area TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE jobs ADD COLUMN nivel_experiencia TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE jobs ADD COLUMN vacantes INTEGER DEFAULT 1`); } catch(e) {}
  try { db.run(`ALTER TABLE jobs ADD COLUMN fecha_limite TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE jobs ADD COLUMN beneficios TEXT DEFAULT ''`); } catch(e) {}

  saveDb();
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

module.exports = { getDb, saveDb, query, run };
