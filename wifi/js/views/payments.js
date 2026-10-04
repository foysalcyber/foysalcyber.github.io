/* ============================================================
   Payments — ledger, monthly collection, filters
   ============================================================ */
import { state, memberById, routerName, routerBadgeClass, recentMonths } from "../store.js";
import { openPaymentModal, openLedger } from "../modals.js";
import {
  esc, tk, money, monthLabel, dateLabel, downloadFile, toCSV, printEl, toast, loading, confirmDialog,
  statCard, emptyState, avatarHtml, skeleton, sectionHead
} from "../utils.js";
import { PAY_TYPES } from "../config.js";
import { db_actions } from "../store.js";

let typeFilter = 'all';
let onlyMonth = true;

const ts = v => v?.toMillis ? v.toMillis() : (v ? new Date(v).getTime() : 0);

export function render(root) {
  if (!state.ready) { root.innerHTML = skeleton('page'); return; }

  const all = state.payments.filter(p => state.router === 'all' || p.routerId === state.router);
  const monthPays = all.filter(p => p.month === state.month);
  const sum = (arr, types) => arr.filter(p => types.includes(p.type)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const collected = sum(monthPays, ['payment', 'advance']);
  const advance = sum(monthPays, ['advance']);
  const refunded = sum(monthPays, ['refund']);
  const waived = sum(monthPays, ['waiver']);
  const count = monthPays.filter(p => ['payment', 'advance'].includes(p.type)).length;

  let rows = all.slice();
  if (onlyMonth) rows = rows.filter(p => p.month === state.month);
  if (typeFilter !== 'all') rows = rows.filter(p => p.type === typeFilter);
  if (state.search) {
    const q = state.search.toLowerCase();
    rows = rows.filter(p => {
      const m = memberById(p.memberId);
      return [m?.name, m?.room, p.note].some(v => (v || '').toLowerCase().includes(q));
    });
  }
  rows.sort((a, b) => ts(b.date) - ts(a.date) || String(b.month || '').localeCompare(String(a.month || '')));

  const chartMonths = recentMonths(6);
  const chart = chartMonths.map(ym => ({
    ym,
    v: all.filter(p => p.month === ym && ['payment', 'advance'].includes(p.type))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
  }));
  const maxV = Math.max(1, ...chart.map(c => c.v));
  const curMonth = new Date().toISOString().slice(0, 7);

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>💳 Payments</h1>
        <p>${esc(routerName(state.router))} · ${all.length} entries recorded</p>
      </div>
      <div class="spacer"></div>
      <button class="btn" id="pExport">⬇️ CSV</button>
      <button class="btn" id="pPrint">🖨️ Print</button>
      <button class="btn btn-primary" id="pAdd">＋ Record payment</button>
    </div>

    <div class="grid cols-auto stagger">
      ${statCard({ label: `${monthLabel(state.month, true)} collection`, value: tk(collected), icon: '💰', tone: 'success', accent: true, hint: `${count} payment${count === 1 ? '' : 's'}` })}
      ${statCard({ label: 'Advance', value: tk(advance), icon: '⭐', tone: 'info', hint: 'received this month' })}
      ${statCard({ label: 'Refunded', value: tk(refunded), icon: '↩️', tone: 'danger', hint: 'paid back this month' })}
      ${statCard({ label: 'Waived', value: tk(waived), icon: '🎁', tone: 'warning', hint: 'written off this month' })}
    </div>

    ${sectionHead({ title: '📈 Last 6 months', sub: 'Collection trend' })}
    <div class="card"><div class="card-body">
      <div class="bar-chart">
        ${chart.map(c => `
          <div class="bar-col ${c.ym === curMonth ? 'is-current' : ''}" title="${monthLabel(c.ym)} — ${tk(c.v)}">
            <div class="bar-val">${c.v ? money(c.v) : ''}</div>
            <div class="bar" style="height:${Math.max(2, (c.v / maxV) * 100)}%"></div>
            <div class="bar-lab">${monthLabel(c.ym, true).split(' ')[0]}</div>
          </div>`).join('')}
      </div>
    </div></div>

    ${sectionHead({
      title: '🧾 Ledger',
      sub: `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}${onlyMonth ? ` in ${monthLabel(state.month, true)}` : ''}`
    })}

    <div class="toolbar">
      <div class="search-box">
        <span class="si">🔍</span>
        <input type="text" id="pSearch" placeholder="Search name, room or note…" value="${esc(state.search)}" />
      </div>
      <label class="switch"><input type="checkbox" id="pOnlyMonth" ${onlyMonth ? 'checked' : ''}><span class="track"></span><span class="small muted">Only ${esc(monthLabel(state.month, true))}</span></label>
      <div class="spacer"></div>
      <div class="segmented" id="pTypes">
        ${[['all', 'All'], ['payment', '💰 Payment'], ['advance', '⭐ Advance'], ['refund', '↩️ Refund'], ['waiver', '🎁 Waiver']]
          .map(([k, l]) => `<button data-t="${k}" class="${typeFilter === k ? 'active' : ''}">${l}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Date</th><th>Member</th><th>Router</th><th>Type</th><th>Month</th>
            <th class="right">Amount</th><th>Note</th><th class="right no-print">Actions</th>
          </tr></thead>
          <tbody>
            ${rows.map(p => {
              const m = memberById(p.memberId);
              const t = PAY_TYPES[p.type] || PAY_TYPES.payment;
              const neg = t.sign === -1;
              const tone = p.type === 'refund' ? 'danger' : (p.type === 'advance' ? 'info' : (p.type === 'waiver' ? 'warn' : 'ok'));
              return `<tr class="clickable" data-member="${p.memberId}">
                <td class="small muted">${dateLabel(p.date)}</td>
                <td><div class="cell-user">
                  ${avatarHtml(m?.name || '?', 'sm')}
                  <div class="meta"><div class="n">${esc(m?.name || 'Unknown')}</div><div class="s">Room ${esc(m?.room || '—')}</div></div>
                </div></td>
                <td><span class="badge ${routerBadgeClass(p.routerId || m?.routerId)}">${esc(routerName(p.routerId || m?.routerId))}</span></td>
                <td><span class="badge ${tone}">${t.icon} ${t.label}</span></td>
                <td class="small muted">${monthLabel(p.month, true)}</td>
                <td class="right num"><b style="color:${neg ? 'var(--danger)' : 'var(--success)'}">${neg ? '−' : '+'}${tk(p.amount)}</b></td>
                <td class="small muted">${esc(p.note || '')}</td>
                <td class="right no-print"><div class="row-actions">
                  <button class="btn btn-sm" data-edit="${p.id}">✏️</button>
                  <button class="btn btn-sm btn-soft-danger" data-del="${p.id}">🗑️</button>
                </div></td>
              </tr>`;
            }).join('') ||
            `<tr><td colspan="8">${emptyState({
              icon: '🧾',
              title: 'No payments found',
              text: onlyMonth ? 'Try another month, or switch off the month filter.' : 'Record the first payment to start the books.',
              action: `<button class="btn btn-primary btn-sm" id="pAdd2">＋ Record payment</button>`
            })}</td></tr>`}
          </tbody>
          ${rows.length ? `<tfoot><tr>
            <td colspan="5" class="right">Net total</td>
            <td class="right num">${tk(rows.reduce((s, p) => s + ((PAY_TYPES[p.type]?.sign ?? 1) * (Number(p.amount) || 0)), 0))}</td>
            <td colspan="2"></td></tr></tfoot>` : ''}
        </table>
      </div>
    </div>
  `;

  bind(root, rows);
}

function bind(root, rows) {
  const search = root.querySelector('#pSearch');
  let t;
  search.addEventListener('input', () => {
    state.search = search.value;
    clearTimeout(t);
    t = setTimeout(() => {
      render(root);
      const s = document.querySelector('#pSearch');
      if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    }, 300);
  });

  root.querySelector('#pOnlyMonth').onchange = e => { onlyMonth = e.target.checked; render(root); };
  root.querySelectorAll('#pTypes [data-t]').forEach(b => b.onclick = () => { typeFilter = b.dataset.t; render(root); });

  root.querySelector('#pAdd').onclick = () => openPaymentModal();
  root.querySelector('#pAdd2')?.addEventListener('click', () => openPaymentModal());

  root.querySelectorAll('[data-member]').forEach(tr => tr.onclick = () => openLedger(tr.dataset.member));

  root.querySelectorAll('[data-edit]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const p = state.payments.find(x => x.id === b.dataset.edit);
    openPaymentModal({ payment: p });
  });
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const p = state.payments.find(x => x.id === b.dataset.del);
    if (!p) return;
    const ok = await confirmDialog({
      title: 'Delete this payment?',
      message: `<b>${tk(p.amount)}</b> (${esc(monthLabel(p.month, true))}) will be deleted.`,
      okText: 'Delete'
    });
    if (!ok) return;
    try { loading(true); await db_actions.deletePayment(p.id); toast('Payment deleted', 'ok'); }
    catch (er) { toast('Error: ' + er.message, 'err'); }
    finally { loading(false); }
  });

  root.querySelector('#pExport').onclick = () => {
    const head = ['Date', 'Member', 'Room', 'Router', 'Type', 'Month', 'Amount', 'Note'];
    const data = rows.map(p => {
      const m = memberById(p.memberId);
      return [p.date ? dateLabel(p.date) : '', m?.name || 'Unknown', m?.room || '', routerName(p.routerId || m?.routerId),
        PAY_TYPES[p.type]?.label || p.type, p.month, (PAY_TYPES[p.type]?.sign ?? 1) * (Number(p.amount) || 0), p.note || ''];
    });
    downloadFile(`payments_${state.month}.csv`, toCSV(head, data), 'text/csv');
    toast('CSV downloaded', 'ok');
  };
  root.querySelector('#pPrint').onclick = () => printEl(`Payment ledger — ${monthLabel(state.month)}`);
}
