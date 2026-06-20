const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/conversations', authMiddleware, (req, res) => {
  const uid = req.user.id;
  res.json(query(
    "SELECT m.id,m.contenido,m.created_at,CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END as other_user_id,u.nombre,u.apellido,u.foto,SUM(CASE WHEN m.receiver_id=? AND m.leido=0 THEN 1 ELSE 0 END) as unread_count FROM messages m JOIN users u ON u.id=(CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END) WHERE m.sender_id=? OR m.receiver_id=? GROUP BY other_user_id ORDER BY m.created_at DESC",
    [uid, uid, uid, uid, uid]));
});

router.get('/:userId', authMiddleware, (req, res) => {
  const msgs = query(
    'SELECT m.*,s.nombre as sender_nombre FROM messages m JOIN users s ON s.id=m.sender_id WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?) ORDER BY m.created_at ASC LIMIT 100',
    [req.user.id, req.params.userId, req.params.userId, req.user.id]);
  run('UPDATE messages SET leido=1 WHERE receiver_id=? AND sender_id=?', [req.user.id, req.params.userId]);
  res.json(msgs);
});

router.post('/:userId', authMiddleware, (req, res) => {
  const { contenido } = req.body;
  if (!contenido?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });
  const id = uuidv4();
  run('INSERT INTO messages (id,sender_id,receiver_id,contenido) VALUES (?,?,?,?)',
    [id, req.user.id, req.params.userId, contenido]);
  res.json({ success: true, id });
});

module.exports = router;
