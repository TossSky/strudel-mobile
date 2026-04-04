/**
 * ui.js — UI helpers: toast, panels, dialogs, beat indicator, console
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  // ═══ TOAST ═══
  let toastTimer;
  function toast(message, type) {
    type = type || 'info';
    const el = $('toast');
    el.textContent = message;
    el.className = 'toast visible ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.className = 'toast', 3000);
  }

  // ═══ PANELS ═══
  function openPanel(id) {
    $(id).classList.add('show');
  }
  function closePanel(id) {
    $(id).classList.remove('show');
  }

  // Close panels on overlay click
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.overlay').forEach(ov => {
      ov.addEventListener('click', e => {
        if (e.target === ov) ov.classList.remove('show');
      });
    });
  });

  // ═══ STATUS BAR ═══
  function setStatus(type, message) {
    $('statusDot').className = 'status-dot ' + type;
    $('statusText').textContent = message;
  }

  // ═══ CYCLE PROGRESS BAR ═══
  let beatFrame = null;
  let barFill = null;
  let barCursor = null;

  function initBeatBar() {
    const bar = $('beatBar');
    if (!bar) return;
    bar.innerHTML = '';
    barFill = document.createElement('div');
    barFill.className = 'beat-bar-fill';
    bar.appendChild(barFill);
    barCursor = document.createElement('div');
    barCursor.className = 'beat-bar-cursor';
    bar.appendChild(barCursor);
  }

  // ═══ HAP HIGHLIGHT STATE ═══
  let visibleHaps = [];
  let lastQueryTime = null;

  /**
   * Walk text nodes inside a DOM element and find the node + local offset
   * for a given absolute character offset (0-based).
   */
  function findTextPosition(root, targetOffset) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var current = 0;
    var node;
    while ((node = walker.nextNode())) {
      var len = node.length;
      if (current + len > targetOffset) {
        return { node: node, offset: targetOffset - current };
      }
      current += len;
    }
    // Offset at the very end — return last text node's end
    if (node) return { node: node, offset: node.length };
    return null;
  }

  function startBeatAnimation(getCps) {
    cancelAnimationFrame(beatFrame);
    visibleHaps = [];
    lastQueryTime = null;

    function tick() {
      const ctx = window.Engine && window.Engine.audioContext;
      if (!ctx || !window.Engine.playing) {
        stopBeatAnimation();
        return;
      }

      // Try to read cycle phase & CPS directly from Strudel scheduler
      var scheduler = typeof window.getScheduler === 'function' ? window.getScheduler() : null;
      var cps, currentCycle;

      if (scheduler && scheduler.origin != null && scheduler.cps) {
        cps = scheduler.cps;
        if (typeof scheduler.getPhase === 'function') {
          currentCycle = scheduler.getPhase();
        } else {
          currentCycle = (ctx.currentTime - scheduler.origin) * scheduler.cps;
        }
      } else {
        // Fallback: use playOrigin + activeCps from Engine
        var uiCps = getCps();
        cps = (window.Engine && window.Engine.activeCps) || uiCps;
        var origin = (window.Engine && window.Engine.playOrigin) || 0;
        currentCycle = (ctx.currentTime - origin) * cps;
      }

      var cyclePos = ((currentCycle % 1) + 1) % 1;
      var totalCycles = Math.floor(currentCycle);
      var pct = (cyclePos * 100).toFixed(1);

      if (barFill) barFill.style.width = pct + '%';
      if (barCursor) barCursor.style.left = 'calc(' + pct + '% - 1.5px)';

      // ─── Hap-based highlights (throttled to ~30fps) ───
      if (!tick._lastHl || ctx.currentTime - tick._lastHl > 0.033) {
        tick._lastHl = ctx.currentTime;
        renderHapHighlights(currentCycle, cps);
      }

      const cc = $('cycleCounter');
      if (cc) cc.textContent = 'cycle ' + totalCycles;

      beatFrame = requestAnimationFrame(tick);
    }

    beatFrame = requestAnimationFrame(tick);
  }

  /**
   * Query the Strudel scheduler for active haps and render highlight rectangles
   * over the corresponding source code locations.
   */
  function renderHapHighlights(currentCycle, cps) {
    const container = $('hapHighlights');
    const editor = $('editor');
    if (!container || !editor) return;

    const pattern = window.Engine && window.Engine.pattern;
    if (!pattern || !pattern.queryArc) {
      container.innerHTML = '';
      return;
    }

    // Use the exact code that was evaluated (offsets are relative to it)
    const evalCode = (window.Engine && window.Engine.evaluatedCode) || '';
    // The editor may have leading whitespace that was trimmed — compute the offset
    const editorVal = editor.value || '';
    var trimOffset = 0;
    if (evalCode && editorVal !== evalCode) {
      var idx = editorVal.indexOf(evalCode);
      if (idx >= 0) trimOffset = idx;
    }
    const code = evalCode;
    const lookBehind = 1 / 10;
    const queryEnd = currentCycle;
    const queryBegin = Math.max(0, lastQueryTime !== null ? lastQueryTime : currentCycle - lookBehind);

    try {
      const newHaps = pattern.queryArc(queryBegin, queryEnd);
      lastQueryTime = queryEnd;

      const onsetHaps = newHaps.filter(function (h) { return h.hasOnset && h.hasOnset(); });
      visibleHaps = visibleHaps.concat(onsetHaps);

      // Keep haps whose whole hasn't ended yet
      visibleHaps = visibleHaps.filter(function (h) {
        return h.whole && h.whole.end >= currentCycle - lookBehind;
      });
    } catch (e) {
      // queryArc can throw if pattern is invalid
    }

    // Collect char-offset locations from visible haps
    const rects = [];
    for (var hi = 0; hi < visibleHaps.length; hi++) {
      var hap = visibleHaps[hi];
      var locs = hap.context && hap.context.locations;
      if (!locs || !locs.length) continue;
      var isOnset = hap.whole && currentCycle >= hap.whole.begin && currentCycle < hap.whole.begin + 0.06;
      for (var li = 0; li < locs.length; li++) {
        var loc = locs[li];
        // loc is {start: charOffset, end: charOffset} — absolute offsets in source code
        if (typeof loc.start !== 'number' || typeof loc.end !== 'number') continue;
        rects.push({ start: loc.start, end: loc.end, onset: isOnset });
      }
    }

    // Deduplicate
    var seen = {};
    var uniqueRects = [];
    for (var ri = 0; ri < rects.length; ri++) {
      var key = rects[ri].start + ':' + rects[ri].end;
      if (!seen[key]) {
        seen[key] = true;
        uniqueRects.push(rects[ri]);
      }
    }

    // Use Range API on highlightLayer for pixel-perfect positioning
    var hl = $('highlightLayer');
    if (!hl) { container.innerHTML = ''; return; }
    var containerRect = container.getBoundingClientRect();

    var html = '';
    for (var ui = 0; ui < uniqueRects.length; ui++) {
      var r = uniqueRects[ui];
      var adjStart = r.start + trimOffset;
      var adjEnd = r.end + trimOffset;

      var startPos = findTextPosition(hl, adjStart);
      var endPos = findTextPosition(hl, adjEnd);
      if (!startPos || !endPos) continue;

      var range = document.createRange();
      try {
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
      } catch (e) { continue; }

      var clientRects = range.getClientRects();
      var cls = r.onset ? 'hap-hl onset' : 'hap-hl';
      for (var ri = 0; ri < clientRects.length; ri++) {
        var cr = clientRects[ri];
        if (cr.width < 1 || cr.height < 1) continue;
        html += '<div class="' + cls + '" style="top:' + (cr.top - containerRect.top) + 'px;left:' + (cr.left - containerRect.left) + 'px;width:' + cr.width + 'px;height:' + cr.height + 'px"></div>';
      }
    }

    container.innerHTML = html;
  }

  function stopBeatAnimation() {
    cancelAnimationFrame(beatFrame);
    if (barFill) barFill.style.width = '0%';
    if (barCursor) barCursor.style.left = '0%';
    visibleHaps = [];
    lastQueryTime = null;
    const container = $('hapHighlights');
    if (container) container.innerHTML = '';
    const cc = $('cycleCounter');
    if (cc) cc.textContent = '';
  }

  // ═══ CONSOLE LOG ═══
  const logs = [];
  function addLog(msg, type) {
    type = type || 'info';
    logs.push({ msg: String(msg), type, time: new Date() });
    if (logs.length > 200) logs.shift();
    renderConsole();
  }

  function renderConsole() {
    const el = $('consoleLog');
    if (!el) return;
    el.innerHTML = logs.slice(-60).map(l => {
      const t = l.time.toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return '<div class="log-' + l.type + '"><span style="color:var(--text-faint)">' + t + '</span> ' + Highlight.esc(l.msg) + '</div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function clearConsole() {
    logs.length = 0;
    renderConsole();
  }

  // ═══ DIALOG ═══
  function showDialog(id) {
    $(id).classList.add('show');
  }
  function hideDialog(id) {
    $(id).classList.remove('show');
  }

  window.UI = {
    $,
    toast,
    openPanel,
    closePanel,
    setStatus,
    initBeatBar,
    startBeatAnimation,
    stopBeatAnimation,
    addLog,
    clearConsole,
    showDialog,
    hideDialog
  };
})();
