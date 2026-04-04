/**
 * engine.js — Strudel audio engine wrapper
 * Handles loading, initialization, evaluation, and AudioContext management
 */
(function () {
  'use strict';

  let ready = false;
  let playing = false;
  let audioCtx = null;

  const STRUDEL_URL = 'https://unpkg.com/@strudel/web@1.0.3';

  // Sample sources
  const DIRT_SAMPLES = 'github:tidalcycles/dirt-samples';
  // Local JSON files (avoid CORS issues with strudel.cc)
  const PIANO_JSON = 'samples/piano.json';
  const DRUM_MACHINES_JSON = 'samples/tidal-drum-machines.json';
  const DRUM_MACHINES_BASE = 'https://raw.githubusercontent.com/ritchse/tidal-drum-machines/main/machines/';
  const VCSL_JSON = 'samples/vcsl.json';
  const VCSL_BASE = 'https://raw.githubusercontent.com/sgossner/VCSL/master/';

  // All loaded sample names (populated after boot)
  let loadedSounds = {};

  // Current pattern (captured by patching Pattern.prototype.play)
  let currentPattern = null;
  // The exact code string passed to evaluate (offsets are relative to this)
  let evaluatedCode = '';
  // Actual CPS as set by the strudel scheduler (may differ from UI input)
  let activeCps = 1;
  // AudioContext.currentTime at the moment playback first starts
  let playOrigin = 0;

  // Known dirt-samples (from github:tidalcycles/dirt-samples)
  const DIRT_SAMPLE_NAMES = [
    '808','808bd','808cy','808hc','808ht','808lc','808lt','808mc','808mt','808oh','808sd','909',
    'ab','ade','ades2','ades3','ades4','alex','alphabet','amencutup','armora','arp','arpy','auto',
    'baa','baa2','bass','bass0','bass1','bass2','bass3','bassdm','bassfoo','battles','bd','bend',
    'bev','bin','birds','birds3','bleep','blip','blue','bottle','breaks125','breaks152','breaks157',
    'breaks165','breath','bubble','can','casio','cb','cc','chin','circus','clak','click','clubkick',
    'co','coins','control','cosmicg','cp','cr','crow','d','db','diphone','diphone2','dist','dork2',
    'dorkbot','dr','dr2','dr55','dr_few','drum','drumtraks','e','east','electro1','em2','erk','f',
    'feel','feelfx','fest','fire','flick','fm','foo','future','gab','gabba','gabbaloud','gabbalouder',
    'glasstap','glitch','glitch2','gretsch','gtr','h','hand','hardcore','hardkick','haw','hc','hh',
    'hh27','hit','hmm','ho','hoover','house','ht','if','ifdrums','incoming','industrial','insect',
    'invaders','jazz','jungbass','jungle','juno','jvbass','kicklinn','koy','kurt','latibro','led',
    'less','lighter','linnhats','lt','made','made2','mash','mash2','metal','miniyeah','monsterb',
    'moog','mouth','mp3','msg','mt','mute','newnotes','noise','noise2','notes','num','numbers',
    'oc','odx','off','outdoor','pad','padlong','pebbles','perc','peri','pluck','popkick','print',
    'proc','procshort','psr','rave','rave2','ravemono','realclaps','reverbkick','rm','rs','sax',
    'sd','seawolf','sequential','sf','sheffield','short','sid','simplesine','sitar','sn','space',
    'speakspell','speech','speechless','speedupdown','stab','stomp','subroc3d','sugar','sundance',
    'tabla','tabla2','tablex','tacscan','tech','techno','tink','tok','toys','trump','ul','ulgab',
    'uxay','v','voodoo','wind','wobble','world','xmas','yeah'
  ];

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load: ' + url));
      document.head.appendChild(script);
    });
  }

  /**
   * Resume AudioContext — required by mobile browsers.
   * Must be called from a user gesture (click/tap).
   */
  async function ensureAudio() {
    try {
      if (window.getAudioContext) {
        audioCtx = window.getAudioContext();
      }
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
    } catch (e) {
      console.warn('[Engine] AudioContext error:', e.message);
    }
    return audioCtx;
  }

  /**
   * Load a JSON sample map with a base URL
   */
  async function loadSampleMap(jsonUrl, baseUrl) {
    try {
      const resp = await fetch(jsonUrl);
      const data = await resp.json();
      // Add _base if not present
      if (baseUrl && !data._base) {
        data._base = baseUrl;
      }
      await window.samples(data);
      // Track loaded sounds
      for (const key of Object.keys(data)) {
        if (!key.startsWith('_')) {
          const val = data[key];
          loadedSounds[key] = Array.isArray(val) ? val.length : (typeof val === 'object' ? Object.keys(val).length : 1);
        }
      }
      return Object.keys(data).filter(k => !k.startsWith('_')).length;
    } catch (e) {
      console.warn('[Engine] Failed to load samples from', jsonUrl, e.message);
      return 0;
    }
  }

  /**
   * Boot the Strudel engine.
   * @param {function} onProgress - callback(message)
   * @returns {Promise<boolean>}
   */
  async function boot(onProgress) {
    try {
      onProgress && onProgress('Loading @strudel/web...');
      await loadScript(STRUDEL_URL);

      onProgress && onProgress('Initializing audio engine...');
      await window.initStrudel({
        prebake: async () => {
          // Load dirt-samples (basic sounds: bd, sd, hh, etc.)
          onProgress && onProgress('Loading dirt-samples...');
          await window.samples(DIRT_SAMPLES);
          // Register known names for the sounds browser
          DIRT_SAMPLE_NAMES.forEach(n => { loadedSounds[n] = 1; });

          // Load piano samples
          onProgress && onProgress('Loading piano...');
          await loadSampleMap(PIANO_JSON);

          // Load tidal drum machines (TR-909, TR-808, etc.)
          onProgress && onProgress('Loading drum machines...');
          const dmCount = await loadSampleMap(DRUM_MACHINES_JSON, DRUM_MACHINES_BASE);
          console.log('[Engine] Loaded', dmCount, 'drum machine samples');

          // Load VCSL orchestral samples
          onProgress && onProgress('Loading VCSL instruments...');
          const vcslCount = await loadSampleMap(VCSL_JSON, VCSL_BASE);
          console.log('[Engine] Loaded', vcslCount, 'VCSL samples');

          onProgress && onProgress('All samples loaded!');
        }
      });

      // Grab audio context
      if (window.getAudioContext) {
        audioCtx = window.getAudioContext();
      }

      ready = true;
      return true;
    } catch (e) {
      console.error('[Engine] Boot error:', e);
      throw e;
    }
  }

  /**
   * Evaluate Strudel code.
   * Handles CPS separately to avoid scope issues.
   * @param {string} code - User code
   * @param {number} cps - Cycles per second
   */
  let _playPatched = false;

  function patchPlay() {
    if (_playPatched) return;
    // By the time evalCode runs, initStrudel's async init (ch) has completed,
    // so all strudel globals (pure, setcps, etc.) are on window via globalThis.
    try {
      var testPat = typeof window.pure === 'function' ? window.pure(0)
                  : (window.strudel && typeof window.strudel.pure === 'function' ? window.strudel.pure(0) : null);
      if (testPat) {
        var proto = Object.getPrototypeOf(testPat);
        while (proto && !proto.hasOwnProperty('play')) {
          proto = Object.getPrototypeOf(proto);
        }
        if (proto && typeof proto.play === 'function') {
          var origPlay = proto.play;
          proto.play = function () {
            currentPattern = this;
            return origPlay.apply(this, arguments);
          };
          _playPatched = true;
          console.log('[Engine] Pattern.play patched for drawing');
        }
      }
      if (!_playPatched) {
        console.warn('[Engine] Could not find Pattern.play to patch');
      }
    } catch (e) {
      console.warn('[Engine] Patch error:', e.message);
    }
  }

  /**
   * Set CPS on the internal scheduler.
   * Strudel exports setcps/setCps to globalThis via evalScope.
   */
  function applyCps(cps) {
    var fn = window.setcps || window.setCps
          || (window.strudel && (window.strudel.setcps || window.strudel.setCps));
    if (typeof fn === 'function') {
      try { fn(cps); activeCps = cps; } catch (e) { console.warn('[Engine] CPS set failed:', e.message); }
    }
  }

  /**
   * Wrap setcps/setCps globals so we always know the real CPS.
   */
  function patchSetCps() {
    ['setcps', 'setCps'].forEach(function (name) {
      if (typeof window[name] === 'function' && !window[name]._patched) {
        var orig = window[name];
        window[name] = function (v) {
          activeCps = v;
          return orig.apply(this, arguments);
        };
        window[name]._patched = true;
      }
    });
  }

  async function evalCode(code, cps) {
    if (!ready) throw new Error('Engine not ready');

    await ensureAudio();

    // Patch Pattern.play and setcps on first evaluate (globals are available by now)
    patchPlay();
    patchSetCps();

    // Don't override CPS from input if the code sets it via .cps() or .cpm()
    var codeSetsTempo = /\.cps\s*\(/.test(code) || /\.cpm\s*\(/.test(code)
                     || /setcps\s*\(/.test(code) || /setCps\s*\(/.test(code);
    if (!codeSetsTempo) {
      applyCps(cps);
    }

    // Capture play origin on first eval (scheduler sets its origin here too)
    if (!playing && audioCtx) {
      playOrigin = audioCtx.currentTime;
    }

    // Evaluate — triggers lazy sample loading and calls pattern.play()
    evaluatedCode = code;
    await window.evaluate(code);
    playing = true;

    // Wait briefly for samples to finish loading
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Stop all sound.
   */
  function stop() {
    if (!ready) return;
    try {
      window.hush();
    } catch (e) {
      console.warn('[Engine] hush error:', e.message);
    }
    playing = false;
    playOrigin = 0;
  }

  window.Engine = {
    boot,
    evalCode,
    stop,
    ensureAudio,
    get ready() { return ready; },
    get playing() { return playing; },
    set playing(v) { playing = v; },
    get audioContext() { return audioCtx; },
    get sounds() { return loadedSounds; },
    get pattern() { return currentPattern; },
    get evaluatedCode() { return evaluatedCode; },
    get activeCps() { return activeCps; },
    get playOrigin() { return playOrigin; }
  };
})();
