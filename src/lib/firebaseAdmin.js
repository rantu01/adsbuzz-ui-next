import * as admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";

function normalizePrivateKey(rawKey) {
  if (!rawKey) return rawKey;
  let key = String(rawKey).trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  if (!key.includes("BEGIN PRIVATE KEY") && !key.includes("\\n")) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf-8");
      if (decoded.includes("BEGIN PRIVATE KEY")) {
        key = decoded;
      }
    } catch {
      // not base64, keep as-is
    }
  }

  key = key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  return key;
}

export function getFirebaseAdmin() {
  if (admin.getApps().length > 0) return admin.getApp();

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, "base64").toString("utf-8")
      );
      return admin.initializeApp({
        credential: admin.cert(serviceAccount),
      });
    }

    if (
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ) {
      const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

      if (!privateKey.includes("BEGIN PRIVATE KEY")) {
        console.error(
          "getFirebaseAdmin: FIREBASE_ADMIN_PRIVATE_KEY is malformed (missing PEM header)."
        );
        return null;
      }

      return admin.initializeApp({
        credential: admin.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey,
        }),
      });
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }

    return null;
  } catch (err) {
    console.error("getFirebaseAdmin initialization failed:", err?.message || err);
    return null;
  }
}

export function getFirebaseAuth() {
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    return getAuth(app);
  } catch (err) {
    console.error("getFirebaseAuth failed:", err?.message || err);
    return null;
  }
}

export async function verifyFirebaseToken(idToken) {
  const fbAuth = getFirebaseAuth();
  if (!fbAuth) {
    throw new Error("Firebase Auth not available. Check FIREBASE_ADMIN_* env vars.");
  }
  const decoded = await fbAuth.verifyIdToken(idToken);
  return decoded;
}

export async function createBrowserSessionCookie(idToken, expiresInMs) {
  const fbAuth = getFirebaseAuth();
  if (!fbAuth) {
    throw new Error("Firebase Auth not available. Check FIREBASE_ADMIN_* env vars.");
  }
  const expiresIn = Number(expiresInMs) || 10 * 24 * 60 * 60 * 1000; // default 10 days
  return fbAuth.createSessionCookie(idToken, { expiresIn });
}

export async function verifySessionCookie(token) {
  const fbAuth = getFirebaseAuth();
  if (!fbAuth) {
    throw new Error("Firebase Auth not available. Check FIREBASE_ADMIN_* env vars.");
  }
  return fbAuth.verifySessionCookie(token, true);
}

export async function deleteFirebaseAuthUser(uid) {
  const fbAuth = getFirebaseAuth();
  if (!fbAuth) {
    console.error("deleteFirebaseAuthUser: Firebase Auth not available.");
    return false;
  }
  try {
    await fbAuth.deleteUser(uid);
    return true;
  } catch (err) {
    console.error("deleteFirebaseAuthUser failed:", err.message || err);
    return false;
  }
}

export async function updateFirebaseUserPassword(uid, newPassword) {
  const fbAuth = getFirebaseAuth();
  if (!fbAuth) {
    console.error("updateFirebaseUserPassword: Firebase Auth not available.");
    return false;
  }
  try {
    await fbAuth.updateUser(uid, { password: newPassword });
    return true;
  } catch (err) {
    console.error("updateFirebaseUserPassword failed:", err.message || err);
    return false;
  }
}

export default getFirebaseAdmin;
