const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

function authorJoinFields() {
  return `
    COALESCE(c.nombre, u.nombre) as author_nombre,
    u.apellido as author_apellido,
    COALESCE(c.logo, u.foto) as author_foto
  `;
}

// ===== FEED GENERAL (todas las publicaciones, más recientes primero) =====
router.get('/', authMiddleware, (req, res) => {
  const posts = query(`
    SELECT p.*, ${authorJoinFields()},
           (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) as total_likes,
           (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id) as total_comments,
           (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id AND user_id=?) as liked_by_me
    FROM posts p
    LEFT JOIN users u ON u.id = p.author_id AND p.author_type='user'
    LEFT JOIN companies c ON c.id = p.author_id AND p.author_type='company'
    ORDER BY p.created_at DESC
    LIMIT 50
  `, [req.user.id]);

  const postIds = posts.map(p => p.id);
  const mediaByPost = {};
  if (postIds.length) {
    const placeholders = postIds.map(() => '?').join(',');
    const media = query(`SELECT * FROM post_media WHERE post_id IN (${placeholders}) ORDER BY orden ASC`, postIds);
    media.forEach(m => {
      if (!mediaByPost[m.post_id]) mediaByPost[m.post_id] = [];
      mediaByPost[m.post_id].push({ url: m.url, tipo: m.tipo });
    });
  }

  posts.forEach(p => { p.media = mediaByPost[p.id] || []; });
  res.json(posts);
});

// ===== PUBLICACIONES DE UN AUTOR ESPECÍFICO (para mostrar en su perfil) =====
router.get('/by/:authorId', authMiddleware, (req, res) => {
  const posts = query(`
    SELECT p.*, ${authorJoinFields()},
           (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) as total_likes,
           (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id) as total_comments,
           (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id AND user_id=?) as liked_by_me
    FROM posts p
    LEFT JOIN users u ON u.id = p.author_id AND p.author_type='user'
    LEFT JOIN companies c ON c.id = p.author_id AND p.author_type='company'
    WHERE p.author_id=?
    ORDER BY p.created_at DESC
  `, [req.user.id, req.params.authorId]);

  const postIds = posts.map(p => p.id);
  const mediaByPost = {};
  if (postIds.length) {
    const placeholders = postIds.map(() => '?').join(',');
    const media = query(`SELECT * FROM post_media WHERE post_id IN (${placeholders}) ORDER BY orden ASC`, postIds);
    media.forEach(m => {
      if (!mediaByPost[m.post_id]) mediaByPost[m.post_id] = [];
      mediaByPost[m.post_id].push({ url: m.url, tipo: m.tipo });
    });
  }
  posts.forEach(p => { p.media = mediaByPost[p.id] || []; });
  res.json(posts);
});

// ===== CREAR PUBLICACIÓN =====
router.post('/', authMiddleware, (req, res) => {
  const { contenido, media } = req.body; // media: [{url, tipo}, ...]
  if (!contenido?.trim() && (!media || !media.length)) {
    return res.status(400).json({ error: 'La publicación necesita texto o al menos un archivo' });
  }

  const id = uuidv4();
  run('INSERT INTO posts (id,author_id,author_type,contenido) VALUES (?,?,?,?)',
    [id, req.user.id, req.user.accountType || 'user', contenido || '']);

  if (media && media.length) {
    media.forEach((m, i) => {
      run('INSERT INTO post_media (id,post_id,url,tipo,orden) VALUES (?,?,?,?,?)',
        [uuidv4(), id, m.url, m.tipo || 'image', i]);
    });
  }

  res.json({ success: true, id });
});

// ===== ELIMINAR PUBLICACIÓN (solo el autor) =====
router.delete('/:id', authMiddleware, (req, res) => {
  const post = query('SELECT * FROM posts WHERE id=? AND author_id=?', [req.params.id, req.user.id]);
  if (!post.length) return res.status(403).json({ error: 'No autorizado' });
  run('DELETE FROM post_media WHERE post_id=?', [req.params.id]);
  run('DELETE FROM post_likes WHERE post_id=?', [req.params.id]);
  run('DELETE FROM post_comments WHERE post_id=?', [req.params.id]);
  run('DELETE FROM posts WHERE id=?', [req.params.id]);
  res.json({ success: true });
});

// ===== LIKE / UNLIKE =====
router.post('/:id/like', authMiddleware, (req, res) => {
  const existing = query('SELECT id FROM post_likes WHERE post_id=? AND user_id=?', [req.params.id, req.user.id]);
  if (existing.length) {
    run('DELETE FROM post_likes WHERE id=?', [existing[0].id]);
    return res.json({ success: true, liked: false });
  }
  run('INSERT INTO post_likes (id,post_id,user_id) VALUES (?,?,?)', [uuidv4(), req.params.id, req.user.id]);
  res.json({ success: true, liked: true });
});

// ===== COMENTARIOS =====
router.get('/:id/comments', authMiddleware, (req, res) => {
  res.json(query(`
    SELECT pc.*, COALESCE(c.nombre, u.nombre) as author_nombre, u.apellido as author_apellido, COALESCE(c.logo, u.foto) as author_foto
    FROM post_comments pc
    LEFT JOIN users u ON u.id = pc.author_id AND pc.author_type='user'
    LEFT JOIN companies c ON c.id = pc.author_id AND pc.author_type='company'
    WHERE pc.post_id=?
    ORDER BY pc.created_at ASC
  `, [req.params.id]));
});

router.post('/:id/comments', authMiddleware, (req, res) => {
  const { contenido } = req.body;
  if (!contenido?.trim()) return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  const id = uuidv4();
  run('INSERT INTO post_comments (id,post_id,author_id,author_type,contenido) VALUES (?,?,?,?,?)',
    [id, req.params.id, req.user.id, req.user.accountType || 'user', contenido.trim()]);
  res.json({ success: true, id });
});

module.exports = router;
