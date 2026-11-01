import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const API = `${BACKEND_URL}/api`;
export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cs-session') || 'null'); } catch { return null; }
  });
  const [mode, setMode] = useState('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [online, setOnline] = useState([]);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  async function submitAuth(e) {
    e.preventDefault(); setError('');
    try {
      const data = await request(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ username, password }) });
      localStorage.setItem('cs-session', JSON.stringify(data)); setSession(data);
    } catch (e) { setError(e.message); }
  }
  function logout() {
    socketRef.current?.disconnect(); localStorage.removeItem('cs-session');
    setSession(null); setActive(null); setMessages([]); setUsers([]);
  }
  useEffect(() => {
    if (!session?.token) return;
    const socket = io(BACKEND_URL, { auth: { token: session.token } });
    socketRef.current = socket;
    socket.on('presence', setOnline);
    socket.on('new-message', msg => {
      if (active && (msg.from === active.id || msg.to === active.id)) setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });
    socket.on('connect_error', () => setError('Live connection failed. Check that the backend terminal is running.'));
    return () => socket.disconnect();
  }, [session?.token, active?.id]);
  async function searchUsers(e) {
    e?.preventDefault(); setError('');
    try { setUsers(await request(`/users?q=${encodeURIComponent(query)}`)); }
    catch (e) { setError(e.message); }
  }
  async function openChat(user) {
    setActive(user); setError('');
    try { setMessages(await request(`/messages/${user.id}`)); }
    catch (e) { setError(e.message); }
  }
  function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !active || !socketRef.current?.connected) return;
    socketRef.current.emit('private-message', { to: active.id, text });
    setDraft('');
  }
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (!session) return <main className="auth-wrap"><div className="orb orb-a"/><div className="orb orb-b"/><form className="auth-card" onSubmit={submitAuth}>
    <div className="logo">✦</div><p className="eyebrow">YOUR SPACE TO CONNECT</p><h1>ChatSphere</h1><p className="muted">A simple, private place to talk.</p>
    <div className="switch"><button type="button" className={mode==='register'?'selected':''} onClick={()=>setMode('register')}>Create account</button><button type="button" className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Sign in</button></div>
    <label>Username</label><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. alex_01" autoComplete="username" required minLength={3}/>
    <label>Password</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="At least 6 characters" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={6}/>
    {error && <p className="error">{error}</p>}<button className="primary full">{mode==='register'?'Create account':'Sign in'} <span>→</span></button>
    <p className="footnote">Usernames: 3–20 letters, numbers or underscores.</p>
  </form></main>;

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">✦</span><div><b>ChatSphere</b><small>YOUR MESSAGES, IN ONE PLACE</small></div></div>
      <div className="profile"><div className="avatar">{session.user.username[0].toUpperCase()}</div><div className="profile-info"><b>{session.user.username}</b><small><i/> Online</small></div><button className="logout" onClick={logout}>↗</button></div>
      <form className="search" onSubmit={searchUsers}><input value={query} onChange={setQuery} placeholder="Find people…"/><button aria-label="Search">⌕</button></form>
      <div className="list-label">PEOPLE <span>{users.length}</span></div>
      <div className="people">{users.map(u=><button key={u.id} className={`person ${active?.id===u.id?'active':''}`} onClick={()=>openChat(u)}><div className="avatar small">{u.username[0].toUpperCase()}</div><div className="person-text"><b>{u.username}</b><small>{online.includes(u.id)?'Online':'Start a conversation'}</small></div><span className={`status ${online.includes(u.id)?'on':''}`}/></button>)}{!users.length&&<p className="empty">Search for a username to start chatting.</p>}</div>
      <div className="sidebar-bottom">CONNECTED LOCALLY <span className="green-dot"/> </div>
    </aside>
    <section className="chat-area">
      {error&&<div className="toast" onClick={()=>setError('')}>{error} ×</div>}
      {!active ? <div className="welcome"><div className="welcome-icon">✦</div><p className="eyebrow">WELCOME TO YOUR SPACE</p><h2>Good conversations<br/>start with hello.</h2><p className="muted">Search for someone on the left and send your first message.</p><div className="welcome-hint">✧ &nbsp; Private one-to-one conversations</div></div> :
      <><header className="chat-header"><div className="avatar">{active.username[0].toUpperCase()}</div><div><b>{active.username}</b><small><span className={`status ${online.includes(active.id)?'on':''}`}/>{online.includes(active.id)?'Online':'Conversation'}</small></div></header>
      <div className="messages">{messages.map(m=><div key={m.id} className={`message-row ${m.from===session.user.id?'mine':''}`}><div className="bubble">{m.text}<small>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div></div>)}{!messages.length&&<div className="first-message">Say hello to {active.username} 👋</div>}<div ref={bottomRef}/></div>
      <form className="composer" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={`Message ${active.username}…`} maxLength={2000}/><button className="primary" disabled={!draft.trim()}>Send <span>↗</span></button></form></>}
    </section>
  </main>;
}
