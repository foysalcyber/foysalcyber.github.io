/* ============================================================
   Main screen — one router at a time, one month at a time
   ============================================================ */
import {
  state, membersOf, monthSummary, paymentFor, paidAmount, devicesOf, fee, routerName
} from "../store.js";
import { openMemberModal, openPaymentModal, openMemberPanel } from "../modals.js";
import {
  esc, tk, monthLabel, avatarHtml, emptyState, statCard, skeleton
} from "../utils.js";

export function render(root) {
  if (!state.ready) { root.innerHTML = skeleton('page'); return; }

  const routers = state.settings.routers || [{ id: 'A', name: 'Router A' }, { id: 'B', name: 'Router B' }];
  const rows = membersOf();
  const s = monthSummary();
  const monthShort = monthLabel(state.month, true);

  root.innerHTML = `
    <div class="rtabs" id="rtabs">
      ${routers.map(r => {
        const n = state.members.filter(m => (m.routerId || 'A') === r.id).length;
        return `<button class="rtab ${state.router === r.id ? 'on' : ''}" data-router="${r.id}">
          <span class="rt-ico">📡</span>
          <span class="col">
            <span class="rt-name">${esc(r.name)}</span>
            <span class="rt-sub">${n} member${n === 1 ? '' : 's'}</span>
          </span>
        </button>`;
      }).join('')}
    </div>

    <div class="grid cols-3">
      ${statCard({
        label: `Collected in ${monthShort}`,
        value: tk(s.collected), icon: '💰', tone: 'success', accent: true,
        hint: `of ${tk(s.expected)} expected`
      })}
      ${statCard({
        label: 'Paid', value: `${s.paidCount} / ${s.members}`, icon: '✅', tone: 'success',
        hint: `${s.unpaidCount} still unpaid`
      })}
      ${statCard({
        label: 'Pending', value: tk(s.pending), icon: '⏳', tone: s.pending > 0 ? 'danger' : '',
        hint: s.pending > 0 ? 'to collect this month' : 'all collected'
      })}
    </div>

    <div class="toolbar">
      <div class="search-box">
        <span class="si">🔍</span>
        <input type="text" id="mSearch" placeholder="Search name or room…" value="${esc(state.search)}" />
      </div>
      <div class="spacer"></div>
      <div class="segmented" id="mFilters">
        ${[['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid']]
          .map(([k, l]) => `<button data-f="${k}" class="${state.filter === k ? 'active' : ''}">${l}</button>`).join('')}
      </div>
      <button class="btn btn-primary" id="mAdd">＋ Add member</button>
    </div>

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
                <td>
                  <div class="cell-user">
                    ${avatarHtml(m.name)}
                    <div class="meta"><div class="n">${esc(m.name)}</div></div>
                  </div>
                </td>
                <td><b>${esc(m.room || '—')}</b></td>
                <td>${dev.length
                    ? `<span class="badge">📱 ${dev.length}</span>`
                    : '<span class="faint small">None</span>'}</td>
                <td>${amt > 0
                    ? `<span class="badge ok">Paid ${tk(amt)}</span>`
                    : `<span class="badge danger">Unpaid</span>`}</td>
                <td class="right">
                  ${amt > 0
                    ? `<button class="btn btn-sm btn-success" data-pay="${m.id}" title="Change or undo this payment">✅ Paid</button>`
                    : `<button class="btn btn-sm btn-primary" data-pay="${m.id}" title="Record the money you received">Mark paid</button>`}
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="5">${emptyState({
              icon: state.search || state.filter !== 'all' ? '🔍' : '👥',
              title: state.search || state.filter !== 'all' ? 'No member found' : `No members on ${routerName(state.router)} yet`,
              text: state.search || state.filter !== 'all' ? 'Try a different search or filter.' : 'Tap “Add member” to create the first one.',
              action: (state.search || state.filter !== 'all') ? '' : `<button class="btn btn-primary btn-sm" id="mAdd2">＋ Add member</button>`
            })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <p class="small muted mt-12">
      💡 Tap a member to see their devices and the last 6 months.
      Every new month starts with everyone unpaid — mark them paid as you collect ${tk(fee())}.
    </p>
  `;

  bind(root);
}

function bind(root) {
  root.querySelectorAll('[data-router]').forEach(b => b.onclick = () => {
    state.router = b.dataset.router;
    try { localStorage.setItem('wifi-router', state.router); } catch { }
    render(root);
  });

  root.querySelectorAll('[data-pay]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    openPaymentModal(b.dataset.pay);
  });

  root.querySelectorAll('[data-member]').forEach(tr => tr.onclick = () => openMemberPanel(tr.dataset.member));

  const add = () => openMemberModal();
  const a1 = root.querySelector('#mAdd'); if (a1) a1.onclick = add;
  const a2 = root.querySelector('#mAdd2'); if (a2) a2.onclick = add;

  const search = root.querySelector('#mSearch');
  if (search) {
    search.addEventListener('input', () => {
      const pos = search.selectionStart;
      state.search = search.value;
      clearTimeout(window.__msearch);
      window.__msearch = setTimeout(() => {
        render(root);
        const el = root.querySelector('#mSearch');
        if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { } }
      }, 220);
    });
  }

  root.querySelectorAll('#mFilters button').forEach(b => b.onclick = () => {
    state.filter = b.dataset.f;
    render(root);
  });
}
