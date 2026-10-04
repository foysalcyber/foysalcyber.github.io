/* ============================================================
   Shared helpers — formatting, DOM, UI primitives
   ============================================================ */
import { MONTHS, MONTHS_SHORT } from "./config.js";

/* ------------------------------ escape ------------------------------ */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ------------------------------ money ------------------------------ */
let CURRENCY = '৳';

export function setCurrency(sym) { if (sym) CURRENCY = sym; }

export function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export function taka(n) { return CURRENCY + ' ' + money(n); }
export const tk = taka;                    // short alias used everywhere

/* ------------------------------ dates ------------------------------ */
export function monthKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
export function currentMonth() { return monthKey(); }

export function todayStr() { return toInputDate(new Date()); }

export function toInputDate(d) {
  if (!d) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "October 2026" (or "Oct 26" when short) */
export function monthLabel(ym, short = false) {
  const [y, m] = String(ym || '').split('-');
  if (!y || !m) return '—';
  const idx = Number(m) - 1;
  const name = short ? (MONTHS_SHORT[idx] || MONTHS[idx]) : MONTHS[idx];
  if (!name) return String(ym);
  return short ? `${name} ’${String(y).slice(2)}` : `${name} ${y}`;
}

export function monthAdd(ym, n) {
  let [y, m] = String(ym).split('-').map(Number);
  m = m + n;
  y = y + Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  return y + '-' + String(m).padStart(2, '0');
}

/** whole months from a to b (b inclusive) — minimum 1 when a <= b */
export const addMonths = monthAdd;   // alias

export function monthDiff(a, b) {
  const [ay, am] = String(a).split('-').map(Number);
  const [by, bm] = String(b).split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function dateLabel(d) {
  if (!d) return '—';
  if (d.toDate) d = d.toDate();
  if (!(d instanceof Date)) {
    const t = new Date(d);
    if (isNaN(t)) return '—';
    d = t;
  }
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/* ------------------------------ dom ------------------------------ */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ------------------------------ avatars ------------------------------ */
const AV_COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'
];

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function avatarStyle(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export function avatarHtml(name, size = '') {
  return `<span class="avatar ${size}" style="background:${avatarStyle(name)}">${esc(initials(name))}</span>`;
}

/* ------------------------------ toast ------------------------------ */
export function toast(msg, type = '') {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const icon = type === 'ok' ? '✅' : type === 'err' ? '⚠️' : 'ℹ️';
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.innerHTML = `<span class="t-ico">${icon}</span><span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 240);
  }, type === 'err' ? 3600 : 2600);
}

/* ------------------------------ loading ------------------------------ */
export function loading(show, text = 'Loading…') {
  const root = document.getElementById('loadingRoot');
  if (!root) return;
  root.innerHTML = show
    ? `<div class="loading-box"><div class="spinner"></div><div class="small">${esc(text)}</div></div>`
    : '';
  root.hidden = !show;
}

/* ------------------------------ ui blocks ------------------------------ */
export function skeleton(kind = 'page') {
  if (kind === 'table') {
    return `<div class="sk-wrap">${Array.from({ length: 6 }, () =>
      `<div class="sk" style="height:44px;border-radius:10px"></div>`).join('')}</div>`;
  }
  if (kind === 'cards') {
    return `<div class="grid cols-4">${Array.from({ length: 4 }, () =>
      `<div class="sk" style="height:104px;border-radius:14px"></div>`).join('')}</div>`;
  }
  return `<div class="sk-wrap">
    <div class="sk" style="height:26px;width:180px"></div>
    <div class="grid cols-4">${Array.from({ length: 4 }, () =>
      `<div class="sk" style="height:104px;border-radius:14px"></div>`).join('')}</div>
    <div class="sk" style="height:280px;border-radius:14px"></div>
  </div>`;
}

export function statCard({ label, value, hint = '', icon = '', tone = '', accent = false, trend = '' }) {
  return `<div class="stat ${tone} ${accent ? 'accent' : ''}">
    ${icon ? `<div class="st-ico">${icon}</div>` : ''}
    ${trend ? `<div class="trend ${trend.dir || ''}">${esc(trend.text || trend)}</div>` : ''}
    <div class="st-label">${esc(label)}</div>
    <div class="st-value">${value}</div>
    ${hint ? `<div class="st-hint">${hint}</div>` : ''}
  </div>`;
}

export function emptyState({ icon = '📭', title = 'Nothing here yet', text = '', action = '' }) {
  return `<div class="empty">
    <div class="e-art">${icon}</div>
    <h4>${esc(title)}</h4>
    ${text ? `<p>${text}</p>` : ''}
    ${action || ''}
  </div>`;
}

export function sectionHead({ title, sub = '', right = '' }) {
  return `<div class="section-head">
    <div class="col">
      <h3>${title}</h3>
      ${sub ? `<div class="small muted">${sub}</div>` : ''}
    </div>
    <div class="spacer"></div>
    ${right || ''}
  </div>`;
}

/** Sortable table header: sortTh(key, label, state, extraClass) */
export function sortTh(key, label, sort = {}, cls = '') {
  const on = sort && sort.key === key;
  const dir = on ? (sort.dir === 'desc' ? 'desc' : 'asc') : '';
  return `<th class="th-sort ${cls} ${dir}" data-sort="${esc(key)}">${esc(label)}<span class="sort-ico"></span></th>`;
}

/* ------------------------------ modal ------------------------------ */
export function modal({ icon = '', title = '', sub = '', body = '', footer = '', wide = false, onMount, onClose }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        ${icon ? `<div class="m-icon">${icon}</div>` : ''}
        <div class="col" style="min-width:0">
          <h3>${esc(title)}</h3>
          ${sub ? `<div class="small muted">${sub}</div>` : ''}
        </div>
        <div class="spacer"></div>
        <button class="icon-btn" data-x aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;

  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  back.querySelector('[data-x]').onclick = close;

  document.getElementById('modalRoot').appendChild(back);
  if (onMount) onMount(back, close);
  return close;
}

export function confirmDialog({ icon = '⚠️', title = 'Are you sure?', message = '', okText = 'Yes', danger = true, cancelText = 'Cancel' }) {
  return new Promise(resolve => {
    let done = false;
    const close = modal({
      icon, title, body: `<p class="small muted" style="margin:0">${message}</p>`,
      footer: `<div class="spacer"></div>
        <button class="btn" data-no>${esc(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(okText)}</button>`,
      onMount(el, cl) {
        el.querySelector('[data-no]').onclick = () => { done = true; resolve(false); cl(); };
        el.querySelector('[data-yes]').onclick = () => { done = true; resolve(true); cl(); };
      },
      onClose() { if (!done) resolve(false); }
    });
  });
}

/* ------------------------------ files ------------------------------ */
export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

export function toCSV(headers, rows) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.map(cell).join(',')]
    .concat(rows.map(r => r.map(cell).join(',')))
    .join('\r\n');
}

export function printEl(title = 'Hostel WiFi Manager') {
  const old = document.title;
  document.title = title;
  window.print();
  setTimeout(() => { document.title = old; }, 400);
}

export function copyText(text) {
  const done = () => toast('Copied to clipboard', 'ok');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback());
  } else fallback();

  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch { toast('Copy failed — select manually', 'err'); }
    ta.remove();
  }
}

/* ------------------------------ misc ------------------------------ */
export function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
