/**
 * app.js — Main application: wiring, event handlers, initialization
 */
(function () {
  'use strict';

  const $ = UI.$;

  // Ensure App namespace exists early
  window.App = window.App || {};

  // ─── State ───
  let currentProject = null;
  let fontSize = 14;

  // ─── DOM refs ───
  const editor = $('editor');
  const hlLayer = $('highlightLayer');
  const lineNums = $('lineNumbers');
  const playBtn = $('playBtn');
  const cpsInput = $('cpsInput');

  const DEFAULT_CODE = `// strudel REPL
// Press Play to start!

note("c3 [e3 g3] a3 <f3 d3>")
  .s("piano")
  .room(0.4)
  .slow(2)`;

  // ═══════════════════════════════════════
  //  EDITOR — sync highlight + scroll
  // ═══════════════════════════════════════
  function syncHighlight() {
    hlLayer.innerHTML = Highlight.highlight(editor.value) + '\n';
    updateLineNumbers();
  }

  function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) {
      html += '<span class="ln">' + i + '</span>';
    }
    lineNums.innerHTML = html;
  }

  editor.addEventListener('scroll', () => {
    hlLayer.scrollTop = editor.scrollTop;
    hlLayer.scrollLeft = editor.scrollLeft;
    lineNums.style.transform = 'translateY(-' + editor.scrollTop + 'px)';
  });
  editor.addEventListener('input', () => {
    syncHighlight();
    $('charCount').textContent = editor.value.length + ' chars';
  });

  // Tab key inserts 2 spaces
  editor.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, s) + '  ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = s + 2;
      editor.dispatchEvent(new Event('input'));
    }
  });

  // ═══════════════════════════════════════
  //  TRANSPORT CONTROLS
  // ═══════════════════════════════════════
  function getCps() {
    return parseFloat(cpsInput.value) || 1;
  }

  async function doPlay() {
    if (!Engine.ready) {
      UI.toast('Engine still loading...', 'info');
      return;
    }

    // Toggle off
    if (Engine.playing) {
      Engine.stop();
      Engine.playing = false;
      playBtn.classList.remove('active');
      playBtn.textContent = '▶ Play';
      UI.setStatus('ok', 'Stopped');
      UI.stopBeatAnimation();
      UI.addLog('Stopped', 'info');
      return;
    }

    const code = editor.value.trim();
    if (!code) {
      UI.toast('Write some code first!', 'info');
      return;
    }

    try {
      UI.addLog('Evaluating...', 'info');
      await Engine.evalCode(code, getCps());
      playBtn.classList.add('active');
      playBtn.textContent = '⏹ Stop';
      UI.setStatus('on', 'Playing');
      UI.addLog('Playing!', 'ok');
      UI.startBeatAnimation(getCps);
    } catch (e) {
      console.error('[App] Play error:', e);
      UI.toast(e.message || 'Error', 'error');
      UI.setStatus('err', 'Error');
      UI.addLog('ERROR: ' + (e.message || e), 'err');
    }
  }

  async function doEval() {
    if (!Engine.ready) {
      UI.toast('Engine still loading...', 'info');
      return;
    }

    const code = editor.value.trim();
    if (!code) return;

    try {
      UI.addLog('Re-evaluating...', 'info');
      await Engine.evalCode(code, getCps());
      playBtn.classList.add('active');
      playBtn.textContent = '⏹ Stop';
      UI.setStatus('on', 'Updated');
      UI.toast('Pattern updated', 'success');
      UI.addLog('Pattern updated', 'ok');
      UI.startBeatAnimation(getCps);
    } catch (e) {
      console.error('[App] Eval error:', e);
      UI.toast(e.message || 'Error', 'error');
      UI.setStatus('err', 'Error');
      UI.addLog('ERROR: ' + (e.message || e), 'err');
    }
  }

  function doHush() {
    Engine.stop();
    Engine.playing = false;
    playBtn.classList.remove('active');
    playBtn.textContent = '▶ Play';
    UI.setStatus('ok', 'Hushed');
    UI.stopBeatAnimation();
    UI.addLog('Hushed', 'info');
  }

  playBtn.onclick = doPlay;
  $('evalBtn').onclick = doEval;
  $('hushBtn').onclick = doHush;

  // CPS live update
  cpsInput.onchange = () => {
    if (!Engine.ready || !Engine.playing) return;
    const v = getCps();
    try {
      var fn = window.setcps || window.setCps;
      if (typeof fn === 'function') fn(v);
      UI.addLog('CPS → ' + v, 'info');
    } catch (e) {
      console.warn('[App] CPS change error:', e);
    }
  };

  // ═══════════════════════════════════════
  //  KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doEval(); }
    if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); doHush(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); }
  });

  // ═══════════════════════════════════════
  //  SNIPPETS
  // ═══════════════════════════════════════
  document.querySelectorAll('.snippet-btn').forEach(btn => {
    btn.onclick = () => {
      const sn = btn.dataset.s;
      const pos = editor.selectionStart;
      const before = editor.value.substring(0, pos);
      const after = editor.value.substring(editor.selectionEnd);
      editor.value = before + sn + after;

      // Smart cursor placement
      let cur = sn.length;
      const dq = sn.indexOf('""');
      const sq = sn.indexOf("''");
      if (dq !== -1) cur = dq + 1;
      else if (sq !== -1) cur = sq + 1;
      else {
        const op = sn.lastIndexOf('(');
        const cl = sn.lastIndexOf(')');
        if (op !== -1 && cl !== -1 && cl - op > 1) cur = op + 1;
      }
      editor.selectionStart = editor.selectionEnd = pos + cur;
      editor.focus();
      editor.dispatchEvent(new Event('input'));
    };
  });

  // ═══════════════════════════════════════
  //  PANEL BUTTONS
  // ═══════════════════════════════════════
  $('btnProjects').onclick = () => { renderProjectList(); UI.openPanel('projectsPanel'); };
  $('btnExamples').onclick = () => { renderExamples(); UI.openPanel('examplesPanel'); };
  $('btnConsole').onclick = () => UI.openPanel('consolePanel');
  $('btnSettings').onclick = () => UI.openPanel('settingsPanel');

  // ═══════════════════════════════════════
  //  PROJECTS
  // ═══════════════════════════════════════
  function saveProject() {
    const code = editor.value;
    const cps = getCps();

    if (currentProject) {
      // Existing project — just save
      currentProject = Projects.save({
        id: currentProject.id,
        name: currentProject.name,
        code,
        cps
      });
      renderProjectList();
      UI.toast('Project saved', 'success');
      UI.addLog('Saved: ' + currentProject.name, 'ok');
    } else {
      // New project — ask for a name first
      showSaveAsDialog(code, cps);
    }
  }

  function showSaveAsDialog(code, cps) {
    const label = $('projectNameLabel').textContent || '';
    $('saveAsInput').value = (label === 'untitled') ? '' : label;
    UI.showDialog('saveAsDialog');
    setTimeout(() => { $('saveAsInput').focus(); $('saveAsInput').select(); }, 100);

    // Store pending save data
    window._pendingSave = { code, cps };
  }

  window.App.hideSaveAs = function () { UI.hideDialog('saveAsDialog'); };
  window.App.doSaveAs = function () {
    const name = $('saveAsInput').value.trim() || 'untitled';
    const pending = window._pendingSave;
    if (!pending) return;

    currentProject = Projects.save({ name: name, code: pending.code, cps: pending.cps });
    $('projectNameLabel').textContent = currentProject.name;
    window._pendingSave = null;
    UI.hideDialog('saveAsDialog');
    renderProjectList();
    UI.toast('Project saved', 'success');
    UI.addLog('Saved: ' + currentProject.name, 'ok');
  };

  function newProject() {
    doHush();
    editor.value = '';
    cpsInput.value = '1';
    currentProject = null;
    $('projectNameLabel').textContent = 'untitled';
    UI.closePanel('projectsPanel');
    editor.focus();
    editor.dispatchEvent(new Event('input'));
  }

  function loadProject(id) {
    const p = Projects.find(id);
    if (!p) return;
    doHush();
    editor.value = p.code || '';
    cpsInput.value = p.cps || '1';
    currentProject = p;
    $('projectNameLabel').textContent = p.name;
    UI.setStatus('ok', 'Loaded');
    editor.dispatchEvent(new Event('input'));
    UI.closePanel('projectsPanel');
    UI.toast('Loaded: ' + p.name, 'success');
  }

  function deleteProject(id, ev) {
    ev.stopPropagation();
    if (!confirm('Delete this project?')) return;
    Projects.remove(id);
    if (currentProject && currentProject.id === id) {
      currentProject = null;
      $('projectNameLabel').textContent = 'untitled';
    }
    renderProjectList();
    UI.toast('Deleted', 'info');
  }

  function renderProjectList() {
    const projects = Projects.getAll();
    const el = $('projectList');

    if (!projects.length) {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-dim);font-size:13px">No saved projects.<br>Press Save to create one.</div>';
      return;
    }

    el.innerHTML = projects.map(p => {
      const date = new Date(p.modified).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const preview = (p.code || '').split('\n').find(l => l.trim() && !l.trim().startsWith('//')) || '';
      const isCurrent = currentProject && currentProject.id === p.id;

      return '<div class="project-item ' + (isCurrent ? 'current' : '') + '" onclick="App.loadProject(\'' + p.id + '\')">' +
        '<div style="flex:1;min-width:0">' +
          '<div class="project-name-text">' + (isCurrent ? '● ' : '') + Highlight.esc(p.name) + '</div>' +
          '<div class="project-meta">' + date + ' · ' + (p.cps || 1) + ' CPS</div>' +
          '<div class="project-preview">' + Highlight.esc(preview) + '</div>' +
        '</div>' +
        '<button class="project-delete" onclick="App.deleteProject(\'' + p.id + '\',event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
      '</div>';
    }).join('');
  }

  // Expose for inline handlers
  window.App.loadProject = loadProject;
  window.App.deleteProject = deleteProject;

  // ═══════════════════════════════════════
  //  IMPORT / EXPORT
  // ═══════════════════════════════════════
  function exportCurrent() {
    const name = currentProject ? currentProject.name : 'untitled';
    Projects.download(
      Projects.exportProject({
        name,
        code: editor.value,
        cps: getCps()
      }),
      name + '.strudel.json'
    );
    UI.toast('Exported', 'success');
  }

  function exportAllProjects() {
    const all = Projects.getAll();
    if (!all.length) { UI.toast('No projects', 'info'); return; }
    Projects.download(Projects.exportAll(), 'strudel-projects.json');
    UI.toast('Exported ' + all.length + ' projects', 'success');
  }

  $('fileInput').onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        const result = Projects.importData(data);
        if (result.type === 'bundle') {
          renderProjectList();
          UI.toast('Imported ' + result.count + ' projects', 'success');
        } else if (result.type === 'single') {
          currentProject = result.project;
          editor.value = result.project.code || '';
          cpsInput.value = result.project.cps || '1';
          $('projectNameLabel').textContent = result.project.name;
          editor.dispatchEvent(new Event('input'));
          renderProjectList();
          UI.toast('Imported: ' + result.project.name, 'success');
        }
      } catch (err) {
        UI.toast('Import error: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Wire panel action buttons
  window.App.saveProject = saveProject;
  window.App.newProject = newProject;
  window.App.exportCurrent = exportCurrent;
  window.App.exportAll = exportAllProjects;
  window.App.triggerImport = () => $('fileInput').click();

  // ═══════════════════════════════════════
  //  EXAMPLES
  // ═══════════════════════════════════════
  let exampleTab = Object.keys(Examples)[0];

  function renderExamples() {
    const tabs = Object.keys(Examples);
    $('exampleTabs').innerHTML = tabs.map(k =>
      '<button class="tab-btn ' + (k === exampleTab ? 'active' : '') + '" onclick="App.setExampleTab(\'' + k + '\')">' + k + '</button>'
    ).join('');

    $('exampleList').innerHTML = (Examples[exampleTab] || []).map((ex, i) =>
      '<div class="example-item" onclick="App.loadExample(\'' + exampleTab + '\',' + i + ')">' +
        '<div class="example-name">' + Highlight.esc(ex.name) + '</div>' +
        '<div class="example-desc">' + Highlight.esc(ex.desc) + '</div>' +
        '<div class="example-code">' + Highlight.esc(ex.code.split('\n')[0]) + '</div>' +
      '</div>'
    ).join('');
  }

  window.App.setExampleTab = function (tab) {
    exampleTab = tab;
    renderExamples();
  };

  window.App.loadExample = function (cat, idx) {
    const ex = Examples[cat][idx];
    if (!ex) return;
    doHush();
    editor.value = ex.code;
    cpsInput.value = '1';
    currentProject = null;
    $('projectNameLabel').textContent = ex.name;
    UI.setStatus('ok', 'Example loaded');
    editor.dispatchEvent(new Event('input'));
    UI.closePanel('examplesPanel');
    UI.toast('Loaded: ' + ex.name, 'success');
  };

  // ═══════════════════════════════════════
  //  SOUNDS PANEL
  // ═══════════════════════════════════════
  const SYNTH_SOUNDS = ['sawtooth', 'square', 'triangle', 'sine'];
  let soundTab = 'samples';
  let soundSearchQuery = '';

  $('btnSounds').onclick = () => { renderSounds(); UI.openPanel('soundsPanel'); };

  $('soundSearch').oninput = function () {
    soundSearchQuery = this.value.toLowerCase().trim();
    renderSoundList();
  };

  function getSoundCategories() {
    const sounds = Engine.sounds || {};
    const categories = {
      samples: {},
      'drum-machines': {},
      synths: {},
    };

    // Separate drum machine sounds from regular samples
    for (const [name, count] of Object.entries(sounds)) {
      // Drum machine sounds have format "MachineName_type"
      if (name.includes('_') && /^[A-Z]/.test(name)) {
        const bank = name.split('_')[0];
        if (!categories['drum-machines'][bank]) categories['drum-machines'][bank] = [];
        categories['drum-machines'][bank].push({ name, count });
      } else {
        categories.samples[name] = count;
      }
    }

    // Add built-in synths
    SYNTH_SOUNDS.forEach(s => { categories.synths[s] = 1; });

    return categories;
  }

  function renderSounds() {
    const tabs = ['samples', 'drum-machines', 'synths'];
    $('soundTabs').innerHTML = tabs.map(k =>
      '<button class="tab-btn ' + (k === soundTab ? 'active' : '') + '" onclick="App.setSoundTab(\'' + k + '\')">' + k + '</button>'
    ).join('');
    renderSoundList();
  }

  function renderSoundList() {
    const categories = getSoundCategories();
    const list = $('soundList');
    const q = soundSearchQuery;

    if (soundTab === 'samples') {
      const items = Object.entries(categories.samples)
        .filter(([name]) => !q || name.toLowerCase().includes(q))
        .sort((a, b) => a[0].localeCompare(b[0]));

      if (!items.length) {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-dim)">No samples loaded yet.<br>Press Play first to load sounds.</div>';
        return;
      }

      list.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:2px 6px">' +
        items.map(([name, count]) =>
          '<span class="sound-item" onclick="App.insertSound(\'' + name + '\')" title="' + count + ' sample(s)">' +
          name + '<span style="color:var(--text-faint)">(' + count + ')</span></span>'
        ).join(' ') + '</div>';
    } else if (soundTab === 'drum-machines') {
      const banks = Object.entries(categories['drum-machines'])
        .filter(([bank]) => !q || bank.toLowerCase().includes(q))
        .sort((a, b) => a[0].localeCompare(b[0]));

      if (!banks.length) {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-dim)">No drum machines loaded yet.</div>';
        return;
      }

      list.innerHTML = banks.map(([bank, sounds]) =>
        '<div style="margin-bottom:8px"><span style="color:var(--blue);font-weight:600">' + bank + '</span>' +
        '<span style="color:var(--text-faint)"> (' + sounds.length + ')</span>' +
        '<div style="display:flex;flex-wrap:wrap;gap:2px 6px;margin-top:2px">' +
        sounds.map(s =>
          '<span class="sound-item" onclick="App.insertSound(\'' + s.name + '\')">' +
          s.name.split('_').slice(1).join('_') + '</span>'
        ).join(' ') + '</div></div>'
      ).join('');
    } else if (soundTab === 'synths') {
      const items = SYNTH_SOUNDS.filter(s => !q || s.includes(q));
      list.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:2px 6px">' +
        items.map(name =>
          '<span class="sound-item" onclick="App.insertSound(\'' + name + '\')">' + name + '</span>'
        ).join(' ') + '</div>';
    }
  }

  window.App.setSoundTab = function (tab) {
    soundTab = tab;
    renderSounds();
  };

  window.App.insertSound = function (name) {
    const pos = editor.selectionStart;
    editor.value = editor.value.substring(0, pos) + name + editor.value.substring(editor.selectionEnd);
    editor.selectionStart = editor.selectionEnd = pos + name.length;
    editor.focus();
    editor.dispatchEvent(new Event('input'));
    UI.closePanel('soundsPanel');
  };

  // ═══════════════════════════════════════
  //  RENAME DIALOG
  // ═══════════════════════════════════════
  $('projectNameLabel').onclick = () => {
    $('renameInput').value = currentProject ? currentProject.name : ($('projectNameLabel').textContent || 'untitled');
    UI.showDialog('renameDialog');
    setTimeout(() => $('renameInput').focus(), 100);
  };

  window.App.hideRename = function () { UI.hideDialog('renameDialog'); };
  window.App.doRename = function () {
    const name = $('renameInput').value.trim() || 'untitled';
    $('projectNameLabel').textContent = name;
    if (currentProject) {
      Projects.rename(currentProject.id, name);
      currentProject.name = name;
    }
    UI.hideDialog('renameDialog');
  };

  $('renameDialog').onclick = e => { if (e.target === $('renameDialog')) UI.hideDialog('renameDialog'); };
  $('renameInput').onkeydown = e => {
    if (e.key === 'Enter') window.App.doRename();
    if (e.key === 'Escape') window.App.hideRename();
  };

  $('saveAsDialog').onclick = e => { if (e.target === $('saveAsDialog')) window.App.hideSaveAs(); };
  $('saveAsInput').onkeydown = e => {
    if (e.key === 'Enter') window.App.doSaveAs();
    if (e.key === 'Escape') window.App.hideSaveAs();
  };

  // ═══════════════════════════════════════
  //  AUTH
  // ═══════════════════════════════════════
  let authMode = 'login'; // 'login' or 'register'

  function updateUserUI() {
    const user = Auth.currentUser();
    const btn = $('userBtn');
    const label = $('userLabel');
    if (user) {
      label.textContent = user.username;
      btn.classList.add('logged-in');
    } else {
      label.textContent = 'Sign in';
      btn.classList.remove('logged-in');
    }
  }

  $('userBtn').onclick = () => {
    if (Auth.isLoggedIn()) {
      // Show logout option
      if (confirm('Sign out of ' + Auth.currentUser().username + '?')) {
        Auth.logout();
        currentProject = null;
        editor.value = DEFAULT_CODE;
        cpsInput.value = '1';
        $('projectNameLabel').textContent = 'untitled';
        editor.dispatchEvent(new Event('input'));
        renderProjectList();
        updateUserUI();
        UI.toast('Signed out', 'info');
      }
    } else {
      authMode = 'login';
      $('authTitle').textContent = 'Sign In';
      $('authSubmit').textContent = 'Sign In';
      $('authToggle').textContent = 'Create account';
      $('authError').textContent = '';
      $('authUsername').value = '';
      $('authPassword').value = '';
      UI.showDialog('authDialog');
      setTimeout(() => $('authUsername').focus(), 100);
    }
  };

  window.App.toggleAuthMode = function () {
    authMode = authMode === 'login' ? 'register' : 'login';
    $('authTitle').textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
    $('authSubmit').textContent = authMode === 'login' ? 'Sign In' : 'Register';
    $('authToggle').textContent = authMode === 'login' ? 'Create account' : 'Already have an account';
    $('authError').textContent = '';
  };

  window.App.doAuth = function () {
    const username = $('authUsername').value.trim();
    const password = $('authPassword').value;
    const result = authMode === 'login' ? Auth.login(username, password) : Auth.register(username, password);

    if (result.ok) {
      UI.hideDialog('authDialog');
      updateUserUI();
      // Reload projects for this user
      currentProject = null;
      const userProjects = Projects.getAll();
      if (userProjects.length > 0) {
        // Load the most recent project
        const latest = userProjects[0];
        editor.value = latest.code || '';
        cpsInput.value = latest.cps || '1';
        currentProject = latest;
        $('projectNameLabel').textContent = latest.name;
      } else {
        editor.value = DEFAULT_CODE;
        cpsInput.value = '1';
        $('projectNameLabel').textContent = 'untitled';
      }
      editor.dispatchEvent(new Event('input'));
      renderProjectList();
      UI.toast(authMode === 'login' ? 'Welcome back, ' + username : 'Account created!', 'success');
    } else {
      $('authError').textContent = result.error;
    }
  };

  $('authDialog').onclick = e => { if (e.target === $('authDialog')) UI.hideDialog('authDialog'); };
  $('authUsername').onkeydown = e => { if (e.key === 'Enter') $('authPassword').focus(); };
  $('authPassword').onkeydown = e => {
    if (e.key === 'Enter') window.App.doAuth();
    if (e.key === 'Escape') UI.hideDialog('authDialog');
  };

  // ═══════════════════════════════════════
  //  FONT SIZE
  // ═══════════════════════════════════════
  window.App.adjustFont = function (delta) {
    fontSize = Math.max(10, Math.min(24, fontSize + delta));
    editor.style.fontSize = fontSize + 'px';
    hlLayer.style.fontSize = fontSize + 'px';
    lineNums.style.fontSize = fontSize + 'px';
    $('fontSizeValue').textContent = fontSize;
    Storage.set('strudel_fs', fontSize);
  };

  // ═══════════════════════════════════════
  //  CONSOLE
  // ═══════════════════════════════════════
  window.App.clearConsole = UI.clearConsole;

  // ═══════════════════════════════════════
  //  SESSION PERSISTENCE
  // ═══════════════════════════════════════
  function saveSession() {
    Storage.set('strudel_session', {
      code: editor.value,
      cps: cpsInput.value,
      fs: fontSize,
      pid: currentProject ? currentProject.id : null,
      pn: $('projectNameLabel').textContent
    });
  }

  function loadSession() {
    const s = Storage.get('strudel_session');
    if (!s) return false;
    if (s.code) editor.value = s.code;
    if (s.cps) cpsInput.value = s.cps;
    if (s.fs) { fontSize = s.fs; window.App.adjustFont(0); }
    if (s.pid) {
      const p = Projects.find(s.pid);
      if (p) { currentProject = p; $('projectNameLabel').textContent = p.name; }
      else if (s.pn) $('projectNameLabel').textContent = s.pn;
    }
    return !!s.code;
  }

  // ═══════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════
  (function init() {
    // Restore user session
    updateUserUI();

    // Restore font size
    const savedFs = Storage.get('strudel_fs');
    if (savedFs) { fontSize = savedFs; window.App.adjustFont(0); }

    // Load session or default
    if (!loadSession()) editor.value = DEFAULT_CODE;
    editor.dispatchEvent(new Event('input'));

    // Init beat bar
    UI.initBeatBar();

    // Auto-save every 4 seconds
    setInterval(saveSession, 4000);

    // Intercept console
    const origError = console.error;
    console.error = function (...args) {
      UI.addLog(args.join(' '), 'err');
      origError.apply(console, args);
    };

    // Boot engine
    UI.addLog('Starting Strudel engine...', 'info');
    Engine.boot(msg => {
      $('loadingMessage').textContent = msg;
      UI.addLog(msg, 'info');
    }).then(() => {
      UI.setStatus('ok', 'Ready');
      $('samplesStatus').textContent = '✓ loaded';
      const ctx = Engine.audioContext;
      $('audioStatus').textContent = ctx ? ctx.state : '—';
      $('loadingScreen').classList.add('bye');
      setTimeout(() => $('loadingScreen').style.display = 'none', 500);
      UI.toast('Engine ready — press Play!', 'success');
      UI.addLog('Engine ready. Samples loaded.', 'ok');
    }).catch(e => {
      UI.setStatus('err', 'Engine error');
      $('loadingMessage').textContent = 'Error: ' + e.message;
      $('samplesStatus').textContent = '✗';
      $('audioStatus').textContent = 'error';
      UI.addLog('BOOT ERROR: ' + e.message, 'err');
      setTimeout(() => {
        $('loadingScreen').classList.add('bye');
        setTimeout(() => $('loadingScreen').style.display = 'none', 500);
      }, 2500);
      UI.toast('Engine error: ' + e.message, 'error');
    });
  })();
})();
