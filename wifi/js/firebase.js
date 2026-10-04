/* ============================================================
   Firebase init — App / Auth / Firestore
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Session persists — stays signed in after closing the browser
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const db = getFirestore(app);

/* ---- Firestore helpers ---- */
export {
  collection, doc, onSnapshot, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, writeBatch, query, where, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ---- Auth helpers ---- */
export {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
