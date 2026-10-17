// Tiny promise wrapper around IndexedDB. Everything lives on the device.
const DB_NAME = 'notebae';
const DB_VERSION = 1;
const STORES = ['notes', 'folders', 'images', 'meta'];

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const idb = req.result;
        for (const name of STORES) {
          if (!idb.objectStoreNames.contains(name)) {
            idb.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const idb = await open();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  all: (store) => run(store, 'readonly', (s) => s.getAll()),
  get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
  put: (store, value) => run(store, 'readwrite', (s) => s.put(value)),
  del: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
  putMany: (store, values) =>
    run(store, 'readwrite', (s) => {
      for (const v of values) s.put(v);
    }),
  async getMeta(key, fallback = null) {
    const row = await this.get('meta', key);
    return row ? row.value : fallback;
  },
  setMeta: (key, value) => run('meta', 'readwrite', (s) => s.put({ key, value })),
};
