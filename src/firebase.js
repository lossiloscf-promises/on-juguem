import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Estas claves NO son secretas (son públicas por diseño en apps Firebase),
// pero igualmente las metemos en variables de entorno para no hardcodearlas.
// Se rellenan en un archivo .env.local (ver README.md, paso 2).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Misma región que las Cloud Functions (functions/index.js) — si se cambia
// allí, hay que cambiarla aquí también.
export const functions = getFunctions(app, "europe-west1");
export const storage = getStorage(app);
