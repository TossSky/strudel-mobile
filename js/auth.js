/**
 * auth.js — Authentication via server API
 * Token cached in localStorage for session persistence.
 * login/register are async (server calls), the rest is sync (local cache).
 */
(function () {
  'use strict';

  var TOKEN_KEY = 'strudel_token';
  var USER_KEY  = 'strudel_user';

  // --- Local cache helpers (sync) ---
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function getStoredUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveLocal(token, username) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify({ username: username }));
    } catch (e) {}
  }

  function clearLocal() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }

  // --- Server calls (async) ---
  async function register(username, password) {
    if (!username || !password) return { ok: false, error: 'Username and password required' };
    if (username.length < 2)    return { ok: false, error: 'Username too short' };
    if (password.length < 3)    return { ok: false, error: 'Password too short (min 3)' };
    try {
      var resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      var data = await resp.json();
      if (!resp.ok) return { ok: false, error: data.error || 'Registration failed' };
      saveLocal(data.token, data.username);
      return { ok: true, user: { username: data.username } };
    } catch (e) {
      return { ok: false, error: 'Network error — is the server running?' };
    }
  }

  async function login(username, password) {
    if (!username || !password) return { ok: false, error: 'Username and password required' };
    try {
      var resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      var data = await resp.json();
      if (!resp.ok) return { ok: false, error: data.error || 'Login failed' };
      saveLocal(data.token, data.username);
      return { ok: true, user: { username: data.username } };
    } catch (e) {
      return { ok: false, error: 'Network error — is the server running?' };
    }
  }

  // --- Sync helpers ---
  function logout() {
    clearLocal();
  }

  function currentUser() {
    if (!getToken()) return null;
    return getStoredUser();
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function authHeaders() {
    var token = getToken();
    if (!token) return {};
    return { 'Authorization': 'Bearer ' + token };
  }

  window.Auth = {
    register: register,
    login: login,
    logout: logout,
    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    authHeaders: authHeaders
  };
})();
