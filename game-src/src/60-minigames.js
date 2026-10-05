// =========================================================
//   MINI-GAMES
// =========================================================
Object.assign(TAGS, { timing: 'Timing', reaction: 'Reaction', combo: 'Moves', read: 'The read' });
const DEFAULT_PROMPT = { timing: 'Stop the needle in the window. Orange is perfect.', reaction: 'Move on the orange GO, not before.', combo: 'Hit the moves in order before time runs out.', read: 'Make the call before the play clock runs out.' };
// MINIGAMES[type](cfg, host): draw into host, call setMini({ stop, key, finish }) right away, and call
// endMini(host, r, label, cfg.onDone, extra) exactly once with r = 'great' | 'good' | 'bad'.
// cfg: { type, diff (0.6-5.5), prompt, btn, label, clutch, edge, read, fakes, moment, onDone }.
// The host must contain an element with class "mg" (endMini draws its result flash inside it).
function setMini(obj) { mini = obj; }
function stopMini() { if (mini) { const m = mini; mini = null; m.stop(); } }
function startMini(cfg, host) {
  const f = MINIGAMES[cfg.type] || MINIGAMES.timing;
  f(cfg, host);
}
function mgHead(cfg) {
  const tag = (cfg.clutch ? 'Clutch · ' : '') + (cfg.label || TAGS[cfg.type] || 'Play');
  return `<div class="mg-head"><span class="mg-tag">${esc(tag)}</span><span class="mg-prompt">${fmt(cfg.prompt || DEFAULT_PROMPT[cfg.type] || '')}</span></div>`;
}
function endMini(host, r, label, cb, extra) {
  Sound.play(r === 'great' ? 'great' : r === 'good' ? 'good' : 'bad');
  const mg = host.querySelector('.mg');
  if (mg) {
    const f = document.createElement('div');
    f.className = 'flash ' + r;
    f.innerHTML = `<b>${{ great: 'Perfect!', good: 'Good', bad: 'Missed' }[r]}</b>${label ? `<span>${esc(label)}</span>` : ''}`;
    mg.appendChild(f);
  }
  // The result flash shows for about a second. If anything interrupts it (menu, title, page change),
  // the result is applied right away instead of being lost.
  let fired = false;
  const fire = () => { if (fired) return; fired = true; clearTimeout(t); if (mini === stub) mini = null; try { cb(r, extra); } catch (e) { console.error(e); } };
  const t = setTimeout(fire, reduceMotion ? 700 : 1050);
  const stub = { stop: fire, key() { return true; }, finish() {} };
  mini = stub;
  emit('miniEnd', r, label);
}

// Timing: stop a sweeping needle inside the window.
function miniTiming(cfg, host) {
  const s = S.st, d = cfg.diff;
  const band = cfg.clutch && S.items.band ? 5 : 0;
  const goodW = clamp(mod('timing.window', 10 + s.skill * 0.13 + (s.conf - 50) * 0.06 - d * 1.8 + band, cfg), 6, 40);
  const perfW = goodW * 0.36;
  const speed = mod('timing.speed', 50 + d * 13 + (s.energy < 30 ? 16 : 0), cfg);
  const c = rand(goodW / 2 + 6, 100 - goodW / 2 - 6);
  host.innerHTML = `<div class="mg">${mgHead(cfg)}
    <div class="meter" role="presentation"><div class="zone good" style="left:${c - goodW / 2}%;width:${goodW}%"></div><div class="zone perfect" style="left:${c - perfW / 2}%;width:${perfW}%"></div><div class="needle" style="left:0%"></div></div>
    <div class="mg-row"><span class="mg-help"><span class="kb-only">Press <kbd>Space</kbd> or tap</span><span class="touch-only">Tap</span> the button once to start and again to stop.</span><button class="mg-btn" type="button">Snap it</button></div></div>`;
  const needle = host.querySelector('.needle'), btn = host.querySelector('.mg-btn');
  let running = false, pos = 0, dir = 1, last = 0, passes = 0, raf = 0, done = false;
  function frame(t) {
    if (!last) last = t;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    pos += dir * speed * dt;
    if (pos >= 100) { pos = 100; dir = -1; passes++; }
    else if (pos <= 0) { pos = 0; dir = 1; passes++; }
    needle.style.left = pos + '%';
    if (passes >= 4) return stopAt(true);
    raf = requestAnimationFrame(frame);
  }
  function stopAt(timeout) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    const dist = Math.abs(pos - c);
    const r = timeout ? 'bad' : dist <= perfW / 2 ? 'great' : dist <= goodW / 2 ? 'good' : 'bad';
    endMini(host, r, timeout ? 'Too late' : null, cfg.onDone);
  }
  function act() {
    if (done) return;
    if (!running) { running = true; btn.textContent = cfg.btn || 'Now!'; Sound.play('tick'); raf = requestAnimationFrame(frame); }
    else stopAt(false);
  }
  btn.addEventListener('click', act);
  host.querySelector('.meter').addEventListener('pointerdown', e => { e.preventDefault(); act(); });
  mini = {
    stop() { done = true; cancelAnimationFrame(raf); },
    key(e) { if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) act(); return true; } return false; },
    finish(r) { if (done) return; done = true; cancelAnimationFrame(raf); endMini(host, r, null, cfg.onDone); },
  };
}

// Reaction: go on the real signal, ignore the fake ones.
function miniReaction(cfg, host) {
  const s = S.st, d = cfg.diff;
  const great = mod('reaction.great', 265 + s.skill * 0.9 - d * 14 - (s.energy < 30 ? 40 : 0), cfg);
  const good = great + 200;
  const nFakes = cfg.fakes != null ? cfg.fakes : ri(0, 2);
  host.innerHTML = `<div class="mg">${mgHead(cfg)}
    <button class="react-pad" type="button"><span class="rp-text">Tap to get set</span></button>
    <div class="mg-row"><span class="mg-help">Tap the pad<span class="kb-only"> or press <kbd>Space</kbd></span>. Jumping on a fake call is a penalty.</span></div></div>`;
  const pad = host.querySelector('.react-pad'), txt = pad.querySelector('.rp-text');
  const fakes = ['Hut!', 'Blue 80!', 'Omaha!', 'Hut-hut!'];
  let phase = 'idle', t0 = 0, done = false;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function arm() {
    phase = 'wait';
    pad.className = 'react-pad wait';
    txt.textContent = 'Set…';
    let t = rand(900, 1700);
    for (let i = 0; i < nFakes; i++) {
      later(() => { if (phase !== 'wait') return; txt.textContent = pick(fakes); pad.classList.add('fake'); later(() => { pad.classList.remove('fake'); if (phase === 'wait') txt.textContent = 'Set…'; }, 420); }, t);
      t += rand(800, 1400);
    }
    later(() => {
      if (phase !== 'wait') return;
      phase = 'go';
      t0 = performance.now();
      pad.className = 'react-pad go';
      txt.textContent = 'GO';
      Sound.play('tick');
      later(() => { if (phase === 'go') finish('bad', 'Too slow', { text: 'You read it a beat too late. By the time you move, the play is already past you.' }); }, good + 500);
    }, t);
  }
  // slack: touch screens report taps a little late, so a tap is graded 40 ms kinder.
  function press(slack) {
    if (done) return;
    if (phase === 'idle') return arm();
    if (phase === 'wait') return finish('bad', 'False start');
    if (phase === 'go') { const rt = performance.now() - t0, g = rt - (slack || 0); finish(g <= great ? 'great' : g <= good ? 'good' : 'bad', `${Math.round(rt)} ms`); }
  }
  function finish(r, label, extra) {
    if (done) return;
    done = true;
    phase = 'done';
    timers.forEach(clearTimeout);
    endMini(host, r, label, cfg.onDone, extra);
  }
  // Some touch browsers follow a tap with a click whose detail is 0; ignore clicks right after a pointer press
  // so one tap never counts twice (that would turn "get set" into a false start).
  let lastPtr = -1e9;
  pad.addEventListener('pointerdown', e => { e.preventDefault(); lastPtr = performance.now(); press(e.pointerType === 'touch' ? 40 : 0); });
  pad.addEventListener('click', e => { if (e.detail === 0 && performance.now() - lastPtr > 700) press(); }); // keyboard/assistive activation only
  mini = {
    stop() { done = true; timers.forEach(clearTimeout); },
    key(e) { if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) press(); return true; } return false; },
    finish(r) { finish(r); },
  };
}

// Combo: enter the arrow sequence before the clock runs out.
function miniCombo(cfg, host) {
  const s = S.st, d = cfg.diff;
  const len = clamp(Math.round(mod('combo.len', 3 + Math.round(d / 2), cfg)), 3, 7);
  const band = cfg.clutch && S.items.band ? 0.4 : 0;
  let total = clamp(mod('combo.time', len * (0.45 + s.skill * 0.0025 + (s.conf - 50) * 0.0015 - d * 0.03 - (s.energy < 30 ? 0.06 : 0)) + band, cfg), 1.6, 6);
  const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
  const glyph = { ArrowLeft: '←', ArrowUp: '↑', ArrowRight: '→', ArrowDown: '↓' };
  const alias = { a: 'ArrowLeft', w: 'ArrowUp', d: 'ArrowRight', s: 'ArrowDown', A: 'ArrowLeft', W: 'ArrowUp', D: 'ArrowRight', S: 'ArrowDown' };
  const seq = Array.from({ length: len }, () => pick(keys));
  host.innerHTML = `<div class="mg">${mgHead(cfg)}
    <div class="combo-seq">${seq.map((k, i) => `<span class="arrow-box${i === 0 ? ' cur' : ''}">${glyph[k]}</span>`).join('')}</div>
    <div class="timer"><i></i></div>
    <div class="combo-pad">${keys.map(k => `<button class="pad-btn" type="button" data-key="${k}" aria-label="${k.replace('Arrow', '')}">${glyph[k]}</button>`).join('')}</div>
    <div class="mg-row"><span class="mg-help"><span class="kb-only">Arrow keys, WASD, or the pad.</span><span class="touch-only">Tap the arrows in order.</span> The clock starts on your first move. A wrong move costs time.</span></div></div>`;
  const boxes = $$('.arrow-box', host), bar = host.querySelector('.timer > i'), seqEl = host.querySelector('.combo-seq');
  let started = false, idx = 0, left = total, last = 0, raf = 0, done = false;
  function frame(t) {
    if (!last) last = t;
    left -= Math.min(0.05, (t - last) / 1000);
    last = t;
    bar.style.transform = `scaleX(${Math.max(0, left / total)})`;
    if (left <= 0) return finish('bad', 'Brought down');
    raf = requestAnimationFrame(frame);
  }
  function input(k, pad) {
    if (done) return;
    // Tapping on-screen buttons is slower than arrow keys, so a combo played on the pad gets a quarter more time.
    if (!started) { started = true; if (pad) { total *= 1.25; left = total; } raf = requestAnimationFrame(frame); }
    if (k === seq[idx]) {
      boxes[idx].classList.remove('cur');
      boxes[idx].classList.add('done');
      idx++;
      Sound.play('tick');
      if (idx === len) return finish(left / total >= 0.5 ? 'great' : 'good');
      boxes[idx].classList.add('cur');
    } else {
      left -= 0.5;
      seqEl.classList.remove('shake');
      void seqEl.offsetWidth;
      seqEl.classList.add('shake');
    }
  }
  function finish(r, label) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    endMini(host, r, label, cfg.onDone);
  }
  let lastPtr = -1e9; // see miniReaction: a tap must never count twice
  $$('.pad-btn', host).forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); lastPtr = performance.now(); input(b.dataset.key, true); }));
  $$('.pad-btn', host).forEach(b => b.addEventListener('click', e => { if (e.detail === 0 && performance.now() - lastPtr > 700) input(b.dataset.key, true); }));
  mini = {
    stop() { done = true; cancelAnimationFrame(raf); },
    key(e) { const k = keys.includes(e.key) ? e.key : alias[e.key]; if (k) { if (!e.repeat) input(k); return true; } return e.key === ' '; },
    finish(r) { finish(r); },
  };
}

// Read: pick the right call before the play clock runs out.
function miniRead(cfg, host) {
  const rd = cfg.read, d = cfg.diff;
  const total = clamp(mod('read.time', 10 - d * 0.8, cfg), 5, 14);
  const opts = shuffle(rd.opts);
  host.innerHTML = `<div class="mg">${mgHead(cfg)}
    <div class="mg-prompt" style="margin-bottom:10px">${fmt(rd.q)}</div>
    ${cfg.edge ? `<div class="film-note"><b>Film note</b>${fmt(rd.tell)}</div>` : ''}
    <div class="read-zone"><div class="mg-row" style="margin-top:12px"><span class="mg-help">You'll have ${Math.round(total)} seconds once you break the huddle.</span><button class="mg-btn" type="button">Break the huddle</button></div></div></div>`;
  const zone = host.querySelector('.read-zone');
  let started = false, left = total, last = 0, raf = 0, done = false, bar = null;
  function start() {
    if (started || done) return;
    started = true;
    zone.innerHTML = `<div class="timer"><i></i></div><div class="read-opts">${opts.map((o, i) => `<button class="read-opt" type="button" data-i="${i}"><span class="k">${i + 1}</span><span>${fmt(o[0])}</span></button>`).join('')}</div>`;
    bar = zone.querySelector('.timer > i');
    $$('.read-opt', zone).forEach(b => b.addEventListener('click', () => choosePick(+b.dataset.i)));
    // On small screens the options can land below the fold while the clock runs: bring them into view.
    const r = zone.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) window.scrollBy({ top: Math.min(r.bottom - window.innerHeight + 12, r.top - 70), behavior: reduceMotion ? 'auto' : 'smooth' });
    raf = requestAnimationFrame(frame);
  }
  function frame(t) {
    if (!last) last = t;
    left -= Math.min(0.05, (t - last) / 1000);
    last = t;
    bar.style.transform = `scaleX(${Math.max(0, left / total)})`;
    if (left <= 0) {
      done = true;
      endMini(host, 'bad', 'Delay of game', cfg.onDone, { text: 'The play clock hits zero before you can decide. Flag. Delay of game.' });
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function choosePick(i) {
    if (done || !started) return;
    done = true;
    cancelAnimationFrame(raf);
    const o = opts[i];
    endMini(host, o[1], null, cfg.onDone, { text: o[2] });
  }
  host.querySelector('.mg-btn').addEventListener('click', start);
  mini = {
    stop() { done = true; cancelAnimationFrame(raf); },
    key(e) {
      if (!started) { if (e.key === ' ' || e.key === 'Enter') { start(); return true; } return false; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= opts.length) { choosePick(n - 1); return true; }
      return false;
    },
    finish(r) {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const o = opts.find(x => x[1] === r);
      endMini(host, r, null, cfg.onDone, { text: o ? o[2] : '' });
    },
  };
}

Object.assign(MINIGAMES, { timing: miniTiming, reaction: miniReaction, combo: miniCombo, read: miniRead });
