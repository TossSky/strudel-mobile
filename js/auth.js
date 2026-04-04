/**
 * auth.js — Authentication via server API
 * Token stored in localStorage for session persistence
 */
(function () {
  'use strict';

  const TOKEN_KEY = 'strudel_token';
  const USER_KEY = 'strudel_user';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  function getStoredUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveSession(token, username) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify({ username: username }));
    } catch {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  }

  async function register(username, password) {
    try {
      var resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      var data = await resp.json();
      if (!resp.ok) return { ok: false, error: data.error || 'Registration failed' };
      saveSession(data.token, data.username);
      return { ok: true, user: { username: data.username } };
    } catch (e) {
      return { ok: false, error: 'Network error' };
    }
  }

  async function login(username, password) {
    try {
      var resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      var data = await resp.json();
      if (!resp.ok) return { ok: false, error: data.error || 'Login failed' };
      saveSession(data.token, data.username);
      return { ok: true, user: { username: data.username } };
    } catch (e) {
      return { ok: false, error: 'Network error' };
    }
  }

  function logout() {
    clearSession();
  }

  function currentUser() {
    var token = getToken();
    if (!token) return null;
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
