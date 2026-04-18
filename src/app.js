// ================================
// ECLIPSE RUN CLUB — Supabase App
// ================================

const SUPABASE_URL = 'https://gzjaibvfeqchppqgtgrp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6amFpYnZmZXFjaHBwcWd0Z3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1Mjc2ODcsImV4cCI6MjA5MjEwMzY4N30.7Yxmso5BQ2uQ4w89PnHGt8JLRkhu6AMpWCBdZ_bj5ig';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- STATE ---
let currentUser = null;
let currentProfile = null;
let nextEvent = null;
let previousScreen = 'home';
let authMode = 'signin';

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadProfile();
  }
  await renderHome();
  await renderEvents();
  await renderSpotlight();
  renderChat();
  renderProfile();
  renderNotifications();
  if (!currentUser) setTimeout(() => openAuthModal(), 800);
});

// --- AUTH STATE CHANGE ---
db.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    currentUser = session.user;
    await loadProfile();
    renderProfile();
    await renderHome();
    await renderEvents();
    await renderSpotlight();
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    currentProfile = null;
    renderProfile();
  }
});

// --- LOAD PROFILE ---
async function loadProfile() {
  if (!currentUser) return;
  const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) {
    currentProfile = data;
  } else {
    // Create profile if doesn't exist
    const name = currentUser.user_metadata?.name || currentUser.email.split('@')[0];
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const { data: newProfile } = await db.from('profiles').insert({
      id: currentUser.id,
      name,
      email: currentUser.email,
      is_admin: false,
      runs: 0,
      km: 0,
      events_attended: 0
    }).select().single();
    currentProfile = newProfile;
  }
}

// --- SCREEN NAVIGATION ---
function showScreen(name) {
  if (name !== 'notifications') previousScreen = getCurrentScreen();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  const nav = document.getElementById('nav-' + name);
  if (nav) nav.classList.add('active');
}

function getCurrentScreen() {
  const active = document.querySelector('.screen.active');
  return active ? active.id.replace('screen-', '') : 'home';
}

function goBack() { showScreen(previousScreen || 'home'); }

// --- HOME ---
async function renderHome() {
  const { data: events } = await db.from('events').select('*').order('date', { ascending: true }).limit(3);
  if (!events || events.length === 0) {
    document.getElementById('next-event-date').textContent = 'No upcoming events';
    document.getElementById('next-event-title').textContent = 'Check back soon!';
    return;
  }
  nextEvent = events[0];
  const d = new Date(nextEvent.date);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('next-event-date').textContent = `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} · ${nextEvent.time}`;
  document.getElementById('next-event-title').textContent = nextEvent.title;
  document.getElementById('next-event-location').textContent = nextEvent.location;
  document.getElementById('next-event-distance').textContent = nextEvent.distance;
  document.getElementById('stat-going').textContent = nextEvent.going;
  document.getElementById('stat-distance').textContent = nextEvent.distance.split(' ')[0];

  // Member count
  const { count } = await db.from('profiles').select('*', { count: 'exact', head: true });
  document.getElementById('stat-members').textContent = count || 0;

  // Check if current user RSVPd
  if (currentUser) {
    const { data: rsvp } = await db.from('rsvps').select('id').eq('user_id', currentUser.id).eq('event_id', nextEvent.id).single();
    const btn = document.getElementById('rsvp-btn');
    if (rsvp) {
      btn.textContent = "✓ You're Going";
      btn.classList.add('going');
    } else {
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> I\'m Going';
      btn.classList.remove('going');
    }
  }

  // Events preview
  const list = document.getElementById('events-preview');
  list.innerHTML = events.map(e => eventCardHTML(e)).join('');
}

async function toggleRSVP() {
  if (!requireAuth()) return;
  if (!nextEvent) return;
  const btn = document.getElementById('rsvp-btn');
  const { data: existing } = await db.from('rsvps').select('id').eq('user_id', currentUser.id).eq('event_id', nextEvent.id).single();
  if (existing) {
    await db.from('rsvps').delete().eq('id', existing.id);
    await db.from('events').update({ going: nextEvent.going - 1 }).eq('id', nextEvent.id);
    nextEvent.going--;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> I\'m Going';
    btn.classList.remove('going');
  } else {
    await db.from('rsvps').insert({ user_id: currentUser.id, event_id: nextEvent.id });
    await db.from('events').update({ going: nextEvent.going + 1 }).eq('id', nextEvent.id);
    nextEvent.going++;
    btn.textContent = "✓ You're Going";
    btn.classList.add('going');
  }
  document.getElementById('stat-going').textContent = nextEvent.going;
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

async function renderEvents() {
  const { data: events } = await db.from('events').select('*').order('date', { ascending: true });
  const list = document.getElementById('all-events-list');
  if (!list) return;
  list.innerHTML = events && events.length
    ? events.map(e => eventCardHTML(e)).join('')
    : '<div class="empty-state"><div class="empty-state-icon">📅</div>No upcoming events yet.</div>';

  // Show add event button for admins
  if (currentProfile?.is_admin) {
    document.getElementById('admin-add-event-btn').style.display = 'block';
  }
}

function showAddEventModal() {
  openModal('modal-add-event');
}

async function submitEvent() {
  const title = document.getElementById('ev-title').value.trim();
  const date = document.getElementById('ev-date').value;
  const time = document.getElementById('ev-time').value.trim();
  const location = document.getElementById('ev-location').value.trim();
  const distance = document.getElementById('ev-distance').value.trim();
  if (!title || !date || !time || !location || !distance) {
    alert('Please fill in all fields.'); return;
  }
  const { error } = await db.from('events').insert({ title, date, time, location, distance, going: 0 });
  if (error) { alert('Error adding event: ' + error.message); return; }
  closeModal();
  await renderEvents();
  await renderHome();
  showScreen('events');
}

// --- SPOTLIGHT ---
async function renderSpotlight() {
  const isAdmin = currentProfile?.is_admin;
  const query = db.from('spotlight').select('*').order('created_at', { ascending: false });
  if (!isAdmin) query.eq('approved', true);
  const { data: posts } = await query;
  const list = document.getElementById('spotlight-list');
  if (!list) return;

  if (!posts || posts.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌟</div>No achievements yet. Be the first to share!</div>';
    return;
  }

  list.innerHTML = posts.map(p => `
    <div class="spotlight-card" id="sp-${p.id}">
      <div class="spotlight-header">
        <div class="sp-avatar">${p.initials}</div>
        <div>
          <div class="sp-name">${p.name}</div>
          <div class="sp-time">${formatTime(p.created_at)}</div>
        </div>
        <div class="sp-badge">${p.badge}</div>
        ${isAdmin && !p.approved ? `<button onclick="approvePost(${p.id})" style="margin-left:8px;background:#e8f542;color:#0c0c0c;border:none;border-radius:12px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;">APPROVE</button>` : ''}
      </div>
      ${!p.approved ? '<div style="font-size:11px;color:#666;margin-bottom:8px;font-style:italic;">Pending approval...</div>' : ''}
      <div class="sp-content">${p.content}</div>
      <div class="sp-achievement">
        <div class="sp-ach-icon">${p.icon}</div>
        <div>
          <div class="sp-ach-label">${p.label}</div>
          <div class="sp-ach-value">${p.value}</div>
        </div>
      </div>
      <div class="sp-actions">
        <button class="sp-action-btn cheer" onclick="cheerPost(${p.id}, this)">
          🎉 Cheer · <span class="cheer-count">${p.cheers}</span>
        </button>
        <div class="sp-count">${p.comments} comments</div>
      </div>
    </div>`).join('');
}

async function approvePost(id) {
  await db.from('spotlight').update({ approved: true }).eq('id', id);
  await renderSpotlight();
}

async function cheerPost(id, btn) {
  if (!requireAuth()) return;
  const { data: post } = await db.from('spotlight').select('cheers').eq('id', id).single();
  if (!post) return;
  await db.from('spotlight').update({ cheers: post.cheers + 1 }).eq('id', id);
  btn.querySelector('.cheer-count').textContent = post.cheers + 1;
  btn.style.background = '#222a10';
  btn.style.borderColor = '#3a4a10';
  btn.onclick = null;
}

function showPostForm() {
  if (!requireAuth()) return;
  openModal('modal-post');
}

async function submitPost() {
  const type = document.getElementById('post-type').value;
  const value = document.getElementById('post-value').value.trim();
  const content = document.getElementById('post-text').value.trim();
  if (!value || !content) { alert('Please fill in all fields.'); return; }
  const badgeMap = { pb: 'New PB', race: '1st Race', milestone: 'Milestone' };
  const iconMap = { pb: '⚡', race: '🏅', milestone: '🌑' };
  const labelMap = { pb: 'New Personal Best', race: 'Race Completion', milestone: 'Distance Milestone' };
  const name = currentProfile?.name || currentUser.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const { error } = await db.from('spotlight').insert({
    user_id: currentUser.id,
    name, initials,
    badge: badgeMap[type],
    value, content,
    label: labelMap[type],
    icon: iconMap[type],
    cheers: 0,
    comments: 0,
    approved: false
  });
  if (error) { alert('Error: ' + error.message); return; }
  closeModal();
  await renderSpotlight();
  showScreen('spotlight');
  alert('Your achievement has been submitted and will appear once approved by an admin!');
}

// --- CHAT ---
function renderChat() {
  const chats = [
    { initials: 'EC', name: 'Eclipse Group Chat', preview: 'Welcome to Eclipse Run Club! 🖤', time: 'now', unread: 1, main: true },
    { initials: 'SR', name: 'Sarah R.', preview: 'See you Saturday!', time: '2m', unread: 0 },
    { initials: 'DM', name: 'Dan M.', preview: 'That last run was brilliant', time: '1h', unread: 0 },
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
  alert(`Full messaging coming soon! For now use the Eclipse Group Chat on WhatsApp.`);
}

// --- PROFILE ---
function renderProfile() {
  if (currentProfile) {
    const initials = currentProfile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('profile-initials').textContent = initials;
    document.getElementById('profile-name').textContent = currentProfile.name;
    document.getElementById('profile-tag').textContent = 'Eclipse Member';
    document.getElementById('p-runs').textContent = currentProfile.runs || 0;
    document.getElementById('p-km').textContent = currentProfile.km || 0;
    document.getElementById('p-events').textContent = currentProfile.events_attended || 0;
    if (currentProfile.is_admin) {
      document.getElementById('admin-badge').style.display = 'block';
      document.getElementById('admin-add-event-btn').style.display = 'block';
    }
  } else {
    document.getElementById('profile-initials').textContent = '?';
    document.getElementById('profile-name').textContent = 'Sign In';
    document.getElementById('profile-tag').textContent = 'Join Eclipse';
    document.getElementById('admin-badge').style.display = 'none';
  }
}

async function signOut() {
  if (confirm('Are you sure you want to sign out?')) {
    await db.auth.signOut();
    currentUser = null;
    currentProfile = null;
    renderProfile();
    showScreen('home');
  }
}

// --- NOTIFICATIONS ---
function renderNotifications() {
  const notifs = [
    { icon: '🏃', text: 'Welcome to Eclipse Run Club! Your next run is coming up.', time: 'Just now' },
    { icon: '📅', text: 'New event added — check the Events tab!', time: 'Today' },
  ];
  const list = document.getElementById('notifications-list');
  if (!list) return;
  list.innerHTML = notifs.map(n => `
    <div class="notif-item">
      <div class="notif-icon">${n.icon}</div>
      <div>
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
  document.getElementById('notif-dot').classList.add('active');
}

// --- AUTH ---
function requireAuth() {
  if (currentUser) return true;
  openAuthModal();
  return false;
}

function openAuthModal() {
  authMode = 'signin';
  document.getElementById('auth-title').textContent = 'Sign In';
  document.getElementById('auth-name-wrap').style.display = 'none';
  document.getElementById('auth-submit-btn').textContent = 'Sign In';
  document.getElementById('auth-error').style.display = 'none';
  openModal('modal-auth');
}

function toggleAuthMode() {
  if (authMode === 'signin') {
    authMode = 'signup';
    document.getElementById('auth-title').textContent = 'Create Account';
    document.getElementById('auth-name-wrap').style.display = 'block';
    document.getElementById('auth-submit-btn').textContent = 'Create Account';
  } else {
    authMode = 'signin';
    document.getElementById('auth-title').textContent = 'Sign In';
    document.getElementById('auth-name-wrap').style.display = 'none';
    document.getElementById('auth-submit-btn').textContent = 'Sign In';
  }
}

async function submitAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const name = document.getElementById('auth-name').value.trim();
  const errEl = document.getElementById('auth-error');
  errEl.style.display = 'none';
  if (!email || !password) { showAuthError('Please enter your email and password.'); return; }
  if (authMode === 'signup') {
    if (!name) { showAuthError('Please enter your name.'); return; }
    const { error } = await db.auth.signUp({ email, password, options: { data: { name } } });
    if (error) { showAuthError(error.message); return; }
    closeModal();
    alert('Account created! Please check your email to confirm your account, then sign in.');
  } else {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) { showAuthError('Incorrect email or password.'); return; }
    closeModal();
  }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
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

// --- HELPERS ---
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
