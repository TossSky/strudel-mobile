/**
 * storage.js — localStorage wrapper with in-memory fallback
 * Falls back gracefully when localStorage is unavailable (file:// protocol)
 */
(function () {
  'use strict';

  const memStore = {};
  let useLocal = true;

  // Test if localStorage actually works
  try {
    const testKey = '__strudel_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
  } catch {
    useLocal = false;
    console.warn('[Storage] localStorage unavailable, using in-memory fallback');
  }

  window.Storage = {
    get(key) {
      try {
        const raw = useLocal ? localStorage.getItem(key) : memStore[key];
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    set(key, value) {
      try {
        const json = JSON.stringify(value);
        if (useLocal) localStorage.setItem(key, json);
        else memStore[key] = json;
        return true;
      } catch (e) {
        console.warn('[Storage] write error:', e);
        return false;
      }
    },

    remove(key) {
      try {
        if (useLocal) localStorage.removeItem(key);
        else delete memStore[key];
        return true;
      } catch {
        return false;
      }
    },

    get available() {
      return useLocal;
    }
  };
})();
