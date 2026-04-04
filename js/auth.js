/**
 * auth.js — Simple account system with localStorage
 * Stores users as { username, passwordHash, created }
 * Projects are scoped per user
 */
(function () {
  'use strict';

  const USERS_KEY = 'strudel_users';
  const SESSION_KEY = 'strudel_current_user';

  // Simple hash (not cryptographic — just for basic password check)
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return hash.toString(36);
  }

  function getUsers() {
    return window.Storage.get(USERS_KEY) || {};
  }

  function saveUsers(users) {
    window.Storage.set(USERS_KEY, users);
  }

  function register(username, password) {
    if (!username || !password) return { ok: false, error: 'Username and password required' };
    if (username.length < 2) return { ok: false, error: 'Username too short' };
    if (password.length < 3) return { ok: false, error: 'Password too short (min 3)' };

    const users = getUsers();
    const key = username.toLowerCase();
    if (users[key]) return { ok: false, error: 'Username already taken' };

    users[key] = {
      username: username,
      passwordHash: simpleHash(password),
      created: new Date().toISOString()
    };
    saveUsers(users);
    window.Storage.set(SESSION_KEY, key);
    return { ok: true, user: users[key] };
  }

  function login(username, password) {
    if (!username || !password) return { ok: false, error: 'Username and password required' };

    const users = getUsers();
    const key = username.toLowerCase();
    const user = users[key];
    if (!user) return { ok: false, error: 'User not found' };
    if (user.passwordHash !== simpleHash(password)) return { ok: false, error: 'Wrong password' };

    window.Storage.set(SESSION_KEY, key);
    return { ok: true, user };
  }

  function logout() {
    window.Storage.remove(SESSION_KEY);
  }

  function currentUser() {
    const key = window.Storage.get(SESSION_KEY);
    if (!key) return null;
    const users = getUsers();
    return users[key] || null;
  }

  function isLoggedIn() {
    return !!currentUser();
  }

  // Project storage key scoped to current user
  function projectsKey() {
    const key = window.Storage.get(SESSION_KEY);
    return key ? 'strudel_projects_' + key : 'strudel_projects';
  }

  window.Auth = {
    register,
    login,
    logout,
    currentUser,
    isLoggedIn,
    projectsKey
  };
})();
