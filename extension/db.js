/**
 * db.js — IndexedDB-backed dictionary
 * First run (or after a version bump): fetches bundled dict.json → stores in IndexedDB.
 * All subsequent lookups: fast IndexedDB reads, no JSON parse overhead.
 * Re-seeds automatically when the extension version changes (dict update).
 */

const DB_NAME     = 'french-gender-db';
const DB_VERSION  = 2;
const STORE_WORDS = 'words';
const STORE_META  = 'meta';
const META_VERSION_KEY = 'dict_version';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_WORDS)) {
        d.createObjectStore(STORE_WORDS, { keyPath: 'word' });
      }
      if (!d.objectStoreNames.contains(STORE_META)) {
        d.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function getMeta(d, key) {
  return new Promise((resolve) => {
    const tx  = d.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(key);
    req.onsuccess = (e) => resolve(e.target.result ? e.target.result.value : null);
    req.onerror   = ()  => resolve(null);
  });
}

function clearStore(d, storeName) {
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

function currentVersion() {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '0.0.0';
  }
}

async function seedDB(d) {
  const installedVersion = await getMeta(d, META_VERSION_KEY);
  const thisVersion      = currentVersion();
  if (installedVersion === thisVersion) return;

  let json;
  try {
    const url  = chrome.runtime.getURL('dict.json');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    json = await resp.json();
  } catch (err) {
    console.warn('[French Gender] dict.json fetch failed, will retry next load:', err);
    return;
  }

  await clearStore(d, STORE_WORDS);

  const tx    = d.transaction([STORE_WORDS, STORE_META], 'readwrite');
  const words = tx.objectStore(STORE_WORDS);
  const meta  = tx.objectStore(STORE_META);

  for (const [word, data] of Object.entries(json)) {
    words.put({ word, ...data });
  }
  meta.put({ key: META_VERSION_KEY, value: thisVersion });

  await new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

function getWord(d, word) {
  return new Promise((resolve) => {
    const tx  = d.transaction(STORE_WORDS, 'readonly');
    const req = tx.objectStore(STORE_WORDS).get(word);
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror   = ()  => resolve(null);
  });
}

// Normalize: lowercase, strip leading articles
function normalize(raw) {
  return raw
    .toLowerCase()
    .replace(/^(le |la |l'|les |un |une |des )/i, '')
    .trim();
}

// Public API used by content.js
window.FrenchGenderDB = {
  async init() {
    db = await openDB();
    await seedDB(db);
  },

  async lookup(rawWord) {
    if (!db) return null;
    const key = normalize(rawWord);
    if (!key) return null;
    return await getWord(db, key);
  },

  _internals: { normalize, currentVersion, META_VERSION_KEY, STORE_WORDS, STORE_META }
};
