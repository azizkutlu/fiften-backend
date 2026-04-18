import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

let db = null;

export function initFirebaseAdmin() {
  if (getApps().length > 0) {
    db = getFirestore();
    return;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountJson && !serviceAccountPath) {
    console.warn(
      '[Admin] FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH not set — Firestore queries disabled'
    );
    return;
  }

  try {
    const rawJson = serviceAccountJson || readFileSync(serviceAccountPath, 'utf8');
    initializeApp({ credential: cert(JSON.parse(rawJson)) });
    db = getFirestore();
    console.log('[Admin] Firebase Admin initialized');
  } catch (e) {
    console.error('[Admin] Firebase Admin init failed:', e.message);
  }
}

export function getDb() {
  return db;
}
