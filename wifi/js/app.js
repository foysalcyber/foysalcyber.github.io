/* ============================================================
   App shell — sign-in, month navigation, theme, render loop
   ============================================================ */
import {
  auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "./firebase.js";
import { state, subscribe, startSync } from "./store.js";
import * as listView from "./views/list.js";
import { openMemberModal, openSettings } from "./modals.js";
import {
  $, esc, monthLabel, addMonths, monthKey, toast, loading, setCurrency, initials, uid
} from "./utils.js";

/* ---------------- theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem('wifi-theme');
  const dark = saved ? saved === 'dark'
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  paintTheme();
}
function paintTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#themeToggle').innerHTML = dark ? '☀️' : '🌙';
  $('#themeToggle').title = dark ? 'Light mode' : 'Dark mode';
}
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  localStorage.setItem('wifi-theme', dark ? 'light' : 'dark');
  paintTheme();
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
  'auth/configuration-not-found': 'Email/Password sign-in is not enabled yet (Firebase Console → Authentication → Sign-in method).'
};

function loginError(msg) {
  const box = $('#loginErr');
  box.innerHTML = '⚠️ ' + esc(msg);
  box.hidden = false;
}

async function doLogin() {
  const email = $('#email').value.trim();
  const pass = $('#password').value;
  $('#loginErr').hidden = true;
  if (!email || !pass) { loginError('Enter both email and password.'); return; }
  const btn = $('#loginBtn');
  btn.disabled = true;
  const old = btn.innerHTML;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;margin:0;border-width:2px"></span> Signing in…`;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    loginError(AUTH_ERRORS[e.code] || e.message || 'Sign-in failed.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

async function doForgot() {
  const email = $('#email').value.trim();
  if (!email) { loginError('Type your email first, then press Forgot password.'); return; }
  try { await sendPasswordResetEmail(auth, email); toast('Password reset email sent', 'ok'); }
  catch (e) { loginError(AUTH_ERRORS[e.code] || e.message || 'Could not send reset email.'); }
}

/* ---------------- render ---------------- */
let rendering = false;

function render() {
  const root = $('#view');
  if (!root) return;
  setCurrency(state.settings.currency);
  $('#brandName').textContent = state.settings.hostelName || 'Hostel WiFi';
  $('#monthLabel').textContent = monthLabel(state.month);
  const isNow = state.month === monthKey();
  $('#monthLabel').classList.toggle('now', isNow);

  if (state.error) {
    root.innerHTML = `<div class="card" style="border-color:var(--danger)"><div class="card-body">
      <h3 style="font-size:16px">⚠️ Data could not be loaded</h3>
      <p class="small muted mt-8">${esc(state.error)}</p>
      <p class="small muted mt-8">Check your Firestore rules and internet connection, then reload.</p>
      <button class="btn btn-primary mt-12" onclick="location.reload()">Reload</button>
    </div></div>`;
    return;
  }

  rendering = true;
  try { listView.render(root); }
  catch (e) {
    console.error(e);
    root.innerHTML = `<div class="card"><div class="card-body">
      <h3 style="font-size:16px">Something went wrong</h3>
      <p class="small muted mt-8">${esc(e.message)}</p>
      <button class="btn btn-primary mt-12" onclick="location.reload()">Reload</button>
    </div></div>`;
  } finally { rendering = false; }
}

export function refresh() { if (!rendering) render(); }
export function go() { render(); }

/* ---------------- events ---------------- */
function bind() {
  $('#loginBtn').onclick = doLogin;
  $('#password').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
  $('#email').onkeydown = e => { if (e.key === 'Enter') $('#password').focus(); };
  $('#loginForgot').onclick = doForgot;

  $('#themeToggle').onclick = toggleTheme;
  $('#prevMonth').onclick = () => { state.month = addMonths(state.month, -1); render(); };
  $('#nextMonth').onclick = () => { state.month = addMonths(state.month, 1); render(); };
  $('#monthLabel').onclick = () => { state.month = monthKey(); render(); };
  $('#monthLabel').title = 'Jump to the current month';

  const um = $('#userMenu');
  $('#userBtn').onclick = e => { e.stopPropagation(); um.hidden = !um.hidden; };
  document.addEventListener('click', () => { um.hidden = true; });
  $('#udSettings').onclick = () => openSettings();
  $('#udTheme').onclick = () => { toggleTheme(); };
  $('#udLogout').onclick = async () => { await signOut(auth); location.reload(); };

  document.addEventListener('keydown', e => {
    const t = (e.target.tagName || '').toLowerCase();
    const typing = t === 'input' || t === 'textarea' || t === 'select' || e.target.isContentEditable;
    if (e.key === 'Escape' && document.activeElement?.id === 'mSearch') {
      const i = $('#mSearch'); i.value = ''; state.search = ''; render(); return;
    }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); $('#mSearch')?.focus(); }
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openMemberModal(); }
  });

  subscribe(() => { if (state.ready) refresh(); });
}

/* ---------------- boot ---------------- */
initTheme();
bind();

onAuthStateChanged(auth, user => {
  if (user) {
    state.userEmail = user.email || '';
    const short = (user.email || 'U').split('@')[0];
    $('#userInitial').textContent = esc(initials(short));
    $('#userMail').textContent = user.email || '';
    $('#loginScreen').hidden = true;
    $('#appShell').hidden = false;
    try {
      const r = localStorage.getItem('wifi-router');
      if (r === 'A' || r === 'B') state.router = r;
    } catch { }
    startSync();
    render();
  } else {
    state.userEmail = '';
    $('#loginScreen').hidden = false;
    $('#appShell').hidden = true;
    loading(false);
  }
});
