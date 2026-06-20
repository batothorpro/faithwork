const express = require('express');
const multer = require('multer');
const { run } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { uploadBuffer } = require('../utils/cloudinary');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB máximo por archivo
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido'));
  }
});

// ===== SUBIR FOTO DE PERFIL (persona o empresa) =====
router.post('/profile-photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'La foto de perfil debe ser una imagen' });

    const result = await uploadBuffer(req.file.buffer, {
      folder: 'faithwork/profiles',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
    });

    const table = req.user.accountType === 'company' ? 'companies' : 'users';
    const col = req.user.accountType === 'company' ? 'logo' : 'foto';
    run(`UPDATE ${table} SET ${col}=? WHERE id=?`, [result.secure_url, req.user.id]);

    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error('Error subiendo foto de perfil:', err);
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

// ===== SUBIR MEDIA PARA PUBLICACIONES (múltiples archivos) =====
router.post('/post-media', authMiddleware, upload.array('files', 6), async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No se recibieron archivos' });

    const uploads = await Promise.all(req.files.map(async (file) => {
      const isVideo = file.mimetype.startsWith('video/');
      const result = await uploadBuffer(file.buffer, {
        folder: 'faithwork/posts',
        resource_type: isVideo ? 'video' : 'image'
      });
      return { url: result.secure_url, tipo: isVideo ? 'video' : 'image' };
    }));

    res.json({ success: true, files: uploads });
  } catch (err) {
    console.error('Error subiendo media:', err);
    res.status(500).json({ error: 'Error al subir los archivos' });
  }
});

module.exports = router;
