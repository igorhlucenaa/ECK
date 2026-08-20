import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'pwa-workana';
const STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.STORAGE_BUCKET ||
  'pwa-workana.firebasestorage.app';

let firestoreConfigured = false;

export function getFirebaseAdmin(): typeof admin {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
  }
  return admin;
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
