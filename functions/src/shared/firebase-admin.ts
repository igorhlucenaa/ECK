import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'pwa-workana';
const STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.STORAGE_BUCKET ||
  `${PROJECT_ID}.firebasestorage.app`;

let firestoreConfigured = false;

/**
 * Garante app default do Firebase Admin (Auth, Firestore, etc.).
 * Usa admin.app() em vez de admin.apps.length — evita falso positivo no emulador/runtime.
 */
export function getFirebaseAdmin(): typeof admin {
  try {
    admin.app();
  } catch {
    // Em Cloud Functions, initializeApp() vazio usa credenciais do runtime.
    if (process.env.GCLOUD_PROJECT || process.env.K_SERVICE) {
      admin.initializeApp();
    } else {
      admin.initializeApp({
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
      });
    }
  }
  return admin;
}

export function getFirebaseAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}

export function getFirestoreDb(): admin.firestore.Firestore {
  const db = getFirebaseAdmin().firestore();

  if (!firestoreConfigured) {
    db.settings({ ignoreUndefinedProperties: true });
    firestoreConfigured = true;
  }

  return db;
}

export function getStorageBucketName(): string {
  return STORAGE_BUCKET;
}

export function getStorageBucket() {
  return getFirebaseAdmin().storage().bucket(STORAGE_BUCKET);
}
