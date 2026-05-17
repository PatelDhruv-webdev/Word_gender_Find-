/**
 * Global test setup — runs before every test file.
 * - Resets IndexedDB (fake-indexeddb) between tests
 * - Installs a `chrome` API mock routed to in-memory storage
 * - Swaps fetch to return the bundled dict.json
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { vi, beforeEach, afterEach } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const EXT_DIR = join(__dirname, '..', 'extension');

function makeStorageArea() {
  const data = new Map();
  const listeners = new Set();

  return {
    _data: data,
    _listeners: listeners,
    async get(defaults) {
      if (defaults == null) return Object.fromEntries(data);
      if (typeof defaults === 'string') {
        return { [defaults]: data.get(defaults) };
      }
      const out = {};
      for (const [k, v] of Object.entries(defaults)) {
        out[k] = data.has(k) ? data.get(k) : v;
      }
      return out;
    },
    async set(items) {
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        const oldValue = data.get(k);
        data.set(k, v);
        changes[k] = { oldValue, newValue: v };
      }
      listeners.forEach((fn) => fn(changes, 'sync'));
    },
    async clear() {
      data.clear();
    },
  };
}

export function installChromeMock({ manifestVersion = '1.0.0', dictPath = join(EXT_DIR, 'dict.json') } = {}) {
  const syncArea = makeStorageArea();
  const onChangedListeners = new Set();
  syncArea._listeners.add((changes, area) => {
    onChangedListeners.forEach((fn) => fn(changes, area));
  });

  globalThis.chrome = {
    runtime: {
      getManifest: () => ({ version: manifestVersion }),
      getURL: (path) => `chrome-extension://test/${path}`,
      onInstalled: { addListener: vi.fn() },
    },
    storage: {
      sync: syncArea,
      onChanged: {
        addListener: (fn) => onChangedListeners.add(fn),
        removeListener: (fn) => onChangedListeners.delete(fn),
      },
    },
  };

  const dictJson = readFileSync(dictPath, 'utf8');
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.endsWith('/dict.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(dictJson),
        text: async () => dictJson,
      };
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  });

  return { syncArea, onChangedListeners };
}

export function makeFetchFail() {
  globalThis.fetch = vi.fn(async () => {
    throw new Error('network down');
  });
}

// Reset IndexedDB to a pristine in-memory factory before every test.
// This avoids `deleteDatabase` blocking on open connections from prior tests.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  if (typeof document !== 'undefined') document.body.innerHTML = '';
  if (typeof window !== 'undefined') {
    delete window.FrenchGenderDB;
    delete window.__FG_TEST__;
  }
});
