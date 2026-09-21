// IndexedDB 封装：按 token 持久化驾驶缓存，规避 localStorage 5MB 配额限制
// 库结构：db=travelplan, store=driving_cache, keyPath=token
// 记录形状：{ token, driving, manual, updatedAt }

import type { DrivingResponse } from '../types/domain';

interface CacheRecord {
  token: string;
  driving: Record<string, DrivingResponse>;
  manual: Record<string, { distance: number; duration: number }>;
  updatedAt: number;
}

const DB_NAME = 'travelplan';
const STORE = 'driving_cache';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'token' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function idbLoad(
  token: string
): Promise<{
  driving: Record<string, DrivingResponse>;
  manual: Record<string, { distance: number; duration: number }>;
}> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(token);
      req.onsuccess = () => {
        const rec = req.result as CacheRecord | undefined;
        if (rec) {
          resolve({ driving: rec.driving || {}, manual: rec.manual || {} });
        } else {
          resolve({ driving: {}, manual: {} });
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return { driving: {}, manual: {} };
  }
}

export async function idbSave(
  token: string,
  driving: Record<string, DrivingResponse>,
  manual: Record<string, { distance: number; duration: number }>
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const rec: CacheRecord = {
        token,
        driving,
        manual,
        updatedAt: Date.now(),
      };
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // 静默失败：不影响会话内使用
  }
}

export async function idbClear(token: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(token);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // 静默失败
  }
}
