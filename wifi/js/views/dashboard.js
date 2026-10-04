/* ============================================================
   Dashboard — everything at a glance
   ============================================================ */
import {
  state, memberStats, memberById, routerName, routerBadgeClass,
  filteredDevices, unknownDevices, defaultersConnected, paidInMonth, feeOf, db_actions
} from "../store.js";
import { openPaymentModal, openLedger, openMemberModal, openDeviceModal } from "../modals.js";
import {
  esc, money, tk, monthLabel, dateLabel, copyText, toast, loading, confirmDialog,
  statCard, emptyState, sectionHead, avatarHtml, skeleton
} from "../utils.js";
import { DEVICE_TYPES, DEVICE_STATUS } from "../config.js";
import { go } from "../app.js";

const ts = v => v?.toMillis ? v.toMillis() : (v ? new Date(v).getTime() : 0);

export function render(root) {
  if (!state.ready) { root.innerHTML = skeleton('page'); return; }

  const month = state.month;
  const routers = state.settings.routers || [];
  const members = state.members.filter(m => state.router === 'all' || m.routerId === state.router);
  const activeMembers = members.filter(m => m.active !== false);
  const pays = state.payments.filter(p => state.router === 'all' || p.routerId === state.router);

  const collected = pays.filter(p => p.month === month && (p.type === 'payment' || p.type === 'advance'))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const prevCollected = pays.filter(p => p.month === monthAddSafe(month, -1) && (p.type === 'payment' || p.type === 'advance'))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const expected = activeMembers.reduce((s, m) => s + feeOf(m), 0);
  const refunded = pays.filter(p => p.month === month && p.type === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);

  let totalDue = 0, totalCredit = 0;
  members.forEach(m => { const st = memberStats(m); totalDue += st.due; totalCredit += st.credit; });

  const conn = filteredDevices().filter(d => d.status === 'connected');
  const unk = unknownDevices();
  const blocked = filteredDevices().filter(d => d.status === 'blocked');
  const defaulters = defaultersConnected();
  const dues = dueList();
  const pct = expected > 0 ? Math.round(collected / expected * 100) : 0;
  const trendDir = collected > prevCollected ? 'up' : (collected < prevCollected ? 'down' : 'flat');
  const trendPct = prevCollected > 0 ? Math.round(Math.abs(collected - prevCollected) / prevCollected * 100) : null;

  root.innerHTML = `
    ${state.error ? `<div class="alert"><span class="ai">⚠️</span><span>Firestore connection problem: ${esc(state.error)}<br>Check your Firestore rules — see <code>README.md</code>.</span></div>` : ''}

    ${state.members.length === 0 ? welcomeCard() : ''}

    <!-- ===== page head ===== -->
    <div class="page-head">
      <div>
        <h1>${greeting()}${state.router !== 'all' ? ` · ${esc(routerName(state.router))}` : ''}</h1>
        <p>${monthLabel(month)} · ${members.length} members · ${conn.length} devices online</p>
      </div>
      <div class="spacer"></div>
      <button class="btn" data-goto="reports">🧾 Reports</button>
      <button class="btn btn-primary" data-newpay>＋ Record payment</button>
    </div>

    <!-- ===== KPIs ===== -->
    <div class="grid cols-auto stagger">
      ${statCard({ label: 'Members', value: members.length, icon: '👥', tone: 'brand',
        hint: `${activeMembers.length} active · ${members.length - activeMembers.length} inactive` })}
      ${statCard({ label: `${monthLabel(month, true)} collection`, value: tk(collected), icon: '💰', tone: 'success', accent: true,
        hint: `of ${tk(expected)} expected${trendPct !== null ? ` <span class="trend ${trendDir}" title="Compared with last month">${trendDir === 'up' ? '▲' : (trendDir === 'down' ? '▼' : '■')} ${trendPct}%</span>` : ''}` })}
      ${statCard({ label: 'Total due', value: tk(totalDue), icon: '📉', tone: 'danger',
        hint: `${dues.length} member${dues.length === 1 ? '' : 's'} to collect from` })}
      ${statCard({ label: 'Total advance', value: tk(totalCredit), icon: '⭐', tone: 'info',
        hint: 'credit to refund' })}
      ${statCard({ label: 'Connected devices', value: conn.length, icon: '📶',
        hint: `${blocked.length} blocked` })}
      ${statCard({ label: 'Unknown devices', value: unk.length, icon: '❓', tone: 'warning',
        hint: 'not linked to anyone' })}
    </div>

    <!-- ===== routers ===== -->
    ${sectionHead({
      title: '📡 Router-wise accounts',
      sub: 'Two routers, two separate books',
      right: `<button class="btn btn-sm" data-goto="devices">View devices →</button>`
    })}
    <div class="grid cols-2 stagger">
      ${routers.map(r => routerCard(r.id)).join('')}
    </div>

    <!-- ===== needs attention ===== -->
    ${(dues.length || defaulters.length || unk.length) ? `
      ${sectionHead({ title: '🔔 Needs attention', sub: 'Dues, unpaid connections and unknown devices' })}
      <div class="grid ${defaulters.length ? 'cols-2' : ''} stagger">
        ${defaulters.length ? `
          <div class="card hoverable" style="border-color:color-mix(in srgb,var(--danger) 30%,var(--border))">
            <div class="card-head">
              <h3>🚨 Connected without paying</h3>
              <span class="badge danger">${defaulters.length}</span>
              <div class="spacer"></div>
              <button class="btn btn-sm btn-soft-danger no-print" data-blockalldef>Block all</button>
            </div>
            <div class="card-body flush">
              ${defaulters.slice(0, 5).map(({ m, st }) => {
                const ds = state.devices.filter(d => d.memberId === m.id && d.status === 'connected');
                return `<div class="list-item">
                  ${avatarHtml(m.name)}
                  <div class="li-main">
                    <div class="t">${esc(m.name)}</div>
                    <div class="s">Room ${esc(m.room || '—')} · ${esc(routerName(m.routerId))} · ${ds.length} device${ds.length === 1 ? '' : 's'}</div>
                  </div>
                  <b style="color:var(--danger)">${tk(st.due)}</b>
                  <div class="row gap-4 no-print">
                    <button class="btn btn-sm btn-success" data-pay="${m.id}">Collect</button>
                    <button class="btn btn-sm btn-soft-danger" data-blockdevs="${m.id}">Block</button>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>` : ''}
        <div class="card hoverable">
          <div class="card-head">
            <h3>❓ Unknown devices</h3>
            <span class="badge warn">${unk.length}</span>
            <div class="spacer"></div>
            <button class="btn btn-sm" data-goto="devices">Manage →</button>
          </div>
          <div class="card-body flush">
            ${unk.length ? unk.slice(0, 5).map(d => `
              <div class="list-item">
                <span style="font-size:18px;width:32px;text-align:center">${(DEVICE_TYPES[d.type] || DEVICE_TYPES.other).split(' ')[0]}</span>
                <div class="li-main">
                  <div class="t">${esc(d.name)}</div>
                  <div class="s">${esc(d.mac || 'No MAC')} · Room ${esc(d.room || '—')} · ${esc(routerName(d.routerId))}</div>
                </div>
                <span class="badge ${DEVICE_STATUS[d.status]?.cls || ''}">${DEVICE_STATUS[d.status]?.label || d.status}</span>
                <div class="row gap-4 no-print">
                  <button class="btn btn-sm" data-assign="${d.id}">Assign</button>
                  <button class="btn btn-sm btn-soft-danger" data-blockone="${d.id}">Block</button>
                </div>
              </div>`).join('')
              : emptyState({ icon: '✅', title: 'No unknown devices', text: 'Every device is linked to a member.' })}
          </div>
        </div>
      </div>` : ''}

    <!-- ===== dues table ===== -->
    ${sectionHead({
      title: `⚠️ Who owes money`,
      sub: `${dues.length} member${dues.length === 1 ? '' : 's'} · ${tk(totalDue)} outstanding`,
      right: `<button class="btn btn-sm no-print" data-copyall="due">📋 Copy list</button>
              <button class="btn btn-sm no-print" data-goto="reports">Full report →</button>`
    })}
    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Member</th><th>Router</th><th class="right">Fee/mo</th><th class="right">Months due</th>
            <th class="right">Due</th><th>This month</th><th class="right no-print">Actions</th>
          </tr></thead>
          <tbody>
            ${dues.slice(0, 10).map(({ m, st }) => `
              <tr class="clickable" data-member="${m.id}">
                <td><div class="cell-user">${avatarHtml(m.name)}<div class="meta">
                  <div class="n">${esc(m.name)}</div><div class="s">Room ${esc(m.room || '—')}</div>
                </div></div></td>
                <td><span class="badge ${routerBadgeClass(m.routerId)}">${esc(routerName(m.routerId))}</span></td>
                <td class="right num">${tk(st.fee)}</td>
                <td class="right num">${Math.max(1, Math.round(st.due / (st.fee || 1)))}</td>
                <td class="right num"><b style="color:var(--danger)">${tk(st.due)}</b></td>
                <td>${paidInMonth(m, month) > 0 ? `<span class="badge ok">${tk(paidInMonth(m, month))}</span>` : '<span class="badge danger">Not paid</span>'}</td>
                <td class="right no-print"><div class="row-actions">
                  <button class="btn btn-sm btn-success" data-pay="${m.id}">💳 Collect</button>
                  <button class="btn btn-sm" data-msg="${m.id}" title="Copy reminder">✉️</button>
                </div></td>
              </tr>`).join('') ||
              `<tr><td colspan="7">${emptyState({ icon: '🎉', title: 'Everyone has paid', text: 'No outstanding dues right now.' })}</td></tr>`}
          </tbody>
        </table>
      </div>
      ${dues.length > 10 ? `<div class="card-foot"><button class="btn btn-sm" data-goto="members">View all ${dues.length} →</button></div>` : ''}
    </div>

    <!-- ===== rooms + recent ===== -->
    <div class="grid cols-2 mt-24">
      <div>
        ${sectionHead({ title: '🏠 Connections by room', sub: 'Where devices are online right now' })}
        <div class="card">
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Room</th><th class="right">Online</th><th class="right">Devices</th><th>Members</th></tr></thead>
              <tbody>
                ${roomRows().map(r => `<tr>
                  <td><b>${esc(r.room)}</b></td>
                  <td class="right num"><span class="badge ${r.connected ? 'ok' : ''}">${r.connected}</span></td>
                  <td class="right num">${r.total}</td>
                  <td class="small muted">${esc(r.names.join(', ')) || '—'}</td>
                </tr>`).join('') ||
                `<tr><td colspan="4">${emptyState({ icon: '🏠', title: 'No devices yet', text: 'Add devices to see room-wise connections.' })}</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div>
        ${sectionHead({
          title: '🧾 Recent payments',
          sub: 'Latest money in',
          right: `<button class="btn btn-sm btn-primary no-print" data-newpay>＋ Payment</button>`
        })}
        <div class="card">
          <div class="card-body flush">
            ${recentPayments().length ? recentPayments().map(p => {
              const m = memberById(p.memberId);
              const neg = p.type === 'refund';
              return `<div class="list-item">
                ${avatarHtml(m?.name || '?', 'sm')}
                <div class="li-main">
                  <div class="t">${esc(m?.name || 'Unknown')}</div>
                  <div class="s">${monthLabel(p.month, true)} · ${dateLabel(p.date)}${p.note ? ' · ' + esc(p.note) : ''}</div>
                </div>
                <span class="badge ${neg ? 'danger' : (p.type === 'advance' ? 'info' : (p.type === 'waiver' ? 'warn' : 'ok'))}">${neg ? '−' : '+'}${tk(p.amount)}</span>
              </div>`;
            }).join('') : emptyState({ icon: '🧾', title: 'No payments yet', text: 'Record your first payment to start the books.',
              action: `<button class="btn btn-primary btn-sm" data-newpay>＋ Record payment</button>` })}
          </div>
        </div>
      </div>
    </div>
  `;

  bind(root);
}

/* ------------------------------ helpers ------------------------------ */
function greeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
  return `${g}${state.userEmail ? '' : ''}`;
}
function monthAddSafe(ym, d) {
  let [y, m] = ym.split('-').map(Number); m += d;
  while (m <= 0) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function dueList() {
  return state.members
    .filter(m => (state.router === 'all' || m.routerId === state.router))
    .map(m => ({ m, st: memberStats(m) }))
    .filter(x => x.st.due > 0)
    .sort((a, b) => b.st.due - a.st.due);
}

function routerCard(rid) {
  const ms = state.members.filter(m => m.routerId === rid);
  const active = ms.filter(m => m.active !== false);
  const pays = state.payments.filter(p => p.routerId === rid);
  const collected = pays.filter(p => p.month === state.month && (p.type === 'payment' || p.type === 'advance'))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  let due = 0, credit = 0;
  ms.forEach(m => { const st = memberStats(m); due += st.due; credit += st.credit; });
  const devs = state.devices.filter(d => d.routerId === rid);
  const conn = devs.filter(d => d.status === 'connected');
  const unk = devs.filter(d => !d.memberId);
  const blocked = devs.filter(d => d.status === 'blocked');
  const expected = active.reduce((s, m) => s + feeOf(m), 0);
  const pct = expected > 0 ? Math.min(100, Math.round(collected / expected * 100)) : 0;

  return `
  <div class="card hoverable" style="border-top:3px solid ${rid === 'B' ? 'var(--teal)' : 'var(--brand-600)'}">
    <div class="card-head">
      <span class="badge ${routerBadgeClass(rid)}">${esc(routerName(rid))}</span>
      <span class="sub">${ms.length} members</span>
      <div class="spacer"></div>
      <button class="btn btn-sm" data-setrouter="${rid}">Open →</button>
    </div>
    <div class="card-body">
      <div class="row" style="margin-bottom:6px">
        <b style="font-size:22px;letter-spacing:-.03em">${tk(collected)}</b>
        <span class="muted small">/ ${tk(expected)}</span>
        <div class="spacer"></div>
        <span class="badge ${pct >= 100 ? 'ok' : (pct >= 60 ? 'warn' : 'danger')}">${pct}%</span>
      </div>
      <div class="progress ${pct >= 100 ? 'ok' : (pct >= 60 ? 'warn' : 'bad')}" style="margin-bottom:14px"><i style="width:${pct}%"></i></div>
      <dl class="kv">
        <dt>📉 Total due</dt><dd style="color:var(--danger)">${tk(due)}</dd>
        <dt>⭐ Total advance</dt><dd style="color:var(--info)">${tk(credit)}</dd>
        <dt>📶 Connected</dt><dd>${conn.length} device${conn.length === 1 ? '' : 's'}</dd>
        <dt>🚫 Blocked · ❓ Unknown</dt><dd>${blocked.length} · ${unk.length}</dd>
      </dl>
    </div>
  </div>`;
}

function roomRows() {
  const map = new Map();
  filteredDevices().forEach(d => {
    const room = d.room || 'Unknown';
    if (!map.has(room)) map.set(room, { room, connected: 0, total: 0, names: [] });
    const r = map.get(room);
    r.total++;
    if (d.status === 'connected') r.connected++;
    const m = memberById(d.memberId);
    if (m && !r.names.includes(m.name)) r.names.push(m.name);
  });
  return Array.from(map.values()).sort((a, b) => b.connected - a.connected || String(a.room).localeCompare(String(b.room), 'en', { numeric: true }));
}

function recentPayments() {
  return state.payments
    .filter(p => state.router === 'all' || p.routerId === state.router)
    .sort((a, b) => ts(b.date) - ts(a.date))
    .slice(0, 6);
}

function welcomeCard() {
  return `
  <div class="card hoverable" style="border-color:var(--brand-200);background:linear-gradient(135deg,var(--brand-50),var(--surface) 60%)">
    <div class="card-body">
      <div class="row" style="margin-bottom:4px">
        <span style="font-size:24px">👋</span>
        <h3 style="font-size:17px">Welcome — 3 steps to get started</h3>
      </div>
      <p class="small muted" style="margin-bottom:16px">No data yet. Follow these steps and your accounts will be running within 5 minutes.</p>
      <div class="grid cols-3" style="gap:10px">
        <div class="card"><div class="card-body">
          <div style="font-size:22px;margin-bottom:6px">👤</div>
          <b>1. Add members</b>
          <p class="small muted mt-4">Everyone who took WiFi — name, room, phone, router.</p>
          <button class="btn btn-sm btn-primary mt-8" data-newmember>＋ Add member</button>
        </div></div>
        <div class="card"><div class="card-body">
          <div style="font-size:22px;margin-bottom:6px">💳</div>
          <b>2. Record payments</b>
          <p class="small muted mt-4">Who paid how much — pick the month and save.</p>
          <button class="btn btn-sm btn-primary mt-8" data-newpay>＋ Add payment</button>
        </div></div>
        <div class="card"><div class="card-body">
          <div style="font-size:22px;margin-bottom:6px">📱</div>
          <b>3. Add devices</b>
          <p class="small muted mt-4">Name/MAC from the router client list.</p>
          <button class="btn btn-sm btn-primary mt-8" data-newdevice>＋ Add device</button>
        </div></div>
      </div>
      <p class="small muted mt-16">💡 Carrying over old balances? Edit the member → <b>“Opening Balance”</b> field: <code>-500</code> for a due, <code>300</code> for an advance.</p>
    </div>
  </div>`;
}

function reminderText(m, st) {
  return (state.settings.reminderTemplate || '')
    .replace(/\{name\}/g, m.name || '')
    .replace(/\{room\}/g, m.room || '-')
    .replace(/\{router\}/g, routerName(m.routerId))
    .replace(/\{month\}/g, monthLabel(state.month))
    .replace(/\{due\}/g, money(st.due))
    .replace(/\{amount\}/g, money(st.due))
    .replace(/\{fee\}/g, money(st.fee));
}

/* ------------------------------ events ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-pay]').forEach(b => b.onclick = e => {
    e.stopPropagation(); openPaymentModal({ memberId: b.dataset.pay });
  });
  root.querySelectorAll('[data-msg]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const m = memberById(b.dataset.msg);
    if (m) copyText(reminderText(m, memberStats(m)));
  });
  root.querySelectorAll('[data-member]').forEach(tr => tr.onclick = () => openLedger(tr.dataset.member));
  root.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => go(b.dataset.goto));
  root.querySelectorAll('[data-setrouter]').forEach(b => b.onclick = () => {
    state.router = b.dataset.setrouter;
    document.querySelectorAll('.rs-btn').forEach(x => x.classList.toggle('active', x.dataset.router === state.router));
    go('dashboard');
  });

  root.querySelectorAll('[data-newpay]').forEach(b => b.onclick = () => openPaymentModal());
  root.querySelectorAll('[data-newmember]').forEach(b => b.onclick = () => openMemberModal());
  root.querySelectorAll('[data-newdevice]').forEach(b => b.onclick = () => openDeviceModal());

  root.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => {
    const d = state.devices.find(x => x.id === b.dataset.assign);
    openDeviceModal(d);
  });
  root.querySelectorAll('[data-blockone]').forEach(b => b.onclick = async () => {
    try { loading(true); await db_actions.updateDevice(b.dataset.blockone, { status: 'blocked' }); toast('Device blocked', 'ok'); }
    catch (e) { toast('Error: ' + e.message, 'err'); } finally { loading(false); }
  });
  root.querySelectorAll('[data-blockdevs]').forEach(b => b.onclick = async () => {
    const ids = state.devices.filter(d => d.memberId === b.dataset.blockdevs && d.status === 'connected').map(d => d.id);
    await bulkBlock(ids);
  });
  const blockAll = root.querySelector('[data-blockalldef]');
  if (blockAll) blockAll.onclick = async () => {
    const ids = defaultersConnected().flatMap(({ m }) =>
      state.devices.filter(d => d.memberId === m.id && d.status === 'connected').map(d => d.id));
    await bulkBlock(ids);
  };
  const copyAll = root.querySelector('[data-copyall]');
  if (copyAll) copyAll.onclick = () => {
    const lines = dueList().map(({ m, st }) => `• ${m.name} (Room ${m.room || '?'}, ${routerName(m.routerId)}) — ${money(st.due)} due`);
    copyText(`Due list for ${monthLabel(state.month)}:\n` + (lines.join('\n') || 'Nobody'));
  };
}

async function bulkBlock(ids) {
  if (!ids.length) { toast('No devices to block', 'warn'); return; }
  const ok = await confirmDialog({
    title: 'Block these devices?',
    message: `<b>${ids.length}</b> device(s) will be blocked. Remember to block them on the router too.`,
    okText: 'Block'
  });
  if (!ok) return;
  try { loading(true); await db_actions.blockMany(ids, true); toast(`${ids.length} device(s) blocked`, 'ok'); }
  catch (e) { toast('Error: ' + e.message, 'err'); }
  finally { loading(false); }
}
