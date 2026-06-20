require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb, run } = require('./db/database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const JWT_SECRET = process.env.JWT_SECRET || 'faithwork_secret_iglesia_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map();

wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'auth') {
        try {
          const decoded = jwt.verify(msg.token, JWT_SECRET);
          userId = decoded.id;
          clients.set(userId, ws);
          ws.send(JSON.stringify({ type: 'auth_ok', userId }));
        } catch { ws.send(JSON.stringify({ type: 'auth_error' })); }
        return;
      }

      if (!userId) return;

      if (msg.type === 'message') {
        const { receiverId, contenido } = msg;
        if (!receiverId || !contenido?.trim()) return;
        const id = uuidv4();
        run('INSERT INTO messages (id,sender_id,receiver_id,contenido) VALUES (?,?,?,?)',
          [id, userId, receiverId, contenido]);
        const payload = JSON.stringify({ type: 'message', id, sender_id: userId, receiver_id: receiverId, contenido, created_at: new Date().toISOString() });
        const rWs = clients.get(receiverId);
        if (rWs && rWs.readyState === WebSocket.OPEN) rWs.send(payload);
        ws.send(JSON.stringify({ type: 'message_sent', id, receiver_id: receiverId, contenido, created_at: new Date().toISOString() }));
      }
    } catch (e) { console.error('WS error:', e); }
  });

  ws.on('close', () => { if (userId) clients.delete(userId); });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/posts', require('./routes/posts'));
app.get('/reset-password.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));

// Manejador de errores (incluye errores de Multer: tamaño, tipo de archivo, etc.)
app.use((err, req, res, next) => {
  if (err) {
    console.error('Error middleware:', err.message);
    return res.status(400).json({ error: err.message || 'Error procesando la solicitud' });
  }
  next();
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
getDb().then(() => {
  server.listen(PORT, () => console.log('FaithWork en http://localhost:' + PORT));
}).catch(err => { console.error('Error BD:', err); process.exit(1); });
