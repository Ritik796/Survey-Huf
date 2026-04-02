import { ref, get, set, update } from 'firebase/database';
import { getDB } from './firebaseConfig';

// ─── Get data from a Firebase path ───────────────────────────────────────────
export const getData = async (path) => {
  const db = getDB();
  const snapshot = await get(ref(db, path));
  return snapshot.exists() ? snapshot.val() : null;
};

// ─── Save (overwrite) data at a Firebase path ────────────────────────────────
export const saveData = async (path, data) => {
  const db = getDB();
  await set(ref(db, path), data);
};

// ─── Update (merge) data at a Firebase path ──────────────────────────────────
export const updateData = async (path, data) => {
  const db = getDB();
  await update(ref(db, path), data);
};
