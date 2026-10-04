/* ============================================================
   Devices — who uses what, blocking, room view
   ============================================================ */
import { state, memberById, routerName, routerBadgeClass, memberStats, filteredDevices, db_actions } from "../store.js";
import { openDeviceModal, openPaymentModal, openLedger } from "../modals.js";
import {
  esc, tk, downloadFile, toCSV, printEl, toast, loading, confirmDialog,
  statCard, emptyState, avatarHtml, skeleton
} from "../utils.js";
import { DEVICE_TYPES, DEVICE_STATUS, COL } from "../config.js";
import { db, writeBatch, doc, serverTimestamp } from "../firebase.js";

let filter = 'all';         // all | connected | blocked | unknown | due
let groupMode = 'list';     // list | room
const selected = new Set();

export function render(root) {
  if (!state.ready) { root.innerHTML = skeleton('table'); return; }

  const all = filteredDevices();
  const cnt = {
    all: all.length,
    connected: all.filter(d => d.status === 'connected').length,
    blocked: all.filter(d => d.status === 'blocked').length,
    unknown: all.filter(d => !d.memberId).length,
    due: all.filter(d => { const m = memberById(d.memberId); return m && memberStats(m).due > 0; }).length
  };

  let rows = all;
  if (filter === 'connected') rows = rows.filter(d => d.status === 'connected');
  else if (filter === 'blocked') rows = rows.filter(d => d.status === 'blocked');
  else if (filter === 'unknown') rows = rows.filter(d => !d.memberId);
  else if (filter === 'due') rows = rows.filter(d => { const m = memberById(d.memberId); return m && memberStats(m).due > 0; });

  if (state.search) {
    const q = state.search.toLowerCase();
    rows = rows.filter(d => {
      const m = memberById(d.memberId);
      return [d.name, d.mac, d.room, m?.name].some(v => (v || '').toLowerCase().includes(q));
    });
  }
  rows = rows.sort((a, b) =>
    (a.status === 'blocked' ? 1 : 0) - (b.status === 'blocked' ? 1 : 0)
    || String(a.room || '').localeCompare(String(b.room || ''), 'en', { numeric: true })
    || String(a.name).localeCompare(String(b.name), 'en'));

  const rooms = {};
  rows.forEach(d => { const k = d.room || 'Unknown room'; (rooms[k] = rooms[k] || []).push(d); });
  const roomKeys = Object.keys(rooms).sort((a, b) => String(a).localeCompare(String(b), 'en', { numeric: true }));

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>📱 Devices</h1>
        <p>${esc(routerName(state.router))} · ${cnt.all} device${cnt.all === 1 ? '' : 's'} tracked · ${cnt.connected} online</p>
      </div>
      <div class="spacer"></div>
      <button class="btn" id="dExport">⬇️ CSV</button>
      <button class="btn" id="dPrint">🖨️ Print</button>
      <button class="btn btn-primary" id="dAdd">＋ Add device</button>
    </div>

    <div class="grid cols-auto stagger">
      ${statCard({ label: 'Total devices', value: cnt.all, icon: '📱', tone: 'brand', hint: esc(routerName(state.router)) })}
      ${statCard({ label: 'Connected', value: cnt.connected, icon: '🟢', tone: 'success', hint: 'online right now' })}
      ${statCard({ label: 'Blocked', value: cnt.blocked, icon: '🚫', tone: 'danger', hint: 'access denied' })}
      ${statCard({ label: 'Unknown', value: cnt.unknown, icon: '❓', tone: 'warning', hint: 'no owner linked' })}
      ${statCard({ label: "Defaulter-owned", value: cnt.due, icon: '💸', tone: 'danger', hint: 'owner still owes' })}
    </div>

    ${selected.size ? `
      <div class="card" style="margin:16px 0;border-color:var(--brand-200);background:var(--brand-50)">
        <div class="card-body tight row wrap">
          <b>${selected.size} selected</b>
          <div class="spacer"></div>
          <button class="btn btn-sm btn-soft-danger" id="bulkBlock">🚫 Block</button>
          <button class="btn btn-sm" id="bulkUnblock">✅ Unblock</button>
          <button class="btn btn-sm" id="bulkConnect">🟢 Mark connected</button>
          <button class="btn btn-sm" id="bulkClear">Clear selection</button>
          <button class="btn btn-sm btn-soft-danger" id="bulkDelete">🗑️ Delete</button>
        </div>
      </div>` : ''}

    <div class="toolbar">
      <div class="search-box">
        <span class="si">🔍</span>
        <input type="text" id="dSearch" placeholder="Search device, MAC, room or owner…" value="${esc(state.search)}" />
      </div>
      <div class="spacer"></div>
      <div class="segmented" id="dFilters">
        ${[['all', 'All'], ['connected', '🟢 Connected'], ['blocked', '🚫 Blocked'], ['unknown', '❓ Unknown'], ['due', '💸 Defaulters']]
          .map(([k, l]) => `<button data-f="${k}" class="${filter === k ? 'active' : ''}">${l} <span class="cnt">${cnt[k]}</span></button>`).join('')}
      </div>
      <div class="tabs" id="dView">
        <button data-g="list" class="${groupMode === 'list' ? 'active' : ''}">List</button>
        <button data-g="room" class="${groupMode === 'room' ? 'active' : ''}">By room</button>
      </div>
    </div>

    ${groupMode === 'list'
      ? deviceTable(rows)
      : roomView(rooms, roomKeys)}

    <p class="small muted mt-12">💡 Tip: add devices from your router's DHCP client list. “Blocked” only marks it here — remember to block the MAC on the router itself.</p>
  `;

  bind(root, rows);
}

/* ------------------------------ views ------------------------------ */
function statusBadge(d) {
  const s = DEVICE_STATUS[d.status] || DEVICE_STATUS.offline;
  return `<span class="badge ${s.cls}"><span class="dot-ico"></span>${s.label}</span>`;
}
function accountBadge(owner) {
  if (!owner) return '<span class="faint">—</span>';
  const st = memberStats(owner);
  if (st.due > 0) return `<span class="badge danger">Due ${tk(st.due)}</span>`;
  if (st.credit > 0) return `<span class="badge info">⭐ ${tk(st.credit)}</span>`;
  return '<span class="badge ok">Clear</span>';
}

function deviceTable(rows) {
  return `
  <div class="card">
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr>
          <th style="width:38px"><input type="checkbox" id="selAll" aria-label="Select all" /></th>
          <th>Device</th><th>Owner</th><th>Room</th><th>Router</th><th>Status</th><th>Account</th>
          <th class="right no-print">Actions</th>
        </tr></thead>
        <tbody>
          ${rows.map(d => {
            const m = memberById(d.memberId);
            return `<tr>
              <td><input type="checkbox" class="sel" value="${d.id}" ${selected.has(d.id) ? 'checked' : ''} aria-label="Select ${esc(d.name)}" /></td>
              <td><div class="cell-user">
                <span style="font-size:19px;width:32px;text-align:center">${(DEVICE_TYPES[d.type] || DEVICE_TYPES.other).split(' ')[0]}</span>
                <div class="meta">
                  <div class="n">${esc(d.name)}</div>
                  <div class="s mono">${esc(d.mac || 'No MAC')}${d.note ? ' · ' + esc(d.note) : ''}</div>
                </div>
              </div></td>
              <td>${m ? `<button class="link-btn" data-member="${m.id}">${esc(m.name)}</button>` : '<span class="badge warn">Unknown</span>'}</td>
              <td>${esc(d.room || '—')}</td>
              <td><span class="badge ${routerBadgeClass(d.routerId)}">${esc(routerName(d.routerId))}</span></td>
              <td>${statusBadge(d)}</td>
              <td>${accountBadge(m)}</td>
              <td class="right no-print"><div class="row-actions">
                <button class="btn btn-sm" data-toggle="${d.id}" title="${d.status === 'blocked' ? 'Unblock' : 'Block'}">${d.status === 'blocked' ? '✅' : '🚫'}</button>
                <button class="btn btn-sm" data-edit="${d.id}">✏️</button>
              </div></td>
            </tr>`;
          }).join('') ||
          `<tr><td colspan="8">${emptyState({
            icon: '📱',
            title: 'No devices found',
            text: 'Add the devices connected to your routers so you can see who is online.',
            action: `<button class="btn btn-primary btn-sm" id="dAdd2">＋ Add device</button>`
          })}</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

function roomView(rooms, roomKeys) {
  if (!roomKeys.length) {
    return `<div class="card">${emptyState({ icon: '📱', title: 'No devices found', text: 'Add devices to see them grouped by room.' })}</div>`;
  }
  return `<div class="grid cols-2 stagger">${roomKeys.map(room => {
    const list = rooms[room];
    const online = list.filter(d => d.status === 'connected').length;
    return `<div class="card hoverable">
      <div class="card-head">
        <h3>🏠 Room ${esc(room)}</h3>
        <div class="spacer"></div>
        <span class="badge ${online ? 'ok' : ''}">${online} online</span>
        <span class="badge outline">${list.length} device${list.length === 1 ? '' : 's'}</span>
      </div>
      <div class="card-body flush">
        ${list.map(d => {
          const m = memberById(d.memberId);
          return `<div class="list-item">
            <span style="font-size:18px;width:28px;text-align:center">${(DEVICE_TYPES[d.type] || DEVICE_TYPES.other).split(' ')[0]}</span>
            <div class="li-main">
              <div class="t">${esc(d.name)}</div>
              <div class="s">${m ? esc(m.name) : '❓ Unknown owner'} · ${esc(routerName(d.routerId))}</div>
            </div>
            ${statusBadge(d)}
            ${accountBadge(m)}
            <button class="icon-btn sm no-print" data-edit="${d.id}" title="Edit">✏️</button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('')}</div>`;
}

/* ------------------------------ events ------------------------------ */
function bind(root, rows) {
  const search = root.querySelector('#dSearch');
  let t;
  search.addEventListener('input', () => {
    state.search = search.value;
    clearTimeout(t);
    t = setTimeout(() => {
      render(root);
      const s = document.querySelector('#dSearch');
      if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    }, 300);
  });

  root.querySelectorAll('#dFilters [data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; render(root); });
  root.querySelectorAll('#dView [data-g]').forEach(b => b.onclick = () => { groupMode = b.dataset.g; render(root); });
  root.querySelector('#dAdd').onclick = () => openDeviceModal();
  root.querySelector('#dAdd2')?.addEventListener('click', () => openDeviceModal());

  root.querySelectorAll('[data-member]').forEach(b => b.onclick = () => openLedger(b.dataset.member));

  const selAll = root.querySelector('#selAll');
  if (selAll) selAll.onchange = e => {
    root.querySelectorAll('.sel').forEach(cb => {
      cb.checked = e.target.checked;
      e.target.checked ? selected.add(cb.value) : selected.delete(cb.value);
    });
    render(root);
  };
  root.querySelectorAll('.sel').forEach(cb => cb.onchange = () => {
    cb.checked ? selected.add(cb.value) : selected.delete(cb.value);
    render(root);
  });

  root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const d = state.devices.find(x => x.id === b.dataset.edit);
    openDeviceModal(d);
  });
  root.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    const d = state.devices.find(x => x.id === b.dataset.toggle);
    const next = d.status === 'blocked' ? 'offline' : 'blocked';
    try { loading(true); await db_actions.updateDevice(d.id, { status: next }); toast(next === 'blocked' ? 'Device blocked' : 'Device unblocked', 'ok'); }
    catch (e) { toast('Error: ' + e.message, 'err'); } finally { loading(false); }
  });

  const ids = Array.from(selected);
  const on = (id, fn) => { const el = root.querySelector('#' + id); if (el) el.onclick = fn; };
  on('bulkBlock', async () => {
    try { loading(true); await db_actions.blockMany(ids, true); selected.clear(); toast(`${ids.length} device(s) blocked`, 'ok'); }
    catch (e) { toast('Error: ' + e.message, 'err'); } finally { loading(false); }
  });
  on('bulkUnblock', async () => {
    try { loading(true); await bulkSet(ids, 'offline'); selected.clear(); toast('Devices unblocked', 'ok'); }
    catch (e) { toast('Error: ' + e.message, 'err'); } finally { loading(false); }
  });
  on('bulkConnect', async () => {
    try { loading(true); await bulkSet(ids, 'connected'); selected.clear(); toast('Marked as connected', 'ok'); }
    catch (e) { toast('Error: ' + e.message, 'err'); } finally { loading(false); }
  });
  on('bulkClear', () => { selected.clear(); render(root); });
  on('bulkDelete', async () => {
    const ok = await confirmDialog({
      title: 'Delete devices?',
      message: `<b>${ids.length}</b> device(s) will be permanently deleted.`,
      okText: 'Delete'
    });
    if (!ok) return;
    try { loading(true); await db_actions.deleteManyDevices(ids); selected.clear(); toast('Devices deleted', 'ok'); }
    catch (e) { toast('Error: ' + e.message, 'err'); } finally { loading(false); }
  });

  root.querySelector('#dExport').onclick = () => {
    const head = ['Device', 'MAC', 'Type', 'Owner', 'Room', 'Router', 'Status', 'Note'];
    const data = rows.map(d => [d.name, d.mac || '', DEVICE_TYPES[d.type] || d.type,
      memberById(d.memberId)?.name || 'Unknown', d.room || '', routerName(d.routerId),
      DEVICE_STATUS[d.status]?.label || d.status, d.note || '']);
    downloadFile(`devices_${routerName(state.router).replace(/\s+/g, '_')}.csv`, toCSV(head, data), 'text/csv');
    toast('CSV downloaded', 'ok');
  };
  root.querySelector('#dPrint').onclick = () => printEl('Device list');
}

async function bulkSet(ids, status) {
  const batch = writeBatch(db);
  ids.forEach(id => batch.update(doc(db, COL.devices, id), { status, updatedAt: serverTimestamp() }));
  await batch.commit();
}
