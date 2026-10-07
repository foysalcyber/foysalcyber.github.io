/* ============================================================
   Main screen — one router at a time, one month at a time
   Members (inline editable) + device search
   ============================================================ */
import {
  state, membersOf, monthSummary, paymentFor, paidAmount, devicesOf,
  fee, routerName, routerStats, searchDevices, db_actions
} from "../store.js";
import { openMemberModal, openPaymentModal, openMemberPanel, openDeviceModal } from "../modals.js";
import {
  esc, tk, monthLabel, avatarHtml, emptyState, statCard, skeleton, toast
} from "../utils.js";

export function render(root) {
  if (!state.ready) { root.innerHTML = skeleton('page'); return; }

  const routers = state.settings.routers || [{ id: 'A', name: 'Router A' }, { id: 'B', name: 'Router B' }];
  const s = monthSummary();
  const monthShort = monthLabel(state.month, true);
  const isDevices = state.mode === 'devices';

  root.innerHTML = `
    <div class="rtabs" id="rtabs">
      ${routers.map(r => {
        const st = routerStats(r.id);
        return `<button class="rtab ${state.router === r.id ? 'on' : ''}" data-router="${r.id}">
          <span class="rt-ico">📡</span>
          <span class="col">
            <span class="rt-name">${esc(r.name)}</span>
            <span class="rt-sub">${st.members} member${st.members === 1 ? '' : 's'} · ${st.devices} device${st.devices === 1 ? '' : 's'}</span>
          </span>
          ${st.unpaid > 0 ? `<span class="rt-flag">${st.unpaid} unpaid</span>` : '<span class="rt-flag ok">All paid</span>'}
        </button>`;
      }).join('')}
    </div>

    <div class="grid cols-3 stagger">
      ${statCard({
        label: `Collected in ${monthShort}`,
        value: tk(s.collected), icon: '💰', tone: 'success', accent: true,
        hint: `of ${tk(s.expected)} expected`
      })}
      ${statCard({
        label: 'Paid', value: `${s.paidCount} / ${s.members}`, icon: '✅', tone: 'success',
        hint: `${s.unpaidCount} still unpaid`,
        extra: `<div class="mini-bar"><i style="width:${s.members ? Math.round(s.paidCount / s.members * 100) : 0}%"></i></div>`
      })}
      ${statCard({
        label: 'Pending', value: tk(s.pending), icon: '⏳', tone: s.pending > 0 ? 'danger' : '',
        hint: s.pending > 0 ? 'to collect this month' : 'all collected'
      })}
    </div>

    <div class="toolbar">
      <div class="segmented switch" id="mMode">
        <button data-mode="members" class="${isDevices ? '' : 'active'}">👥 Members</button>
        <button data-mode="devices" class="${isDevices ? 'active' : ''}">📱 Devices</button>
      </div>

      <div class="search-box">
        <span class="si">🔍</span>
        <input type="${isDevices ? 'text' : 'text'}"
               id="mSearch"
               placeholder="${isDevices ? 'Search device, MAC, owner or room…' : 'Search name or room…'}"
               value="${esc(isDevices ? state.query : state.search)}" />
      </div>

      ${isDevices ? '' : `
      <div class="segmented" id="mFilters">
        ${[['all', 'All', s.members], ['unpaid', 'Unpaid', s.unpaidCount], ['paid', 'Paid', s.paidCount]]
          .map(([k, l, n]) => `<button data-f="${k}" class="${state.filter === k ? 'active' : ''}">${l} <span class="cnt">${n}</span></button>`).join('')}
      </div>`}

      <div class="spacer"></div>
      <button class="btn btn-primary" id="mAdd">＋ Add member</button>
    </div>

    ${isDevices ? deviceTable() : memberTable(monthShort)}

    <p class="hint-line">
      ${isDevices
        ? `💡 Tap a device to open its owner. Searching looks across <b>both routers</b>.`
        : `💡 Tap a member for devices + 6-month history · tap the <b>name</b> or <b>room</b> to edit it inline. Every new month starts with everyone unpaid — mark them paid as you collect ${tk(fee())}.`}
    </p>
  `;

  bind(root);
}

/* ------------------------------ members ------------------------------ */
function memberTable(monthShort) {
  const rows = membersOf();
  return `
    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th>Room</th>
              <th>Devices</th>
              <th>${esc(monthShort)}</th>
              <th class="right">Mark</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(m => {
              const amt = paidAmount(m.id, state.month);
              const dev = devicesOf(m.id);
              return `<tr class="clickable" data-member="${m.id}">
                <td class="editable" data-edit="name" data-label="Member" title="Click to edit the name">
                  <div class="cell-user">
                    ${avatarHtml(m.name)}
                    <div class="meta"><span class="n">${esc(m.name)}</span></div>
                    <span class="pen">✏️</span>
                  </div>
                </td>
                <td class="editable" data-edit="room" data-label="Room" title="Click to edit the room">
                  <b>${esc(m.room || '—')}</b><span class="pen">✏️</span>
                </td>
                <td data-label="Devices">${dev.length
                    ? `<span class="badge">📱 ${dev.length}</span>`
                    : '<span class="faint small">None</span>'}</td>
                <td data-label="${esc(monthShort)}">${amt > 0
                    ? `<span class="badge ok">Paid ${tk(amt)}</span>`
                    : `<span class="badge danger">Unpaid</span>`}</td>
                <td class="right" data-label="Mark">
                  ${amt > 0
                    ? `<button class="btn btn-sm btn-success" data-pay="${m.id}" title="Change or undo this payment">✅ Paid</button>`
                    : `<button class="btn btn-sm btn-primary" data-pay="${m.id}" title="Record the money you received">Mark paid</button>`}
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="5">${emptyState({
              icon: (state.search || state.filter !== 'all') ? '🔍' : '👥',
              title: (state.search || state.filter !== 'all') ? 'No member found' : `No members on ${routerName(state.router)} yet`,
              text: (state.search || state.filter !== 'all') ? 'Try a different search or filter.' : 'Tap “Add member” to create the first one.',
              action: (state.search || state.filter !== 'all') ? '' : `<button class="btn btn-primary btn-sm" id="mAdd2">＋ Add member</button>`
            })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ------------------------------ devices ------------------------------ */
function deviceTable() {
  const rows = searchDevices();
  const searching = (state.query || '').trim().length > 0;
  return `
    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Device</th>
              <th>MAC address</th>
              <th>Owner</th>
              <th>Room</th>
              ${searching ? '<th>Router</th>' : ''}
              <th class="right no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(d => {
              const pay = d.owner ? paidAmount(d.owner.id, state.month) : 0;
              return `<tr class="${d.owner ? 'clickable' : ''}" ${d.owner ? `data-member="${d.owner.id}"` : ''}>
                <td data-label="Device">
                  <div class="cell-user">
                    <span class="dev-ico">📱</span>
                    <div class="meta"><span class="n">${esc(d.name)}</span></div>
                  </div>
                </td>
                <td class="mono small" data-label="MAC">${esc(d.mac || '—')}</td>
                <td data-label="Owner">${d.owner
                    ? `<div class="cell-user">${avatarHtml(d.owner.name, 'sm')}<span class="n">${esc(d.owner.name)}</span></div>`
                    : '<span class="badge warn">Unassigned</span>'}</td>
                <td data-label="Room">${esc(d.room || d.owner?.room || '—')}</td>
                ${searching ? `<td data-label="Router"><span class="badge ${d.routerId === 'B' ? 'rb' : 'ra'}">${esc(routerName(d.routerId))}</span></td>` : ''}
                <td class="right no-print" data-label="Actions">
                  ${d.owner
                    ? (pay > 0
                        ? `<span class="badge ok">Paid ${tk(pay)}</span>`
                        : `<button class="btn btn-sm btn-primary" data-pay="${d.owner.id}">Mark paid</button>`)
                    : ''}
                  <button class="icon-btn sm" data-editdev="${d.id}" title="Edit device">✏️</button>
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="${searching ? 6 : 5}">${emptyState({
              icon: searching ? '🔍' : '📱',
              title: searching ? 'No device found' : `No devices on ${routerName(state.router)} yet`,
              text: searching ? 'Check the device name, MAC or owner.' : 'Open a member and add their device name + MAC address.',
              action: searching ? '' : `<button class="btn btn-primary btn-sm" id="mAdd2">＋ Add member</button>`
            })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ------------------------------ events ------------------------------ */
function bind(root) {
  // router sections
  root.querySelectorAll('[data-router]').forEach(b => b.onclick = () => {
    state.router = b.dataset.router;
    try { localStorage.setItem('wifi-router', state.router); } catch { }
    render(root);
  });

  // members / devices switch
  root.querySelectorAll('#mMode button').forEach(b => b.onclick = () => {
    state.mode = b.dataset.mode;
    render(root);
    root.querySelector('#mSearch')?.focus();
  });

  // filters
  root.querySelectorAll('#mFilters button').forEach(b => b.onclick = () => {
    state.filter = b.dataset.f;
    render(root);
  });

  // search (members or devices)
  const search = root.querySelector('#mSearch');
  if (search) {
    search.addEventListener('input', () => {
      const pos = search.selectionStart;
      if (state.mode === 'devices') state.query = search.value;
      else state.search = search.value;
      clearTimeout(window.__msearch);
      window.__msearch = setTimeout(() => {
        render(root);
        const el = root.querySelector('#mSearch');
        if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { } }
      }, 220);
    });
  }

  // payment
  root.querySelectorAll('[data-pay]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    openPaymentModal(b.dataset.pay);
  });
  root.querySelectorAll('[data-editdev]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    openDeviceModal(state.devices.find(x => x.id === b.dataset.editdev));
  });

  // open member panel
  root.querySelectorAll('tr[data-member]').forEach(tr => tr.onclick = () => openMemberPanel(tr.dataset.member));

  // inline editing of name / room
  root.querySelectorAll('td.editable').forEach(td => td.addEventListener('click', e => {
    e.stopPropagation();
    startEdit(td, root);
  }));

  const add = () => openMemberModal();
  const a1 = root.querySelector('#mAdd'); if (a1) a1.onclick = add;
  const a2 = root.querySelector('#mAdd2'); if (a2) a2.onclick = add;
}

/* ------------------------------ inline edit ------------------------------ */
function startEdit(td, root) {
  if (td.querySelector('input')) return;
  const tr = td.closest('[data-member]');
  const id = tr?.dataset.member;
  const field = td.dataset.edit;
  const m = state.members.find(x => x.id === id);
  if (!m) return;

  const old = String(m[field] ?? '');
  const input = document.createElement('input');
  input.className = 'inline-edit';
  input.value = old;
  input.placeholder = field === 'room' ? 'Room no.' : 'Name';
  input.setAttribute('aria-label', 'Edit ' + field);

  td.classList.add('editing');
  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  input.select();

  let closed = false;
  const cancel = () => { if (closed) return; closed = true; render(root); };

  const save = async () => {
    if (closed) return;
    closed = true;
    const val = input.value.trim();
    if (!val || val === old) { render(root); return; }
    try {
      await db_actions.updateMember(id, { [field]: val });
      toast(field === 'room' ? 'Room updated' : 'Name updated', 'ok');
    } catch (e) {
      toast('Error: ' + e.message, 'err');
      render(root);
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
  });
}
