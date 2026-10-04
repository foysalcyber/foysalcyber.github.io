/* ============================================================
   Store — Firestore realtime data + Account (balance/due/advance)
   ============================================================ */
import {
  db, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, writeBatch, getDocs, query, where, getDoc
} from "./firebase.js";
import { COL, SETTINGS_DOC, DEFAULT_SETTINGS } from "./config.js";
import { currentMonth, monthDiff, monthAdd } from "./utils.js";

/* ---------------- State ---------------- */
export const state = {
  ready: false,
  error: null,
  members: [],
  payments: [],
  devices: [],
  settings: { ...DEFAULT_SETTINGS },
  router: 'all',      // 'all' | 'A' | 'B'
  month: currentMonth(),
  route: 'dashboard',
  search: '',
  userEmail: ''
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

/* ---------------- Realtime listeners ---------------- */
let started = false;
export function startSync() {
  if (started) return;
  started = true;

  // Settings (First run created automatically on first run)
  const sRef = doc(db, COL.settings, SETTINGS_DOC);
  getDoc(sRef).then(snap => {
    if (!snap.exists()) {
      return setDoc(sRef, { ...DEFAULT_SETTINGS, createdAt: serverTimestamp() });
    }
  }).catch(err => setError(err));

  onSnapshot(sRef,
    snap => { if (snap.exists()) state.settings = { ...DEFAULT_SETTINGS, ...snap.data() }; emit(); },
    err => setError(err)
  );

  const bind = (name, key) => onSnapshot(
    collection(db, COL[name]),
    snap => {
      state[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.ready = true; state.error = null;
      emit();
    },
    err => setError(err)
  );

  bind('members', 'members');
  bind('payments', 'payments');
  bind('devices', 'devices');
}

function setError(err) {
  console.error(err);
  state.error = err?.message || String(err);
  emit();
}

/* ---------------- Helpers ---------------- */
export function routerName(id) {
  if (id === 'all') return 'All routers';
  const r = (state.settings.routers || []).find(x => x.id === id);
  return r ? r.name : id;
}
export function routerBadgeClass(id) { return id === 'B' ? 'rb' : 'ra'; }
export function feeOf(m) { return Number(m?.monthlyFee ?? state.settings.defaultFee) || 0; }

export function inRouterFilter(item) {
  return state.router === 'all' || item.routerId === state.router;
}
export function filteredMembers() {
  const q = state.search.trim().toLowerCase();
  return state.members
    .filter(inRouterFilter)
    .filter(m => !q || [m.name, m.room, m.phone, m.note].some(v => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => (a.room || '').localeCompare(b.room || '', 'en', { numeric: true }) || (a.name || '').localeCompare(b.name || '', 'en'));
}
export function filteredPayments() { return state.payments.filter(inRouterFilter); }
export function filteredDevices() { return state.devices.filter(inRouterFilter); }

export function memberById(id) { return state.members.find(m => m.id === id); }
export function paymentsOf(id) {
  return state.payments
    .filter(p => p.memberId === id)
    .sort((a, b) => ts(b.date) - ts(a.date) || String(b.month || '').localeCompare(String(a.month || '')));
}
export function devicesOf(id) { return state.devices.filter(d => d.memberId === id); }
function ts(v) { return v?.toMillis ? v.toMillis() : (v ? new Date(v).getTime() : 0); }

/* ---------------- Account ---------------- */
/**
 * balance > 0  → advance / refundable
 * balance < 0  → Has due
 */
export function memberStats(m) {
  const fee = feeOf(m);
  const now = currentMonth();
  const start = m.startMonth || now;
  let end = now;
  if (m.active === false && m.endMonth) end = m.endMonth;
  if (monthDiff(start, end) < 0) end = start;

  const billedMonths = Math.max(0, monthDiff(start, end) + 1);
  const billed = fee * billedMonths;

  const pays = state.payments.filter(p => p.memberId === m.id);
  let paid = 0, refunded = 0, waived = 0, advance = 0;
  pays.forEach(p => {
    const amt = Number(p.amount) || 0;
    if (p.type === 'refund') refunded += amt;
    else if (p.type === 'waiver') waived += amt;
    else if (p.type === 'advance') { advance += amt; paid += amt; }
    else paid += amt;
  });

  const opening = Number(m.openingBalance) || 0;      // + = Advance, - = Due
  const balance = opening + paid + waived - refunded - billed;

  return {
    fee, start, end, billedMonths, billed,
    paid, refunded, waived, advance, opening,
    balance,
    due: balance < 0 ? -balance : 0,
    credit: balance > 0 ? balance : 0,
    isDefaulter: m.active !== false && balance < 0
  };
}

/** How much was paid in a given month */
export function paidInMonth(m, ym) {
  return state.payments
    .filter(p => p.memberId === m.id && p.month === ym && (p.type === 'payment' || p.type === 'advance'))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

/** Members who are No Connected but Amount have not paid */
export function defaultersConnected() {
  return state.members
    .filter(inRouterFilter)
    .map(m => ({ m, st: memberStats(m) }))
    .filter(x => x.st.due > 0)
    .filter(x => state.devices.some(d => d.memberId === x.m.id && d.status === 'connected'))
    .sort((a, b) => b.st.due - a.st.due);
}

export function unknownDevices() {
  return state.devices.filter(inRouterFilter).filter(d => !d.memberId);
}
export function blockedDevices() {
  return state.devices.filter(inRouterFilter).filter(d => d.status === 'blocked');
}
export function connectedDevices() {
  return state.devices.filter(inRouterFilter).filter(d => d.status === 'connected');
}

/* ---------------- CRUD ---------------- */
export const db_actions = {
  /* Settings */
  async saveSettings(patch) {
    await setDoc(doc(db, COL.settings, SETTINGS_DOC), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  },

  /* Members */
  async addMember(data) {
    const ref = await addDoc(collection(db, COL.members), {
      ...data,
      active: data.active !== false,
      startMonth: data.startMonth || currentMonth(),
      monthlyFee: Number(data.monthlyFee ?? state.settings.defaultFee) || 0,
      createdAt: serverTimestamp()
    });
    return ref.id;
  },
  async updateMember(id, data) {
    await updateDoc(doc(db, COL.members, id), { ...data, updatedAt: serverTimestamp() });
  },
  async deleteMember(id) {
    const batch = writeBatch(db);
    batch.delete(doc(db, COL.members, id));
    const snap = await getDocs(query(collection(db, COL.payments), where('memberId', '==', id)));
    snap.forEach(d => batch.delete(d.ref));
    const dsnap = await getDocs(query(collection(db, COL.devices), where('memberId', '==', id)));
    dsnap.forEach(d => batch.update(d.ref, { memberId: null, orphan: true }));
    await batch.commit();
  },

  /* Payments */
  async addPayment(data) {
    await addDoc(collection(db, COL.payments), { ...data, createdAt: serverTimestamp() });
  },
  async updatePayment(id, data) {
    await updateDoc(doc(db, COL.payments, id), { ...data, updatedAt: serverTimestamp() });
  },
  async deletePayment(id) {
    await deleteDoc(doc(db, COL.payments, id));
  },

  /* Devices */
  async addDevice(data) {
    await addDoc(collection(db, COL.devices), { ...data, createdAt: serverTimestamp(), lastSeen: serverTimestamp() });
  },
  async updateDevice(id, data) {
    await updateDoc(doc(db, COL.devices, id), { ...data, updatedAt: serverTimestamp() });
  },
  async deleteDevice(id) {
    await deleteDoc(doc(db, COL.devices, id));
  },

  /* Bulk */
  async blockMany(ids, blocked = true) {
    const batch = writeBatch(db);
    ids.forEach(id => batch.update(doc(db, COL.devices, id), {
      status: blocked ? 'blocked' : 'offline', updatedAt: serverTimestamp()
    }));
    await batch.commit();
  },
  async deleteManyDevices(ids) {
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, COL.devices, id)));
    await batch.commit();
  }
};

/* ---- Month list (for reports) ---- */
export function recentMonths(n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthAdd(currentMonth(), -i));
  return out;
}
