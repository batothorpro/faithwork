const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const addRating = (u) => {
  const r = query('SELECT AVG(puntuacion) as p, COUNT(*) as t FROM ratings WHERE rated_id=?', [u.id]);
  u.rating_promedio = r[0]?.p ? parseFloat(r[0].p).toFixed(1) : null;
  u.rating_total = r[0]?.t || 0;
  return u;
};

// ===== MI PERFIL (persona o empresa según token) =====
router.get('/me', authMiddleware, (req, res) => {
  if (req.user.accountType === 'company') {
    const c = query('SELECT id,nombre,email,logo,descripcion,sector,ciudad,sitio_web,created_at FROM companies WHERE id=?', [req.user.id]);
    if (!c.length) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ ...c[0], accountType: 'company' });
  }
  const u = query('SELECT id,nombre,apellido,email,foto,bio,cargo,ciudad,iglesia,created_at FROM users WHERE id=?', [req.user.id]);
  if (!u.length) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ...addRating(u[0]), accountType: 'user' });
});

router.put('/me', authMiddleware, (req, res) => {
  if (req.user.accountType === 'company') {
    const { nombre, descripcion, sector, ciudad, sitio_web } = req.body;
    run('UPDATE companies SET nombre=?,descripcion=?,sector=?,ciudad=?,sitio_web=? WHERE id=?',
      [nombre, descripcion || '', sector || '', ciudad || '', sitio_web || '', req.user.id]);
    return res.json({ success: true });
  }
  const { nombre, apellido, bio, cargo, ciudad, iglesia } = req.body;
  run('UPDATE users SET nombre=?,apellido=?,bio=?,cargo=?,ciudad=?,iglesia=? WHERE id=?',
    [nombre, apellido, bio || '', cargo || '', ciudad || '', iglesia || '', req.user.id]);
  res.json({ success: true });
});

// ===== BÚSQUEDA GLOBAL: personas Y empresas =====
router.get('/search', authMiddleware, (req, res) => {
  if (!req.query.q) return res.json({ people: [], companies: [] });
  const t = '%' + req.query.q + '%';

  const people = query(
    'SELECT id,nombre,apellido,cargo,ciudad,iglesia,foto FROM users WHERE (nombre LIKE ? OR apellido LIKE ? OR cargo LIKE ?) AND id!=? LIMIT 15',
    [t, t, t, req.user.accountType === 'user' ? req.user.id : '']);

  const companies = query(
    'SELECT id,nombre,logo,sector,ciudad,descripcion FROM companies WHERE (nombre LIKE ? OR sector LIKE ?) AND id!=? LIMIT 15',
    [t, t, req.user.accountType === 'company' ? req.user.id : '']);

  res.json({ people, companies });
});

// ===== PERFIL DE EMPRESA (público) =====
router.get('/company/:id', authMiddleware, (req, res) => {
  const c = query('SELECT id,nombre,logo,descripcion,sector,ciudad,sitio_web,created_at FROM companies WHERE id=?', [req.params.id]);
  if (!c.length) return res.status(404).json({ error: 'Empresa no encontrada' });
  const jobCount = query('SELECT COUNT(*) as t FROM jobs WHERE company_id=? AND activo=1', [req.params.id]);
  res.json({ ...c[0], ofertas_activas: jobCount[0]?.t || 0, accountType: 'company' });
});

router.get('/company/:id/jobs', authMiddleware, (req, res) => {
  res.json(query('SELECT * FROM jobs WHERE company_id=? AND activo=1 ORDER BY created_at DESC', [req.params.id]));
});

// ===== CONTACTOS (solo entre personas) =====
router.get('/me/contacts', authMiddleware, (req, res) => {
  const uid = req.user.id;
  res.json(query(
    "SELECT u.id,u.nombre,u.apellido,u.cargo,u.ciudad,u.foto,c.status,c.id as contact_record_id FROM contacts c JOIN users u ON (CASE WHEN c.user_id=? THEN u.id=c.contact_id ELSE u.id=c.user_id END) WHERE (c.user_id=? OR c.contact_id=?) AND c.status='accepted'",
    [uid, uid, uid]));
});

router.get('/me/contact-requests', authMiddleware, (req, res) => {
  res.json(query(
    "SELECT c.id,u.id as user_id,u.nombre,u.apellido,u.cargo,u.foto FROM contacts c JOIN users u ON u.id=c.user_id WHERE c.contact_id=? AND c.status='pending'",
    [req.user.id]));
});

router.post('/me/contacts/:id', authMiddleware, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
  const ex = query('SELECT id FROM contacts WHERE (user_id=? AND contact_id=?) OR (user_id=? AND contact_id=?)',
    [req.user.id, req.params.id, req.params.id, req.user.id]);
  if (ex.length) return res.status(400).json({ error: 'Ya existe una solicitud o conexión' });
  run('INSERT INTO contacts (id,user_id,contact_id,status) VALUES (?,?,?,?)',
    [uuidv4(), req.user.id, req.params.id, 'pending']);
  res.json({ success: true });
});

router.put('/me/contacts/:id', authMiddleware, (req, res) => {
  const status = req.body.action === 'accept' ? 'accepted' : 'rejected';
  run('UPDATE contacts SET status=? WHERE id=? AND contact_id=?', [status, req.params.id, req.user.id]);
  res.json({ success: true });
});

router.post('/:id/rate', authMiddleware, (req, res) => {
  const { puntuacion, comentario, tipo, job_id } = req.body;
  if (!puntuacion || puntuacion < 1 || puntuacion > 5) return res.status(400).json({ error: 'Puntuación entre 1 y 5' });
  if (query('SELECT id FROM ratings WHERE rater_id=? AND rated_id=? AND job_id=?', [req.user.id, req.params.id, job_id]).length)
    return res.status(400).json({ error: 'Ya calificaste en esta oferta' });
  run('INSERT INTO ratings (id,rater_id,rated_id,job_id,puntuacion,comentario,tipo) VALUES (?,?,?,?,?,?,?)',
    [uuidv4(), req.user.id, req.params.id, job_id, puntuacion, comentario || '', tipo || 'general']);
  res.json({ success: true });
});

router.get('/:id/ratings', authMiddleware, (req, res) => {
  res.json(query(
    'SELECT r.*,u.nombre,u.apellido,u.foto,j.titulo as job_titulo FROM ratings r JOIN users u ON u.id=r.rater_id JOIN jobs j ON j.id=r.job_id WHERE r.rated_id=? ORDER BY r.created_at DESC',
    [req.params.id]));
});

router.get('/:id', authMiddleware, (req, res) => {
  const u = query('SELECT id,nombre,apellido,foto,bio,cargo,ciudad,iglesia,created_at FROM users WHERE id=?', [req.params.id]);
  if (!u.length) return res.status(404).json({ error: 'No encontrado' });
  res.json(addRating(u[0]));
});

module.exports = router;
