/* ============================================================
   Firebase configuration + app default Settings
   ============================================================ */

export const firebaseConfig = {
  apiKey: "AIzaSyBAwrER4GjexFSHSodBYe0A0t3O9JmEtJs",
  authDomain: "wifi-38ea5.firebaseapp.com",
  projectId: "wifi-38ea5",
  storageBucket: "wifi-38ea5.firebasestorage.app",
  messagingSenderId: "259136272793",
  appId: "1:259136272793:web:5288a1c794c01b00c8bb08",
  measurementId: "G-D41G68FYCX"
};

/* Firestore collection names */
export const COL = {
  members: 'members',
  payments: 'payments',
  devices: 'devices',
  settings: 'settings'
};

export const SETTINGS_DOC = 'app';

/* These defaults are created automatically on first launch */
export const DEFAULT_SETTINGS = {
  hostelName: 'Our Hostel',
  defaultFee: 150,                       // fixed monthly fee for everyone
  currency: '৳',
  routers: [
    { id: 'A', name: 'Router A' },
    { id: 'B', name: 'Router B' }
  ],
  reminderTemplate:
    'Hi {name},\nYour {month} WiFi bill of {due} is still unpaid.\n' +
    'Room: {room} | Router: {router}\nPlease pay at your earliest convenience.\nThank you — Hostel WiFi',
  createdAt: null
};

/* Payment types */
export const PAY_TYPES = {
  payment: { label: 'Payment', icon: '💰', sign: +1 },
  advance: { label: 'Advance', icon: '⭐', sign: +1 },
  refund: { label: 'Refund', icon: '↩️', sign: -1 },
  waiver: { label: 'Waiver / discount', icon: '🎁', sign: +1 }
};

/* Device types */
export const DEVICE_TYPES = {
  phone: '📱 Phone',
  laptop: '💻 Laptop',
  tv: '📺 TV',
  tablet: '📲 Tablet',
  other: '🔌 Other'
};

/* Device status */
export const DEVICE_STATUS = {
  connected: { label: 'Connected', cls: 'ok' },
  offline: { label: 'Disconnected', cls: '' },
  blocked: { label: 'Blocked', cls: 'bad' }
};

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
