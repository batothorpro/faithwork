const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../db/database');
const { generateToken } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/email');
const router = express.Router();

// ===== REGISTRO DE PERSONA =====
router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, ciudad, iglesia } = req.body;
    if (!nombre || !apellido || !email || !password)
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    if (query('SELECT id FROM users WHERE email=?', [email]).length > 0)
      return res.status(400).json({ error: 'El correo ya está registrado' });
    if (query('SELECT id FROM companies WHERE email=?', [email]).length > 0)
      return res.status(400).json({ error: 'Ese correo ya está registrado como empresa' });

    const id = uuidv4();
    const hash = await bcrypt.hash(password, 10);
    run('INSERT INTO users (id,nombre,apellido,email,password,ciudad,iglesia) VALUES (?,?,?,?,?,?,?)',
      [id, nombre, apellido, email, hash, ciudad || '', iglesia || '']);
    res.json({
      token: generateToken({ id, email, nombre, accountType: 'user' }),
      user: { id, nombre, apellido, email, ciudad, iglesia },
      accountType: 'user'
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al registrar' }); }
});

// ===== REGISTRO DE EMPRESA =====
router.post('/register-company', async (req, res) => {
  try {
    const { nombre, email, password, descripcion, sector, ciudad, sitio_web } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
    if (query('SELECT id FROM companies WHERE email=?', [email]).length > 0)
      return res.status(400).json({ error: 'El correo ya está registrado' });
    if (query('SELECT id FROM users WHERE email=?', [email]).length > 0)
      return res.status(400).json({ error: 'Ese correo ya está registrado como persona' });

    const id = uuidv4();
    const hash = await bcrypt.hash(password, 10);
    run('INSERT INTO companies (id,owner_id,nombre,descripcion,sector,ciudad,sitio_web,email,password) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, id, nombre, descripcion || '', sector || '', ciudad || '', sitio_web || '', email, hash]);
    res.json({
      token: generateToken({ id, email, nombre, accountType: 'company' }),
      user: { id, nombre, email, descripcion, sector, ciudad, sitio_web },
      accountType: 'company'
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al registrar empresa' }); }
});

// ===== LOGIN (detecta automáticamente si es persona o empresa) =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const users = query('SELECT * FROM users WHERE email=?', [email]);
    if (users.length && await bcrypt.compare(password, users[0].password)) {
      const { password: _, ...userSafe } = users[0];
      return res.json({ token: generateToken({ ...users[0], accountType: 'user' }), user: userSafe, accountType: 'user' });
    }

    const companies = query('SELECT * FROM companies WHERE email=?', [email]);
    if (companies.length && await bcrypt.compare(password, companies[0].password)) {
      const { password: _, ...companySafe } = companies[0];
      return res.json({ token: generateToken({ ...companies[0], accountType: 'company' }), user: companySafe, accountType: 'company' });
    }

    return res.status(401).json({ error: 'Credenciales incorrectas' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al iniciar sesión' }); }
});

// ===== SOLICITAR RECUPERACIÓN DE CONTRASEÑA =====
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Correo requerido' });

    let account = query('SELECT id,nombre,email FROM users WHERE email=?', [email])[0];
    let accountType = 'user';
    if (!account) {
      account = query('SELECT id,nombre,email FROM companies WHERE email=?', [email])[0];
      accountType = 'company';
    }

    // Por seguridad, siempre respondemos igual exista o no la cuenta
    if (!account) {
      return res.json({ success: true, message: 'Si el correo existe, se ha enviado un enlace de recuperación' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

    run('INSERT INTO password_resets (id,account_id,account_type,token,expires_at) VALUES (?,?,?,?,?)',
      [uuidv4(), account.id, accountType, token, expiresAt]);

    const emailResult = await sendPasswordResetEmail(account.email, account.nombre, token, accountType);
    if (!emailResult.success) {
      console.error('Fallo envío de email:', emailResult.error);
    }

    res.json({ success: true, message: 'Si el correo existe, se ha enviado un enlace de recuperación' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error procesando la solicitud' }); }
});

// ===== VALIDAR TOKEN DE RECUPERACIÓN =====
router.get('/reset-password/:token', (req, res) => {
  const reset = query('SELECT * FROM password_resets WHERE token=? AND used=0', [req.params.token])[0];
  if (!reset) return res.status(400).json({ error: 'Enlace inválido o ya utilizado' });
  if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: 'El enlace ha expirado' });
  res.json({ valid: true });
});

// ===== CONFIRMAR NUEVA CONTRASEÑA =====
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Datos incompletos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const reset = query('SELECT * FROM password_resets WHERE token=? AND used=0', [token])[0];
    if (!reset) return res.status(400).json({ error: 'Enlace inválido o ya utilizado' });
    if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: 'El enlace ha expirado' });

    const hash = await bcrypt.hash(password, 10);
    const table = reset.account_type === 'company' ? 'companies' : 'users';
    run(`UPDATE ${table} SET password=? WHERE id=?`, [hash, reset.account_id]);
    run('UPDATE password_resets SET used=1 WHERE id=?', [reset.id]);

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error al restablecer la contraseña' }); }
});

module.exports = router;

