import {
  APP_TIME_ZONE,
  MEAL_RATE_CHANGE_MONTH,
  SLOT_ORDER,
  WEEKDAY_NAMES,
  buildMonthCsv,
  calculateMonth,
  currentDateKey,
  currentHour,
  daysInMonth,
  formatMeals,
  formatMoney,
  formatMonthLabel,
  halfMealCostPaisaForMonth,
  makeDateKey,
  mealRatePaisaForMonth,
  parseDateKey,
  parseMonthKey,
  parseTakaToPaisa,
  sanitizeDayEntry,
  shiftMonth,
  slotHalfUnits,
  weekdayIndex,
} from './core.js?v=1.3.0';

const FIREBASE_VERSION = '11.0.2';
const APP_VERSION = '1.3.0';
const ADMIN_EMAIL = 'foysal.cyber@gmail.com';
const ACTIVE_NOW_MS = 5 * 60 * 1000;
const ACTIVE_TODAY_MS = 24 * 60 * 60 * 1000;
const PRESENCE_INTERVAL_MS = 2 * 60 * 1000;
const firebaseConfig = {
  apiKey: 'AIzaSyCkUUgCehPOurUM09KjqtMfE2FEO0hFyyo',
  authDomain: 'hostel-meal-fd287.firebaseapp.com',
  projectId: 'hostel-meal-fd287',
  storageBucket: 'hostel-meal-fd287.firebasestorage.app',
  messagingSenderId: '758189177379',
  appId: '1:758189177379:web:96d87fa60cec94ea3fcf96',
  // The supplied value contained a line break. Analytics is not required by this app,
  // but the corrected ID is kept here for future use.
  measurementId: 'G-7WK2JBXNB6',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = (name, className = '') => `<svg${className ? ` class="${className}"` : ''} aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const todayKey = () => currentDateKey(APP_TIME_ZONE);

const state = {
  mode: null,
  user: null,
  profile: null,
  firebaseReady: false,
  firebaseError: null,
  firebase: null,
  auth: null,
  db: null,
  appActive: false,
  monthKey: todayKey().slice(0, 7),
  selectedDate: todayKey(),
  entries: {},
  advancePaisa: 0,
  summary: null,
  activeView: 'overview',
  calendarFilter: 'all',
  monthGeneration: 0,
  unsubs: [],
  saveOperations: 0,
  renderFrame: null,
  confirmResolver: null,
  mealWriteTokens: new Map(),
  presenceTimer: null,
  presenceVisibilityHandler: null,
  presenceUid: null,
  sessionRecordedUid: null,
  roomPromptTimer: null,
  adminUsers: [],
  adminFilter: 'all',
  adminSearch: '',
  adminUnsubscribe: null,
  adminClockTimer: null,
};

const viewMeta = {
  overview: ['CONTROL CENTER', 'Overview'],
  calendar: ['DAILY REGISTER', 'Meal calendar'],
  insights: ['MONTHLY INTELLIGENCE', 'Insights'],
  settings: ['ACCOUNT & DATA', 'Settings'],
  admin: ['PRIVATE ADMINISTRATION', 'Admin panel'],
};

const slotMeta = {
  breakfast: { label: 'Breakfast', icon: 'sun', color: 'var(--amber)' },
  lunch: { label: 'Lunch', icon: 'lunch', color: 'var(--primary)' },
  dinner: { label: 'Dinner', icon: 'moon', color: 'var(--purple)' },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bootComplete() {
  const boot = $('#bootScreen');
  if (!boot || boot.classList.contains('is-leaving')) return;
  boot.classList.add('is-leaving');
  window.setTimeout(() => boot.remove(), 500);
}

function setButtonBusy(button, busy, label = 'Working…') {
  if (!button) return;
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span>${escapeHtml(label)}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    delete button.dataset.originalHtml;
  }
}

function setAuthAlert(message = '', type = 'error') {
  const alert = $('#authAlert');
  if (!message) {
    alert.classList.add('is-hidden');
    alert.textContent = '';
    return;
  }
  alert.textContent = message;
  alert.classList.remove('is-hidden', 'is-success');
  if (type === 'success') alert.classList.add('is-success');
}

function toast(title, message = '', type = 'success', action = null) {
  const region = $('#toastRegion');
  const element = document.createElement('div');
  element.className = `toast${type === 'error' ? ' is-error' : ''}`;
  element.innerHTML = `
    <span class="toast-icon">${icon(type === 'error' ? 'info' : 'check')}</span>
    <span><strong>${escapeHtml(title)}</strong>${message ? `<small>${escapeHtml(message)}</small>` : ''}</span>
    ${action ? `<button type="button">${escapeHtml(action.label)}</button>` : ''}
    <i class="toast-progress"></i>`;
  region.append(element);

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    element.classList.add('is-leaving');
    window.setTimeout(() => element.remove(), 260);
  };
  if (action) {
    $('button', element)?.addEventListener('click', () => {
      action.handler();
      remove();
    });
  }
  window.setTimeout(remove, 4_100);
}

function humanFirebaseError(error) {
  const code = String(error?.code ?? '');
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'No account was found for this email.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists for this email.',
    'auth/weak-password': 'Use a stronger password with at least 8 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/popup-blocked': 'The sign-in popup was blocked by this browser.',
    'auth/unauthorized-domain': 'Add this website domain to Firebase Authentication → Authorized domains.',
    'auth/operation-not-allowed': 'Enable this sign-in method in Firebase Authentication first.',
    'auth/network-request-failed': 'A network request failed. Check your connection and try again.',
    'permission-denied': 'Firestore denied the request. Deploy the included firestore.rules file.',
    'firestore/permission-denied': 'Firestore denied the request. Deploy the included firestore.rules file.',
    'unavailable': 'The cloud service is temporarily unavailable.',
    'firestore/unavailable': 'The cloud service is temporarily unavailable.',
  };
  return messages[code] || error?.message?.replace(/^Firebase:\s*/i, '') || 'Something went wrong. Please try again.';
}

async function initFirebase() {
  const connection = $('#authConnectionStatus');
  const projectStatus = $('#firebaseProjectStatus');
  try {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
    ]);

    const app = appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);

    state.firebase = { appModule, authModule, firestoreModule, app };
    state.auth = auth;
    state.db = db;
    state.firebaseReady = true;

    connection?.classList.add('is-connected');
    connection?.classList.remove('is-offline');
    if (connection) connection.lastElementChild.textContent = 'Secure Firebase connection ready';
    projectStatus?.classList.add('is-connected');
    projectStatus?.classList.remove('is-offline');
    if (projectStatus) $('small', projectStatus).textContent = firebaseConfig.projectId;

    let initialAuthResolved = false;
    await new Promise((resolve) => {
      authModule.onAuthStateChanged(auth, async (user) => {
        if (!initialAuthResolved) {
          initialAuthResolved = true;
          resolve();
        }
        if (user) {
          state.mode = 'firebase';
          state.user = user;
          await showApp();
        } else if (state.mode !== 'demo') {
          state.mode = null;
          state.user = null;
          showAuth();
        }
      });
    });
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    state.firebaseError = error;
    connection?.classList.add('is-offline');
    connection?.classList.remove('is-connected');
    if (connection) connection.lastElementChild.textContent = 'Cloud unavailable — demo mode still works';
    projectStatus?.classList.add('is-offline');
    if (projectStatus) $('small', projectStatus).textContent = 'Unavailable in this preview';
    showAuth();
  } finally {
    bootComplete();
  }
}

function isAdminEmail() {
  return state.mode === 'firebase'
    && String(state.user?.email || '').toLowerCase() === ADMIN_EMAIL;
}

function isAdminUser() {
  return isAdminEmail() && state.user?.emailVerified === true;
}

function showAuth() {
  cleanupDataListeners();
  stopPresenceTracking();
  stopAdminSubscription();
  if (state.roomPromptTimer) window.clearTimeout(state.roomPromptTimer);
  state.roomPromptTimer = null;
  state.sessionRecordedUid = null;
  state.appActive = false;
  $('#appShell').classList.add('is-hidden');
  $('#authView').classList.remove('is-hidden');
  $('#accountPopover').classList.add('is-hidden');
  closeSidebar();
  bootComplete();
}

async function showApp() {
  if (!state.user) return;
  const firstEntry = !state.appActive;
  state.appActive = true;
  $('#authView').classList.add('is-hidden');
  $('#appShell').classList.remove('is-hidden');
  $('#demoBanner').classList.toggle('is-hidden', state.mode !== 'demo');
  setAuthAlert();
  updateUserInterface();
  updateAdminAccessUI();
  updateProjectAndSyncStatus();
  const requestedView = validView(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  navigate(requestedView === 'admin' && !isAdminUser() ? 'overview' : requestedView, false);

  if (state.mode === 'firebase') {
    await subscribeProfile();
    startPresenceTracking();
  }
  if (firstEntry || !state.summary) await loadMonth(state.monthKey);
  bootComplete();
}

function validView(value) {
  return Object.hasOwn(viewMeta, value);
}

function cleanupDataListeners() {
  for (const unsubscribe of state.unsubs.splice(0)) {
    try { unsubscribe(); } catch { /* Listener was already detached. */ }
  }
  state.monthGeneration += 1;
}

async function subscribeProfile() {
  if (!state.firebaseReady || !state.user || state.mode !== 'firebase') return;
  const { doc, onSnapshot, setDoc, serverTimestamp } = state.firebase.firestoreModule;
  const ref = doc(state.db, 'users', state.user.uid);
  const fallbackName = normalizedDisplayName(state.user.displayName || state.user.email?.split('@')[0]);

  try {
    await new Promise((resolve) => {
      let initialSnapshotHandled = false;
      const finishInitial = () => {
        if (!initialSnapshotHandled) {
          initialSnapshotHandled = true;
          resolve();
        }
      };
      const unsubscribe = onSnapshot(ref, async (snapshot) => {
        try {
          if (snapshot.exists()) {
            const data = snapshot.data();
            state.profile = {
              displayName: typeof data.displayName === 'string' ? data.displayName : fallbackName,
              email: state.user.email || data.email || '',
              roomNo: typeof data.roomNo === 'string' ? data.roomNo : '',
              sessionCount: Number.isSafeInteger(data.sessionCount) ? data.sessionCount : 0,
              mealActionCount: Number.isSafeInteger(data.mealActionCount) ? data.mealActionCount : 0,
              lastSeenAt: data.lastSeenAt || null,
              lastMealActivityAt: data.lastMealActivityAt || null,
            };
            updateUserInterface();
            scheduleRoomCompletion();
          } else {
            state.profile = { displayName: fallbackName, email: state.user.email || '', roomNo: '' };
            updateUserInterface();
            scheduleRoomCompletion();
            setDoc(ref, {
              displayName: fallbackName.slice(0, 60),
              email: state.user.email || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((error) => {
              toast('Profile could not be initialized', humanFirebaseError(error), 'error');
            });
          }
        } catch (error) {
          toast('Profile could not be initialized', humanFirebaseError(error), 'error');
        } finally {
          finishInitial();
        }
      }, (error) => {
        state.profile = { displayName: fallbackName, email: state.user.email || '', roomNo: '' };
        updateUserInterface();
        toast('Profile access failed', humanFirebaseError(error), 'error');
        finishInitial();
      });
      state.unsubs.push(unsubscribe);
    });
  } catch (error) {
    console.error(error);
  }
}

function normalizedDisplayName(value) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return normalized.length >= 2 ? normalized : 'Resident';
}

function displayName() {
  return normalizedDisplayName(state.profile?.displayName || state.user?.displayName || state.user?.email?.split('@')[0]);
}

function userEmail() {
  return state.profile?.email || state.user?.email || (state.mode === 'demo' ? 'Local preview' : '');
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || 'ML').toUpperCase();
}

function updateUserInterface() {
  const name = displayName();
  const email = userEmail();
  $$('[data-user-name]').forEach((el) => { el.textContent = name; });
  $$('[data-user-email]').forEach((el) => { el.textContent = email; });
  $$('[data-user-initials]').forEach((el) => { el.textContent = initials(name); });
  $('#greetingName').textContent = name.split(/\s+/)[0] || 'Resident';
  if (document.activeElement !== $('#profileNameInput')) $('#profileNameInput').value = name;
  if (document.activeElement !== $('#profileRoomInput')) $('#profileRoomInput').value = state.profile?.roomNo || '';
  $('#profileEmailInput').value = email;
  $('#accountModeLabel').textContent = state.mode === 'demo' ? 'Browser-only demo profile' : 'Firebase cloud account';
  const verification = $('#emailVerificationBadge');
  if (state.mode === 'demo') {
    verification.innerHTML = `${icon('zap')} Demo mode`;
  } else if (state.user?.emailVerified) {
    verification.innerHTML = `${icon('shield')} Email verified`;
  } else {
    verification.innerHTML = `${icon('info')} Email not verified`;
  }
  updateAdminAccessUI();
}

function updateAdminAccessUI() {
  const admin = isAdminUser();
  const emailMatches = isAdminEmail();
  $$('[data-admin-only]').forEach((element) => element.classList.toggle('is-hidden', !admin));
  $('.mobile-bottom-nav')?.classList.toggle('has-admin', admin);

  const gateway = $('#adminGatewayCard');
  gateway?.classList.toggle('is-hidden', !emailMatches);
  if (emailMatches) {
    $('#adminGatewayTitle').textContent = admin ? 'Admin panel ready' : 'Verify the administrator email';
    $('#adminGatewayStatus').textContent = admin
      ? 'View registered residents, room numbers and recent activity in real time.'
      : 'Email verification is required before protected user data can be read.';
    $('#adminGatewayButton').innerHTML = admin
      ? `${icon('admin')}<span>Open admin panel</span>`
      : `${icon('mail')}<span>Verify admin email</span>`;
  }
}

async function handleAdminGateway() {
  if (!isAdminEmail()) return;
  if (isAdminUser()) {
    navigate('admin');
    return;
  }
  const button = $('#adminGatewayButton');
  setButtonBusy(button, true, 'Checking…');
  try {
    await state.firebase.authModule.reload(state.user);
    await state.firebase.authModule.getIdToken(state.user, true);
    if (state.user.emailVerified) {
      updateAdminAccessUI();
      toast('Administrator verified', 'The protected admin panel is now available.');
      navigate('admin');
    } else {
      await state.firebase.authModule.sendEmailVerification(state.user);
      toast('Verification email sent', `Check ${ADMIN_EMAIL}, verify it, then press this button again.`);
    }
  } catch (error) {
    toast('Verification check failed', humanFirebaseError(error), 'error');
  } finally {
    setButtonBusy(button, false);
    updateAdminAccessUI();
  }
}

function updateProjectAndSyncStatus() {
  const projectStatus = $('#firebaseProjectStatus');
  if (state.mode === 'demo') {
    projectStatus?.classList.remove('is-connected');
    projectStatus?.classList.add('is-offline');
    if (projectStatus) $('small', projectStatus).textContent = 'Demo data stays in localStorage';
    setSyncStatus('local');
  } else if (state.firebaseReady) {
    projectStatus?.classList.add('is-connected');
    projectStatus?.classList.remove('is-offline');
    if (projectStatus) $('small', projectStatus).textContent = firebaseConfig.projectId;
    setSyncStatus('synced');
  }
}

function setSyncStatus(status) {
  const element = $('#syncStatus');
  if (!element) return;
  const definitions = {
    synced: ['cloud', 'Synced'],
    saving: ['refresh', 'Saving'],
    offline: ['cloud-off', 'Offline'],
    local: ['cloud-off', 'Local only'],
  };
  const [iconName, label] = definitions[status] || definitions.synced;
  element.classList.remove('is-saving', 'is-offline');
  if (status === 'saving') element.classList.add('is-saving');
  if (status === 'offline' || status === 'local') element.classList.add('is-offline');
  element.innerHTML = `${icon(iconName)}<span>${label}</span>`;
}

function beginSave() {
  state.saveOperations += 1;
  setSyncStatus(state.mode === 'demo' ? 'local' : 'saving');
}

function endSave() {
  state.saveOperations = Math.max(0, state.saveOperations - 1);
  if (state.saveOperations === 0) {
    setSyncStatus(state.mode === 'demo' ? 'local' : navigator.onLine ? 'synced' : 'offline');
  }
}

function navigate(view, updateHash = true) {
  if (!validView(view)) view = 'overview';
  if (view === 'admin' && !isAdminUser()) {
    view = 'settings';
    if (state.appActive && isAdminEmail()) toast('Verification required', 'Verify the administrator email before opening this panel.', 'error');
  }
  state.activeView = view;
  $$('.app-view').forEach((el) => el.classList.toggle('is-active', el.dataset.appView === view));
  $$('[data-view]').forEach((el) => el.classList.toggle('is-active', el.dataset.view === view));
  const [eyebrow, title] = viewMeta[view];
  $('#pageEyebrow').textContent = eyebrow;
  $('#pageTitle').textContent = title;
  if (updateHash && location.hash !== `#${view}`) history.pushState(null, '', `#${view}`);
  $('#accountPopover').classList.add('is-hidden');
  closeSidebar();
  if (view === 'admin') startAdminSubscription();
  else stopAdminSubscription();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectAuthTab(tab) {
  const signIn = tab === 'signin';
  $('#signInTab').classList.toggle('is-active', signIn);
  $('#signUpTab').classList.toggle('is-active', !signIn);
  $('#signInTab').setAttribute('aria-selected', String(signIn));
  $('#signUpTab').setAttribute('aria-selected', String(!signIn));
  $('#signInForm').classList.toggle('is-hidden', !signIn);
  $('#signUpForm').classList.toggle('is-hidden', signIn);
  setAuthAlert();
}

function openSidebar() {
  $('#sidebar').classList.add('is-open');
  $('#sidebarBackdrop').classList.add('is-open');
}

function closeSidebar() {
  $('#sidebar')?.classList.remove('is-open');
  $('#sidebarBackdrop')?.classList.remove('is-open');
}

function openModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.classList.remove('is-hidden');
  document.body.classList.add('modal-open');
  window.setTimeout(() => $('input,button', modal)?.focus(), 50);
}

function closeModal(id) {
  $(`#${id}`)?.classList.add('is-hidden');
  if (!document.querySelector('.modal-layer:not(.is-hidden)')) document.body.classList.remove('modal-open');
}

function requestConfirm({ title, message, confirmLabel = 'Confirm', danger = true }) {
  const modal = $('#confirmModal');
  $('#confirmTitle').textContent = title;
  $('#confirmMessage').textContent = message;
  $('#confirmActionButton').textContent = confirmLabel;
  $('#confirmActionButton').className = `button ${danger ? 'button-danger' : 'button-primary'}`;
  openModal('confirmModal');
  return new Promise((resolve) => { state.confirmResolver = resolve; });
}

function resolveConfirm(result) {
  closeModal('confirmModal');
  const resolver = state.confirmResolver;
  state.confirmResolver = null;
  resolver?.(result === 'confirm');
}

function updateMonthControls() {
  const label = formatMonthLabel(state.monthKey);
  $('#topMonthLabel').textContent = label;
  $('#monthPicker').value = state.monthKey;
  $('#overviewSubtitle').textContent = `Here is your precise meal position for ${label}.`;
  $('#calendarMonthKicker').textContent = label.toUpperCase();
  $('#calendarMonthTitle').textContent = `${daysInMonth(state.monthKey)}-day monthly register`;
  $('#calendarSubtitle').textContent = `Toggle a slot only when that meal was eaten. ${label} has ${daysInMonth(state.monthKey)} days.`;
  $('#advanceModalCaption').textContent = `Enter the amount paid to the hostel authority for ${label}.`;
  $('#quickFillCaption').textContent = `Choose an action for ${label}. You can still change any slot afterward.`;
  $('#clearMonthCaption').textContent = `Delete entries and advance for ${label}`;
}

async function loadMonth(monthKey) {
  try { parseMonthKey(monthKey); } catch { return; }
  const oldSelectedDay = (() => {
    try { return parseDateKey(state.selectedDate).day; } catch { return 1; }
  })();
  state.monthKey = monthKey;
  const current = todayKey();
  const day = current.startsWith(`${monthKey}-`)
    ? parseDateKey(current).day
    : Math.min(oldSelectedDay, daysInMonth(monthKey));
  state.selectedDate = makeDateKey(monthKey, day);
  state.entries = {};
  state.advancePaisa = 0;
  state.monthGeneration += 1;
  const generation = state.monthGeneration;
  state.unsubs = state.unsubs.filter((unsubscribe) => {
    // Profile listener is intentionally resubscribed when showApp runs; all month
    // listeners are cleared below through a complete listener refresh.
    try { unsubscribe(); } catch { /* no-op */ }
    return false;
  });
  if (state.mode === 'firebase') await subscribeProfile();

  updateMonthControls();
  requestRender();

  if (state.mode === 'demo') {
    loadDemoMonth(monthKey);
    return;
  }
  if (!state.firebaseReady || !state.user) return;

  const {
    collection,
    doc,
    onSnapshot,
    serverTimestamp,
    setDoc,
  } = state.firebase.firestoreModule;
  const monthRef = doc(state.db, 'users', state.user.uid, 'months', monthKey);
  const daysRef = collection(state.db, 'users', state.user.uid, 'months', monthKey, 'days');
  const expectedMealRatePaisa = mealRatePaisaForMonth(monthKey);
  let monthCreationAttempted = false;
  let monthRateRepairAttempted = false;

  const monthUnsub = onSnapshot(monthRef, async (snapshot) => {
    if (generation !== state.monthGeneration) return;
    if (snapshot.exists()) {
      const monthData = snapshot.data();
      const value = monthData.advancePaisa;
      state.advancePaisa = Number.isSafeInteger(value) && value >= 0 ? value : 0;
      requestRender();
      if (monthData.mealRatePaisa !== expectedMealRatePaisa && !monthRateRepairAttempted) {
        monthRateRepairAttempted = true;
        setDoc(monthRef, {
          mealRatePaisa: expectedMealRatePaisa,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch((error) => {
          toast('Meal rate could not be synchronized', `${humanFirebaseError(error)} Deploy the updated firestore.rules before this release.`, 'error');
        });
      }
    } else if (!monthCreationAttempted) {
      monthCreationAttempted = true;
      try {
        await setDoc(monthRef, {
          monthKey,
          advancePaisa: 0,
          mealRatePaisa: expectedMealRatePaisa,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        toast('Month could not be initialized', humanFirebaseError(error), 'error');
      }
    }
  }, (error) => {
    if (generation !== state.monthGeneration) return;
    setSyncStatus('offline');
    toast('Month access failed', humanFirebaseError(error), 'error');
  });

  const daysUnsub = onSnapshot(daysRef, { includeMetadataChanges: true }, (snapshot) => {
    if (generation !== state.monthGeneration) return;
    const nextEntries = {};
    for (const documentSnapshot of snapshot.docs) {
      const dateKey = documentSnapshot.id;
      try {
        if (!dateKey.startsWith(`${monthKey}-`)) continue;
        parseDateKey(dateKey);
        nextEntries[dateKey] = sanitizeDayEntry(documentSnapshot.data());
      } catch { /* Ignore malformed IDs even if legacy data exists. */ }
    }
    state.entries = nextEntries;
    requestRender();
    setSyncStatus(snapshot.metadata.hasPendingWrites ? 'saving' : navigator.onLine ? 'synced' : 'offline');
  }, (error) => {
    if (generation !== state.monthGeneration) return;
    setSyncStatus('offline');
    toast('Meal records could not be loaded', humanFirebaseError(error), 'error');
  });

  state.unsubs.push(monthUnsub, daysUnsub);
}

function demoStorageKey(monthKey) {
  return `meal-ledger:demo:${monthKey}`;
}

function seedDemoMonth(monthKey) {
  const current = todayKey();
  let end = 0;
  if (monthKey < current.slice(0, 7)) end = daysInMonth(monthKey);
  if (monthKey === current.slice(0, 7)) end = parseDateKey(current).day;
  const entries = {};
  for (let day = 1; day <= end; day += 1) {
    const dateKey = makeDateKey(monthKey, day);
    entries[dateKey] = {
      breakfast: day % 6 !== 0,
      lunch: day % 5 !== 0,
      dinner: day % 7 !== 0 && day % 11 !== 0,
    };
  }
  return { version: 1, advancePaisa: 4_000_00, entries };
}

function loadDemoMonth(monthKey) {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(demoStorageKey(monthKey)) || 'null'); } catch { data = null; }
  if (!data) {
    data = seedDemoMonth(monthKey);
    localStorage.setItem(demoStorageKey(monthKey), JSON.stringify(data));
  }
  state.advancePaisa = Number.isSafeInteger(data.advancePaisa) && data.advancePaisa >= 0 ? data.advancePaisa : 0;
  state.entries = {};
  for (const [dateKey, entry] of Object.entries(data.entries || {})) {
    try {
      if (parseDateKey(dateKey).monthKey === monthKey) state.entries[dateKey] = sanitizeDayEntry(entry);
    } catch { /* Skip invalid demo entries. */ }
  }
  requestRender();
  setSyncStatus('local');
}

function saveDemoMonth() {
  localStorage.setItem(demoStorageKey(state.monthKey), JSON.stringify({
    version: 1,
    advancePaisa: state.advancePaisa,
    entries: state.entries,
  }));
}

function normalizeRoomNo(value) {
  const roomNo = String(value ?? '').trim();
  return /^[0-9]{1,6}$/.test(roomNo) ? roomNo : null;
}

function scheduleRoomCompletion() {
  if (state.roomPromptTimer) window.clearTimeout(state.roomPromptTimer);
  state.roomPromptTimer = null;
  if (state.mode !== 'firebase' || normalizeRoomNo(state.profile?.roomNo)) {
    if (!$('#roomSetupModal').classList.contains('is-hidden')) closeModal('roomSetupModal');
    return;
  }
  state.roomPromptTimer = window.setTimeout(() => {
    if (state.mode === 'firebase' && !normalizeRoomNo(state.profile?.roomNo)) {
      $('#requiredRoomInput').value = '';
      $('#requiredRoomError').textContent = '';
      openModal('roomSetupModal');
    }
  }, 1_200);
}

async function saveRequiredRoom(event) {
  event.preventDefault();
  const roomNo = normalizeRoomNo($('#requiredRoomInput').value);
  if (!roomNo) {
    $('#requiredRoomError').textContent = 'Enter a room number containing 1 to 6 digits.';
    $('#requiredRoomInput').focus();
    return;
  }
  $('#requiredRoomError').textContent = '';
  const button = $('button[type="submit"]', event.currentTarget);
  setButtonBusy(button, true, 'Saving…');
  try {
    const { doc, serverTimestamp, setDoc } = state.firebase.firestoreModule;
    await setDoc(doc(state.db, 'users', state.user.uid), {
      displayName: displayName().slice(0, 60),
      email: state.user.email || '',
      roomNo,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      appVersion: APP_VERSION,
    }, { merge: true });
    state.profile = { ...state.profile, roomNo };
    updateUserInterface();
    closeModal('roomSetupModal');
    toast('Room number saved', `Room ${roomNo} is now linked to your profile.`);
  } catch (error) {
    $('#requiredRoomError').textContent = humanFirebaseError(error);
  } finally {
    setButtonBusy(button, false);
  }
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function writePresence(recordSession = false) {
  if (state.mode !== 'firebase' || !state.firebaseReady || !state.user) return;
  const { doc, increment, serverTimestamp, setDoc } = state.firebase.firestoreModule;
  const payload = {
    displayName: displayName().slice(0, 60),
    email: state.user.email || '',
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    appVersion: APP_VERSION,
  };
  if (recordSession) {
    payload.lastLoginAt = serverTimestamp();
    payload.sessionCount = increment(1);
  }
  try {
    await setDoc(doc(state.db, 'users', state.user.uid), payload, { merge: true });
  } catch (error) {
    console.warn('Presence heartbeat was not saved.', error);
  }
}

function startPresenceTracking() {
  if (state.mode !== 'firebase' || !state.user) return;
  if (state.presenceUid === state.user.uid && state.presenceTimer) return;
  stopPresenceTracking();
  state.presenceUid = state.user.uid;
  const isNewSession = state.sessionRecordedUid !== state.user.uid;
  if (isNewSession) state.sessionRecordedUid = state.user.uid;
  writePresence(isNewSession);
  state.presenceTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') writePresence(false);
  }, PRESENCE_INTERVAL_MS);
  state.presenceVisibilityHandler = () => {
    if (document.visibilityState === 'visible') writePresence(false);
  };
  document.addEventListener('visibilitychange', state.presenceVisibilityHandler);
}

function stopPresenceTracking() {
  if (state.presenceTimer) window.clearInterval(state.presenceTimer);
  if (state.presenceVisibilityHandler) document.removeEventListener('visibilitychange', state.presenceVisibilityHandler);
  state.presenceTimer = null;
  state.presenceVisibilityHandler = null;
  state.presenceUid = null;
}

async function recordMealActivity() {
  if (state.mode !== 'firebase' || !state.firebaseReady || !state.user) return;
  const { doc, increment, serverTimestamp, setDoc } = state.firebase.firestoreModule;
  try {
    await setDoc(doc(state.db, 'users', state.user.uid), {
      displayName: displayName().slice(0, 60),
      email: state.user.email || '',
      lastSeenAt: serverTimestamp(),
      lastMealActivityAt: serverTimestamp(),
      mealActionCount: increment(1),
      updatedAt: serverTimestamp(),
      appVersion: APP_VERSION,
    }, { merge: true });
  } catch (error) {
    console.warn('Usage activity was not recorded.', error);
  }
}

function adminStatus(user, now = Date.now()) {
  const lastSeen = timestampMillis(user.lastSeenAt);
  if (!lastSeen) return { key: 'never', label: 'Never active', age: Infinity };
  const age = Math.max(0, now - lastSeen);
  if (age <= ACTIVE_NOW_MS) return { key: 'active', label: 'Active now', age };
  if (age <= ACTIVE_TODAY_MS) return { key: 'recent', label: 'Recent', age };
  return { key: 'inactive', label: 'Inactive', age };
}

function relativeAdminTime(value) {
  const millis = timestampMillis(value);
  if (!millis) return 'Never';
  const difference = Math.max(0, Date.now() - millis);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (difference < minute) return 'Just now';
  if (difference < hour) return `${Math.floor(difference / minute)}m ago`;
  if (difference < day) return `${Math.floor(difference / hour)}h ago`;
  if (difference < 30 * day) return `${Math.floor(difference / day)}d ago`;
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(millis));
}

function absoluteAdminDate(value) {
  const millis = timestampMillis(value);
  if (!millis) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(millis));
}

function startAdminSubscription(force = false) {
  if (!isAdminUser() || !state.firebaseReady || !state.db) return;
  if (state.adminUnsubscribe && !force) return;
  stopAdminSubscription();
  const { collection, onSnapshot } = state.firebase.firestoreModule;
  const body = $('#adminUserTableBody');
  if (body) body.innerHTML = `<tr><td colspan="7"><div class="admin-loading"><i></i><span>Loading protected user data…</span></div></td></tr>`;
  state.adminUnsubscribe = onSnapshot(collection(state.db, 'users'), (snapshot) => {
    state.adminUsers = snapshot.docs.map((documentSnapshot) => ({ uid: documentSnapshot.id, ...documentSnapshot.data() }));
    renderAdminPanel();
  }, (error) => {
    state.adminUsers = [];
    if (state.adminClockTimer) window.clearInterval(state.adminClockTimer);
    state.adminClockTimer = null;
    $('.admin-table-wrap')?.classList.remove('is-hidden');
    $('#adminUserEmpty')?.classList.add('is-hidden');
    if (body) body.innerHTML = `<tr><td colspan="7"><div class="admin-loading"><span>${escapeHtml(humanFirebaseError(error))}</span></div></td></tr>`;
    toast('Admin data access failed', `${humanFirebaseError(error)} Confirm that the latest firestore.rules are published.`, 'error');
  });
  state.adminClockTimer = window.setInterval(renderAdminPanel, 60 * 1000);
}

function stopAdminSubscription() {
  if (state.adminUnsubscribe) {
    try { state.adminUnsubscribe(); } catch { /* Listener already closed. */ }
  }
  if (state.adminClockTimer) window.clearInterval(state.adminClockTimer);
  state.adminUnsubscribe = null;
  state.adminClockTimer = null;
}

function filteredAdminUsers() {
  const search = state.adminSearch.trim().toLowerCase();
  const now = Date.now();
  return state.adminUsers
    .filter((user) => {
      const status = adminStatus(user, now);
      if (state.adminFilter === 'active' && status.key !== 'active') return false;
      if (state.adminFilter === 'recent' && status.age > ACTIVE_TODAY_MS) return false;
      if (state.adminFilter === 'inactive' && !['inactive', 'never'].includes(status.key)) return false;
      if (state.adminFilter === 'room-missing' && normalizeRoomNo(user.roomNo) !== null) return false;
      if (!search) return true;
      return [user.displayName, user.email, user.roomNo, user.uid]
        .some((value) => String(value || '').toLowerCase().includes(search));
    })
    .sort((a, b) => {
      const statusOrder = { active: 0, recent: 1, inactive: 2, never: 3 };
      const statusDifference = statusOrder[adminStatus(a, now).key] - statusOrder[adminStatus(b, now).key];
      return statusDifference || timestampMillis(b.lastSeenAt) - timestampMillis(a.lastSeenAt);
    });
}

function renderAdminPanel() {
  if (!$('#view-admin')) return;
  const now = Date.now();
  const users = state.adminUsers;
  const statuses = users.map((user) => adminStatus(user, now));
  const active = statuses.filter((status) => status.key === 'active').length;
  const activeToday = statuses.filter((status) => status.age <= ACTIVE_TODAY_MS).length;
  const recentOnly = statuses.filter((status) => status.key === 'recent').length;
  const idle = users.length - active - recentOnly;
  const validRooms = users.map((user) => normalizeRoomNo(user.roomNo)).filter(Boolean);
  const uniqueRooms = new Set(validRooms);
  const missingRooms = users.length - validRooms.length;

  $('#adminTotalUsers').textContent = String(users.length);
  $('#adminActiveNow').textContent = String(active);
  $('#adminActiveToday').textContent = String(activeToday);
  $('#adminRoomCount').textContent = String(uniqueRooms.size);
  $('#adminMissingRooms').textContent = `${missingRooms} missing room${missingRooms === 1 ? '' : 's'}`;
  $('#adminDistributionActive').textContent = String(active);
  $('#adminDistributionRecent').textContent = String(recentOnly);
  $('#adminDistributionIdle').textContent = String(idle);
  const divisor = Math.max(1, users.length);
  $('#adminDistributionActiveBar').style.width = `${(active / divisor) * 100}%`;
  $('#adminDistributionRecentBar').style.width = `${(recentOnly / divisor) * 100}%`;
  $('#adminDistributionIdleBar').style.width = `${(idle / divisor) * 100}%`;
  $('#adminLastUpdated').textContent = `Updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())}`;

  const visible = filteredAdminUsers();
  $('#adminUsersCaption').textContent = `Showing ${visible.length} of ${users.length} registered profile${users.length === 1 ? '' : 's'}.`;
  const body = $('#adminUserTableBody');
  const empty = $('#adminUserEmpty');
  $('.admin-table-wrap').classList.toggle('is-hidden', visible.length === 0);
  empty.classList.toggle('is-hidden', visible.length > 0);
  if (!visible.length) {
    body.innerHTML = '';
    return;
  }

  body.innerHTML = visible.map((user) => {
    const name = typeof user.displayName === 'string' && user.displayName.trim() ? user.displayName.trim() : 'Unnamed resident';
    const email = typeof user.email === 'string' ? user.email : 'No email profile';
    const roomNo = normalizeRoomNo(user.roomNo);
    const status = adminStatus(user, now);
    const sessions = Number.isSafeInteger(user.sessionCount) && user.sessionCount >= 0 ? user.sessionCount : 0;
    const mealActions = Number.isSafeInteger(user.mealActionCount) && user.mealActionCount >= 0 ? user.mealActionCount : 0;
    return `<tr>
      <td data-label="RESIDENT"><div class="admin-resident"><span class="admin-resident-avatar">${escapeHtml(initials(name))}</span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(email)}</small></span></div></td>
      <td data-label="ROOM"><span class="admin-room-number${roomNo ? '' : ' is-missing'}">${roomNo ? escapeHtml(roomNo) : 'Not set'}</span></td>
      <td data-label="STATUS"><span class="admin-status ${status.key}"><i></i>${escapeHtml(status.label)}</span></td>
      <td data-label="LAST ACTIVE" title="${escapeHtml(absoluteAdminDate(user.lastSeenAt))}">${escapeHtml(relativeAdminTime(user.lastSeenAt))}</td>
      <td data-label="SESSIONS" class="admin-number-cell">${sessions.toLocaleString('en-US')}</td>
      <td data-label="MEAL ACTIONS" class="admin-number-cell">${mealActions.toLocaleString('en-US')}</td>
      <td data-label="JOINED">${escapeHtml(absoluteAdminDate(user.createdAt))}</td>
    </tr>`;
  }).join('');
}

function exportAdminUsers() {
  if (!isAdminUser()) return;
  const rows = [['Name', 'Email', 'Room No.', 'Status', 'Last active', 'Sessions', 'Meal actions', 'Joined', 'User UID']];
  const now = Date.now();
  for (const user of filteredAdminUsers()) {
    rows.push([
      user.displayName || '',
      user.email || '',
      normalizeRoomNo(user.roomNo) || '',
      adminStatus(user, now).label,
      timestampMillis(user.lastSeenAt) ? new Date(timestampMillis(user.lastSeenAt)).toISOString() : '',
      Number.isSafeInteger(user.sessionCount) ? user.sessionCount : 0,
      Number.isSafeInteger(user.mealActionCount) ? user.mealActionCount : 0,
      timestampMillis(user.createdAt) ? new Date(timestampMillis(user.createdAt)).toISOString() : '',
      user.uid,
    ]);
  }
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(',')).join('\r\n');
  downloadFile(`meal-ledger-users-${todayKey()}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  toast('User directory exported', `${rows.length - 1} safe user profiles included. Passwords are never exported.`);
}

function requestRender() {
  if (state.renderFrame) return;
  state.renderFrame = requestAnimationFrame(() => {
    state.renderFrame = null;
    renderAll();
  });
}

function updateRateInterface(summary) {
  const mealRate = summary?.mealRatePaisa ?? mealRatePaisaForMonth(state.monthKey);
  const halfRate = summary?.halfMealCostPaisa ?? mealRate / 2;
  const usesCurrentRate = state.monthKey >= MEAL_RATE_CHANGE_MONTH;
  const mealMoney = formatMoney(mealRate);
  const mealMoneyFixed = formatMoney(mealRate, { forceDecimals: true });
  const halfMoney = formatMoney(halfRate, { forceDecimals: true });
  const currentScheduledMoney = formatMoney(mealRatePaisaForMonth(MEAL_RATE_CHANGE_MONTH));
  const legacyScheduledMoney = formatMoney(mealRatePaisaForMonth('2026-08'));

  $('#sidebarMealRate').textContent = mealMoney;
  $('#sidebarRateCaption').textContent = usesCurrentRate
    ? `${currentScheduledMoney} applies from September 2026 onward.`
    : `Historical ${legacyScheduledMoney} rate through August 2026.`;
  $('#metricMealRate').textContent = `${mealMoney} / meal`;
  $('#formulaHalfRate').textContent = `Total half-units × ${halfMoney}`;
  $('#formulaMealRateText').textContent = `Equivalent to total meals × ${mealMoney}, without floating-point rounding.`;
  $('#billingMealRate').textContent = mealMoneyFixed;
  $('#billingMealRateNote').textContent = usesCurrentRate
    ? 'per 1.0 meal · September 2026 onward'
    : 'per 1.0 meal · through August 2026';
  $('#billingHalfRate').textContent = `billed at ${halfMoney}`;
  $('#footerMealRate').textContent = `1 MEAL = ${mealMoney}`;
}

function renderAll() {
  state.summary = calculateMonth(state.monthKey, state.entries, state.advancePaisa);
  updateMonthControls();
  updateRateInterface(state.summary);
  renderGreeting();
  renderMetrics();
  renderSelectedDay();
  renderCalendar();
  renderRecentActivity();
  renderCharts();
  renderInsights();
}

function renderGreeting() {
  const hour = currentHour(APP_TIME_ZONE);
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  $('#greetingText').textContent = greeting;
}

function renderMetrics() {
  const summary = state.summary;
  $('#metricMeals').textContent = formatMeals(summary.actualHalfUnits);
  $('#metricActiveDays').textContent = summary.activeDays;
  $('#metricMealsMax').textContent = `of ${formatMeals(summary.maximumHalfUnits)} possible`;
  $('#metricCost').textContent = formatMoney(summary.spentPaisa);
  $('#metricAdvance').textContent = formatMoney(summary.advancePaisa);

  const usePercent = summary.advancePaisa > 0 ? (summary.spentPaisa / summary.advancePaisa) * 100 : 0;
  $('#metricAdvanceUse').textContent = summary.advancePaisa ? `${Math.round(usePercent)}% used` : 'Not set';
  $('#advanceUsageText').textContent = summary.advancePaisa ? `${Math.round(usePercent)}% of ${formatMoney(summary.advancePaisa)}` : 'No advance set';
  $('#advanceUsageBar').style.width = `${Math.min(100, usePercent)}%`;

  const due = summary.balancePaisa < 0;
  const balanceCard = $('#balanceMetricCard');
  balanceCard.classList.toggle('is-due', due);
  $('#balanceMetricLabel').textContent = due ? 'AMOUNT DUE' : 'REMAINING';
  $('#metricBalance').textContent = formatMoney(Math.abs(summary.balancePaisa));
  $('#balanceMetricHint').innerHTML = due
    ? '<i class="status-mark status-danger"></i> Advance exceeded'
    : '<i class="status-mark status-good"></i> Advance is sufficient';
  $('.metric-icon svg', balanceCard)?.querySelector('use')?.setAttribute('href', due ? '#i-arrow-down' : '#i-arrow-up');

  const percent = summary.completionPercent;
  $('#mealProgressPercent').textContent = `${Math.round(percent)}%`;
  $('#mealProgressRing').style.strokeDashoffset = String(389.56 * (1 - Math.min(100, percent) / 100));
  for (const slot of SLOT_ORDER) {
    $(`#${slot}Total`).textContent = formatMeals(summary.slotTotals[slot].halfUnits);
    $(`#${slot}Days`).textContent = `${summary.slotTotals[slot].checkedDays} days`;
  }

  $('#calendarInlineMeals').textContent = formatMeals(summary.actualHalfUnits);
  $('#calendarInlineCost').textContent = formatMoney(summary.spentPaisa);
  $('#allDayCount').textContent = summary.days;
  $('#loggedDayCount').textContent = summary.activeDays;
  $('#emptyDayCount').textContent = summary.days - summary.activeDays;
}

function formatHumanDate(dateKey, includeYear = false) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function specialRuleText(dateKey) {
  const weekday = weekdayIndex(dateKey);
  if (weekday === 5) return '2× FRIDAY LUNCH';
  if (weekday === 2) return '2× TUESDAY DINNER';
  if (weekday === 0) return '1.5× SUNDAY DINNER';
  return '';
}

function mealToggleMarkup(dateKey, slot, entry, variant = 'day') {
  const meta = slotMeta[slot];
  const halfUnits = slotHalfUnits(dateKey, slot);
  const slotCostPaisa = halfUnits * halfMealCostPaisaForMonth(parseDateKey(dateKey).monthKey);
  const on = entry[slot];
  if (variant === 'selected') {
    return `<button class="selected-meal-toggle${on ? ' is-on' : ''}" data-meal-toggle data-date="${dateKey}" data-slot="${slot}" type="button" aria-pressed="${on}" aria-label="${on ? 'Unmark' : 'Mark'} ${meta.label} on ${formatHumanDate(dateKey)}">
      <span class="meal-mini-icon">${icon(meta.icon)}</span>
      <span><strong>${meta.label}</strong><small>${formatMeals(halfUnits)} meal${halfUnits === 2 ? '' : 's'}</small></span>
      <em>${formatMoney(slotCostPaisa)}</em>
      <span class="toggle-box">${icon('check')}</span>
    </button>`;
  }
  return `<button class="day-meal-toggle${on ? ' is-on' : ''}" data-meal-toggle data-date="${dateKey}" data-slot="${slot}" type="button" aria-pressed="${on}" aria-label="${on ? 'Unmark' : 'Mark'} ${meta.label} on ${formatHumanDate(dateKey)}">
    ${icon(meta.icon)}<span>${meta.label}</span><small>${formatMeals(halfUnits)}</small><i class="day-check">${icon('check')}</i>
  </button>`;
}

function renderSelectedDay() {
  const item = state.summary.daily.find((day) => day.dateKey === state.selectedDate) || state.summary.daily[0];
  if (!item) return;
  state.selectedDate = item.dateKey;
  const current = todayKey();
  const relative = item.dateKey === current ? 'TODAY' : item.dateKey < current ? 'PAST' : 'UPCOMING';
  $('#selectedDayTitle').textContent = relative === 'TODAY' ? 'Today' : 'Selected day';
  $('#selectedDayDate').textContent = formatHumanDate(item.dateKey);
  $('#selectedDayBadge').textContent = relative;
  $('#selectedDayToggles').innerHTML = SLOT_ORDER.map((slot) => mealToggleMarkup(item.dateKey, slot, item.entry, 'selected')).join('');
  $('#selectedDayMeals').textContent = `${formatMeals(item.actualHalfUnits)} meal${item.actualHalfUnits === 2 ? '' : 's'}`;
  $('#selectedDayCost').textContent = formatMoney(item.costPaisa);
  $('#previousDayButton').disabled = item.day === 1;
  $('#nextDayButton').disabled = item.day === state.summary.days;
}

function renderCalendar() {
  const grid = $('#calendarGrid');
  const current = todayKey();
  let visible = state.summary.daily;
  if (state.calendarFilter === 'logged') visible = visible.filter((day) => day.actualHalfUnits > 0);
  if (state.calendarFilter === 'empty') visible = visible.filter((day) => day.actualHalfUnits === 0);

  $('#calendarEmptyState').classList.toggle('is-hidden', visible.length > 0);
  grid.classList.toggle('is-hidden', visible.length === 0);
  if (!visible.length) {
    grid.innerHTML = '';
    return;
  }

  let leadingPlaceholders = '';
  let trailingPlaceholders = '';
  if (state.calendarFilter === 'all') {
    const offset = (state.summary.daily[0].weekday + 6) % 7;
    const previousMonth = shiftMonth(state.monthKey, -1);
    const previousMonthDays = daysInMonth(previousMonth);
    const previousLabel = formatMonthLabel(previousMonth, 'short').split(' ')[0].toUpperCase();
    leadingPlaceholders = Array.from({ length: offset }, (_, index) => {
      const day = previousMonthDays - offset + index + 1;
      return `<div class="day-placeholder" aria-hidden="true"><strong>${String(day).padStart(2, '0')}</strong><span>${previousLabel}</span></div>`;
    }).join('');

    const occupied = offset + state.summary.days;
    const remainder = occupied % 7;
    const trailingCount = remainder ? 7 - remainder : 0;
    const nextLabel = formatMonthLabel(shiftMonth(state.monthKey, 1), 'short').split(' ')[0].toUpperCase();
    trailingPlaceholders = Array.from({ length: trailingCount }, (_, index) =>
      `<div class="day-placeholder" aria-hidden="true"><strong>${String(index + 1).padStart(2, '0')}</strong><span>${nextLabel}</span></div>`
    ).join('');
  }

  const dayCards = visible.map((item) => {
    const special = specialRuleText(item.dateKey);
    return `<article class="day-card${item.actualHalfUnits ? ' has-meals' : ''}${item.dateKey === current ? ' is-today' : ''}${item.dateKey > current ? ' is-future' : ''}" data-day-card="${item.dateKey}">
      <div class="day-card-head">
        <button class="day-number" data-select-date="${item.dateKey}" type="button" aria-label="Select ${formatHumanDate(item.dateKey)}"><strong>${String(item.day).padStart(2, '0')}</strong><span>${WEEKDAY_NAMES[item.weekday].slice(0, 3).toUpperCase()}</span></button>
        <span class="day-total-badge">${formatMeals(item.actualHalfUnits)} M</span>
      </div>
      <div class="special-rule${special ? '' : ' is-none'}">${icon('zap')}<span>${special || 'STANDARD DAY'}</span></div>
      <div class="day-meals">${SLOT_ORDER.map((slot) => mealToggleMarkup(item.dateKey, slot, item.entry)).join('')}</div>
      <div class="day-card-footer"><span>${item.actualHalfUnits ? 'LOGGED' : 'NO MEALS'}</span><strong>${formatMoney(item.costPaisa)}</strong></div>
    </article>`;
  }).join('');
  grid.innerHTML = `${leadingPlaceholders}${dayCards}${trailingPlaceholders}`;
}

function renderRecentActivity() {
  const recent = state.summary.daily.filter((day) => day.actualHalfUnits > 0).reverse().slice(0, 5);
  const container = $('#recentActivity');
  if (!recent.length) {
    container.innerHTML = `<div class="empty-state">${icon('lunch')}<strong>No meals logged yet</strong><p>Use Quick Entry or the calendar to start this month.</p></div>`;
    return;
  }
  container.innerHTML = recent.map((item) => `
    <div class="recent-row">
      <span class="recent-date"><strong>${String(item.day).padStart(2, '0')}</strong><small>${WEEKDAY_NAMES[item.weekday].slice(0, 3).toUpperCase()}</small></span>
      <span class="recent-day-name"><strong>${formatHumanDate(item.dateKey)}</strong><small>${specialRuleText(item.dateKey) || 'Standard meal values'}</small></span>
      ${SLOT_ORDER.map((slot) => `<span class="recent-slot${item.entry[slot] ? ' is-on' : ''}"><i></i>${slotMeta[slot].label} ${item.entry[slot] ? formatMeals(item.values[slot]) : '—'}</span>`).join('')}
      <span class="recent-total"><strong>${formatMeals(item.actualHalfUnits)} meals</strong><small>${formatMoney(item.costPaisa)}</small></span>
    </div>`).join('');
}

function lineChartMarkup(summary, gradientSuffix = '') {
  const width = 1000;
  const height = 260;
  const padding = 13;
  let cumulative = 0;
  const values = summary.daily.map((item) => {
    cumulative += item.costPaisa;
    return cumulative;
  });
  if (cumulative === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="No spending logged"><text class="empty-chart-label" x="${width / 2}" y="${height / 2}">NO COST DATA YET</text></svg>`;
  }
  const max = cumulative;
  const points = values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / max) * (height - padding * 2);
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const area = `M ${points[0][0]} ${height - padding} ${path.replace(/^M/, 'L')} L ${points.at(-1)[0]} ${height - padding} Z`;
  const gradientId = `chartGradient${gradientSuffix}`;
  const [lastX, lastY] = points.at(-1);
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Cumulative cost ${formatMoney(cumulative)}">
    <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".3"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>
    <path class="area" d="${area}" style="fill:url(#${gradientId})"></path>
    <path class="chart-line" d="${path}"></path>
    <line class="chart-guide" x1="${lastX}" y1="${lastY}" x2="${lastX}" y2="${height}"></line>
    <circle class="chart-dot" cx="${lastX}" cy="${lastY}" r="5"></circle>
  </svg>`;
}

function renderCharts() {
  $('#overviewChart').innerHTML = lineChartMarkup(state.summary, 'Overview');
  $('#insightsTrajectoryChart').innerHTML = lineChartMarkup(state.summary, 'Insights');
  $('#trajectoryChange').textContent = `${formatMoney(state.summary.spentPaisa)} total`;
  $('#chartMidDay').textContent = String(Math.ceil(state.summary.days / 2)).padStart(2, '0');
  $('#chartLastDay').textContent = String(state.summary.days).padStart(2, '0');
  $('#insightsTrajectoryTotal').textContent = formatMoney(state.summary.spentPaisa);
  $('#insightsTrajectoryMeals').textContent = `${formatMeals(state.summary.actualHalfUnits)} meals`;
}

function renderInsights() {
  const summary = state.summary;
  const average = summary.activeDays ? (summary.actualHalfUnits / 2 / summary.activeDays) : 0;
  $('#insightDailyAverage').textContent = average.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  $('#insightSpecialMeals').textContent = formatMeals(summary.specialExtraHalfUnits);
  $('#insightSpecialCost').textContent = `${formatMoney(summary.specialExtraCostPaisa)} added cost`;
  $('#insightMaximum').textContent = formatMeals(summary.maximumHalfUnits);
  $('#insightMaximumCost').textContent = `${formatMoney(summary.maximumHalfUnits * summary.halfMealCostPaisa)} if every slot is eaten`;

  const current = todayKey();
  const currentMonth = current.slice(0, 7);
  let projected = summary.spentPaisa;
  let caption = 'Final actual cost';
  if (state.monthKey === currentMonth) {
    const elapsed = parseDateKey(current).day;
    const elapsedCost = summary.daily.slice(0, elapsed).reduce((total, day) => total + day.costPaisa, 0);
    projected = elapsed ? Math.round((elapsedCost * summary.days) / elapsed) : 0;
    caption = `Based on ${elapsed} elapsed day${elapsed === 1 ? '' : 's'}`;
  } else if (state.monthKey > currentMonth) {
    projected = null;
    caption = 'Available after the month begins';
  }
  $('#insightProjection').textContent = projected === null ? '—' : formatMoney(projected);
  $('#insightProjectionCaption').textContent = caption;

  const slotValues = SLOT_ORDER.map((slot) => summary.slotTotals[slot].halfUnits);
  const total = slotValues.reduce((sum, value) => sum + value, 0);
  const percentages = slotValues.map((value) => total ? (value / total) * 100 : 0);
  let cursor = 0;
  const colors = ['var(--amber)', 'var(--primary)', 'var(--purple)'];
  const segments = percentages.map((percentage, index) => {
    const start = cursor;
    cursor += percentage;
    return `${colors[index]} ${start}% ${cursor}%`;
  });
  $('.slot-donut-visual').style.background = total
    ? `conic-gradient(${segments.join(',')})`
    : 'var(--surface-3)';
  $('#slotDonutTotal').textContent = formatMeals(total);
  $('#slotDonutLegend').innerHTML = SLOT_ORDER.map((slot, index) => `
    <div class="slot-legend-row"><i style="background:${colors[index]}"></i><span>${slotMeta[slot].label}</span><strong>${formatMeals(summary.slotTotals[slot].halfUnits)}</strong></div>`).join('');

  const totalsByWeekday = Array(7).fill(0);
  summary.daily.forEach((day) => { totalsByWeekday[day.weekday] += day.actualHalfUnits; });
  const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(1, ...totalsByWeekday);
  $('#weekdayBars').innerHTML = mondayFirst.map((weekday) => {
    const value = totalsByWeekday[weekday];
    const height = (value / max) * 84;
    return `<div class="weekday-bar"><div class="weekday-bar-track"><i style="--bar-height:${height}%" data-value="${formatMeals(value)}"></i></div><span>${WEEKDAY_NAMES[weekday].slice(0, 3).toUpperCase()}</span></div>`;
  }).join('');
}

async function toggleMeal(dateKey, slot) {
  try {
    if (parseDateKey(dateKey).monthKey !== state.monthKey || !SLOT_ORDER.includes(slot)) return;
  } catch { return; }
  const previous = sanitizeDayEntry(state.entries[dateKey]);
  const nextValue = !previous[slot];
  state.entries[dateKey] = { ...previous, [slot]: nextValue };
  const tokenKey = `${dateKey}:${slot}`;
  const token = (state.mealWriteTokens.get(tokenKey) || 0) + 1;
  state.mealWriteTokens.set(tokenKey, token);
  requestRender();
  beginSave();

  try {
    if (state.mode === 'demo') {
      saveDemoMonth();
      return;
    }
    const { doc, serverTimestamp, setDoc } = state.firebase.firestoreModule;
    const ref = doc(state.db, 'users', state.user.uid, 'months', state.monthKey, 'days', dateKey);
    await setDoc(ref, {
      dateKey,
      [slot]: nextValue,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    recordMealActivity();
  } catch (error) {
    if (state.mealWriteTokens.get(tokenKey) === token && state.entries[dateKey]?.[slot] === nextValue) {
      state.entries[dateKey] = { ...sanitizeDayEntry(state.entries[dateKey]), [slot]: previous[slot] };
      requestRender();
    }
    toast('Meal was not saved', humanFirebaseError(error), 'error');
  } finally {
    endSave();
  }
}

function selectDay(dateKey) {
  try {
    if (parseDateKey(dateKey).monthKey !== state.monthKey) return;
    state.selectedDate = dateKey;
    requestRender();
    if (window.innerWidth <= 720) navigate('overview');
  } catch { /* Ignore malformed dates. */ }
}

function stepSelectedDay(delta) {
  const currentDay = parseDateKey(state.selectedDate).day;
  const nextDay = Math.max(1, Math.min(daysInMonth(state.monthKey), currentDay + delta));
  state.selectedDate = makeDateKey(state.monthKey, nextDay);
  requestRender();
}

function openAdvanceModal() {
  $('#advanceInput').value = formatMoney(state.advancePaisa, { symbol: false, forceDecimals: true });
  updateAdvancePreview();
  openModal('advanceModal');
}

function updateAdvancePreview() {
  const paisa = parseTakaToPaisa($('#advanceInput').value);
  const preview = $('#advancePreviewValue');
  if (paisa === null) {
    preview.textContent = 'Enter a valid amount';
    return;
  }
  const balance = paisa - (state.summary?.spentPaisa || 0);
  preview.textContent = `${formatMoney(Math.abs(balance))} ${balance < 0 ? 'due' : 'remaining'}`;
}

async function saveAdvance(event) {
  event.preventDefault();
  const paisa = parseTakaToPaisa($('#advanceInput').value);
  if (paisa === null) {
    toast('Invalid advance amount', 'Use a positive amount with no more than two decimal places.', 'error');
    $('#advanceInput').focus();
    return;
  }
  const button = $('button[type="submit"]', event.currentTarget);
  setButtonBusy(button, true, 'Saving…');
  const previous = state.advancePaisa;
  state.advancePaisa = paisa;
  requestRender();
  beginSave();
  try {
    if (state.mode === 'demo') {
      saveDemoMonth();
    } else {
      const { doc, serverTimestamp, setDoc } = state.firebase.firestoreModule;
      const ref = doc(state.db, 'users', state.user.uid, 'months', state.monthKey);
      await setDoc(ref, {
        monthKey: state.monthKey,
        advancePaisa: paisa,
        mealRatePaisa: mealRatePaisaForMonth(state.monthKey),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      writePresence(false);
    }
    closeModal('advanceModal');
    toast('Advance updated', `${formatMoney(paisa)} is now assigned to ${formatMonthLabel(state.monthKey)}.`);
  } catch (error) {
    state.advancePaisa = previous;
    requestRender();
    toast('Advance was not saved', humanFirebaseError(error), 'error');
  } finally {
    endSave();
    setButtonBusy(button, false);
  }
}

async function runBulkAction(action) {
  if (!['through-today', 'all', 'breakfast', 'clear-meals'].includes(action)) return;
  if (action === 'clear-meals') {
    const approved = await requestConfirm({
      title: 'Uncheck every meal?',
      message: `All meal entries in ${formatMonthLabel(state.monthKey)} will be cleared. The advance amount will stay unchanged.`,
      confirmLabel: 'Clear meal entries',
    });
    if (!approved) return;
  }

  const backup = structuredClone(state.entries);
  const count = daysInMonth(state.monthKey);
  let end = count;
  if (action === 'through-today') {
    const current = todayKey();
    if (state.monthKey > current.slice(0, 7)) {
      toast('No elapsed days', 'This month has not started yet.', 'error');
      return;
    }
    if (state.monthKey === current.slice(0, 7)) end = parseDateKey(current).day;
  }

  if (action === 'clear-meals') {
    state.entries = {};
  } else {
    for (let day = 1; day <= end; day += 1) {
      const dateKey = makeDateKey(state.monthKey, day);
      const currentEntry = sanitizeDayEntry(state.entries[dateKey]);
      state.entries[dateKey] = action === 'breakfast'
        ? { ...currentEntry, breakfast: true }
        : { breakfast: true, lunch: true, dinner: true };
    }
  }
  closeModal('quickFillModal');
  requestRender();
  beginSave();

  try {
    if (state.mode === 'demo') {
      saveDemoMonth();
    } else {
      const { doc, serverTimestamp, writeBatch } = state.firebase.firestoreModule;
      const batch = writeBatch(state.db);
      if (action === 'clear-meals') {
        for (const dateKey of Object.keys(backup)) {
          batch.delete(doc(state.db, 'users', state.user.uid, 'months', state.monthKey, 'days', dateKey));
        }
      } else {
        for (let day = 1; day <= end; day += 1) {
          const dateKey = makeDateKey(state.monthKey, day);
          const ref = doc(state.db, 'users', state.user.uid, 'months', state.monthKey, 'days', dateKey);
          const values = action === 'breakfast'
            ? { dateKey, breakfast: true, updatedAt: serverTimestamp() }
            : { dateKey, breakfast: true, lunch: true, dinner: true, updatedAt: serverTimestamp() };
          batch.set(ref, values, { merge: true });
        }
      }
      await batch.commit();
      recordMealActivity();
    }
    const labels = {
      'through-today': 'Every elapsed day was filled',
      all: 'The complete month was filled',
      breakfast: 'All breakfasts were marked',
      'clear-meals': 'All meal entries were cleared',
    };
    toast(labels[action], formatMonthLabel(state.monthKey));
  } catch (error) {
    state.entries = backup;
    requestRender();
    toast('Bulk update failed', humanFirebaseError(error), 'error');
  } finally {
    endSave();
  }
}

async function clearSelectedMonth() {
  const approved = await requestConfirm({
    title: `Clear ${formatMonthLabel(state.monthKey)}?`,
    message: 'Every meal entry and the monthly advance will be deleted. Download a backup first if you may need this data later.',
    confirmLabel: 'Delete month data',
  });
  if (!approved) return;

  const backupEntries = structuredClone(state.entries);
  const backupAdvance = state.advancePaisa;
  state.entries = {};
  state.advancePaisa = 0;
  requestRender();
  beginSave();
  try {
    if (state.mode === 'demo') {
      saveDemoMonth();
    } else {
      const { collection, doc, getDocs, serverTimestamp, writeBatch } = state.firebase.firestoreModule;
      const daysRef = collection(state.db, 'users', state.user.uid, 'months', state.monthKey, 'days');
      const snapshots = await getDocs(daysRef);
      const batch = writeBatch(state.db);
      snapshots.forEach((snapshot) => batch.delete(snapshot.ref));
      batch.set(doc(state.db, 'users', state.user.uid, 'months', state.monthKey), {
        monthKey: state.monthKey,
        advancePaisa: 0,
        mealRatePaisa: mealRatePaisaForMonth(state.monthKey),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await batch.commit();
      recordMealActivity();
    }
    toast('Month cleared', `${formatMonthLabel(state.monthKey)} is back to zero.`);
  } catch (error) {
    state.entries = backupEntries;
    state.advancePaisa = backupAdvance;
    requestRender();
    toast('Month could not be cleared', humanFirebaseError(error), 'error');
  } finally {
    endSave();
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportCsv() {
  downloadFile(`meal-ledger-${state.monthKey}.csv`, `\uFEFF${buildMonthCsv(state.summary)}`, 'text/csv;charset=utf-8');
  toast('CSV statement exported', `meal-ledger-${state.monthKey}.csv`);
}

function exportJson() {
  const summary = state.summary;
  const payload = {
    schemaVersion: 2,
    app: 'Meal Ledger',
    exportedAt: new Date().toISOString(),
    timeZone: APP_TIME_ZONE,
    monthKey: state.monthKey,
    billing: {
      currency: 'BDT',
      mealRatePaisa: summary.mealRatePaisa,
      mealRateTaka: summary.mealRatePaisa / 100,
      halfMealRatePaisa: summary.halfMealCostPaisa,
      halfMealRateTaka: summary.halfMealCostPaisa / 100,
      arithmeticUnit: '0.5 meal',
      rateSchedule: {
        through2026AugustPaisa: mealRatePaisaForMonth('2026-08'),
        from2026SeptemberPaisa: mealRatePaisaForMonth(MEAL_RATE_CHANGE_MONTH),
      },
    },
    rules: {
      breakfast: '0.5 meal every day',
      lunch: '2 meals on Friday; 1 meal otherwise',
      dinner: '2 meals on Tuesday; 1.5 meals on Sunday; 1 meal otherwise',
    },
    advancePaisa: summary.advancePaisa,
    entries: Object.fromEntries(summary.daily.map((day) => [day.dateKey, day.entry])),
    totals: {
      halfMealUnits: summary.actualHalfUnits,
      meals: summary.actualHalfUnits / 2,
      spentPaisa: summary.spentPaisa,
      remainingPaisa: summary.remainingPaisa,
      duePaisa: summary.duePaisa,
    },
  };
  downloadFile(`meal-ledger-${state.monthKey}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  toast('JSON backup exported', `meal-ledger-${state.monthKey}.json`);
}

async function saveProfile(event) {
  event.preventDefault();
  const name = $('#profileNameInput').value.trim().replace(/\s+/g, ' ');
  const roomNo = normalizeRoomNo($('#profileRoomInput').value);
  if (name.length < 2 || name.length > 60) {
    toast('Invalid display name', 'Use between 2 and 60 characters.', 'error');
    return;
  }
  if (!roomNo) {
    toast('Invalid room number', 'Room No. must contain 1 to 6 digits only.', 'error');
    $('#profileRoomInput').focus();
    return;
  }
  const button = $('button[type="submit"]', event.currentTarget);
  setButtonBusy(button, true, 'Saving…');
  try {
    if (state.mode === 'demo') {
      state.profile = { ...state.profile, displayName: name, email: 'Local preview', roomNo };
      localStorage.setItem('meal-ledger:demo-profile', JSON.stringify(state.profile));
    } else {
      const { updateProfile } = state.firebase.authModule;
      const { doc, serverTimestamp, setDoc } = state.firebase.firestoreModule;
      await updateProfile(state.user, { displayName: name });
      await setDoc(doc(state.db, 'users', state.user.uid), {
        displayName: name,
        email: state.user.email || '',
        roomNo,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        appVersion: APP_VERSION,
      }, { merge: true });
      state.profile = { ...state.profile, displayName: name, email: state.user.email || '', roomNo };
    }
    updateUserInterface();
    toast('Profile updated', `Hello, ${name.split(' ')[0]}.`);
  } catch (error) {
    toast('Profile was not saved', humanFirebaseError(error), 'error');
  } finally {
    setButtonBusy(button, false);
  }
}

async function enterDemo() {
  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('meal-ledger:demo-profile') || 'null'); } catch { profile = null; }
  state.mode = 'demo';
  state.user = { uid: 'demo-local', displayName: profile?.displayName || 'Demo Resident', email: null, emailVerified: false };
  state.profile = {
    displayName: profile?.displayName || 'Demo Resident',
    email: 'Local preview',
    roomNo: normalizeRoomNo(profile?.roomNo) || '302',
  };
  state.summary = null;
  await showApp();
}

async function signOutCurrentUser() {
  $('#accountPopover').classList.add('is-hidden');
  if (state.mode === 'demo') {
    state.mode = null;
    state.user = null;
    state.profile = null;
    state.summary = null;
    showAuth();
    return;
  }
  try {
    await state.firebase.authModule.signOut(state.auth);
  } catch (error) {
    toast('Sign out failed', humanFirebaseError(error), 'error');
  }
}

async function handleSignIn(event) {
  event.preventDefault();
  if (!state.firebaseReady) {
    setAuthAlert('Firebase is unavailable here. Use Explore demo, or run the page with an internet connection.');
    return;
  }
  const email = $('#signInEmail').value.trim();
  const password = $('#signInPassword').value;
  if (!email || !password) {
    setAuthAlert('Enter both your email and password.');
    return;
  }
  const button = $('button[type="submit"]', event.currentTarget);
  setButtonBusy(button, true, 'Signing in…');
  setAuthAlert();
  try {
    const persistence = $('#rememberAccount').checked
      ? state.firebase.authModule.browserLocalPersistence
      : state.firebase.authModule.browserSessionPersistence;
    await state.firebase.authModule.setPersistence(state.auth, persistence);
    await state.firebase.authModule.signInWithEmailAndPassword(state.auth, email, password);
  } catch (error) {
    setAuthAlert(humanFirebaseError(error));
  } finally {
    setButtonBusy(button, false);
  }
}

async function handleSignUp(event) {
  event.preventDefault();
  if (!state.firebaseReady) {
    setAuthAlert('Firebase is unavailable here. Use Explore demo, or run the page with an internet connection.');
    return;
  }
  const name = $('#signUpName').value.trim().replace(/\s+/g, ' ');
  const roomNo = normalizeRoomNo($('#signUpRoom').value);
  const email = $('#signUpEmail').value.trim();
  const password = $('#signUpPassword').value;
  if (name.length < 2 || name.length > 60) {
    setAuthAlert('Use a name between 2 and 60 characters.');
    return;
  }
  if (!roomNo) {
    setAuthAlert('Room No. must contain 1 to 6 digits only.');
    $('#signUpRoom').focus();
    return;
  }
  if (password.length < 8 || !/\d/.test(password)) {
    setAuthAlert('Use at least 8 characters and include a number.');
    return;
  }
  if (!$('#acceptTerms').checked) {
    setAuthAlert('Confirm that you understand how your private cloud data is stored.');
    return;
  }
  const button = $('button[type="submit"]', event.currentTarget);
  setButtonBusy(button, true, 'Creating account…');
  setAuthAlert();
  try {
    await state.firebase.authModule.setPersistence(state.auth, state.firebase.authModule.browserLocalPersistence);
    const credential = await state.firebase.authModule.createUserWithEmailAndPassword(state.auth, email, password);
    await state.firebase.authModule.updateProfile(credential.user, { displayName: name });
    state.user = credential.user;
    state.profile = { displayName: name, email, roomNo };
    try { await state.firebase.authModule.sendEmailVerification(credential.user); } catch { /* Verification is helpful but non-blocking. */ }
    const { doc, serverTimestamp, setDoc } = state.firebase.firestoreModule;
    await setDoc(doc(state.db, 'users', credential.user.uid), {
      displayName: name,
      email,
      roomNo,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      appVersion: APP_VERSION,
    }, { merge: true });
    updateUserInterface();
    toast('Account created', 'A verification email has been requested.');
  } catch (error) {
    setAuthAlert(humanFirebaseError(error));
  } finally {
    setButtonBusy(button, false);
  }
}

async function handleGoogleAuth() {
  if (!state.firebaseReady) {
    setAuthAlert('Firebase is unavailable here. Explore the demo instead.');
    return;
  }
  const button = $('#googleAuthButton');
  setButtonBusy(button, true, 'Opening Google…');
  setAuthAlert();
  try {
    const provider = new state.firebase.authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await state.firebase.authModule.signInWithPopup(state.auth, provider);
  } catch (error) {
    setAuthAlert(humanFirebaseError(error));
  } finally {
    setButtonBusy(button, false);
  }
}

async function handlePasswordReset(event) {
  event.preventDefault();
  const email = $('#resetEmailInput').value.trim();
  if (!state.firebaseReady) {
    toast('Firebase unavailable', 'Password reset requires a cloud connection.', 'error');
    return;
  }
  const button = $('button[type="submit"]', event.currentTarget);
  setButtonBusy(button, true, 'Sending…');
  try {
    await state.firebase.authModule.sendPasswordResetEmail(state.auth, email);
    closeModal('resetPasswordModal');
    setAuthAlert('Password reset email sent. Check your inbox.', 'success');
  } catch (error) {
    toast('Reset email was not sent', humanFirebaseError(error), 'error');
  } finally {
    setButtonBusy(button, false);
  }
}

function renderPasswordStrength() {
  const password = $('#signUpPassword').value;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  const percent = Math.min(100, (score / 5) * 100);
  const labels = ['Use 8+ characters with a number', 'Weak password', 'Fair password', 'Good password', 'Strong password', 'Excellent password'];
  $('#passwordMeterBar').style.width = `${percent}%`;
  $('#passwordMeterBar').style.background = score < 3 ? 'var(--primary)' : score < 4 ? 'var(--amber)' : 'var(--green)';
  $('#passwordMeterLabel').textContent = labels[score];
}

function setThemePreference(preference) {
  if (!['dark', 'light', 'system'].includes(preference)) return;
  localStorage.setItem('meal-ledger:theme', preference);
  applyThemePreference();
}

function applyThemePreference() {
  const preference = localStorage.getItem('meal-ledger:theme') || 'dark';
  const resolved = preference === 'system'
    ? matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    : preference;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#07090e' : '#f1f2f5');
  $$('[data-theme-choice]').forEach((button) => button.classList.toggle('is-active', button.dataset.themeChoice === preference));
  const toggle = $('#themeToggleButton');
  if (toggle) {
    toggle.innerHTML = icon(resolved === 'dark' ? 'sun' : 'moon');
    toggle.setAttribute('aria-label', `Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`);
  }
}

function shiftCurrentMonth(delta) {
  const next = shiftMonth(state.monthKey, delta);
  if (next !== state.monthKey) loadMonth(next);
}

function attachEventListeners() {
  $('#copyrightYear').textContent = new Date().getFullYear();
  $('#signInTab').addEventListener('click', () => selectAuthTab('signin'));
  $('#signUpTab').addEventListener('click', () => selectAuthTab('signup'));
  $('#signInForm').addEventListener('submit', handleSignIn);
  $('#signUpForm').addEventListener('submit', handleSignUp);
  $('#googleAuthButton').addEventListener('click', handleGoogleAuth);
  $('#demoModeButton').addEventListener('click', enterDemo);
  $('#signUpPassword').addEventListener('input', renderPasswordStrength);
  $('#forgotPasswordButton').addEventListener('click', () => {
    $('#resetEmailInput').value = $('#signInEmail').value;
    openModal('resetPasswordModal');
  });
  $('#resetPasswordForm').addEventListener('submit', handlePasswordReset);
  $$('.password-toggle').forEach((button) => button.addEventListener('click', () => {
    const input = $(`#${button.dataset.passwordTarget}`);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.innerHTML = icon(show ? 'eye-off' : 'eye');
    button.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} password`);
  }));

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-view]');
    if (nav && state.appActive) navigate(nav.dataset.view);
    const jump = event.target.closest('[data-view-jump]');
    if (jump && state.appActive) navigate(jump.dataset.viewJump);
    const toggle = event.target.closest('[data-meal-toggle]');
    if (toggle) toggleMeal(toggle.dataset.date, toggle.dataset.slot);
    const dateSelector = event.target.closest('[data-select-date]');
    if (dateSelector) selectDay(dateSelector.dataset.selectDate);
    const advanceButton = event.target.closest('[data-open-advance]');
    if (advanceButton) openAdvanceModal();
    const quickFillButton = event.target.closest('[data-open-quick-fill]');
    if (quickFillButton) openModal('quickFillModal');
    const exportCsvButton = event.target.closest('[data-export-csv]');
    if (exportCsvButton && state.summary) exportCsv();
    const exportJsonButton = event.target.closest('[data-export-json]');
    if (exportJsonButton && state.summary) exportJson();
    const close = event.target.closest('[data-close-modal]');
    if (close) closeModal(close.dataset.closeModal);
    const bulk = event.target.closest('[data-bulk-action]');
    if (bulk) runBulkAction(bulk.dataset.bulkAction);
    const confirm = event.target.closest('[data-confirm-result]');
    if (confirm) resolveConfirm(confirm.dataset.confirmResult);
    if (!event.target.closest('#accountPopover, #topProfileButton, #sidebarProfileButton')) $('#accountPopover').classList.add('is-hidden');
  });

  $('#mobileMenuButton').addEventListener('click', openSidebar);
  $('#sidebarBackdrop').addEventListener('click', closeSidebar);
  $('#topProfileButton').addEventListener('click', () => $('#accountPopover').classList.toggle('is-hidden'));
  $('#sidebarProfileButton').addEventListener('click', () => navigate('settings'));
  $('#previousDayButton').addEventListener('click', () => stepSelectedDay(-1));
  $('#nextDayButton').addEventListener('click', () => stepSelectedDay(1));
  $('#advanceInput').addEventListener('input', updateAdvancePreview);
  $('#advanceForm').addEventListener('submit', saveAdvance);
  $('#profileForm').addEventListener('submit', saveProfile);
  $('#roomSetupForm').addEventListener('submit', saveRequiredRoom);
  $('#adminGatewayButton').addEventListener('click', handleAdminGateway);
  $('#adminRefreshButton').addEventListener('click', () => startAdminSubscription(true));
  $('#adminExportButton').addEventListener('click', exportAdminUsers);
  $('#adminUserSearch').addEventListener('input', (event) => {
    state.adminSearch = event.target.value;
    renderAdminPanel();
  });
  $$('[data-admin-filter]').forEach((button) => button.addEventListener('click', () => {
    state.adminFilter = button.dataset.adminFilter;
    $$('[data-admin-filter]').forEach((filterButton) => {
      const selected = filterButton === button;
      filterButton.classList.toggle('is-active', selected);
      filterButton.setAttribute('aria-pressed', String(selected));
    });
    renderAdminPanel();
  }));
  ['signUpRoom', 'profileRoomInput', 'requiredRoomInput'].forEach((id) => {
    $(`#${id}`).addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
    });
  });
  $('#clearMonthButton').addEventListener('click', clearSelectedMonth);
  $('#exitDemoButton').addEventListener('click', signOutCurrentUser);
  $('#settingsSignOutButton').addEventListener('click', signOutCurrentUser);
  $('#popoverSignOutButton').addEventListener('click', signOutCurrentUser);

  $$('.month-shift').forEach((button) => button.addEventListener('click', () => shiftCurrentMonth(Number(button.dataset.monthShift))));
  $('#monthPicker').addEventListener('change', (event) => {
    if (event.target.value) loadMonth(event.target.value);
  });
  $$('.filter-chip').forEach((button) => button.addEventListener('click', () => {
    state.calendarFilter = button.dataset.calendarFilter;
    $$('.filter-chip').forEach((chip) => chip.classList.toggle('is-active', chip === button));
    renderCalendar();
  }));

  $$('.theme-segment button').forEach((button) => button.addEventListener('click', () => setThemePreference(button.dataset.themeChoice)));
  $('#themeToggleButton').addEventListener('click', () => setThemePreference(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if ((localStorage.getItem('meal-ledger:theme') || 'dark') === 'system') applyThemePreference();
  });

  window.addEventListener('hashchange', () => {
    const view = location.hash.slice(1);
    if (state.appActive && validView(view)) navigate(view, false);
  });
  window.addEventListener('online', () => {
    if (state.mode === 'firebase') setSyncStatus('synced');
  });
  window.addEventListener('offline', () => {
    if (state.mode === 'firebase') setSyncStatus('offline');
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const openModalElement = $('.modal-layer:not(.is-hidden)');
      if (openModalElement?.id === 'confirmModal') resolveConfirm('cancel');
      else if (openModalElement && openModalElement.id !== 'roomSetupModal') closeModal(openModalElement.id);
      $('#accountPopover').classList.add('is-hidden');
      closeSidebar();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e' && state.appActive) {
      event.preventDefault();
      exportCsv();
    }
  });
}

async function start() {
  applyThemePreference();
  attachEventListeners();
  updateMonthControls();
  renderPasswordStrength();
  // Do not make the interface depend on the network. Firebase loads dynamically;
  // if it is blocked, the local interactive demo remains fully usable.
  await initFirebase();
}

start();
