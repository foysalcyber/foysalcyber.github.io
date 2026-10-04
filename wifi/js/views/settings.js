/* ============================================================
   Settings — routers, fee, template, backup / restore
   ============================================================ */
import { state, db_actions } from "../store.js";
import { db, collection, getDocs, writeBatch, doc, serverTimestamp } from "../firebase.js";
import { COL, firebaseConfig } from "../config.js";
import { esc, toast, loading, confirmDialog, downloadFile, modal, copyText, emptyState, taka } from "../utils.js";

export function render(root) {
  const s = state.settings;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>⚙️ Settings</h1>
        <p>Routers, default fee, reminder template and data</p>
      </div>
    </div>

    <div class="grid cols-2 stagger">
      <div class="col gap-16">
        <div class="card">
          <div class="card-head"><h3>🏠 General</h3></div>
          <div class="card-body">
            <label class="field">
              <span>Hostel name</span>
              <input type="text" id="sHostel" value="${esc(s.hostelName || '')}" placeholder="Our Hostel" />
            </label>
            <label class="field">
              <span>Monthly fee (fixed) — ${esc(s.currency || '৳')}</span>
              <input type="number" id="sFee" value="${Number(s.defaultFee) || 0}" min="0" step="10" />
              <span class="hint">New members get this fee automatically. To give someone a different fee, edit that member.</span>
            </label>
            <label class="field">
              <span>Currency symbol</span>
              <input type="text" id="sCurrency" value="${esc(s.currency || '৳')}" maxlength="3" />
            </label>
            <button class="btn btn-primary" id="sSave1">💾 Save changes</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>📡 Routers</h3></div>
          <div class="card-body">
            ${(s.routers || []).map(r => `
              <label class="field">
                <span>Router ${esc(r.id)} — name</span>
                <input type="text" class="sRouterName" data-id="${esc(r.id)}" value="${esc(r.name)}" />
              </label>`).join('')}
            <p class="small muted" style="margin:-4px 0 14px">The new name appears everywhere — sidebar, tables and reports.</p>
            <button class="btn btn-primary" id="sSaveRouters">💾 Save router names</button>
          </div>
        </div>
      </div>

      <div class="col gap-16">
        <div class="card">
          <div class="card-head"><h3>✉️ Reminder template</h3></div>
          <div class="card-body">
            <textarea id="sTemplate" style="min-height:158px">${esc(s.reminderTemplate || '')}</textarea>
            <p class="small muted mt-8">Available variables: <code>{name}</code> <code>{room}</code> <code>{router}</code> <code>{month}</code> <code>{due}</code> <code>{amount}</code> <code>{fee}</code></p>
            <div class="msg-box mt-12" id="sTemplatePreview">${esc(preview())}</div>
            <button class="btn btn-primary mt-16" id="sSave2">💾 Save template</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>💾 Backup &amp; restore</h3></div>
          <div class="card-body">
            <div class="row wrap">
              <button class="btn" id="sBackup">⬇️ JSON backup</button>
              <button class="btn" id="sExportAll">📊 All CSVs</button>
              <button class="btn" id="sRestore">⬆️ Restore backup</button>
            </div>
            <p class="small muted mt-12">Back up regularly. Restoring adds to your current data — nothing is deleted.</p>
            <div style="margin-top:18px;padding-top:16px;border-top:1px dashed var(--border)">
              <button class="btn btn-soft-danger" id="sReset">🗑️ Delete all data</button>
              <p class="small muted mt-8">Members, payments and devices will all be removed.</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>ℹ️ Information</h3></div>
          <div class="card-body">
            <dl class="kv">
              <dt>Firebase project</dt><dd class="mono">${esc(firebaseConfig.projectId)}</dd>
              <dt>Signed in as</dt><dd>${esc(state.userEmail || '—')}</dd>
              <dt>Members / payments / devices</dt><dd>${state.members.length} / ${state.payments.length} / ${state.devices.length}</dd>
              <dt>Currency / default fee</dt><dd>${esc(s.currency || '৳')} ${Number(s.defaultFee) || 0}</dd>
            </dl>
            <div class="row wrap mt-16">
              <button class="btn btn-sm" id="sRules">📋 Show Firestore Rules</button>
              <a class="btn btn-sm" href="https://console.firebase.google.com/project/${esc(firebaseConfig.projectId)}" target="_blank" rel="noopener">🔗 Firebase Console</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  bind(root);
}

function preview() {
  const s = state.settings;
  return (s.reminderTemplate || '')
    .replace(/\{name\}/g, 'Rahim').replace(/\{room\}/g, '201')
    .replace(/\{router\}/g, 'Router A').replace(/\{month\}/g, 'October 2026')
    .replace(/\{due\}/g, taka(300)).replace(/\{amount\}/g, taka(300))
    .replace(/\{fee\}/g, taka(s.defaultFee || 150));
}

function bind(root) {
  const tmpl = root.querySelector('#sTemplate');
  const repaint = () => { root.querySelector('#sTemplatePreview').textContent = preview(); };
  tmpl.oninput = repaint;

  root.querySelector('#sSave1').onclick = async () => {
    try {
      loading(true, 'Saving…');
      await db_actions.saveSettings({
        hostelName: root.querySelector('#sHostel').value.trim() || 'Hostel',
        defaultFee: Number(root.querySelector('#sFee').value) || 0,
        currency: root.querySelector('#sCurrency').value.trim() || '৳'
      });
      toast('Settings saved', 'ok');
    } catch (e) { toast('Error: ' + e.message, 'err'); }
    finally { loading(false); }
  };

  root.querySelector('#sSaveRouters').onclick = async () => {
    const routers = (state.settings.routers || []).map(r => ({
      ...r, name: root.querySelector(`.sRouterName[data-id="${r.id}"]`).value.trim() || r.name
    }));
    try {
      loading(true, 'Saving…');
      await db_actions.saveSettings({ routers });
      toast('Router names saved', 'ok');
    } catch (e) { toast('Error: ' + e.message, 'err'); }
    finally { loading(false); }
  };

  root.querySelector('#sSave2').onclick = async () => {
    try {
      loading(true, 'Saving…');
      await db_actions.saveSettings({ reminderTemplate: tmpl.value });
      toast('Template saved', 'ok');
    } catch (e) { toast('Error: ' + e.message, 'err'); }
    finally { loading(false); }
  };

  root.querySelector('#sBackup').onclick = () => {
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

  root.querySelector('#sExportAll').onclick = async () => {
    const { toCSV } = await import("../utils.js");
    const { memberStats, routerName } = await import("../store.js");
    const d = new Date().toISOString().slice(0, 10);
    const mk = (name, head, rows) => downloadFile(name, toCSV(head, rows), 'text/csv');
    mk(`members_${d}.csv`, ['Name', 'Room', 'Phone', 'Router', 'Fee', 'Total Billed', 'Paid', 'Due', 'Advance'],
      state.members.map(m => { const st = memberStats(m); return [m.name, m.room || '', m.phone || '', routerName(m.routerId), st.fee, st.billed, st.paid, st.due, st.credit]; }));
    mk(`payments_${d}.csv`, ['Member', 'Type', 'Month', 'Amount', 'Note'],
      state.payments.map(p => [state.members.find(m => m.id === p.memberId)?.name || '', p.type, p.month, p.amount, p.note || '']));
    mk(`devices_${d}.csv`, ['Device', 'MAC', 'Owner', 'Room', 'Router', 'Status'],
      state.devices.map(dv => [dv.name, dv.mac || '', state.members.find(m => m.id === dv.memberId)?.name || 'Unknown', dv.room || '', routerName(dv.routerId), dv.status]));
    toast('3 CSV files downloaded', 'ok');
  };

  root.querySelector('#sRestore').onclick = () => openRestore();

  root.querySelector('#sReset').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Delete all data?',
      message: `<b>${state.members.length} members, ${state.payments.length} payments, ${state.devices.length} devices</b> will be permanently deleted. This cannot be undone!`,
      okText: 'Yes, delete everything'
    });
    if (!ok) return;
    const ok2 = await confirmDialog({
      title: 'Final confirmation',
      message: 'Take a <b>JSON backup</b> first. Delete everything?',
      okText: 'Delete'
    });
    if (!ok2) return;
    try {
      loading(true, 'Deleting…');
      for (const c of [COL.members, COL.payments, COL.devices]) {
        const snap = await getDocs(collection(db, c));
        let batch = writeBatch(db), n = 0;
        snap.forEach(dd => { batch.delete(dd.ref); if (++n === 450) { batch.commit(); batch = writeBatch(db); n = 0; } });
        await batch.commit();
      }
      toast('All data deleted', 'ok');
    } catch (e) { toast('Error: ' + e.message, 'err'); }
    finally { loading(false); }
  };

  root.querySelector('#sRules').onclick = () => {
    const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}`;
    modal({
      title: '🔐 Firestore Rules',
      sub: 'Paste these and click Publish',
      body: `<p class="small muted">Firebase Console → Firestore Database → <b>Rules</b> → paste the rules below and click <b>Publish</b>.</p>
        <pre style="background:var(--surface-2);padding:14px;border-radius:12px;overflow:auto;font-size:12.5px;border:1px solid var(--border);margin-top:12px">${esc(rules)}</pre>`,
      footer: `<div class="spacer"></div><button class="btn" data-close>Close</button><button class="btn btn-primary" data-copy>📋 Copy</button>`,
      onMount(el, close) {
        el.querySelector('[data-close]').onclick = close;
        el.querySelector('[data-copy]').onclick = () => copyText(rules);
      }
    });
  };
}

/* ------------------------------ restore ------------------------------ */
function openRestore() {
  modal({
    title: '⬆️ Restore backup',
    sub: 'Data is added, nothing is deleted',
    body: `
      <p class="small muted">Choose a previously downloaded <b>wifi-backup-*.json</b> file.</p>
      <label class="field mt-16">
        <span>JSON file</span>
        <input type="file" id="restoreFile" accept="application/json,.json" />
      </label>
      <div id="restoreInfo" class="small muted"></div>`,
    footer: `<div class="spacer"></div><button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-do disabled>Restore</button>`,
    onMount(el, close) {
      el.querySelector('[data-close]').onclick = close;
      const input = el.querySelector('#restoreFile');
      let parsed = null;
      input.onchange = async () => {
        const f = input.files[0];
        if (!f) return;
        try {
          parsed = JSON.parse(await f.text());
          el.querySelector('#restoreInfo').innerHTML =
            `Found: <b>${(parsed.members || []).length}</b> members, <b>${(parsed.payments || []).length}</b> payments, <b>${(parsed.devices || []).length}</b> devices`;
          el.querySelector('[data-do]').disabled = false;
        } catch (e) { el.querySelector('#restoreInfo').textContent = 'Could not read file: ' + e.message; }
      };
      el.querySelector('[data-do]').onclick = async () => {
        if (!parsed) return;
        try {
          loading(true, 'Restoring…');
          let batch = writeBatch(db), n = 0;
          const add = (col, obj) => {
            const ref = doc(collection(db, col));
            batch.set(ref, { ...obj, createdAt: obj.createdAt || serverTimestamp(), restoredAt: serverTimestamp() });
            if (++n === 400) { batch.commit(); batch = writeBatch(db); n = 0; }
          };
          (parsed.members || []).forEach(m => { const { id, ...rest } = m; add(COL.members, rest); });
          (parsed.payments || []).forEach(p => { const { id, ...rest } = p; add(COL.payments, rest); });
          (parsed.devices || []).forEach(d => { const { id, ...rest } = d; add(COL.devices, rest); });
          await batch.commit();
          toast('Restore complete', 'ok');
          close();
        } catch (e) { toast('Error: ' + e.message, 'err'); }
        finally { loading(false); }
      };
    }
  });
}
