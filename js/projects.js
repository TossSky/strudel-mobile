/**
 * projects.js — Project management via server API
 * Caches projects locally, syncs with server when authenticated
 */
(function () {
  'use strict';

  // Local cache of projects (avoids async in render paths)
  var cache = [];

  function headers() {
    var h = Auth.authHeaders();
    h['Content-Type'] = 'application/json';
    return h;
  }

  /** Fetch all projects from server and update cache */
  async function sync() {
    if (!Auth.isLoggedIn()) { cache = []; return []; }
    try {
      var resp = await fetch('/api/projects', { headers: Auth.authHeaders() });
      if (!resp.ok) throw new Error('fetch failed');
      cache = await resp.json();
      return cache;
    } catch (e) {
      console.warn('[Projects] sync error:', e.message);
      return cache;
    }
  }

  function getAll() {
    return cache;
  }

  async function save(project) {
    if (!Auth.isLoggedIn()) return null;
    try {
      var url, method;
      if (project.id) {
        url = '/api/projects/' + project.id;
        method = 'PUT';
      } else {
        url = '/api/projects';
        method = 'POST';
      }
      var resp = await fetch(url, {
        method: method,
        headers: headers(),
        body: JSON.stringify({
          name: project.name || 'untitled',
          code: project.code || '',
          cps: project.cps || 1
        })
      });
      if (!resp.ok) throw new Error('save failed');
      var saved = await resp.json();
      // Update cache
      var idx = cache.findIndex(function (p) { return p.id === saved.id; });
      if (idx !== -1) cache[idx] = saved;
      else cache.unshift(saved);
      return saved;
    } catch (e) {
      console.warn('[Projects] save error:', e.message);
      return null;
    }
  }

  async function remove(id) {
    if (!Auth.isLoggedIn()) return;
    try {
      await fetch('/api/projects/' + id, { method: 'DELETE', headers: Auth.authHeaders() });
      cache = cache.filter(function (p) { return p.id !== id; });
    } catch (e) {
      console.warn('[Projects] remove error:', e.message);
    }
  }

  function find(id) {
    return cache.find(function (p) { return p.id === id; }) || null;
  }

  async function rename(id, newName) {
    if (!Auth.isLoggedIn()) return null;
    try {
      var resp = await fetch('/api/projects/' + id + '/rename', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ name: newName })
      });
      if (!resp.ok) throw new Error('rename failed');
      var updated = await resp.json();
      var idx = cache.findIndex(function (p) { return p.id === id; });
      if (idx !== -1) cache[idx] = updated;
      return updated;
    } catch (e) {
      console.warn('[Projects] rename error:', e.message);
      return null;
    }
  }

  function exportProject(project) {
    return {
      version: 1,
      type: 'strudel-project',
      name: project.name,
      code: project.code,
      cps: project.cps,
      exported: new Date().toISOString()
    };
  }

  function exportAll() {
    return {
      version: 1,
      type: 'strudel-bundle',
      projects: cache,
      exported: new Date().toISOString()
    };
  }

  async function importData(data) {
    if (data.type === 'strudel-bundle' && Array.isArray(data.projects)) {
      var count = 0;
      for (var i = 0; i < data.projects.length; i++) {
        var p = data.projects[i];
        await save({ name: p.name, code: p.code, cps: p.cps });
        count++;
      }
      await sync();
      return { type: 'bundle', count: count };
    }

    if (data.code !== undefined) {
      var project = await save({
        name: data.name || 'imported',
        code: data.code,
        cps: data.cps || 1
      });
      return { type: 'single', project: project };
    }

    throw new Error('Unknown format');
  }

  function download(data, filename) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  window.Projects = {
    sync: sync,
    getAll: getAll,
    save: save,
    remove: remove,
    find: find,
    rename: rename,
    exportProject: exportProject,
    exportAll: exportAll,
    importData: importData,
    download: download
  };
})();
