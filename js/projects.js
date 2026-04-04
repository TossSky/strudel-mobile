/**
 * projects.js — Project management (CRUD, import/export)
 */
(function () {
  'use strict';

  function storageKey() {
    return (window.Auth && window.Auth.projectsKey) ? window.Auth.projectsKey() : 'strudel_projects';
  }

  function getAll() {
    return window.Storage.get(storageKey()) || [];
  }

  function saveAll(projects) {
    window.Storage.set(storageKey(), projects);
  }

  function save(project) {
    const now = new Date().toISOString();
    const projects = getAll();

    if (project.id) {
      const idx = projects.findIndex(p => p.id === project.id);
      if (idx !== -1) {
        projects[idx] = { ...projects[idx], ...project, modified: now };
        saveAll(projects);
        return projects[idx];
      }
    }

    // New project
    const newProject = {
      id: 'p' + Date.now(),
      name: project.name || 'untitled',
      code: project.code || '',
      cps: project.cps || 1,
      created: now,
      modified: now
    };
    projects.unshift(newProject);
    saveAll(projects);
    return newProject;
  }

  function remove(id) {
    saveAll(getAll().filter(p => p.id !== id));
  }

  function find(id) {
    return getAll().find(p => p.id === id) || null;
  }

  function rename(id, newName) {
    const projects = getAll();
    const idx = projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      projects[idx].name = newName;
      projects[idx].modified = new Date().toISOString();
      saveAll(projects);
      return projects[idx];
    }
    return null;
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
      projects: getAll(),
      exported: new Date().toISOString()
    };
  }

  function importData(data) {
    if (data.type === 'strudel-bundle' && Array.isArray(data.projects)) {
      const existing = getAll();
      let count = 0;
      for (const p of data.projects) {
        if (!existing.find(x => x.id === p.id)) {
          existing.push({ ...p, id: 'p' + Date.now() + '_' + count });
          count++;
        }
      }
      saveAll(existing);
      return { type: 'bundle', count };
    }

    if (data.code !== undefined) {
      const p = save({
        name: data.name || 'imported',
        code: data.code,
        cps: data.cps || 1
      });
      return { type: 'single', project: p };
    }

    throw new Error('Unknown format');
  }

  function download(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  window.Projects = {
    getAll,
    save,
    remove,
    find,
    rename,
    exportProject,
    exportAll,
    importData,
    download
  };
})();
