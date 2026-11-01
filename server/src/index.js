import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection failed:", err.message));
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const clientOrigin = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(s => s.trim()) : true;
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});
app.use(cors({
  origin: clientOrigin,
  credentials: true
}));
app.use(express.json());

const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true, minlength: 3 },
  passwordHash: { type: String, required: true }
}, { timestamps: true }));

const Message = mongoose.model('Message', new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 2000 }
}, { timestamps: true }));

function makeToken(user) {
  return jwt.sign({ id: user._id.toString(), username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Please log in.' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Session expired. Please log in again.' }); }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ChatSphere Fresh API' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username must be 3–20 characters: letters, numbers, underscores.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (await User.findOne({ username })) return res.status(409).json({ error: 'That username is already taken.' });
    const user = await User.create({ username, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: makeToken(user), user: { id: user._id, username: user.username } });
  } catch (e) { res.status(500).json({ error: 'Could not register. Check that MongoDB is running.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash)))
    return res.status(401).json({ error: 'Username or password is incorrect.' });
  res.json({ token: makeToken(user), user: { id: user._id, username: user.username } });
});

app.get('/api/users', auth, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const users = await User.find({ username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }, _id: { $ne: req.user.id } }).select('_id username').limit(20);
  res.json(users.map(u => ({ id: u._id, username: u.username })));
});

app.get('/api/messages/:otherId', auth, async (req, res) => {
  const other = req.params.otherId;
  const messages = await Message.find({ $or: [
    { from: req.user.id, to: other }, { from: other, to: req.user.id }
  ] }).sort({ createdAt: 1 }).limit(500);
  res.json(messages.map(m => ({ id: m._id, from: String(m.from), to: String(m.to), text: m.text, createdAt: m.createdAt })));
});

const online = new Map();
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { next(new Error('Unauthorized')); }
});
io.on('connection', socket => {
  online.set(socket.user.id, socket.id);
  io.emit('presence', [...online.keys()]);
  socket.on('private-message', async ({ to, text }) => {
    const clean = String(text || '').trim().slice(0, 2000);
    if (!to || !clean || to === socket.user.id) return;
    const saved = await Message.create({ from: socket.user.id, to, text: clean });
    const payload = { id: saved._id, from: socket.user.id, to, text: clean, createdAt: saved.createdAt };
    socket.emit('new-message', payload);
    const recipientSocket = online.get(to);
    if (recipientSocket) io.to(recipientSocket).emit('new-message', payload);
  });
  socket.on('disconnect', () => {
    online.delete(socket.user.id);
    io.emit('presence', [...online.keys()]);
  });
});

const port = Number(process.env.PORT || 5000);
try {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatsphere_fresh', { serverSelectionTimeoutMS: 5000 });
  console.log('✅ MongoDB connected');
  server.listen(port, () => console.log(`✅ ChatSphere API listening on http://localhost:${port}`));
} catch (e) {
  console.error('❌ MongoDB connection failed:', e.message);
  console.error('Check that the MongoDB Windows service is running and MONGO_URI uses 127.0.0.1.');
  process.exit(1);
}
