const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'faithwork_secret_iglesia_2024';

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(403).json({ error: 'Token inválido' }); }
}

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, nombre: user.nombre, accountType: user.accountType || 'user' }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { authMiddleware, generateToken };
