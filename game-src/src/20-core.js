
/* =========================================================
   UNDRAFTED — a football story game.
   Everything (story, mini-games, saving) lives in this file.
   ========================================================= */

// ---------- Small helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const chance = p => Math.random() < p;
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// Browser storage can be missing or blocked, so every call is wrapped.
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const SAVE_KEY = 'undrafted.save.v1';
const TROPHY_KEY = 'undrafted.trophies.v1';
const PREF_KEY = 'undrafted.prefs.v1';

// ---------- Extension points ----------
// Feature modules plug into the game through these instead of editing the engine.
//   on(name, fn) / emit(name, ...args)   event hooks (see HOOK LIST in 50-engine.js)
//   addMod(key, fn) / mod(key, value)    numeric modifiers: fn(value, ctx) returns the new value
//   UI.*                                 optional renderers a module can provide
const HOOKS = {};
function on(name, fn) { (HOOKS[name] = HOOKS[name] || []).push(fn); }
function emit(name, ...args) {
  const list = HOOKS[name];
  if (!list) return;
  for (const fn of list) { try { fn(...args); } catch (e) { console.error('[hook ' + name + ']', e); } }
}
const MODS = {};
function addMod(key, fn) { (MODS[key] = MODS[key] || []).push(fn); }
function mod(key, value, ctx) {
  const list = MODS[key];
  if (!list) return value;
  for (const fn of list) {
    try { const v = fn(value, ctx); if (typeof v === 'number' && isFinite(v)) value = v; }
    catch (e) { console.error('[mod ' + key + ']', e); }
  }
  return value;
}
// Shared registries, declared here (the first script file) so every module can use them at load time.
const BEATS = [];        // extra story beats: { slate: n | [n...], id: 'page_id', args, if: () => bool, year: 1 }
const FIXED_Y = {};      // fixed beats for later seasons: FIXED_Y[year] = { slate: 'page_id' | () => id }
const ENDING_RULES = []; // { id, when: () => bool }, checked before the built-in endings
const CODAS = [];        // () => paragraph | null, added to the epilogue
const MINIGAMES = {};    // type -> (cfg, host) => void (see 60-minigames.js)
const TAGS = {};         // type -> label shown on the mini-game panel
const UI = {
  portrait: null,     // (speakerName, rawSpeaker) => inline SVG string or ''
  startNextYear: null, // () => void, offered on the ending screen when set
  ledger: null,        // () => HTML for the ending's newspaper column (return '' to use the default)
};

// ---------- Sound (tiny synth, no files needed) ----------
const Sound = (() => {
  let ctx = null;
  let enabled = store.get(PREF_KEY, {}).sound !== false;
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(f, d, type, vol, t0, slide) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (t0 || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, vol, t0, freq) {
    const c = ac(); if (!c) return;
    const len = Math.floor(c.sampleRate * d);
    const buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 900; f.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = vol || 0.05;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(c.currentTime + (t0 || 0));
  }
  const fx = {
    click: () => tone(520, 0.05, 'triangle', 0.035),
    tick: () => tone(900, 0.04, 'square', 0.025),
    good: () => { tone(523, 0.12, 'triangle', 0.06); tone(784, 0.2, 'triangle', 0.06, 0.08); },
    great: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, 'triangle', 0.06, i * 0.07)); noise(1.2, 0.07, 0.05, 800); },
    bad: () => tone(190, 0.32, 'sawtooth', 0.045, 0, -80),
    whistle: () => { tone(2200, 0.32, 'sine', 0.04, 0, 120); tone(2350, 0.18, 'sine', 0.025, 0.06, -80); },
    trophy: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.28, 'sine', 0.05, i * 0.09)),
    cash: () => { tone(1320, 0.07, 'square', 0.025); tone(1760, 0.12, 'square', 0.025, 0.06); },
  };
  return {
    fx, tone, noise, ctx: () => ac(),
    play(n) { if (enabled && fx[n]) { try { fx[n](); } catch (e) { /* ignore */ } } },
    get on() { return enabled; },
    toggle() { enabled = !enabled; const p = store.get(PREF_KEY, {}); p.sound = enabled; store.set(PREF_KEY, p); if (enabled) ac(); return enabled; },
  };
})();

