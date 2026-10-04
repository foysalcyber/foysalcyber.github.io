/* ============================================================
   Members — list, filters, balances, export
   ============================================================ */
import {
  state, memberStats, routerName, routerBadgeClass, devicesOf, paidInMonth
} from "../store.js";
import { openMemberModal, openPaymentModal, openLedger, openDeviceModal } from "../modals.js";
import {
  esc, tk, monthLabel, downloadFile, toCSV, printEl, toast,
  statCard, emptyState, avatarHtml, skeleton, sortTh
} from "../utils.js";
import { refresh } from "../app.js";

let filter = 'all';                                  // all | due | credit | clear | inactive
let sort = { key: 'room', dir: 'asc' };

export function render(root) {
  if (!state.ready) { root.innerHTML = skeleton('table'); return; }

  const all = state.members.filter(m => state.router === 'all' || m.routerId === state.router);
  const rowsAll = all.map(m => ({ m, st: memberStats(m) }));
  const cnt = {
    all: rowsAll.length,
    due: rowsAll.filter(x => x.st.due > 0).length,
    credit: rowsAll.filter(x => x.st.credit > 0).length,
    clear: rowsAll.filter(x => x.st.due === 0 && x.st.credit === 0).length,
    inactive: rowsAll.filter(x => x.m.active === false).length
  };

  let rows = rowsAll;
  if (filter === 'due') rows = rows.filter(x => x.st.due > 0);
  else if (filter === 'credit') rows = rows.filter(x => x.st.credit > 0);
  else if (filter === 'clear') rows = rows.filter(x => x.st.due === 0 && x.st.credit === 0);
  else if (filter === 'inactive') rows = rows.filter(x => x.m.active === false);

  if (state.search) {
    const q = state.search.toLowerCase();
    rows = rows.filter(({ m }) => [m.name, m.room, m.phone, m.note].some(v => (v || '').toLowerCase().includes(q)));
  }

  const dir = sort.dir === 'asc' ? 1 : -1;
  const val = {
    name: x => (x.m.name || '').toLowerCase(),
    room: x => x.m.room || '',
    fee: x => x.st.fee,
    months: x => x.st.billedMonths,
    paid: x => x.st.paid,
    month: x => paidInMonth(x.m, state.month),
    balance: x => x.st.credit - x.st.due,
    devices: x => devicesOf(x.m.id).length
  }[sort.key] || (x => x.m.room || '');
  rows.sort((a, b) => {
    const va = val(a), vb = val(b);
    if (typeof va === 'string') return va.localeCompare(vb, 'en', { numeric: true }) * dir;
    return (va - vb) * dir || (a.m.name || '').localeCompare(b.m.name || '', 'en') ;
  });

  const totalDue = rowsAll.reduce((s, x) => s + x.st.due, 0);
  const totalCredit = rowsAll.reduce((s, x) => s + x.st.credit, 0);

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>👥 Members</h1>
        <p>${esc(routerName(state.router))} · ${cnt.all} member${cnt.all === 1 ? '' : 's'} · ${tk(totalDue)} outstanding</p>
      </div>
      <div class="spacer"></div>
      <button class="btn" id="mExport">⬇️ CSV</button>
      <button class="btn" id="mPrint">🖨️ Print</button>
      <button class="btn btn-primary" id="mAdd">＋ New member</button>
    </div>

    <div class="grid cols-auto stagger" style="margin-bottom:18px">
      ${statCard({ label: 'Total members', value: cnt.all, icon: '👥', tone: 'brand', hint: esc(routerName(state.router)) })}
      ${statCard({ label: 'Has due', value: cnt.due, icon: '📉', tone: 'danger', hint: tk(totalDue) + ' to collect' })}
      ${statCard({ label: 'Has advance', value: cnt.credit, icon: '⭐', tone: 'info', hint: tk(totalCredit) + ' credit' })}
      ${statCard({ label: 'Clear', value: cnt.clear, icon: '✅', tone: 'success', hint: 'up to ' + monthLabel(state.month, true) })}
    </div>

    <div class="toolbar">
      <div class="search-box">
        <span class="si">🔍</span>
        <input type="text" id="mSearch" placeholder="Search name, room or phone…" value="${esc(state.search)}" />
      </div>
      <div class="spacer"></div>
      <div class="segmented" id="mFilters">
        ${[['all', 'All'], ['due', 'Has due'], ['credit', 'Has advance'], ['clear', 'Clear'], ['inactive', 'Inactive']]
          .map(([k, l]) => `<button data-f="${k}" class="${filter === k ? 'active' : ''}">${l} <span class="cnt">${cnt[k]}</span></button>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr>
            ${sortTh('name', 'Member', sort)}
            <th>Router</th>
            ${sortTh('fee', 'Fee/mo', sort, 'right')}
            ${sortTh('months', 'Months', sort, 'right')}
            ${sortTh('paid', 'Paid', sort, 'right')}
            ${sortTh('month', monthLabel(state.month, true), sort, 'right')}
            ${sortTh('balance', 'Balance', sort, 'right')}
            ${sortTh('devices', 'Devices', sort, 'right')}
            <th class="right no-print">Actions</th>
          </tr></thead>
          <tbody>
            ${rows.map(({ m, st }) => {
              const devs = devicesOf(m.id);
              const conn = devs.filter(d => d.status === 'connected').length;
              return `<tr class="clickable" data-member="${m.id}">
                <td><div class="cell-user">
                  ${avatarHtml(m.name)}
                  <div class="meta">
                    <div class="n">${esc(m.name)} ${m.active === false ? '<span class="badge outline">Inactive</span>' : ''}</div>
                    <div class="s">Room ${esc(m.room || '—')}${m.phone ? ' · ' + esc(m.phone) : ''}</div>
                  </div>
                </div></td>
                <td><span class="badge ${routerBadgeClass(m.routerId)}">${esc(routerName(m.routerId))}</span></td>
                <td class="right num">${tk(st.fee)}</td>
                <td class="right num">${st.billedMonths}</td>
                <td class="right num">${tk(st.paid)}</td>
                <td class="right num">${paidInMonth(m, state.month) > 0
                  ? `<span class="badge ok">${tk(paidInMonth(m, state.month))}</span>`
                  : '<span class="badge danger">Not paid</span>'}</td>
                <td class="right num">
                  ${st.due > 0 ? `<b style="color:var(--danger)">${tk(st.due)} due</b>`
                    : (st.credit > 0 ? `<b style="color:var(--info)">${tk(st.credit)} ⭐</b>`
                    : '<span class="badge ok">Clear</span>')}
                </td>
                <td class="right num">${devs.length ? `${conn}/${devs.length}` : '<span class="faint">—</span>'}</td>
                <td class="right no-print"><div class="row-actions">
                  <button class="btn btn-sm btn-success" data-pay="${m.id}">💳</button>
                  <button class="btn btn-sm" data-edit="${m.id}" title="Edit">✏️</button>
                  <button class="btn btn-sm" data-dev="${m.id}" title="Add device">📱</button>
                </div></td>
              </tr>`;
            }).join('') ||
            `<tr><td colspan="9">${emptyState({
              icon: state.search ? '🔍' : '👥',
              title: state.search ? 'No members found' : 'No members yet',
              text: state.search ? 'Try a different search term.' : 'Add the first member who took WiFi.',
              action: state.search ? '' : `<button class="btn btn-primary btn-sm" id="mAdd2">＋ New member</button>`
            })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <p class="small muted mt-12">💡 Click any row to open the full ledger. “Months” = how many months have been billed (up to ${esc(monthLabel(state.month, true))}).</p>
  `;

  bind(root, rows, rowsAll);
}

function bind(root, rows, rowsAll) {
  const search = root.querySelector('#mSearch');
  let t;
  search.addEventListener('input', () => {
    state.search = search.value;
    clearTimeout(t);
    t = setTimeout(() => {
      refresh();
      const s = document.querySelector('#mSearch');
      if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    }, 300);
  });

  root.querySelectorAll('#mFilters [data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; render(root); });
  root.querySelectorAll('th.sortable').forEach(th => th.onclick = () => {
    const k = th.dataset.sort;
    sort = { key: k, dir: sort.key === k && sort.dir === 'asc' ? 'desc' : 'asc' };
    render(root);
  });

  root.querySelector('#mAdd').onclick = () => openMemberModal();
  root.querySelector('#mAdd2')?.addEventListener('click', () => openMemberModal());

  root.querySelectorAll('[data-member]').forEach(tr => tr.onclick = () => openLedger(tr.dataset.member));
  root.querySelectorAll('[data-pay]').forEach(b => b.onclick = e => { e.stopPropagation(); openPaymentModal({ memberId: b.dataset.pay }); });
  root.querySelectorAll('[data-edit]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const m = state.members.find(x => x.id === b.dataset.edit);
    openMemberModal(m);
  });
  root.querySelectorAll('[data-dev]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    openDeviceModal({ memberId: b.dataset.dev, routerId: state.router === 'all' ? '' : state.router });
  });

  root.querySelector('#mExport').onclick = () => {
    const head = ['Name', 'Room', 'Phone', 'Router', 'Monthly Fee', 'Months Billed', 'Total Billed', 'Total Paid', 'Refunded', 'Due', 'Advance', 'Status', 'Start Month'];
    const data = rows.map(({ m, st }) => [
      m.name, m.room || '', m.phone || '', routerName(m.routerId), st.fee, st.billedMonths,
      st.billed, st.paid, st.refunded, st.due, st.credit, m.active === false ? 'Inactive' : 'Active', m.startMonth
    ]);
    downloadFile(`members_${routerName(state.router).replace(/\s+/g, '_')}_${state.month}.csv`, toCSV(head, data), 'text/csv');
    toast('CSV downloaded', 'ok');
  };
  root.querySelector('#mPrint').onclick = () => printEl(`Member list — ${routerName(state.router)}`);
}
