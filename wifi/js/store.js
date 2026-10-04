/* ============================================================
   Store — Firestore realtime data + simple monthly accounts
   ============================================================ */
import {
  db, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, writeBatch, getDocs, query, where, getDoc
} from "./firebase.js";
import { COL, SETTINGS_DOC, DEFAULT_SETTINGS } from "./config.js";
import { currentMonth, monthAdd } from "./utils.js";

/* ---------------- State ---------------- */
export const state = {
  ready: false,
  error: null,
  members: [],
  payments: [],
  devices: [],
  settings: { ...DEFAULT_SETTINGS },
  router: 'A',          // 'A' | 'B'
  month: currentMonth(),
  search: '',
  filter: 'all',        // all | unpaid | paid
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

  const sRef = doc(db, COL.settings, SETTINGS_DOC);
  getDoc(sRef).then(snap => {
    if (!snap.exists()) return setDoc(sRef, { ...DEFAULT_SETTINGS, createdAt: serverTimestamp() });
  }).catch(setError);

  onSnapshot(sRef,
    snap => { if (snap.exists()) state.settings = { ...DEFAULT_SETTINGS, ...snap.data() }; emit(); },
    setError);

  const bind = (name, key) => onSnapshot(
    collection(db, COL[name]),
    snap => {
      state[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.ready = true; state.error = null;
      emit();
    },
    setError
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
  const r = (state.settings.routers || []).find(x => x.id === id);
  return r ? r.name : id;
}

/** Fixed monthly fee — same for everyone */
export function fee() { return Number(state.settings.defaultFee) || 0; }

export function devicesOf(memberId) {
  return state.devices.filter(d => d.memberId === memberId);
}

/** Payment recorded for a member in a month (or null) */
export function paymentFor(memberId, month) {
  return state.payments.find(p => p.memberId === memberId && p.month === month) || null;
}

export function paidAmount(memberId, month) {
  const p = paymentFor(memberId, month);
  return p ? (Number(p.amount) || 0) : 0;
}

/** Members of a router, filtered by search + paid/unpaid filter, sorted by room */
export function membersOf(opts = {}) {
  const routerId = opts.router ?? state.router;
  const month = opts.month ?? state.month;
  const q = (state.search || '').trim().toLowerCase();

  return state.members
    .filter(m => (m.routerId || 'A') === routerId)
    .filter(m => {
      if (state.filter === 'paid') return !!paymentFor(m.id, month);
      if (state.filter === 'unpaid') return !paymentFor(m.id, month);
      return true;
    })
    .filter(m => !q || [m.name, m.room].some(v => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.room || '').localeCompare(String(b.room || ''), 'en', { numeric: true })
      || String(a.name).localeCompare(String(b.name), 'en'));
}

/** Collection summary for one month + router */
export function monthSummary(month = state.month, routerId = state.router) {
  const list = state.members.filter(m => (m.routerId || 'A') === routerId);
  const f = fee();
  let collected = 0, paidCount = 0;
  list.forEach(m => {
    const amt = paidAmount(m.id, month);
    if (amt > 0) { collected += amt; paidCount++; }
  });
  const expected = list.length * f;
  return {
    members: list.length,
    paidCount,
    unpaidCount: list.length - paidCount,
    collected,
    expected,
    pending: Math.max(0, expected - collected)
  };
}

export function recentMonths(n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthAdd(currentMonth(), -i));
  return out;
}

/* ---------------- CRUD ---------------- */
export const db_actions = {
  async saveSettings(patch) {
    await setDoc(doc(db, COL.settings, SETTINGS_DOC), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  },

  async addMember(data) {
    const ref = await addDoc(collection(db, COL.members), {
      name: data.name,
      room: data.room || '',
      routerId: data.routerId || state.router,
      startMonth: currentMonth(),
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
    const p = await getDocs(query(collection(db, COL.payments), where('memberId', '==', id)));
    p.forEach(d => batch.delete(d.ref));
    const dv = await getDocs(query(collection(db, COL.devices), where('memberId', '==', id)));
    dv.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  async addDevice(data) {
    await addDoc(collection(db, COL.devices), { ...data, createdAt: serverTimestamp() });
  },
  async updateDevice(id, data) {
    await updateDoc(doc(db, COL.devices, id), { ...data, updatedAt: serverTimestamp() });
  },
  async deleteDevice(id) {
    await deleteDoc(doc(db, COL.devices, id));
  },

  /** Mark as paid for a month (replaces any earlier entry for that month) */
  async markPaid({ memberId, routerId, month, amount, note = '' }) {
    const snap = await getDocs(query(
      collection(db, COL.payments),
      where('memberId', '==', memberId), where('month', '==', month)
    ));
    const data = { memberId, routerId, month, amount: Number(amount) || 0, note, date: new Date().toISOString().slice(0, 10), updatedAt: serverTimestamp() };
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, data);
    } else {
      await addDoc(collection(db, COL.payments), { ...data, createdAt: serverTimestamp() });
    }
  },
  /** Undo: remove the paid mark for that month */
  async clearPaid(memberId, month) {
    const snap = await getDocs(query(
      collection(db, COL.payments),
      where('memberId', '==', memberId), where('month', '==', month)
    ));
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};
