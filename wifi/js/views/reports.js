/* ============================================================
   Reports — monthly collection, dues, refunds, rooms, backup
   ============================================================ */
import {
  state, memberStats, routerName, routerBadgeClass, filteredDevices, recentMonths, feeOf
} from "../store.js";
import { openPaymentModal, openLedger } from "../modals.js";
import {
  esc, money, tk, monthLabel, dateLabel, downloadFile, toCSV, printEl, copyText, toast,
  statCard, emptyState, avatarHtml, skeleton, sectionHead
} from "../utils.js";

export function render(root) {
  if (!state.ready) { root.innerHTML = skeleton('page'); return; }

  const routers = state.settings.routers || [];
  const months = recentMonths(6).reverse();
  const members = state.members.filter(m => state.router === 'all' || m.routerId === state.router);
  const rows = members.map(m => ({ m, st: memberStats(m) }));

  const dueRows = rows.filter(x => x.st.due > 0).sort((a, b) => b.st.due - a.st.due);
  const creditRows = rows.filter(x => x.st.credit > 0).sort((a, b) => b.st.credit - a.st.credit);
  const totalDue = dueRows.reduce((s, x) => s + x.st.due, 0);
  const totalCredit = creditRows.reduce((s, x) => s + x.st.credit, 0);
  const monthTotal = state.payments
    .filter(p => (state.router === 'all' || p.routerId === state.router) && p.month === state.month && ['payment', 'advance'].includes(p.type))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>🧾 Reports</h1>
        <p>${monthLabel(state.month)} · ${esc(state.settings.hostelName || 'Hostel')}</p>
      </div>
      <div class="spacer"></div>
      <button class="btn" id="rPrint">🖨️ Print</button>
      <button class="btn btn-primary" id="rBackup">⬇️ Backup (JSON)</button>
    </div>

    <div class="grid cols-auto stagger">
      ${statCard({ label: `${monthLabel(state.month, true)} collection`, value: tk(monthTotal), icon: '💰', tone: 'success', accent: true, hint: esc(routerName(state.router)) })}
      ${statCard({ label: 'Outstanding dues', value: tk(totalDue), icon: '📉', tone: 'danger', hint: `${dueRows.length} member${dueRows.length === 1 ? '' : 's'}` })}
      ${statCard({ label: 'Refundable credit', value: tk(totalCredit), icon: '⭐', tone: 'info', hint: `${creditRows.length} member${creditRows.length === 1 ? '' : 's'}` })}
      ${statCard({ label: 'Members', value: rows.length, icon: '👥', tone: 'brand', hint: 'in this view' })}
    </div>

    ${sectionHead({ title: '📈 Monthly Collection', sub: 'Split by router, last 6 months' })}
    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Month</th>${routers.map(r => `<th class="right">${esc(r.name)}</th>`).join('')}
            <th class="right">Total</th><th class="right">Expected</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${months.map(ym => {
              const cells = routers.map(r => state.payments
                .filter(p => p.routerId === r.id && p.month === ym && ['payment', 'advance'].includes(p.type))
                .reduce((s, p) => s + (Number(p.amount) || 0), 0));
              const total = cells.reduce((a, b) => a + b, 0);
              const expected = members
                .filter(m => (m.startMonth || ym) <= ym && (m.active !== false || (m.endMonth || ym) >= ym))
                .reduce((s, m) => s + feeOf(m), 0);
              const pct = expected ? Math.round(total / expected * 100) : 0;
              return `<tr>
                <td><b>${monthLabel(ym, true)}</b></td>
                ${cells.map(v => `<td class="right num">${tk(v)}</td>`).join('')}
                <td class="right num"><b>${tk(total)}</b></td>
                <td class="right num muted">${tk(expected)}</td>
                <td><span class="badge ${pct >= 100 ? 'ok' : (pct >= 60 ? 'warn' : 'danger')}">${pct}%</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${sectionHead({
      title: '📉 Who owes money',
      sub: `${dueRows.length} member${dueRows.length === 1 ? '' : 's'} · ${tk(totalDue)} outstanding`,
      right: `<button class="btn btn-sm no-print" id="rDueCsv">⬇️ CSV</button>
              <button class="btn btn-sm no-print" id="rDueCopy">📋 Copy list</button>`
    })}
    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Member</th><th>Room</th><th>Router</th><th class="right">Fee</th>
            <th class="right">Months due</th><th class="right">Due</th><th>Last payment</th>
            <th class="right no-print">Actions</th>
          </tr></thead>
          <tbody>
            ${dueRows.map(({ m, st }) => {
              const last = state.payments.filter(p => p.memberId === m.id)
                .sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')))[0];
              return `<tr class="clickable" data-member="${m.id}">
                <td><div class="cell-user">${avatarHtml(m.name)}
                  <div class="meta"><div class="n">${esc(m.name)}</div><div class="s">${esc(m.phone || '—')}</div></div></div></td>
                <td>${esc(m.room || '—')}</td>
                <td><span class="badge ${routerBadgeClass(m.routerId)}">${esc(routerName(m.routerId))}</span></td>
                <td class="right num">${tk(st.fee)}</td>
                <td class="right num">${Math.max(1, Math.round(st.due / (st.fee || 1)))}</td>
                <td class="right num"><b style="color:var(--danger)">${tk(st.due)}</b></td>
                <td class="small muted">${last ? monthLabel(last.month, true) : '<span class="faint">Never paid</span>'}</td>
                <td class="right no-print"><div class="row-actions">
                  <button class="btn btn-sm btn-success" data-pay="${m.id}">💳 Collect</button>
                </div></td>
              </tr>`;
            }).join('') || `<tr><td colspan="8">${emptyState({ icon: '🎉', title: 'No dues', text: 'Everyone has paid.' })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    ${sectionHead({
      title: '⭐ Who should get a refund',
      sub: `${creditRows.length} member${creditRows.length === 1 ? '' : 's'} · ${tk(totalCredit)} credit`,
      right: `<button class="btn btn-sm no-print" id="rCrCsv">⬇️ CSV</button>`
    })}
    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Member</th><th>Room</th><th>Router</th><th class="right">Total paid</th>
            <th class="right">Refundable</th><th>Status</th><th class="right no-print">Actions</th>
          </tr></thead>
          <tbody>
            ${creditRows.map(({ m, st }) => `<tr class="clickable" data-member="${m.id}">
              <td><div class="cell-user">${avatarHtml(m.name)}
                <div class="meta"><div class="n">${esc(m.name)}</div><div class="s">${esc(m.phone || '—')}</div></div></td>
              <td>${esc(m.room || '—')}</td>
              <td><span class="badge ${routerBadgeClass(m.routerId)}">${esc(routerName(m.routerId))}</span></td>
              <td class="right num">${tk(st.paid)}</td>
              <td class="right num"><b style="color:var(--info)">${tk(st.credit)}</b></td>
              <td>${m.active === false ? '<span class="badge danger">WiFi off</span>' : '<span class="badge ok">Active</span>'}</td>
              <td class="right no-print"><div class="row-actions">
                <button class="btn btn-sm" data-refund="${m.id}">↩️ Refund</button>
              </div></td>
            </tr>`).join('') || `<tr><td colspan="7">${emptyState({ icon: '⭐', title: 'Nobody has an advance', text: 'No refunds pending.' })}</td></tr>`}
          </tbody>
        </table>
      </div>
      <p class="small muted" style="padding:11px 18px;border-top:1px solid var(--border)">💡 Remember to refund the advance of members who have left. “Refund” opens the entry form for you.</p>
    </div>

    <div class="grid cols-2 mt-24">
      <div>
        ${sectionHead({ title: '📡 Router Summary', sub: 'Members, devices and dues' })}
        <div class="card">
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Router</th><th class="right">Members</th><th class="right">Connected</th><th class="right">Blocked</th><th class="right">Unknown</th><th class="right">Due</th></tr></thead>
              <tbody>
                ${routers.map(r => {
                  const ms = state.members.filter(m => m.routerId === r.id);
                  const ds = state.devices.filter(d => d.routerId === r.id);
                  const due = ms.reduce((s, m) => s + memberStats(m).due, 0);
                  return `<tr>
                    <td><span class="badge ${routerBadgeClass(r.id)}">${esc(r.name)}</span></td>
                    <td class="right num">${ms.length}</td>
                    <td class="right num">${ds.filter(d => d.status === 'connected').length}</td>
                    <td class="right num">${ds.filter(d => d.status === 'blocked').length}</td>
                    <td class="right num">${ds.filter(d => !d.memberId).length}</td>
                    <td class="right num"><b style="color:var(--danger)">${tk(due)}</b></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div>
        ${sectionHead({
          title: '🏠 By Room',
          sub: 'Members, devices and dues',
          right: `<button class="btn btn-sm no-print" id="rRoomCsv">⬇️ CSV</button>`
        })}
        <div class="card">
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Room</th><th class="right">Members</th><th class="right">Online</th><th class="right">Devices</th><th class="right">Due</th></tr></thead>
              <tbody>
                ${roomRows().map(r => `<tr>
                  <td><b>🏠 ${esc(r.room)}</b></td>
                  <td class="right num">${r.members}</td>
                  <td class="right num"><span class="badge ${r.connected ? 'ok' : ''}">${r.connected}</span></td>
                  <td class="right num">${r.devices}</td>
                  <td class="right num">${r.due > 0 ? `<b style="color:var(--danger)">${tk(r.due)}</b>` : '<span class="faint">—</span>'}</td>
                </tr>`).join('') || `<tr><td colspan="5">${emptyState({ icon: '🏠', title: 'No data yet' })}</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  bind(root, { dueRows, creditRows });
}

function roomRows() {
  const map = new Map();
  const push = (room, fn) => {
    const k = room || 'Unknown';
    if (!map.has(k)) map.set(k, { room: k, members: 0, connected: 0, devices: 0, due: 0, names: new Set() });
    fn(map.get(k));
  };
  state.members
    .filter(m => state.router === 'all' || m.routerId === state.router)
    .forEach(m => push(m.room, r => { if (!r.names.has(m.name)) { r.members++; r.names.add(m.name); } r.due += memberStats(m).due; }));
  filteredDevices().forEach(d => push(d.room, r => { r.devices++; if (d.status === 'connected') r.connected++; }));
  return Array.from(map.values())
    .sort((a, b) => b.due - a.due || String(a.room).localeCompare(String(b.room), 'en', { numeric: true }));
}

function bind(root, { dueRows, creditRows }) {
  root.querySelectorAll('[data-pay]').forEach(b => b.onclick = e => { e.stopPropagation(); openPaymentModal({ memberId: b.dataset.pay }); });
  root.querySelectorAll('[data-refund]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const m = state.members.find(x => x.id === b.dataset.refund);
    const st = m ? memberStats(m) : { credit: 0 };
    openPaymentModal({ memberId: b.dataset.refund, type: 'refund', amount: st.credit || '' });
  });
  root.querySelectorAll('[data-member]').forEach(b => b.onclick = () => openLedger(b.dataset.member));

  const dueCopy = `Due list for ${monthLabel(state.month)}:\n` +
    (dueRows.map(({ m, st }) => `• ${m.name} (Room ${m.room || '?'}, ${routerName(m.routerId)}) — ${money(st.due)}`).join('\n') || 'Nobody');

  root.querySelector('#rDueCopy').onclick = () => copyText(dueCopy);
  root.querySelector('#rPrint').onclick = () => printEl(`WiFi Report — ${monthLabel(state.month)}`);

  root.querySelector('#rDueCsv').onclick = () => {
    downloadFile(`due_${state.month}.csv`, toCSV(
      ['Name', 'Room', 'Phone', 'Router', 'Monthly Fee', 'Due', 'Total Paid'],
      dueRows.map(({ m, st }) => [m.name, m.room || '', m.phone || '', routerName(m.routerId), st.fee, st.due, st.paid])
    ), 'text/csv');
    toast('CSV downloaded', 'ok');
  };
  root.querySelector('#rCrCsv').onclick = () => {
    downloadFile(`advance_${state.month}.csv`, toCSV(
      ['Name', 'Room', 'Phone', 'Router', 'Total Paid', 'Refundable'],
      creditRows.map(({ m, st }) => [m.name, m.room || '', m.phone || '', routerName(m.routerId), st.paid, st.credit])
    ), 'text/csv');
    toast('CSV downloaded', 'ok');
  };
  root.querySelector('#rRoomCsv').onclick = () => {
    downloadFile(`rooms_${state.month}.csv`, toCSV(
      ['Room', 'Members', 'Connected Devices', 'Total Devices', 'Due'],
      roomRows().map(r => [r.room, r.members, r.connected, r.devices, r.due])
    ), 'text/csv');
    toast('CSV downloaded', 'ok');
  };
  root.querySelector('#rBackup').onclick = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      members: state.members,
      payments: state.payments.map(p => ({ ...p, date: p.date?.toDate ? p.date.toDate().toISOString() : p.date })),
      devices: state.devices
    };
    downloadFile(`wifi-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
    toast('Backup downloaded', 'ok');
  };
}
