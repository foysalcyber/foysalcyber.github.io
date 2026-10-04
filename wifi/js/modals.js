/* ============================================================
   Form modals — member, payment, device, ledger
   ============================================================ */
import { state, memberStats, paymentsOf, devicesOf, routerName, db_actions } from "./store.js";
import { PAY_TYPES, DEVICE_TYPES, DEVICE_STATUS } from "./config.js";
import {
  modal, confirmDialog, toast, esc, money, tk, monthLabel, dateLabel,
  currentMonth, todayStr, loading, copyText, avatarHtml, statCard, emptyState, sortTh
} from "./utils.js";

const cur = () => state.settings.currency || '৳';

/* ============================================================
   Member — add / edit
   ============================================================ */
export function openMemberModal(member = null) {
  const isEdit = !!member;
  const m = member || {};
  const routers = state.settings.routers || [];
  const fee = m.monthlyFee ?? state.settings.defaultFee ?? 0;

  const body = `
    <div class="form-section">
      <h4>Basic info</h4>
      <div class="form-grid">
        <label class="field full">
          <span>Name <span class="req">*</span></span>
          <input type="text" name="name" value="${esc(m.name || '')}" placeholder="e.g. Karim" required />
        </label>
        <label class="field">
          <span>Room number</span>
          <input type="text" name="room" value="${esc(m.room || '')}" placeholder="e.g. 201" />
        </label>
        <label class="field">
          <span>Phone</span>
          <input type="tel" name="phone" value="${esc(m.phone || '')}" placeholder="01XXXXXXXXX" />
        </label>
      </div>
    </div>

    <div class="form-section">
      <h4>Billing</h4>
      <div class="form-grid">
        <label class="field">
          <span>Router <span class="req">*</span></span>
          <select name="routerId">
            ${routers.map(r => `<option value="${r.id}" ${m.routerId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Monthly fee (${cur()})</span>
          <input type="number" name="monthlyFee" value="${fee}" min="0" step="10" />
        </label>
        <label class="field">
          <span>Start month</span>
          <input type="month" name="startMonth" value="${esc(m.startMonth || currentMonth())}" />
          <span class="hint">Billing starts from this month</span>
        </label>
        <label class="field">
          <span>Opening balance (${cur()})</span>
          <input type="number" name="openingBalance" value="${Number(m.openingBalance) || 0}" step="10" />
          <span class="hint">Use + for credit, − for an opening due</span>
        </label>
        <label class="field full">
          <span>Status</span>
          <label class="switch" style="height:40px">
            <input type="checkbox" name="active" ${m.active === false ? '' : 'checked'} />
            <span class="track"></span>
            <span class="small muted">WiFi active</span>
          </label>
        </label>
        <label class="field full">
          <span>Note</span>
          <textarea name="note" placeholder="Optional — anything worth remembering">${esc(m.note || '')}</textarea>
        </label>
      </div>
    </div>`;

  const footer = `
    ${isEdit ? `<button class="btn btn-soft-danger" data-del style="margin-right:auto">🗑️ Delete</button>` : '<div class="spacer"></div>'}
    <button class="btn" data-close>Cancel</button>
    <button class="btn btn-primary" data-save>${isEdit ? '💾 Save changes' : '➕ Add member'}</button>`;

  return modal({
    title: (isEdit ? '✏️' : '👤') + ' ' + (isEdit ? 'Edit member' : 'New member'),
    sub: isEdit ? esc(m.name || '') : 'Add someone who took WiFi',
    body, footer,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelector('[data-save]').onclick = async () => {
        const v = {};
        el.querySelectorAll('[name]').forEach(i => {
          if (i.type === 'checkbox') v[i.name] = i.checked;
          else if (i.type === 'number') v[i.name] = i.value === '' ? 0 : Number(i.value);
          else v[i.name] = i.value.trim();
        });
        if (!v.name) { toast('Enter a name', 'err'); el.querySelector('[name=name]').focus(); return; }
        try {
          loading(true, 'Saving…');
          if (isEdit) await db_actions.updateMember(member.id, v);
          else await db_actions.addMember(v);
          toast(isEdit ? 'Member updated' : 'Member added', 'ok');
          close();
        } catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
      if (isEdit) {
        el.querySelector('[data-del]').onclick = async () => {
          const ok = await confirmDialog({
            title: 'Delete this member?',
            message: `<b>${esc(m.name)}</b> — their entire payment history will be deleted too, and their devices will become “Unknown”.`,
            okText: 'Delete'
          });
          if (!ok) return;
          try {
            loading(true, 'Deleting…');
            await db_actions.deleteMember(member.id);
            toast('Member deleted', 'ok'); close();
          } catch (e) { toast('Error: ' + e.message, 'err'); }
          finally { loading(false); }
        };
      }
      setTimeout(() => el.querySelector('[name=name]')?.focus(), 90);
    }
  });
}

/* ============================================================
   Payment — add / edit
   ============================================================ */
export function openPaymentModal(preset = {}) {
  const p = preset.payment || null;
  const isEdit = !!p;
  const members = state.members
    .filter(m => state.router === 'all' || m.routerId === state.router)
    .sort((a, b) => String(a.room || '').localeCompare(String(b.room || ''), 'en', { numeric: true })
      || String(a.name).localeCompare(String(b.name), 'en'));

  const defFee = state.settings.defaultFee || 0;
  const selMember = preset.memberId || p?.memberId || '';
  const selInfo = selMember ? state.members.find(m => m.id === selMember) : null;

  const body = `
    <div class="form-section">
      <h4>Who &amp; what</h4>
      <label class="field">
        <span>Member <span class="req">*</span></span>
        <select name="memberId" required>
          <option value="">— Select a member —</option>
          ${members.map(m => {
            const st = memberStats(m);
            const tag = st.due > 0 ? ` (due ${tk(st.due)})` : (st.credit > 0 ? ` (advance ${tk(st.credit)})` : ' (clear)');
            return `<option value="${m.id}" ${m.id === selMember ? 'selected' : ''}>${esc(m.name)} — Room ${esc(m.room || '?')} · ${esc(routerName(m.routerId))}${tag}</option>`;
          }).join('')}
        </select>
      </label>
      <div class="field" id="pmtInfo" style="margin-bottom:4px">${selInfo ? infoBox(selInfo) : ''}</div>
    </div>

    <div class="form-section">
      <h4>Payment</h4>
      <div class="form-grid">
        <label class="field">
          <span>Type</span>
          <select name="type">
            ${Object.entries(PAY_TYPES).map(([k, v]) =>
              `<option value="${k}" ${(p?.type || preset.type || 'payment') === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Amount (${cur()}) <span class="req">*</span></span>
          <input type="number" name="amount" value="${p?.amount ?? (preset.amount ?? '')}" min="1" step="10" required placeholder="0" style="height:48px;font-size:19px;font-weight:650" />
          <span class="chips mt-8" style="gap:5px">
            ${[defFee, defFee * 2, defFee * 3, 100, 500].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v =>
              `<button type="button" class="chip" data-amt="${v}" style="height:28px;padding:0 11px">${tk(v)}</button>`).join('')}
          </span>
        </label>
        <label class="field">
          <span>For month</span>
          <input type="month" name="month" value="${esc(p?.month || preset.month || state.month || currentMonth())}" />
        </label>
        <label class="field">
          <span>Date</span>
          <input type="date" name="date" value="${esc(p?.date || preset.date || todayStr())}" />
        </label>
        <label class="field full">
          <span>Note</span>
          <input type="text" name="note" value="${esc(p?.note || '')}" placeholder="e.g. bKash / cash" />
        </label>
      </div>
    </div>`;

  const footer = `
    ${isEdit ? `<button class="btn btn-soft-danger" data-del style="margin-right:auto">🗑️ Delete</button>` : '<div class="spacer"></div>'}
    <button class="btn" data-close>Cancel</button>
    <button class="btn btn-success" data-save>💾 ${isEdit ? 'Save changes' : 'Collect'}</button>`;

  return modal({
    title: (isEdit ? '✏️' : '💳') + ' ' + (isEdit ? 'Edit payment' : 'Record payment'),
    sub: isEdit ? '' : 'Payments, advances and refunds',
    body, footer,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelectorAll('[data-amt]').forEach(b => b.onclick = () => {
        el.querySelector('[name=amount]').value = b.dataset.amt;
      });
      el.querySelector('[name=memberId]').onchange = e => {
        const mm = state.members.find(m => m.id === e.target.value);
        el.querySelector('#pmtInfo').innerHTML = mm ? infoBox(mm) : '';
      };
      el.querySelector('[data-save]').onclick = async () => {
        const v = {};
        el.querySelectorAll('[name]').forEach(i => {
          if (i.type === 'number') v[i.name] = i.value === '' ? 0 : Number(i.value);
          else v[i.name] = i.value.trim();
        });
        if (!v.memberId) { toast('Select a member', 'err'); return; }
        if (!(v.amount > 0)) { toast('Enter an amount', 'err'); return; }
        const mem = state.members.find(m => m.id === v.memberId);
        v.routerId = mem?.routerId || state.router;
        try {
          loading(true, 'Saving…');
          if (isEdit) await db_actions.updatePayment(p.id, v);
          else await db_actions.addPayment(v);
          toast(isEdit ? 'Payment updated' : `${tk(v.amount)} collected`, 'ok');
          close();
        } catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
      if (isEdit) {
        el.querySelector('[data-del]').onclick = async () => {
          const ok = await confirmDialog({
            title: 'Delete this payment?',
            message: `<b>${tk(p.amount)}</b> — ${esc(monthLabel(p.month, true))} will be deleted.`,
            okText: 'Delete'
          });
          if (!ok) return;
          try { loading(true); await db_actions.deletePayment(p.id); toast('Payment deleted', 'ok'); close(); }
          catch (e) { toast('Error: ' + e.message, 'err'); } finally { loading(false); }
        };
      }
      setTimeout(() => (selMember ? el.querySelector('[name=amount]') : el.querySelector('[name=memberId]'))?.focus(), 90);
    }
  });
}

function infoBox(m) {
  const st = memberStats(m);
  const cls = st.due > 0 ? 'danger' : (st.credit > 0 ? 'info' : 'ok');
  const txt = st.due > 0 ? `Due ${tk(st.due)}` : (st.credit > 0 ? `Advance ${tk(st.credit)}` : 'Account clear');
  return `<div class="alert info" style="margin:0;align-items:center">
    <span class="ai">ℹ️</span>
    <span><b>${esc(m.name)}</b> · Room ${esc(m.room || '?')} · ${esc(routerName(m.routerId))} · ${tk(st.fee)}/month
    <br><span class="badge ${cls}" style="margin-top:5px">${txt}</span>
    <span class="small muted">&nbsp; ${st.billedMonths} months billed · ${tk(st.billed)} total · ${tk(st.paid)} paid</span></span>
  </div>`;
}

/* ============================================================
   Device — add / edit
   ============================================================ */
export function openDeviceModal(device = null) {
  const isEdit = !!device;
  const d = device || {};
  const routers = state.settings.routers || [];
  const members = state.members
    .filter(m => (state.router === 'all' || m.routerId === state.router))
    .sort((a, b) => String(a.room || '').localeCompare(String(b.room || ''), 'en', { numeric: true })
      || String(a.name).localeCompare(String(b.name), 'en'));

  const body = `
    <div class="form-section">
      <h4>Device</h4>
      <div class="form-grid">
        <label class="field full">
          <span>Device name <span class="req">*</span></span>
          <input type="text" name="name" value="${esc(d.name || '')}" placeholder="e.g. Karim-phone / Redmi Note 12" required />
        </label>
        <label class="field">
          <span>MAC address</span>
          <input type="text" name="mac" class="mono" value="${esc(d.mac || '')}" placeholder="AA:BB:CC:DD:EE:FF" />
        </label>
        <label class="field">
          <span>Type</span>
          <select name="type">
            ${Object.entries(DEVICE_TYPES).map(([k, v]) => `<option value="${k}" ${(d.type || 'phone') === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Router <span class="req">*</span></span>
          <select name="routerId">
            ${routers.map(r => `<option value="${r.id}" ${d.routerId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Status</span>
          <select name="status">
            ${Object.entries(DEVICE_STATUS).map(([k, v]) => `<option value="${k}" ${(d.status || 'connected') === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>

    <div class="form-section">
      <h4>Owner</h4>
      <div class="form-grid">
        <label class="field full">
          <span>Member</span>
          <select name="memberId">
            <option value="">— Unknown / no owner —</option>
            ${members.map(m => `<option value="${m.id}" ${d.memberId === m.id ? 'selected' : ''}>${esc(m.name)} — Room ${esc(m.room || '?')}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Room</span>
          <input type="text" name="room" value="${esc(d.room || '')}" placeholder="Auto-filled when an owner is picked" />
        </label>
        <label class="field">
          <span>Note</span>
          <input type="text" name="note" value="${esc(d.note || '')}" placeholder="Optional" />
        </label>
      </div>
    </div>`;

  const footer = `
    ${isEdit ? `<button class="btn btn-soft-danger" data-del style="margin-right:auto">🗑️ Delete</button>` : '<div class="spacer"></div>'}
    <button class="btn" data-close>Cancel</button>
    <button class="btn btn-primary" data-save>${isEdit ? '💾 Save changes' : '➕ Add device'}</button>`;

  return modal({
    title: (isEdit ? '✏️' : '📱') + ' ' + (isEdit ? 'Edit device' : 'Add device'),
    sub: isEdit ? esc(d.name || '') : 'Phone, laptop, TV — anything on the network',
    body, footer,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelector('[name=memberId]').onchange = e => {
        const m = state.members.find(x => x.id === e.target.value);
        if (m) el.querySelector('[name=room]').value = m.room || '';
      };
      el.querySelector('[data-save]').onclick = async () => {
        const v = {};
        el.querySelectorAll('[name]').forEach(i => { v[i.name] = i.value.trim(); });
        if (!v.name) { toast('Enter a device name', 'err'); return; }
        if (v.memberId) {
          const m = state.members.find(x => x.id === v.memberId);
          if (m) { v.room = m.room || v.room; v.routerId = m.routerId || v.routerId; }
        }
        try {
          loading(true, 'Saving…');
          if (isEdit) await db_actions.updateDevice(device.id, v);
          else await db_actions.addDevice(v);
          toast(isEdit ? 'Device updated' : 'Device added', 'ok');
          close();
        } catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
      if (isEdit) {
        el.querySelector('[data-del]').onclick = async () => {
          const ok = await confirmDialog({
            title: 'Delete this device?',
            message: `<b>${esc(d.name)}</b> will be removed from the list.`,
            okText: 'Delete'
          });
          if (!ok) return;
          try { loading(true); await db_actions.deleteDevice(device.id); toast('Device deleted', 'ok'); close(); }
          catch (e) { toast('Error: ' + e.message, 'err'); } finally { loading(false); }
        };
      }
      setTimeout(() => el.querySelector('[name=name]')?.focus(), 90);
    }
  });
}

/* ============================================================
   Ledger — member profile
   ============================================================ */
export function openLedger(memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return;
  const st = memberStats(m);
  const pays = paymentsOf(m.id);
  const devs = devicesOf(m.id);

  const tpl = st.due > 0
    ? (state.settings.reminderTemplate || '')
        .replace(/\{name\}/g, m.name || '')
        .replace(/\{room\}/g, m.room || '-')
        .replace(/\{router\}/g, routerName(m.routerId))
        .replace(/\{month\}/g, monthLabel(state.month))
        .replace(/\{due\}/g, tk(st.due))
        .replace(/\{amount\}/g, tk(st.due))
        .replace(/\{fee\}/g, tk(st.fee))
    : `Hi ${m.name},\nYour WiFi account is clear up to ${monthLabel(state.month)} — nothing is due right now.\n`
      + `Room: ${m.room || '-'} | Router: ${routerName(m.routerId)}\n`
      + `Thank you — ${state.settings.hostelName || 'Hostel WiFi'}`;

  const body = `
    <div class="row gap-16" style="margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--border)">
      ${avatarHtml(m.name, 'lg')}
      <div style="flex:1;min-width:0">
        <div style="font-size:16px;font-weight:650">${esc(m.name)} ${m.active === false ? '<span class="badge outline">Inactive</span>' : ''}</div>
        <div class="small muted">Room ${esc(m.room || '—')} · ${esc(m.phone || 'no phone')} · ${esc(routerName(m.routerId))}</div>
      </div>
      ${st.due > 0 ? `<span class="badge danger" style="font-size:13px;padding:5px 11px">${tk(st.due)} due</span>`
        : (st.credit > 0 ? `<span class="badge info" style="font-size:13px;padding:5px 11px">${tk(st.credit)} advance</span>`
        : '<span class="badge ok" style="font-size:13px;padding:5px 11px">Clear</span>')}
    </div>

    <div class="grid cols-4" style="gap:10px;margin-bottom:20px">
      ${statCard({ label: 'Billed', value: tk(st.billed), hint: `${st.billedMonths} × ${tk(st.fee)}` })}
      ${statCard({ label: 'Paid', value: tk(st.paid), tone: 'success', hint: `${tk(st.refunded)} refunded` })}
      ${statCard({ label: 'Due', value: tk(st.due), tone: st.due > 0 ? 'danger' : '', hint: st.due > 0 ? 'to collect' : 'nothing owed' })}
      ${statCard({ label: 'Advance', value: tk(st.credit), tone: st.credit > 0 ? 'info' : '', hint: st.credit > 0 ? 'refundable' : 'none' })}
    </div>

    <div class="section-head" style="margin:0 0 10px">
      <div><h3 style="font-size:14px">🧾 Payment history</h3></div>
      <div class="spacer"></div>
      <button class="btn btn-sm btn-success" data-addpay>＋ Payment</button>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Date</th><th>Month</th><th>Type</th><th class="right">Amount</th><th>Note</th><th class="right">Edit</th></tr></thead>
          <tbody>
            ${pays.length ? pays.map(p => {
              const t = PAY_TYPES[p.type] || PAY_TYPES.payment;
              const neg = t.sign === -1;
              return `<tr>
                <td class="small muted">${dateLabel(p.date)}</td>
                <td class="small muted">${monthLabel(p.month, true)}</td>
                <td><span class="badge ${p.type === 'refund' ? 'danger' : (p.type === 'advance' ? 'info' : (p.type === 'waiver' ? 'warn' : 'ok'))}">${t.icon} ${t.label}</span></td>
                <td class="right num"><b style="color:${neg ? 'var(--danger)' : 'var(--success)'}">${neg ? '−' : '+'}${tk(p.amount)}</b></td>
                <td class="small muted">${esc(p.note || '')}</td>
                <td class="right"><button class="icon-btn sm" data-editpay="${p.id}">✏️</button></td>
              </tr>`;
            }).join('') : `<tr><td colspan="6">${emptyState({ icon: '🧾', title: 'No payments yet' })}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section-head" style="margin:0 0 10px">
      <div><h3 style="font-size:14px">📱 Devices (${devs.length})</h3></div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-body flush">
        ${devs.length ? devs.map(d => `
          <div class="list-item">
            <span style="font-size:18px;width:28px;text-align:center">${(DEVICE_TYPES[d.type] || DEVICE_TYPES.other).split(' ')[0]}</span>
            <div class="li-main">
              <div class="t">${esc(d.name)}</div>
              <div class="s">${esc(d.mac || 'No MAC')}</div>
            </div>
            <span class="badge ${DEVICE_STATUS[d.status]?.cls || ''}">${DEVICE_STATUS[d.status]?.label || d.status}</span>
            <button class="icon-btn sm" data-editdev="${d.id}">✏️</button>
          </div>`).join('')
          : emptyState({ icon: '📱', title: 'No devices added yet' })}
      </div>
    </div>

    <div class="section-head" style="margin:0 0 10px">
      <div><h3 style="font-size:14px">✉️ ${st.due > 0 ? 'Reminder message' : 'Clear-account message'}</h3></div>
      <div class="spacer"></div>
      <button class="btn btn-sm" data-copy>📋 Copy</button>
    </div>
    <div class="msg-box">${esc(tpl)}</div>
    <p class="small muted mt-8">You can edit this template in Settings.</p>
  `;

  const footer = `
    <div class="spacer"></div>
    <button class="btn" data-close>Close</button>
    <button class="btn" data-editmember>✏️ Edit details</button>
    <button class="btn btn-success" data-pay>💳 Collect payment</button>`;

  return modal({
    title: '👤 Member ledger',
    sub: `${esc(m.name)} · Room ${esc(m.room || '?')} · ${esc(routerName(m.routerId))}`,
    body, footer, wide: true,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelector('[data-pay]').onclick = () => { close(); openPaymentModal({ memberId: m.id }); };
      el.querySelector('[data-addpay]').onclick = () => { close(); openPaymentModal({ memberId: m.id }); };
      el.querySelector('[data-editmember]').onclick = () => { close(); openMemberModal(m); };
      el.querySelector('[data-copy]').onclick = () => copyText(tpl);
      el.querySelectorAll('[data-editpay]').forEach(b => b.onclick = () => {
        close();
        openPaymentModal({ payment: state.payments.find(x => x.id === b.dataset.editpay) });
      });
      el.querySelectorAll('[data-editdev]').forEach(b => b.onclick = () => {
        close();
        openDeviceModal(state.devices.find(x => x.id === b.dataset.editdev));
      });
    }
  });
}
