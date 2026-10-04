/* ============================================================
   Forms — member, payment (mark paid), devices, settings
   ============================================================ */
import { db, collection, getDocs, writeBatch, doc } from "./firebase.js";
import { COL } from "./config.js";
import { state, db_actions, fee, routerName, paymentFor, paidAmount, devicesOf, recentMonths } from "./store.js";
import {
  modal, confirmDialog, toast, loading, esc, tk, money, monthLabel,
  avatarHtml, emptyState, downloadFile
} from "./utils.js";
import { refresh } from "./app.js";

const cur = () => state.settings.currency || '৳';

/* ============================================================
   Member — add / edit
   ============================================================ */
export function openMemberModal(member = null) {
  const isEdit = !!member;
  const m = member || {};
  const routers = state.settings.routers || [{ id: 'A', name: 'Router A' }, { id: 'B', name: 'Router B' }];

  const body = `
    <div class="form-section">
      <div class="form-grid">
        <label class="field wide">
          <span>Name <span class="req">*</span></span>
          <input type="text" name="name" value="${esc(m.name || '')}" placeholder="e.g. Karim Hossain" />
        </label>
        <label class="field">
          <span>Room no.</span>
          <input type="text" name="room" value="${esc(m.room || '')}" placeholder="e.g. 201" />
        </label>
        <label class="field">
          <span>Router</span>
          <select name="routerId">
            ${routers.map(r => `<option value="${r.id}" ${(m.routerId || state.router) === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>`;

  const footer = `
    ${isEdit ? `<button class="btn btn-soft-danger" data-del style="margin-right:auto">🗑️ Delete</button>` : '<div class="spacer"></div>'}
    <button class="btn" data-close>Cancel</button>
    <button class="btn btn-primary" data-save>${isEdit ? '💾 Save' : '➕ Add member'}</button>`;

  return modal({
    icon: isEdit ? '✏️' : '👤',
    title: isEdit ? 'Edit member' : 'New member',
    sub: isEdit ? '' : 'Name, room number and router',
    body, footer,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelector('[data-save]').onclick = async () => {
        const v = {};
        el.querySelectorAll('[name]').forEach(i => v[i.name] = i.value.trim());
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
            title: 'Delete member?',
            message: `<b>${esc(m.name)}</b> — devices and payment marks for this person will be deleted too.`,
            okText: 'Delete'
          });
          if (!ok) return;
          try {
            loading(true, 'Deleting…');
            await db_actions.deleteMember(member.id);
            toast('Member deleted', 'ok');
            close();
          } catch (e) { toast('Error: ' + e.message, 'err'); }
          finally { loading(false); }
        };
      }
      setTimeout(() => el.querySelector('[name=name]')?.focus(), 90);
    }
  });
}

/* ============================================================
   Mark as paid
   ============================================================ */
export function openPaymentModal(memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return;
  const pay = paymentFor(m.id, state.month);
  const isEdit = !!pay;

  const body = `
    <div class="mb-16">
      <div class="row gap-12">
        ${avatarHtml(m.name)}
        <div class="col">
          <b style="font-size:15px">${esc(m.name)}</b>
          <span class="small muted">Room ${esc(m.room || '—')} · ${esc(routerName(m.routerId))} · ${esc(monthLabel(state.month))}</span>
        </div>
      </div>
    </div>
    <div class="form-section" style="padding:0">
      <div class="form-grid">
        <label class="field wide">
          <span>Amount (${cur()})</span>
          <input type="number" name="amount" value="${pay ? pay.amount : fee()}" min="0" step="10"
                 style="height:50px;font-size:20px;font-weight:650" />
          <span class="chips mt-8">
            ${[fee(), fee() * 2, 100, 200, 300].filter((v, i, a) => v > 0 && a.indexOf(v) === i)
              .map(v => `<button type="button" class="chip" data-amt="${v}">${tk(v)}</button>`).join('')}
          </span>
        </label>
        <label class="field wide">
          <span>Note <span class="small muted">(optional)</span></span>
          <input type="text" name="note" value="${esc(pay?.note || '')}" placeholder="e.g. bKash, cash" />
        </label>
      </div>
    </div>`;

  const footer = `
    ${isEdit ? `<button class="btn btn-soft-danger" data-undo style="margin-right:auto">↩️ Mark unpaid</button>` : '<div class="spacer"></div>'}
    <button class="btn" data-close>Cancel</button>
    <button class="btn btn-success" data-save>✅ ${isEdit ? 'Save' : 'Mark as paid'}</button>`;

  return modal({
    icon: '💰',
    title: isEdit ? 'Edit payment' : 'Mark as paid',
    sub: `${esc(monthLabel(state.month))}`,
    body, footer,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelectorAll('[data-amt]').forEach(b => b.onclick = () => {
        el.querySelector('[name=amount]').value = b.dataset.amt;
      });
      el.querySelector('[data-save]').onclick = async () => {
        const amount = Number(el.querySelector('[name=amount]').value);
        const note = el.querySelector('[name=note]').value.trim();
        if (!(amount >= 0)) { toast('Enter an amount', 'err'); return; }
        try {
          loading(true, 'Saving…');
          await db_actions.markPaid({ memberId: m.id, routerId: m.routerId, month: state.month, amount, note });
          toast(`${tk(amount)} recorded for ${m.name}`, 'ok');
          close();
        } catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
      if (isEdit) {
        el.querySelector('[data-undo]').onclick = async () => {
          const ok = await confirmDialog({
            title: 'Mark as unpaid?',
            message: `<b>${esc(m.name)}</b> — the ${esc(monthLabel(state.month))} payment of ${tk(pay.amount)} will be removed.`,
            okText: 'Mark unpaid'
          });
          if (!ok) return;
          try { loading(true); await db_actions.clearPaid(m.id, state.month); toast('Marked unpaid', 'ok'); close(); }
          catch (e) { toast('Error: ' + e.message, 'err'); }
          finally { loading(false); }
        };
      }
      setTimeout(() => {
        const i = el.querySelector('[name=amount]');
        i?.focus(); i?.select();
      }, 90);
    }
  });
}

/* ============================================================
   Device — add / edit
   ============================================================ */
export function openDeviceModal(device = null, memberId = null) {
  const isEdit = !!device;
  const d = device || {};

  const body = `
    <div class="form-section" style="padding:0">
      <div class="form-grid">
        <label class="field wide">
          <span>Device name <span class="req">*</span></span>
          <input type="text" name="name" value="${esc(d.name || '')}" placeholder="e.g. Karim phone" />
        </label>
        <label class="field wide">
          <span>MAC address</span>
          <input type="text" name="mac" class="mono" value="${esc(d.mac || '')}" placeholder="AA:BB:CC:DD:EE:FF" />
        </label>
      </div>
    </div>`;

  const footer = `
    ${isEdit ? `<button class="btn btn-soft-danger" data-del style="margin-right:auto">🗑️ Delete</button>` : '<div class="spacer"></div>'}
    <button class="btn" data-close>Cancel</button>
    <button class="btn btn-primary" data-save>${isEdit ? '💾 Save' : '➕ Add device'}</button>`;

  return modal({
    icon: '📱',
    title: isEdit ? 'Edit device' : 'Add device',
    body, footer,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelector('[data-save]').onclick = async () => {
        const v = {};
        el.querySelectorAll('[name]').forEach(i => v[i.name] = i.value.trim());
        if (!v.name) { toast('Enter a device name', 'err'); return; }
        try {
          loading(true, 'Saving…');
          if (isEdit) {
            await db_actions.updateDevice(device.id, v);
          } else {
            const m = state.members.find(x => x.id === memberId);
            await db_actions.addDevice({ ...v, memberId, routerId: m?.routerId || state.router, room: m?.room || '' });
          }
          toast(isEdit ? 'Device updated' : 'Device added', 'ok');
          close();
          setTimeout(refresh, 150);
        } catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
      if (isEdit) {
        el.querySelector('[data-del]').onclick = async () => {
          const ok = await confirmDialog({
            title: 'Delete device?', message: `<b>${esc(d.name)}</b> will be removed.`, okText: 'Delete'
          });
          if (!ok) return;
          try { loading(true); await db_actions.deleteDevice(device.id); toast('Device deleted', 'ok'); close(); setTimeout(refresh, 150); }
          catch (e) { toast('Error: ' + e.message, 'err'); }
          finally { loading(false); }
        };
      }
      setTimeout(() => el.querySelector('[name=name]')?.focus(), 90);
    }
  });
}

/* ============================================================
   Member panel — devices + monthly history
   ============================================================ */
export function openMemberPanel(memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return;
  const devs = devicesOf(m.id);
  const pay = paymentFor(m.id, state.month);
  const amt = paidAmount(m.id, state.month);
  const months = recentMonths(6).slice().reverse();

  const body = `
    <div class="row gap-12 mb-16" style="padding-bottom:16px;border-bottom:1px solid var(--border)">
      ${avatarHtml(m.name, 'lg')}
      <div class="col" style="flex:1">
        <b style="font-size:17px">${esc(m.name)}</b>
        <span class="small muted">Room ${esc(m.room || '—')} · ${esc(routerName(m.routerId))}</span>
      </div>
      ${amt > 0
        ? `<span class="badge ok" style="font-size:13px;padding:5px 11px">Paid ${tk(amt)}</span>`
        : `<span class="badge danger" style="font-size:13px;padding:5px 11px">Unpaid</span>`}
    </div>

    <div class="section-head" style="margin:0 0 8px">
      <h3 style="font-size:14px">📱 Devices (${devs.length})</h3>
      <div class="spacer"></div>
      <button class="btn btn-sm btn-primary" data-adddev>＋ Add</button>
    </div>
    <div class="card mb-16">
      <div class="card-body flush">
        ${devs.length ? devs.map(d => `
          <div class="list-item">
            <span style="font-size:18px;width:24px;text-align:center">📱</span>
            <div class="li-main">
              <div class="t">${esc(d.name)}</div>
              <div class="s mono">${esc(d.mac || 'No MAC address')}</div>
            </div>
            <button class="icon-btn sm" data-editdev="${d.id}" title="Edit">✏️</button>
            <button class="icon-btn sm danger" data-deldev="${d.id}" title="Delete">🗑️</button>
          </div>`).join('')
        : emptyState({ icon: '📱', title: 'No device added yet', text: 'Add the device name and MAC address.' })}
      </div>
    </div>

    <div class="section-head" style="margin:0 0 8px">
      <h3 style="font-size:14px">🗓️ ${esc(monthLabel(state.month))}</h3>
      <div class="spacer"></div>
      ${amt > 0
        ? `<button class="btn btn-sm" data-editpay>✏️ Edit</button>
           <button class="btn btn-sm btn-soft-danger" data-undo>↩️ Mark unpaid</button>`
        : `<button class="btn btn-sm btn-success" data-pay>✅ Mark as paid</button>`}
    </div>
    <div class="card mb-16">
      <div class="card-body">
        ${amt > 0
          ? `<div class="row gap-12">
               <span style="font-size:26px">✅</span>
               <div class="col">
                 <b style="font-size:16px">${tk(amt)} received</b>
                 <span class="small muted">${esc(pay?.note || 'No note')}</span>
               </div>
             </div>`
          : `<div class="row gap-12">
               <span style="font-size:26px">⏳</span>
               <div class="col">
                 <b style="font-size:16px">${tk(fee())} not received yet</b>
                 <span class="small muted">Tap “Mark as paid” once the money is collected.</span>
               </div>
             </div>`}
      </div>
    </div>

    <div class="section-head" style="margin:0 0 8px">
      <h3 style="font-size:14px">📅 Last 6 months</h3>
    </div>
    <div class="hist">
      ${months.map(ym => {
        const a = paidAmount(m.id, ym);
        const now = ym === state.month;
        return `<button class="hist-m ${a > 0 ? 'paid' : 'unpaid'} ${now ? 'now' : ''}" data-month="${ym}">
          <span class="hm-m">${monthLabel(ym, true)}</span>
          <span class="hm-a">${a > 0 ? tk(a) : 'Unpaid'}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="small muted mt-8">Tap a month to open it on the main screen.</p>`;

  const footer = `
    <button class="btn btn-soft-danger" data-delmember style="margin-right:auto">🗑️ Delete member</button>
    <div class="spacer"></div>
    <button class="btn" data-editmember>✏️ Edit</button>
    <button class="btn" data-close>Close</button>`;

  return modal({
    icon: '👤',
    title: m.name,
    sub: `Room ${m.room || '—'} · ${routerName(m.routerId)}`,
    body, footer, wide: true,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelector('[data-adddev]').onclick = () => { close(); openDeviceModal(null, m.id); };
      el.querySelector('[data-pay]') && (el.querySelector('[data-pay]').onclick = () => { close(); openPaymentModal(m.id); });
      el.querySelector('[data-editpay]') && (el.querySelector('[data-editpay]').onclick = () => { close(); openPaymentModal(m.id); });
      el.querySelector('[data-undo]') && (el.querySelector('[data-undo]').onclick = async () => {
        const ok = await confirmDialog({
          title: 'Mark as unpaid?',
          message: `<b>${esc(m.name)}</b> — ${esc(monthLabel(state.month))} payment of ${tk(amt)} will be removed.`,
          okText: 'Mark unpaid'
        });
        if (!ok) return;
        try { loading(true); await db_actions.clearPaid(m.id, state.month); toast('Marked unpaid', 'ok'); close(); }
        catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      });
      el.querySelector('[data-editmember]').onclick = () => { close(); openMemberModal(m); };
      el.querySelector('[data-delmember]').onclick = async () => {
        const ok = await confirmDialog({
          title: 'Delete member?',
          message: `<b>${esc(m.name)}</b> — devices and payment marks will be deleted too.`,
          okText: 'Delete'
        });
        if (!ok) return;
        try { loading(true); await db_actions.deleteMember(m.id); toast('Member deleted', 'ok'); close(); }
        catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
      el.querySelectorAll('[data-editdev]').forEach(b => b.onclick = () => {
        close();
        openDeviceModal(state.devices.find(x => x.id === b.dataset.editdev));
      });
      el.querySelectorAll('[data-deldev]').forEach(b => b.onclick = async () => {
        const d = state.devices.find(x => x.id === b.dataset.deldev);
        const ok = await confirmDialog({ title: 'Delete device?', message: `<b>${esc(d?.name || '')}</b> will be removed.`, okText: 'Delete' });
        if (!ok) return;
        try { loading(true); await db_actions.deleteDevice(b.dataset.deldev); toast('Device deleted', 'ok'); close(); setTimeout(refresh, 150); }
        catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      });
      el.querySelectorAll('[data-month]').forEach(b => b.onclick = () => {
        close();
        state.month = b.dataset.month;
        refresh();
      });
    }
  });
}

/* ============================================================
   Settings
   ============================================================ */
export function openSettings() {
  const s = state.settings;
  const routers = s.routers || [];

  const body = `
    <div class="form-section" style="padding:0 0 18px">
      <h4>General</h4>
      <div class="form-grid">
        <label class="field wide">
          <span>Hostel name</span>
          <input type="text" name="hostelName" value="${esc(s.hostelName || '')}" />
        </label>
        <label class="field">
          <span>Monthly fee (${cur()})</span>
          <input type="number" name="defaultFee" value="${Number(s.defaultFee) || 0}" min="0" step="10" />
        </label>
        <label class="field">
          <span>Currency symbol</span>
          <input type="text" name="currency" value="${esc(s.currency || '৳')}" maxlength="3" />
        </label>
      </div>
    </div>

    <div class="form-section" style="padding-bottom:22px">
      <h4>Router names</h4>
      <div class="form-grid">
        ${routers.map(r => `
          <label class="field">
            <span>Router ${esc(r.id)}</span>
            <input type="text" class="sRouterName" data-id="${esc(r.id)}" value="${esc(r.name)}" />
          </label>`).join('')}
      </div>
    </div>

    <div class="row wrap">
      <button class="btn" data-backup>⬇️ Download backup</button>
      <button class="btn btn-soft-danger" data-wipe>🗑️ Delete all data</button>
    </div>
    <p class="small muted mt-12">Signed in as <b>${esc(state.userEmail || '—')}</b></p>`;

  const footer = `
    <div class="spacer"></div>
    <button class="btn" data-close>Close</button>
    <button class="btn btn-primary" data-save>💾 Save</button>`;

  return modal({
    icon: '⚙️',
    title: 'Settings',
    body, footer,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      el.querySelector('[data-save]').onclick = async () => {
        const v = {};
        el.querySelectorAll('[name]').forEach(i => v[i.name] = i.value.trim());
        const routersNew = routers.map(r => ({
          ...r, name: el.querySelector(`.sRouterName[data-id="${r.id}"]`).value.trim() || r.name
        }));
        try {
          loading(true, 'Saving…');
          await db_actions.saveSettings({
            hostelName: v.hostelName || 'Hostel',
            defaultFee: Number(v.defaultFee) || 0,
            currency: v.currency || '৳',
            routers: routersNew
          });
          toast('Settings saved', 'ok');
          close();
        } catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
      el.querySelector('[data-backup]').onclick = () => {
        const data = {
          exportedAt: new Date().toISOString(),
          settings: state.settings,
          members: state.members,
          payments: state.payments,
          devices: state.devices
        };
        downloadFile(`wifi-backup-${new Date().toISOString().slice(0, 10)}.json`,
          JSON.stringify(data, null, 2), 'application/json');
        toast('Backup downloaded', 'ok');
      };
      el.querySelector('[data-wipe]').onclick = async () => {
        const ok = await confirmDialog({
          title: 'Delete all data?',
          message: 'Every member, device and payment mark will be deleted. This cannot be undone.',
          okText: 'Delete everything'
        });
        if (!ok) return;
        try {
          loading(true, 'Deleting…');
          for (const c of [COL.members, COL.payments, COL.devices]) {
            const snap = await getDocs(collection(db, c));
            let batch = writeBatch(db), n = 0;
            snap.forEach(dd => { batch.delete(dd.ref); if (++n === 450) { batch.commit(); batch = writeBatch(db); n = 0; } });
            await batch.commit();
          }
          toast('All data deleted', 'ok');
          close();
        } catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
    }
  });
}
