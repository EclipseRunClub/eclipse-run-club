// =====================
// ECLIPSE RUN CLUB APP
// =====================

// --- DATA STORE ---
// In a real app this would connect to a database.
// For now we use localStorage so data persists between visits.

const DB = {
  get: (key) => { try { return JSON.parse(localStorage.getItem('erc_' + key)); } catch { return null; } },
  set: (key, val) => localStorage.setItem('erc_' + key, JSON.stringify(val)),
};

// --- SEED DATA ---
const DEFAULT_EVENTS = [
  { id: 1, title: "Victoria Park 5K", date: "2026-04-26", time: "7:00 AM", location: "Victoria Park, E9", distance: "5K · All paces", going: 24 },
  { id: 2, title: "Regents Canal 10K", date: "2026-05-03", time: "8:00 AM", location: "Mile End, E3", distance: "10K · Intermediate", going: 17 },
  { id: 3, title: "Night Run — Eclipse Special", date: "2026-05-10", time: "9:00 PM", location: "Hackney Marshes", distance: "5K · All paces", going: 41 },
  { id: 4, title: "Hampstead Heath Trail Run", date: "2026-05-17", time: "8:30 AM", location: "Hampstead Heath, NW3", distance: "8K · All paces", going: 29 },
  { id: 5, title: "Eclipse Summer 10K", date: "2026-06-07", time: "7:30 AM", location: "Victoria Park, E9", distance: "10K · All paces", going: 55 },
];

const DEFAULT_SPOTLIGHT = [
  { id: 1, name: "Sarah R.", initials: "SR", type: "pb", badge: "New PB", value: "24:38", label: "New Personal Best · 5K", icon: "⚡", text: "Just smashed my 5K personal best at this morning's run! Couldn't have done it without you all pushing me every week. Eclipse family 🖤", cheers: 14, comments: 3, time: "2 hours ago" },
  { id: 2, name: "Dan M.", initials: "DM", type: "race", badge: "1st Race", value: "58:12", label: "Race Completion · 10K", icon: "🏅", text: "Completed my first ever official 10K race. 14 months ago I couldn't run to the end of the street. Thank you Eclipse!", cheers: 31, comments: 8, time: "Yesterday" },
  { id: 3, name: "Aisha K.", initials: "AK", type: "milestone", badge: "Milestone", value: "100 KM", label: "Distance Milestone", icon: "🌑", text: "Hit 100km total with Eclipse this month. Never thought I'd be a runner but here we are!", cheers: 22, comments: 5, time: "3 days ago" },
];

const DEFAULT_NOTIFICATIONS = [
  { id: 1, icon: "🏃", text: "New event added: Eclipse Summer 10K on June 7th", time: "Just now" },
  { id: 2, icon: "🎉", text: "Sarah R. just posted a new achievement — go cheer her on!", time: "2 hours ago" },
  { id: 3, icon: "📅", text: "Reminder: Victoria Park 5K is tomorrow at 7:00 AM", time: "Yesterday" },
];

// Initialise data if not set
if (!DB.get('events')) DB.set('events', DEFAULT_EVENTS);
if (!DB.get('spotlight')) DB.set('spotlight', DEFAULT_SPOTLIGHT);
if (!DB.get('notifications')) DB.set('notifications', DEFAULT_NOTIFICATIONS);
if (!DB.get('cheered')) DB.set('cheered', []);
if (!DB.get('rsvp')) DB.set('rsvp', []);

// --- STATE ---
let currentUser = DB.get('user') || null;
let previousScreen = 'home';
let authMode = 'signin';

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  renderHome();
  renderEvents();
  renderSpotlight();
  renderChat();
  renderProfile();
  renderNotifications();
  updateNotifDot();
  if (!currentUser) {
    setTimeout(() => openAuthModal(), 800);
  }
});

// --- SCREEN NAVIGATION ---
function showScreen(name) {
  if (name !== 'notifications') previousScreen = getCurrentScreen();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  const nav = document.getElementById('nav-' + name);
  if (nav) nav.classList.add('active');
  if (name === 'notifications') markNotifsRead();
}

function getCurrentScreen() {
  const active = document.querySelector('.screen.active');
  return active ? active.id.replace('screen-', '') : 'home';
}

function goBack() {
  showScreen(previousScreen || 'home');
}

// --- HOME ---
function renderHome() {
  const events = DB.get('events') || [];
  const next = events[0];
  if (next) {
    const d = new Date(next.date);
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    document.getElementById('next-event-date').textContent =
      `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} · ${next.time}`;
    document.getElementById('next-event-title').textContent = next.title;
    document.getElementById('next-event-location').querySelector('span').textContent = next.location;
    document.getElementById('next-event-distance').querySelector('span').textContent = next.distance;
    document.getElementById('stat-going').textContent = next.going;
    document.getElementById('stat-runs').textContent = next.distance.split(' ')[0];
  }

  const rsvps = DB.get('rsvp') || [];
  const btn = document.getElementById('rsvp-btn');
  if (next && rsvps.includes(next.id)) {
    btn.textContent = '✓ You\'re Going';
    btn.classList.add('going');
  }

  const list = document.getElementById('events-list');
  list.innerHTML = events.slice(0, 3).map(e => eventCardHTML(e)).join('');
}

function toggleRSVP() {
  if (!requireAuth()) return;
  const events = DB.get('events') || [];
  const next = events[0];
  if (!next) return;
  const rsvps = DB.get('rsvp') || [];
  const btn = document.getElementById('rsvp-btn');
  const statGoing = document.getElementById('stat-going');
  if (rsvps.includes(next.id)) {
    DB.set('rsvp', rsvps.filter(r => r !== next.id));
    next.going--;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> I\'m Going';
    btn.classList.remove('going');
  } else {
    rsvps.push(next.id);
    DB.set('rsvp', rsvps);
    next.going++;
    btn.textContent = "✓ You're Going";
    btn.classList.add('going');
  }
  events[0] = next;
  DB.set('events', events);
  statGoing.textContent = next.going;
  renderEvents();
}

// --- EVENTS ---
function eventCardHTML(e) {
  const d = new Date(e.date);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `
    <div class="event-card">
      <div class="event-date-block">
        <div class="event-day">${d.getDate()}</div>
        <div class="event-month">${months[d.getMonth()]}</div>
      </div>
      <div class="event-info">
        <div class="event-name">${e.title}</div>
        <div class="event-detail">${e.time} · ${e.location}</div>
      </div>
      <div class="event-going">${e.going} going</div>
    </div>`;
}

function renderEvents() {
  const events = DB.get('events') || [];
  const list = document.getElementById('all-events-list');
  if (!list) return;
  list.innerHTML = events.length
    ? events.map(e => eventCardHTML(e)).join('')
    : '<div class="empty-state"><div class="empty-state-icon">📅</div>No upcoming events yet.</div>';
}

// --- SPOTLIGHT ---
function renderSpotlight() {
  const posts = DB.get('spotlight') || [];
  const cheered = DB.get('cheered') || [];
  const list = document.getElementById('spotlight-list');
  if (!list) return;
  list.innerHTML = posts.length ? posts.map(p => `
    <div class="spotlight-card" id="sp-${p.id}">
      <div class="spotlight-header">
        <div class="sp-avatar">${p.initials}</div>
        <div>
          <div class="sp-name">${p.name}</div>
          <div class="sp-time">${p.time}</div>
        </div>
        <div class="sp-badge">${p.badge}</div>
      </div>
      <div class="sp-content">${p.text}</div>
      <div class="sp-achievement">
        <div class="sp-ach-icon">${p.icon}</div>
        <div>
          <div class="sp-ach-label">${p.label}</div>
          <div class="sp-ach-value">${p.value}</div>
        </div>
      </div>
      <div class="sp-actions">
        <button class="sp-action-btn cheer ${cheered.includes(p.id) ? 'cheered' : ''}"
          onclick="cheerPost(${p.id}, this)">
          🎉 Cheer · <span class="cheer-count">${p.cheers}</span>
        </button>
        <button class="sp-action-btn">💬 Comment</button>
        <div class="sp-count">${p.comments} comments</div>
      </div>
    </div>`).join('')
    : '<div class="empty-state"><div class="empty-state-icon">🌟</div>No achievements yet. Be the first to share!</div>';
}

function cheerPost(id, btn) {
  if (!requireAuth()) return;
  const cheered = DB.get('cheered') || [];
  if (cheered.includes(id)) return;
  cheered.push(id);
  DB.set('cheered', cheered);
  const posts = DB.get('spotlight') || [];
  const post = posts.find(p => p.id === id);
  if (post) {
    post.cheers++;
    DB.set('spotlight', posts);
    btn.querySelector('.cheer-count').textContent = post.cheers;
    btn.style.background = '#222a10';
    btn.style.borderColor = '#3a4a10';
  }
}

function showPostForm() {
  if (!requireAuth()) return;
  openModal('modal-post');
}

function submitPost() {
  const type = document.getElementById('post-type').value;
  const value = document.getElementById('post-value').value.trim();
  const text = document.getElementById('post-text').value.trim();
  if (!value || !text) { alert('Please fill in all fields.'); return; }
  const badgeMap = { pb: 'New PB', race: '1st Race', milestone: 'Milestone' };
  const iconMap = { pb: '⚡', race: '🏅', milestone: '🌑' };
  const labelMap = { pb: 'New Personal Best', race: 'Race Completion', milestone: 'Distance Milestone' };
  const posts = DB.get('spotlight') || [];
  const user = DB.get('user');
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
  posts.unshift({
    id: Date.now(),
    name: user.name,
    initials,
    type,
    badge: badgeMap[type],
    value,
    label: labelMap[type],
    icon: iconMap[type],
    text,
    cheers: 0,
    comments: 0,
    time: 'Just now'
  });
  DB.set('spotlight', posts);
  closeModal();
  renderSpotlight();
  showScreen('spotlight');
}

// --- CHAT ---
function renderChat() {
  const chats = [
    { initials: 'EC', name: 'Eclipse Group Chat', preview: 'Welcome to Eclipse Run Club! 🖤', time: 'now', unread: 3, main: true },
    { initials: 'SR', name: 'Sarah R.', preview: 'Are we meeting at the usual spot?', time: '2m', unread: 0 },
    { initials: 'DM', name: 'Dan M.', preview: 'That 10K route was incredible', time: '1h', unread: 0 },
    { initials: 'AK', name: 'Aisha K.', preview: 'Thanks for the pace advice!', time: '3h', unread: 0 },
  ];
  const list = document.getElementById('chat-list');
  if (!list) return;
  list.innerHTML = chats.map(c => `
    <div class="chat-item" onclick="openChat('${c.name}')">
      <div class="avatar ${c.main ? 'main' : ''}">${c.initials}</div>
      <div class="chat-meta">
        <div class="chat-name">${c.name}</div>
        <div class="chat-preview">${c.preview}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        <div class="chat-time">${c.time}</div>
        ${c.unread > 0 ? `<div class="unread-badge">${c.unread}</div>` : ''}
      </div>
    </div>`).join('');
}

function openChat(name) {
  if (!requireAuth()) return;
  alert(`Opening chat with ${name} — full messaging coming soon!`);
}

// --- PROFILE ---
function renderProfile() {
  const user = DB.get('user');
  if (user) {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
    document.getElementById('profile-initials').textContent = initials;
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-tag').textContent = 'Eclipse Member · Since 2026';
    document.getElementById('p-runs').textContent = user.runs || 0;
    document.getElementById('p-km').textContent = user.km || 0;
    document.getElementById('p-events').textContent = user.events || 0;
  } else {
    document.getElementById('profile-initials').textContent = '?';
    document.getElementById('profile-name').textContent = 'Sign In';
    document.getElementById('profile-tag').textContent = 'Join Eclipse';
  }
}

function editProfile() {
  if (!requireAuth()) return;
  alert('Profile editing coming soon!');
}

function signOut() {
  if (confirm('Are you sure you want to sign out?')) {
    DB.set('user', null);
    currentUser = null;
    renderProfile();
    showScreen('home');
    setTimeout(() => openAuthModal(), 400);
  }
}

// --- NOTIFICATIONS ---
function renderNotifications() {
  const notifs = DB.get('notifications') || [];
  const list = document.getElementById('notifications-list');
  if (!list) return;
  list.innerHTML = notifs.length ? notifs.map(n => `
    <div class="notif-item">
      <div class="notif-icon">${n.icon}</div>
      <div>
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('')
    : '<div class="empty-state"><div class="empty-state-icon">🔔</div>No notifications yet.</div>';
}

function updateNotifDot() {
  const dot = document.getElementById('notif-dot');
  const notifs = DB.get('notifications') || [];
  if (notifs.length > 0) dot.classList.add('active');
}

function markNotifsRead() {
  document.getElementById('notif-dot').classList.remove('active');
}

// --- AUTH ---
function requireAuth() {
  if (DB.get('user')) return true;
  openAuthModal();
  return false;
}

function openAuthModal() {
  authMode = 'signin';
  document.getElementById('auth-title').textContent = 'Sign In';
  document.getElementById('auth-name').style.display = 'none';
  openModal('modal-auth');
}

function toggleAuthMode() {
  if (authMode === 'signin') {
    authMode = 'signup';
    document.getElementById('auth-title').textContent = 'Create Account';
    document.getElementById('auth-name').style.display = 'block';
    document.querySelector('#modal-auth .modal-btn').textContent = 'Create Account';
    document.querySelector('#modal-auth span:last-child').textContent = 'Sign In';
  } else {
    authMode = 'signin';
    document.getElementById('auth-title').textContent = 'Sign In';
    document.getElementById('auth-name').style.display = 'none';
    document.querySelector('#modal-auth .modal-btn').textContent = 'Sign In';
    document.querySelector('#modal-auth span:last-child').textContent = 'Sign Up';
  }
}

function submitAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const name = document.getElementById('auth-name').value.trim();
  if (!email || !password) { alert('Please enter your email and password.'); return; }
  if (authMode === 'signup' && !name) { alert('Please enter your name.'); return; }
  const user = authMode === 'signup'
    ? { name, email, runs: 0, km: 0, events: 0 }
    : { name: email.split('@')[0], email, runs: 0, km: 0, events: 0 };
  DB.set('user', user);
  currentUser = user;
  closeModal();
  renderProfile();
}

// --- MODALS ---
function openModal(id) {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById(id).classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}
