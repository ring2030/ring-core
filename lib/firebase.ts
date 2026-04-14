import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK is browser-only.");
  }
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Missing Firebase env: ${missing.join(", ")}. Copy .env.example to .env.local and fill values.`,
    );
  }
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApps()[0]!;
}

let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let auth: Auth | null = null;

export function getFirestoreDb(): Firestore {
  if (typeof window === "undefined") {
    throw new Error("Firestore is browser-only.");
  }
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (typeof window === "undefined") {
    throw new Error("Firebase Storage is browser-only.");
  }
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

export function getFirebaseAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth is browser-only.");
  }
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}
