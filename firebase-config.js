// ============================================================
// MeetHost — Firebase Configuration
// তোমার Firebase project (SoftMax) এর তথ্য
// ============================================================

// Firebase v12 modular SDK (CDN থেকে import করা হবে index.html-এ)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, remove, child, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyADR168ypXWbj-dhzU1v1ID_euYk_6FsjQ",
  authDomain: "softmax-10bd4.firebaseapp.com",
  databaseURL: "https://softmax-10bd4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "softmax-10bd4",
  storageBucket: "softmax-10bd4.firebasestorage.app",
  messagingSenderId: "618773708473",
  appId: "1:618773708473:web:b70542f5aabfd79e8a6568",
  measurementId: "G-BPN27PZLER"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export {
  db, auth,
  ref, set, get, update, onValue, push, remove, child, onDisconnect, serverTimestamp,
  signInAnonymously, onAuthStateChanged
};
