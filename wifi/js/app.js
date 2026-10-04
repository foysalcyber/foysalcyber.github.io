/* ============================================================
   App shell — auth gate, navigation, chrome, shortcuts
   ============================================================ */
import {
  auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "./firebase.js";
import { state, subscribe, startSync, routerName, memberStats, unknownDevices } from "./store.js";
import { DEFAULT_SETTINGS } from "./config.js";
import * as dashboardView from "./views/dashboard.js";
import * as membersView from "./views/members.js";
import * as paymentsView from "./views/payments.js";
import * as devicesView from "./views/devices.js";
import * as reportsView from "./views/reports.js";
import * as settingsView from "./views/settings.js";
import { openMemberModal, openPaymentModal, openDeviceModal, openLedger } from "./modals.js";
import {
  $, $$, esc, monthLabel, addMonths, toast, loading, setCurrency,
  avatarHtml, initials, modal
} from "./utils.js";

/* ---------------- routing table ---------------- */
const ROUTES = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊', sub: 'Overview' },
  { id: 'members', name: 'Members', icon: '👥', sub: 'Who took WiFi' },
  { id: 'payments', name: 'Payments', icon: '💰', sub: 'Bills & ledger' },
  { id: 'devices', name: 'Devices', icon: '📶', sub: 'Router connections' },
  { id: 'reports', name: 'Reports', icon: '📈', sub: 'Monthly summary' },
  { id: 'settings', name: 'Settings', icon: '⚙️', sub: 'Fee, routers, backup' }
];
const VIEWS = {
  dashboard: dashboardView, members: membersView, payments: paymentsView,
  devices: devicesView, reports: reportsView, settings: settingsView
};

/* ---------------- theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem('wifi-theme');
  const dark = saved ? saved === 'dark'
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  paintThemeBtn();
}
function paintThemeBtn() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#themeToggle').innerHTML = dark ? '☀️' : '🌙';
  $('#themeToggle').title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  localStorage.setItem('wifi-theme', dark ? 'light' : 'dark');
  paintThemeBtn();
}

/* ---------------- auth ---------------- */
const AUTH_ERRORS = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/missing-password': 'Please enter your password.',
  'auth/invalid-credential': 'Email or password is wrong.',
  'auth/wrong-password': 'Email or password is wrong.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network problem — check your connection.',
  'auth/configuration-not-found': 'Email/Password sign-in is not enabled in Firebase Console → Authentication → Sign-in method.'
};

function showLoginError(msg) {
  const box = $('#loginErr');
  box.innerHTML = `⚠️ ${esc(msg)}`;
  box.hidden = false;
}

async function doLogin() {
  const email = $('#email').value.trim();
  const pass = $('#password').value;
  $('#loginErr').hidden = true;
  if (!email || !pass) { showLoginError('Enter both email and password.'); return; }

  const btn = $('#loginBtn');
  btn.disabled = true;
  const old = btn.innerHTML;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;margin:0;border-width:2px"></span> Signing in…`;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showLoginError(AUTH_ERRORS[e.code] || e.message || 'Sign-in failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

async function doForgot() {
  const email = $('#email').value.trim();
  if (!email) { showLoginError('Type your email first, then press Forgot password.'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    toast('Password reset email sent', 'ok');
  } catch (e) {
    showLoginError(AUTH_ERRORS[e.code] || e.message || 'Could not send reset email.');
  }
}

async function doLogout() {
  await signOut(auth);
  state.ready = false;
  location.reload();
}

/* ---------------- navigation ---------------- */
export function go(route) {
  if (!VIEWS[route]) route = 'dashboard';
  state.route = route;
  state.search = '';
  const si = $('#searchInput'); if (si) si.value = '';
  try { localStorage.setItem('wifi-route', route); } catch { }
  render();
}

/* ---------------- chrome ---------------- */
function updateChrome() {
  // nav items
  const dueCount = state.members.filter(m => memberStats(m).due > 0).length;
  const unknownCount = unknownDevices().length;
  const badges = { members: state.members.length, payments: dueCount, devices: unknownCount };

  $('#sidebarNav').innerHTML = ROUTES.map(r => `
    <button class="nav-item ${state.route === r.id ? 'on' : ''}" data-route="${r.id}" title="${esc(r.name)}">
      <span class="ni-ico">${r.icon}</span>
      <span class="col" style="min-width:0">
        <span class="ni-name">${esc(r.name)}</span>
        <span class="ni-sub">${esc(r.sub)}</span>
      </span>
      <span class="spacer"></span>
      ${badges[r.id] ? `<span class="nav-badge">${badges[r.id]}</span>` : ''}
      <span class="ni-dot"></span>
    </button>`).join('');

  $('#mobileNav').innerHTML = ROUTES.map(r => `
    <button class="mn-item ${state.route === r.id ? 'on' : ''}" data-route="${r.id}">
      <span class="mn-ico">${r.icon}</span><span class="mn-t">${esc(r.name.split(' ')[0])}</span>
    </button>`).join('');

  // router switch
  const routers = state.settings.routers || DEFAULT_SETTINGS.routers;
  $('#routerSwitch').innerHTML = `
    <button class="rs-btn ${state.router === 'all' ? 'on' : ''}" data-router="all">All</button>
    ${routers.map(r => `<button class="rs-btn ${state.router === r.id ? 'on' : ''}" data-router="${r.id}"
       id="${r.id === 'A' ? 'rsA' : (r.id === 'B' ? 'rsB' : '')}" title="${esc(r.name)}">${esc(r.name)}</button>`).join('')}`;

  // month
  $('#monthLabel').textContent = monthLabel(state.month);

  // user
  const mail = auth.currentUser?.email || '';
  $('#userEmail').textContent = mail;
  $('#userName').textContent = mail ? mail.split('@')[0] : 'User';
  $('#userAvatar').innerHTML = esc(initials(mail.split('@')[0] || 'U'));
  $('#userAvatar').style.background = 'var(--brand)';
  const umName = $('#umName'), umMail = $('#umMail');
  if (umName) umName.textContent = mail ? mail.split('@')[0] : 'User';
  if (umMail) umMail.textContent = mail || '—';

  // brand
  $('#brandName').textContent = state.settings.hostelName || 'Hostel WiFi';
}

/* ---------------- render ---------------- */
let rendering = false;

function render() {
  const root = $('#view');
  if (!root) return;
  setCurrency(state.settings.currency);
  updateChrome();

  if (state.error) {
    root.innerHTML = `<div class="card" style="border-color:var(--danger)">
      <div style="padding:22px">
        <h1 style="font-size:18px;margin-bottom:6px">⚠️ Data could not be loaded</h1>
        <p class="small muted">${esc(state.error)}</p>
        <p class="small muted" style="margin-top:8px">Check your Firestore security rules and internet connection, then reload.</p>
        <button class="btn btn-primary mt-12" onclick="location.reload()">Reload</button>
      </div></div>`;
    return;
  }

  const view = VIEWS[state.route] || VIEWS.dashboard;
  rendering = true;
  try { view.render(root); }
  catch (e) {
    console.error(e);
    root.innerHTML = `<div class="card"><div class="card-body">
      <h3 style="font-size:16px">Something went wrong on this page</h3>
      <p class="small muted mt-8">${esc(e.message)}</p>
      <button class="btn btn-primary mt-12" onclick="location.reload()">Reload</button>
    </div></div>`;
  } finally { rendering = false; }

  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

export function refresh() { if (!rendering) render(); }

/* ---------------- command palette ---------------- */
let paletteItems = [];
let paletteIdx = 0;

function paletteData(q = '') {
  const query = q.trim().toLowerCase();
  const out = [];

  ROUTES.forEach(r => out.push({
    icon: r.icon, title: r.name, sub: r.sub, run: () => go(r.id)
  }));

  out.push(
    { icon: '➕', title: 'Add member', sub: 'New WiFi account', run: () => openMemberModal() },
    { icon: '💰', title: 'Record payment', sub: 'Collect monthly bill', run: () => openPaymentModal() },
    { icon: '📱', title: 'Add device', sub: 'Register a device', run: () => openDeviceModal() },
    { icon: '🌙', title: 'Toggle theme', sub: 'Light / dark', run: toggleTheme },
    { icon: '🚪', title: 'Sign out', sub: 'Log out of the app', run: doLogout }
  );

  const members = state.members
    .filter(m => !query || [m.name, m.room, m.phone].some(v => (v || '').toLowerCase().includes(query)))
    .slice(0, 8)
    .map(m => {
      const st = memberStats(m);
      return {
        icon: '👤',
        title: m.name,
        sub: `Room ${m.room || '—'} · ${routerName(m.routerId)} · ${st.due > 0 ? esc('Due ') + st.due : (st.credit > 0 ? esc('Advance ') + st.credit : 'Clear')}`,
        run: () => openLedger(m.id)
      };
    });

  const all = [...out.filter(x => !query || (x.title + ' ' + x.sub).toLowerCase().includes(query)), ...members];
  return all;
}

function openPalette() {
  if ($('.palette-back')) return;
  const wrap = document.createElement('div');
  wrap.className = 'palette-back';
  wrap.innerHTML = `
    <div class="palette" role="dialog" aria-modal="true">
      <div class="palette-head">
        <input type="text" id="paletteInput" placeholder="Search pages, members, actions…" autocomplete="off" />
      </div>
      <div class="palette-body" id="paletteBody"></div>
    </div>`;
  document.getElementById('modalRoot').appendChild(wrap);

  const input = $('#paletteInput', wrap);
  const body = $('#paletteBody', wrap);

  const paint = () => {
    paletteItems = paletteData(input.value);
    paletteIdx = 0;
    body.innerHTML = paletteItems.length
      ? paletteItems.map((it, i) => `
          <button class="p-item ${i === 0 ? 'on' : ''}" data-i="${i}">
            <span class="pi-ico">${it.icon}</span>
            <span class="col" style="min-width:0">
              <span class="pi-t">${esc(it.title)}</span>
              <span class="pi-s">${it.sub}</span>
            </span>
          </button>`).join('')
      : `<div class="p-empty">No matches</div>`;
    $$('.p-item', body).forEach(b => b.onclick = () => run(+b.dataset.i));
  };

  const move = d => {
    if (!paletteItems.length) return;
    paletteIdx = (paletteIdx + d + paletteItems.length) % paletteItems.length;
    $$('.p-item', body).forEach((b, i) => b.classList.toggle('on', i === paletteIdx));
    $$('.p-item', body)[paletteIdx]?.scrollIntoView({ block: 'nearest' });
  };

  const run = i => {
    const it = paletteItems[i];
    wrap.remove();
    document.removeEventListener('keydown', onKey, true);
    if (it) it.run();
  };

  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); wrap.remove(); document.removeEventListener('keydown', onKey, true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); run(paletteIdx); }
  };
  document.addEventListener('keydown', onKey, true);
  wrap.addEventListener('mousedown', e => {
    if (e.target === wrap) { wrap.remove(); document.removeEventListener('keydown', onKey, true); }
  });

  input.oninput = paint;
  paint();
  setTimeout(() => input.focus(), 30);
}

/* ---------------- events ---------------- */
function bindEvents() {
  // login
  $('#loginBtn').onclick = doLogin;
  $('#password').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
  $('#email').onkeydown = e => { if (e.key === 'Enter') $('#password').focus(); };
  $('#loginForgot').onclick = doForgot;

  // topbar
  $('#themeToggle').onclick = toggleTheme;
  $('#prevMonth').onclick = () => { state.month = addMonths(state.month, -1); render(); };
  $('#nextMonth').onclick = () => { state.month = addMonths(state.month, 1); render(); };
  $('#monthLabel').title = 'Click to jump to the current month';
  $('#monthLabel').style.cursor = 'pointer';
  $('#monthLabel').onclick = () => { state.month = monthKeyNow(); render(); };
  $('#paletteBtn').onclick = openPalette;
  $('#searchInput').addEventListener('input', e => {
    state.search = e.target.value;
    clearTimeout(window.__searchT);
    window.__searchT = setTimeout(refresh, 220);
  });

  // quick add
  $('#quickAdd').onclick = e => {
    e.stopPropagation();
    document.querySelectorAll('.menu-pop').forEach(m => m.remove());
    const r = e.currentTarget.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'menu-pop';
    pop.style.top = (r.bottom + 8) + 'px';
    pop.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    pop.innerHTML = `
      <button data-qa="member">👤 New member</button>
      <button data-qa="payment">💰 Record payment</button>
      <button data-qa="device">📱 Add device</button>`;
    document.body.appendChild(pop);
    const close = () => pop.remove();
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
    pop.onclick = ev => {
      const b = ev.target.closest('[data-qa]'); if (!b) return;
      close();
      ({ member: openMemberModal, payment: openPaymentModal, device: openDeviceModal })[b.dataset.qa]();
    };
  };

  // user menu
  const um = $('#userMenu');
  $('#userMenuBtn').onclick = e => {
    e.stopPropagation();
    um.hidden = !um.hidden;
  };
  document.addEventListener('click', () => {
    um.hidden = true;
    document.querySelectorAll('.menu-pop').forEach(m => m.remove());
  });
  $('#udBackup').onclick = () => { go('reports'); setTimeout(() => $('#rBackup')?.click(), 400); };
  $('#udSettings').onclick = () => go('settings');
  $('#udTheme').onclick = toggleTheme;
  $('#udLogout').onclick = doLogout;

  // nav (sidebar + mobile) — delegated
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-route]');
    if (nav) { go(nav.dataset.route); return; }
    const rs = e.target.closest('.rs-btn');
    if (rs) { state.router = rs.dataset.router; render(); }
  });

  // shortcuts
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (e.key === 'Escape' && document.activeElement === $('#searchInput')) { $('#searchInput').value = ''; state.search = ''; refresh(); return; }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); $('#searchInput').focus(); }
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openMemberModal(); }
    if (e.key === 'p' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openPaymentModal(); }
  });

  // data changes
  subscribe(() => { if (state.ready) refresh(); });
}

function monthKeyNow() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/* ---------------- boot ---------------- */
initTheme();
bindEvents();

onAuthStateChanged(auth, user => {
  if (user) {
    state.userEmail = user.email || '';
    $('#loginScreen').hidden = true;
    $('#appShell').hidden = false;
    try {
      const saved = localStorage.getItem('wifi-route');
      state.route = VIEWS[saved] ? saved : 'dashboard';
    } catch { state.route = 'dashboard'; }
    startSync();
    render();
  } else {
    state.userEmail = '';
    $('#loginScreen').hidden = false;
    $('#appShell').hidden = true;
    loading(false);
  }
});

// expose for debugging / console use
window.__wifi = { state, go, refresh, openPalette };
