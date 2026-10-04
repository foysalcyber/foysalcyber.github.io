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
  createdAt: null
};

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
