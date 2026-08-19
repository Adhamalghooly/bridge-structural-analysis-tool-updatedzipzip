/**
 * Asynchronous, high-capacity Key-Value store backed by IndexedDB.
 * Used for storing large project states, FE mesh analysis, and configurations safely.
 */

const DB_NAME = 'StructuralDesignStudioDB';
const STORE_NAME = 'KeyValueStore';
const DB_VERSION = 1;

interface IndexedDBStore {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

function getDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export const dbStore: IndexedDBStore = {
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const db = await getDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve((request.result as T) ?? null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error('IndexedDB getItem failed, falling back to memory/local', err);
      return null;
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const db = await getDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error('IndexedDB setItem failed', err);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const db = await getDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error('IndexedDB removeItem failed', err);
    }
  },

  async clear(): Promise<void> {
    try {
      const db = await getDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error('IndexedDB clear failed', err);
    }
  }
};
