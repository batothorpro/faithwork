const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Helper: obtiene info del publicador (persona o empresa) según quién creó la oferta
function getPosterJoin() {
  return `
    LEFT JOIN users u ON u.id = j.user_id
    LEFT JOIN companies c ON c.id = j.company_id
  `;
}

function posterFields() {
  return `
    COALESCE(c.nombre, u.nombre) as poster_nombre,
    u.apellido as poster_apellido,
    COALESCE(c.logo, u.foto) as poster_foto,
    u.iglesia as poster_iglesia,
    CASE WHEN j.company_id IS NOT NULL THEN 'company' ELSE 'user' END as poster_type
  `;
}

router.get('/mine/list', authMiddleware, (req, res) => {
  const col = req.user.accountType === 'company' ? 'company_id' : 'user_id';
  res.json(query(`SELECT j.*,COUNT(a.id) as total_aplicantes FROM jobs j LEFT JOIN applications a ON a.job_id=j.id WHERE j.${col}=? GROUP BY j.id ORDER BY j.created_at DESC`, [req.user.id]));
});

router.get('/mine/applications', authMiddleware, (req, res) => {
  res.json(query(`
    SELECT a.*,j.titulo,j.empresa,j.ciudad,j.tipo,
           COALESCE(c.nombre, u.nombre) as empleador_nombre,
           u.apellido as empleador_apellido
    FROM applications a
    JOIN jobs j ON j.id=a.job_id
    LEFT JOIN users u ON u.id=j.user_id
    LEFT JOIN companies c ON c.id=j.company_id
    WHERE a.user_id=? ORDER BY a.created_at DESC`, [req.user.id]));
});

router.get('/', authMiddleware, (req, res) => {
  let sql = `
    SELECT j.*, ${posterFields()}, COUNT(a.id) as total_aplicantes
    FROM jobs j
    ${getPosterJoin()}
    LEFT JOIN applications a ON a.job_id=j.id
    WHERE j.activo=1`;
  const p = [];
  if (req.query.tipo) { sql += ' AND j.tipo=?'; p.push(req.query.tipo); }
  if (req.query.modalidad) { sql += ' AND j.modalidad=?'; p.push(req.query.modalidad); }
  if (req.query.ciudad) { sql += ' AND j.ciudad LIKE ?'; p.push('%' + req.query.ciudad + '%'); }
  if (req.query.area) { sql += ' AND j.area=?'; p.push(req.query.area); }
  if (req.query.q) {
    const t = '%' + req.query.q + '%';
    sql += ' AND (j.titulo LIKE ? OR j.empresa LIKE ? OR j.descripcion LIKE ?)';
    p.push(t, t, t);
  }
  sql += ' GROUP BY j.id ORDER BY j.created_at DESC LIMIT 50';
  res.json(query(sql, p));
});

router.post('/', authMiddleware, (req, res) => {
  const {
    titulo, empresa, descripcion, requisitos, tipo, modalidad, ciudad, salario,
    area, nivel_experiencia, vacantes, fecha_limite, beneficios
  } = req.body;

  if (!titulo || !empresa || !descripcion) return res.status(400).json({ error: 'Título, empresa y descripción requeridos' });

  const id = uuidv4();
  const isCompany = req.user.accountType === 'company';

  run(`INSERT INTO jobs
    (id,user_id,company_id,titulo,empresa,descripcion,requisitos,tipo,modalidad,ciudad,salario,area,nivel_experiencia,vacantes,fecha_limite,beneficios)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      isCompany ? null : req.user.id,
      isCompany ? req.user.id : null,
      titulo, empresa, descripcion, requisitos || '',
      tipo || 'full-time', modalidad || 'presencial', ciudad || '', salario || '',
      area || '', nivel_experiencia || '', vacantes || 1, fecha_limite || '', beneficios || ''
    ]);
  res.json({ success: true, id });
});

router.get('/:id', authMiddleware, (req, res) => {
  const j = query(`
    SELECT j.*, ${posterFields()}, u.ciudad as user_ciudad
    FROM jobs j
    ${getPosterJoin()}
    WHERE j.id=?`, [req.params.id]);
  if (!j.length) return res.status(404).json({ error: 'No encontrada' });
  const job = j[0];
  job.ya_aplique = query('SELECT id FROM applications WHERE job_id=? AND user_id=?', [req.params.id, req.user.id]).length > 0;
  res.json(job);
});

router.post('/:id/apply', authMiddleware, (req, res) => {
  if (req.user.accountType === 'company') return res.status(403).json({ error: 'Las empresas no pueden aplicar a ofertas' });
  const job = query('SELECT * FROM jobs WHERE id=? AND activo=1', [req.params.id]);
  if (!job.length) return res.status(404).json({ error: 'No encontrada' });
  if (job[0].user_id === req.user.id) return res.status(400).json({ error: 'No puedes aplicar a tu propia oferta' });
  if (query('SELECT id FROM applications WHERE job_id=? AND user_id=?', [req.params.id, req.user.id]).length)
    return res.status(400).json({ error: 'Ya aplicaste a esta oferta' });
  run('INSERT INTO applications (id,job_id,user_id,mensaje) VALUES (?,?,?,?)',
    [uuidv4(), req.params.id, req.user.id, req.body.mensaje || '']);
  res.json({ success: true, message: 'Aplicación enviada' });
});

router.get('/:id/applicants', authMiddleware, (req, res) => {
  const col = req.user.accountType === 'company' ? 'company_id' : 'user_id';
  if (!query(`SELECT id FROM jobs WHERE id=? AND ${col}=?`, [req.params.id, req.user.id]).length)
    return res.status(403).json({ error: 'No autorizado' });
  res.json(query(
    'SELECT a.id,a.mensaje,a.status,a.created_at,u.id as user_id,u.nombre,u.apellido,u.cargo,u.ciudad,u.foto,AVG(r.puntuacion) as rating_promedio FROM applications a JOIN users u ON u.id=a.user_id LEFT JOIN ratings r ON r.rated_id=u.id WHERE a.job_id=? GROUP BY a.id ORDER BY a.created_at DESC',
    [req.params.id]));
});

router.put('/:id/applicants/:appId', authMiddleware, (req, res) => {
  const col = req.user.accountType === 'company' ? 'company_id' : 'user_id';
  if (!query(`SELECT id FROM jobs WHERE id=? AND ${col}=?`, [req.params.id, req.user.id]).length)
    return res.status(403).json({ error: 'No autorizado' });
  run('UPDATE applications SET status=? WHERE id=?', [req.body.status, req.params.appId]);
  res.json({ success: true });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const col = req.user.accountType === 'company' ? 'company_id' : 'user_id';
  run(`UPDATE jobs SET activo=0 WHERE id=? AND ${col}=?`, [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
