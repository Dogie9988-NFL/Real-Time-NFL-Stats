// =========================================================
//   JUICE — game feel. Confetti, impact, big-play stamps, a live scoreboard,
//   crowd audio, haptics, the kickoff title card and stat floats on the player card.
//   Hooks only: page, play, gameStart, gameEnd, miniEnd, award, fx, card, ending, title.
//   Other modules can reuse the effects through `Juice` (see the bottom of this file).
// =========================================================
const Juice = (() => {
  const RM = reduceMotion;
  let gestured = false;          // no audio or vibration before the player has touched the page
  let pageId = null;             // id of the page currently on screen
  const isGamePage = id => !!id && (id.indexOf('g_') === 0 || id === 'game_pre');
  const hash = s => { let h = 2166136261; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pickBy = (arr, key) => arr[hash(key) % arr.length];
  const later = (fn, ms) => setTimeout(() => { try { fn(); } catch (e) { console.error('[juice]', e); } }, ms);
  const J = () => ext('juice', () => ({ board: null, ot: null }));
  const gameKey = g => `${S.year || 1}-${g.n}`;
  const fine = () => { try { return matchMedia('(pointer: fine)').matches; } catch (e) { return true; } };
  const phone = () => {
    try { return matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 820; }
    catch (e) { return false; }
  };
  function buzz(pattern) {
    if (!gestured || !phone() || typeof navigator.vibrate !== 'function') return;
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  // ---------- Confetti: one fixed canvas, a capped particle pool, the loop stops when idle ----------
  const Confetti = (() => {
    const PAL = [['#FF7A2E', '#B8480F'], ['#FFFFFF', '#C6CDD6'], ['#FFB21E', '#B47800'], ['#D2500A', '#7E2E05'], ['#FFFFFF', '#C6CDD6']];
    let cv = null, cx = null, W = 0, H = 0, raf = 0, last = 0, gen = 0;
    const parts = [];
    // Timed follow-up bursts belong to the page that fired them: clear() cancels the ones still waiting.
    const soon = (fn, ms) => { const g0 = gen; later(() => { if (g0 === gen) fn(); }, ms); };
    const cap = () => (W * H < 500000 ? 300 : 520);
    function size() {
      if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function ensure() {
      if (!cv) {
        cv = document.createElement('canvas');
        cv.className = 'jx-confetti';
        cv.setAttribute('aria-hidden', 'true');
        document.body.appendChild(cv);
        cx = cv.getContext('2d');
        window.addEventListener('resize', () => { if (raf) size(); });
      }
      if (!raf) { size(); cv.style.display = 'block'; last = 0; raf = requestAnimationFrame(frame); }
    }
    function piece(x, y, ang, spd, o) {
      if (parts.length >= cap()) return;
      const c = o.colors ? pick(o.colors) : pick(PAL);
      const shape = o.shape || (Math.random() < 0.16 ? 'streamer' : Math.random() < 0.2 ? 'dot' : 'rect');
      const v = spd * rand(0.55, 1.05);
      parts.push({
        x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, shape, c,
        w: rand(6, 10) * (o.scale || 1), h: rand(9, 15) * (o.scale || 1),
        rot: rand(0, 6.28), vr: rand(-7, 7), tilt: rand(0, 6.28), vt: rand(5, 13),
        sway: rand(0.6, 1.8), swayP: rand(0, 6.28), term: rand(95, 170), t: 0,
        life: o.life || rand(3.2, 4.6), g: o.gravity != null ? o.gravity : 520,
      });
    }
    // burst({ x, y, n, angle, spread, speed, ... }) — angle in radians (−π/2 is straight up)
    function burst(o) {
      if (RM) return;
      ensure();
      for (let i = 0; i < o.n; i++) piece(o.x + rand(-6, 6), o.y + rand(-6, 6), (o.angle != null ? o.angle : -Math.PI / 2) + rand(-o.spread / 2, o.spread / 2), o.speed || 900, o);
    }
    function sparkle(x, y, n, o) {
      if (RM) return;
      ensure();
      o = o || {};
      for (let i = 0; i < n; i++) {
        if (parts.length >= cap()) break;
        const a = rand(0, 6.28), v = rand(60, o.speed || 340);
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, shape: 'star', c: pick(o.colors || [['#FFB21E', '#FFF3C4'], ['#FFFFFF', '#FFFFFF'], ['#FF7A2E', '#FFD0B0']]), w: rand(5, 11), h: 0, rot: rand(0, 6.28), vr: rand(-3, 3), tilt: 0, vt: rand(10, 20), sway: 0, swayP: 0, term: 120, t: 0, life: rand(0.7, 1.25), g: o.gravity != null ? o.gravity : 140 });
      }
    }
    function cannons(n, speed) {
      const k = Math.round(n / 2);
      burst({ x: -10, y: H + 10, n: k, angle: -Math.PI / 2 + 0.62, spread: 0.55, speed: speed || Math.max(900, H * 1.45) });
      burst({ x: W + 10, y: H + 10, n: k, angle: -Math.PI / 2 - 0.62, spread: 0.55, speed: speed || Math.max(900, H * 1.45) });
    }
    function rain(n) {
      if (RM) return;
      ensure();
      for (let i = 0; i < n; i++) piece(rand(0, W), rand(-H * 0.5, -10), Math.PI / 2, rand(20, 90), { life: rand(4, 6.5) });
    }
    function frame(t) {
      const dt = last ? Math.min(0.033, (t - last) / 1000) : 0.016;
      last = t;
      cx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.shape === 'star') {
          p.vx *= 1 - 2.6 * dt; p.vy *= 1 - 2.6 * dt; p.vy += p.g * dt;
        } else {
          p.vx *= 1 - 1.5 * dt;
          p.vy += p.g * dt;
          if (p.vy > p.term) p.vy += (p.term - p.vy) * Math.min(1, 6 * dt);
          p.x += Math.sin(p.t * 3 * p.sway + p.swayP) * 38 * p.sway * dt;
        }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.tilt += p.vt * dt;
        let fade = p.life - p.t < 0.6 ? Math.max(0, (p.life - p.t) / 0.6) : 1;
        if (p.die != null) fade = Math.min(fade, Math.max(0, (p.die - p.t) / p.dieLen));
        if (p.t >= p.life || (p.die != null && p.t >= p.die) || p.y > H + 60 || p.x < -80 || p.x > W + 80) { parts.splice(i, 1); continue; }
        draw(p, fade);
      }
      if (parts.length) raf = requestAnimationFrame(frame);
      else { raf = 0; cx.clearRect(0, 0, W, H); cv.style.display = 'none'; }
    }
    function draw(p, a) {
      cx.save();
      cx.globalAlpha = a;
      cx.translate(p.x, p.y);
      cx.rotate(p.rot);
      if (p.shape === 'star') {
        const s = p.w * (0.6 + 0.4 * Math.abs(Math.sin(p.tilt))) * (1 - p.t / p.life * 0.5);
        cx.fillStyle = p.c[0];
        cx.shadowColor = p.c[1]; cx.shadowBlur = 8;
        cx.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.28 : s; const an = k * Math.PI / 4; cx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
        cx.closePath(); cx.fill();
      } else {
        const flip = Math.cos(p.tilt);
        cx.fillStyle = flip > 0 ? p.c[0] : p.c[1];
        if (p.shape === 'dot') { cx.beginPath(); cx.ellipse(0, 0, p.w * 0.45, p.w * 0.45 * Math.abs(flip) + 0.6, 0, 0, 6.29); cx.fill(); }
        else if (p.shape === 'streamer') {
          cx.beginPath();
          cx.moveTo(0, -p.h); cx.quadraticCurveTo(p.w * 0.9 * flip, 0, 0, p.h);
          cx.lineWidth = 3; cx.strokeStyle = cx.fillStyle; cx.stroke();
        } else {
          const h = p.h * Math.abs(flip) + 0.8;
          cx.fillRect(-p.w / 2, -h / 2, p.w, h);
          if (p.c[0] === '#FFFFFF') { cx.lineWidth = 0.75; cx.strokeStyle = 'rgba(20,32,58,.28)'; cx.strokeRect(-p.w / 2, -h / 2, p.w, h); }
        }
      }
      cx.restore();
    }
    // Fade out everything on screen within `secs` (0 = at once) and cancel bursts still waiting to fire.
    function clear(secs) {
      gen++;
      if (!parts.length) return;
      if (!secs) { parts.length = 0; return; }
      parts.forEach(p => { const d = p.t + secs; if (p.die == null || d < p.die) { p.die = d; p.dieLen = secs; } });
    }
    const size2 = () => { if (!cv) { W = window.innerWidth; H = window.innerHeight; } return { W: cv ? W : window.innerWidth, H: cv ? H : window.innerHeight }; };
    return {
      burst, sparkle, cannons, rain, clear, size: size2, get count() { return parts.length; },
      // Presets
      pop(x, y) { burst({ x, y, n: 46, spread: 1.9, speed: 620 }); },
      touchdown(x, y) {
        const { W: w, H: h } = size2();
        burst({ x: x != null ? x : w / 2, y: y != null ? y : h * 0.35, n: 110, spread: 2.4, speed: 950 });
        soon(() => cannons(90), 140);
      },
      win() { cannons(150); soon(() => sparkle(size2().W / 2, size2().H * 0.28, 28), 250); },
      huge() {
        const { W: w, H: h } = size2();
        cannons(190);
        soon(() => burst({ x: w / 2, y: h * 0.38, n: 120, spread: 6.28, speed: 820 }), 350);
        soon(() => rain(170), 600);
        soon(() => cannons(150), 1250);
        [0, 1, 2, 3, 4].forEach(i => soon(() => sparkle(rand(w * 0.15, w * 0.85), rand(h * 0.12, h * 0.45), 30, { speed: 420 }), 500 + i * 420));
      },
    };
  })();

  // ---------- Impact: flash and shake ----------
  function flash(kind) {
    if (RM) return;
    const f = document.createElement('div');
    f.className = 'jx-flash ' + (kind || 'great');
    f.setAttribute('aria-hidden', 'true');
    document.body.appendChild(f);
    const kill = () => f.remove();
    f.addEventListener('animationend', kill);
    later(kill, 900);
  }
  function shake(el, power) {
    if (RM || !el || typeof el.animate !== 'function') return;
    const a = 7 * (power || 1), r = 0.35 * (power || 1);
    try {
      el.animate([
        { transform: 'translate(0,0)' },
        { transform: `translate(${-a}px,${a * 0.3}px) rotate(${-r}deg)` },
        { transform: `translate(${a * 0.85}px,${-a * 0.25}px) rotate(${r}deg)` },
        { transform: `translate(${-a * 0.5}px,0) rotate(${-r * 0.4}deg)` },
        { transform: `translate(${a * 0.25}px,0)` },
        { transform: 'translate(0,0)' },
      ], { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' });
    } catch (e) { /* ignore */ }
  }

  // ---------- Crowd audio (WebAudio on Sound.ctx(), behind one master + compressor) ----------
  const Crowd = (() => {
    let c = null, out = null, bufs = {}, mur = null, beat = 0, watch = 0;
    function ctx() {
      if (!gestured || !Sound.on) return null;
      const a = Sound.ctx();
      if (!a) return null;
      if (a !== c || !out) {
        c = a; bufs = {};
        out = c.createGain(); out.gain.value = 0.9;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
        out.connect(comp); comp.connect(c.destination);
      }
      return c;
    }
    function buf(kind) {
      if (bufs[kind]) return bufs[kind];
      const len = Math.floor(c.sampleRate * 5), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      let l = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w;
      }
      // Make the loop seamless: pull the end back to the start value.
      const drift = d[len - 1] - d[0];
      for (let i = 0; i < len; i++) d[i] -= drift * (i / len);
      return (bufs[kind] = b);
    }
    function src(kind, rate) {
      const s = c.createBufferSource();
      s.buffer = buf(kind);
      if (rate) s.playbackRate.value = rate;
      return s;
    }
    function filt(type, f, q) { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; }
    function env(g, t, peak, att, hold, rel) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + att);
      g.gain.setValueAtTime(peak, t + att + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + att + hold + rel);
    }

    // A low murmur bed that loops while you are at the stadium.
    function murmur(level, muffled) {
      if (!ctx()) return;
      const t = c.currentTime;
      if (!mur) {
        const g = c.createGain(); g.gain.value = 0.0001;
        const body = src('brown'); body.loop = true;
        const lp = filt('lowpass', 520, 0.5);
        const chat = src('white', 0.93); chat.loop = true; chat.loopStart = 0.7;
        const bp = filt('bandpass', 1050, 0.8);
        const cg = c.createGain(); cg.gain.value = 0.18;
        const lfo = c.createOscillator(); lfo.frequency.value = 0.19;
        const lg = c.createGain(); lg.gain.value = 0.08;
        lfo.connect(lg); lg.connect(cg.gain);
        const tone = filt('lowpass', 6000, 0.3);
        body.connect(lp); lp.connect(g);
        chat.connect(bp); bp.connect(cg); cg.connect(g);
        g.connect(tone); tone.connect(out);
        body.start(t); chat.start(t, rand(0, 3)); lfo.start(t);
        mur = { g, tone, nodes: [body, chat, lfo], ctx: c };
      }
      mur.g.gain.cancelScheduledValues(t);
      mur.g.gain.setTargetAtTime(Math.max(0.0001, 0.05 * level), t, 0.45);
      mur.tone.frequency.setTargetAtTime(muffled ? 420 : 6000, t, 0.3);
      if (!watch) watch = setInterval(check, 700);
    }
    function stopMurmur(fast) {
      if (!mur) return;
      const m = mur; mur = null;
      try {
        const t = m.ctx.currentTime;
        m.g.gain.cancelScheduledValues(t);
        m.g.gain.setTargetAtTime(0.0001, t, fast ? 0.05 : 0.3);
        setTimeout(() => { m.nodes.forEach(n => { try { n.stop(); } catch (e) { /* ignore */ } }); try { m.g.disconnect(); } catch (e) { /* ignore */ } }, fast ? 300 : 1400);
      } catch (e) { /* ignore */ }
    }
    // Stop everything that has to stop when you leave the stadium or turn the sound off.
    function check() {
      const ok = Sound.on && screen === 'play' && S && S.at && !document.hidden && wantsCrowd(S.at.id);
      if (!ok) { stopMurmur(!Sound.on); stopBeat(); if (watch) { clearInterval(watch); watch = 0; } }
    }
    function roar(power, dur) {
      if (!ctx()) return;
      power = power || 1; dur = dur || 2.2;
      const t = c.currentTime + 0.02;
      const a = src('white', rand(0.85, 1.1)), b = src('brown');
      const f1 = filt('bandpass', 950, 0.55), f2 = filt('lowpass', 700, 0.4), hs = filt('highshelf', 3000); hs.gain.value = -8;
      const g = c.createGain();
      a.connect(f1); f1.connect(hs); hs.connect(g); b.connect(f2); f2.connect(g); g.connect(out);
      env(g, t, 0.075 * power, 0.28, dur * 0.25, dur * 0.75);
      a.start(t, rand(0, 2)); b.start(t, rand(0, 2)); a.stop(t + dur + 0.6); b.stop(t + dur + 0.6);
      // Fans whistling over the top.
      const n = Math.round(1 + power * 2);
      for (let i = 0; i < n; i++) {
        const o = c.createOscillator(), og = c.createGain(), st = t + rand(0.15, dur * 0.55), f = rand(1900, 2900);
        o.type = 'sine';
        o.frequency.setValueAtTime(f, st);
        o.frequency.linearRampToValueAtTime(f + rand(200, 600), st + 0.12);
        o.frequency.linearRampToValueAtTime(f - rand(300, 700), st + 0.42);
        env(og, st, 0.006 * power, 0.03, 0.25, 0.18);
        o.connect(og); og.connect(out); o.start(st); o.stop(st + 0.5);
      }
    }
    function groan() {
      if (!ctx()) return;
      const t = c.currentTime + 0.02;
      const n = src('brown'), bp = filt('bandpass', 620, 1.3), g = c.createGain();
      bp.frequency.setValueAtTime(620, t); bp.frequency.exponentialRampToValueAtTime(240, t + 1.3);
      n.connect(bp); bp.connect(g); g.connect(out);
      env(g, t, 0.11, 0.18, 0.35, 1.0);
      n.start(t, rand(0, 2)); n.stop(t + 1.7);
      // A low vowel "ohhh" under the noise.
      [0, 1].forEach(k => {
        const o = c.createOscillator(), f = filt('bandpass', 560 + k * 300, 4), og = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(205 + k * 7, t); o.frequency.exponentialRampToValueAtTime(128 + k * 5, t + 1.3);
        env(og, t, 0.010, 0.2, 0.4, 0.9);
        o.connect(f); f.connect(og); og.connect(out); o.start(t); o.stop(t + 1.6);
      });
    }
    function horn(times) {
      if (!ctx()) return;
      for (let k = 0; k < (times || 1); k++) {
        const t = c.currentTime + 0.03 + k * 1.15, len = k === (times || 1) - 1 ? 1.25 : 0.75;
        const lp = filt('lowpass', 1000, 1.2), g = c.createGain();
        lp.connect(g); g.connect(out);
        env(g, t, 0.05, 0.06, len, 0.35);
        [116.5, 146.8, 174.6, 233].forEach((f, i) => [-4, 4].forEach(dt => {
          const o = c.createOscillator();
          o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt + (i === 3 ? 2 : 0);
          o.connect(lp); o.start(t); o.stop(t + len + 0.5);
        }));
      }
    }
    // The ballpark organ: da-da-da-DAAA, da-DAAAAA... then the crowd answers.
    function charge() {
      if (!ctx()) return;
      const t0 = c.currentTime + 0.05;
      const lp = filt('lowpass', 3200, 0.4), g = c.createGain();
      g.gain.value = 1;
      const trem = c.createOscillator(), tg = c.createGain();
      trem.frequency.value = 6.2; tg.gain.value = 0.22; trem.connect(tg); tg.connect(g.gain);
      lp.connect(g); g.connect(out); trem.start(t0); trem.stop(t0 + 2);
      [[392, 0, 0.12], [523.3, 0.15, 0.12], [659.3, 0.3, 0.12], [784, 0.45, 0.3], [659.3, 0.84, 0.11], [784, 0.98, 0.62]].forEach(([f, at, d]) => {
        const t = t0 + at, ng = c.createGain();
        env(ng, t, 0.03, 0.012, d, 0.12);
        ng.connect(lp);
        [[1, 'sine', 1], [2, 'sine', 0.5], [3, 'triangle', 0.18], [4, 'sine', 0.22]].forEach(([m, ty, v]) => {
          const o = c.createOscillator(), og = c.createGain();
          o.type = ty; o.frequency.value = f * m; og.gain.value = v;
          o.connect(og); og.connect(ng); o.start(t); o.stop(t + d + 0.2);
        });
      });
      later(() => { if (wantsCrowd(pageId)) { roar(0.9, 1.3); claps(); } }, 1750);
    }
    function clap(t, v) {
      const n = src('white'), hp = filt('bandpass', 1500, 0.9), g = c.createGain();
      n.connect(hp); hp.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      n.start(t, rand(0, 4)); n.stop(t + 0.15);
    }
    function claps() {
      if (!ctx()) return;
      const t = c.currentTime + 0.4;
      [0, 0.36, 0.86, 1.04, 1.22].forEach(at => { for (let k = 0; k < 4; k++) clap(t + at + rand(0, 0.03), 0.03); });
    }
    function thump(t, v, f) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f || 72, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      env(g, t, v, 0.008, 0.02, 0.18);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.26);
    }
    function heartbeat() {
      if (beat || !ctx()) return;
      const tick = () => {
        if (!ctx() || pageId !== 'g_clutch') return stopBeat();
        const t = c.currentTime + 0.02;
        thump(t, 0.09); thump(t + 0.23, 0.055);
      };
      tick();
      beat = setInterval(tick, 980);
    }
    function stopBeat() { if (beat) { clearInterval(beat); beat = 0; } }
    function drums() {
      if (!ctx()) return;
      const t = c.currentTime + 0.05;
      thump(t + 0.08, 0.12, 90); thump(t + 0.36, 0.14, 84);
      const n = src('white'), lp = filt('lowpass', 900, 0.5), g = c.createGain();
      n.connect(lp); lp.connect(g); g.connect(out);
      env(g, t + 0.36, 0.05, 0.005, 0.02, 0.35); n.start(t + 0.36); n.stop(t + 0.8);
    }
    function chime(us) {
      if (!ctx()) return;
      const t = c.currentTime + 0.02;
      const notes = us ? [[880, 0], [1318.5, 0.11]] : [[330, 0], [247, 0.12]];
      notes.forEach(([f, at]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = us ? 'triangle' : 'square'; o.frequency.value = f;
        env(g, t + at, us ? 0.03 : 0.012, 0.01, 0.06, 0.32);
        o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + 0.5);
      });
    }
    function stopAll() { stopMurmur(true); stopBeat(); }
    return { murmur, stopMurmur, roar, groan, horn, charge, claps, heartbeat, stopBeat, drums, chime, stopAll, check, get running() { return !!mur; } };
  })();

  // Which pages get the crowd, and how loud. Pages in the middle of a game (injected beats, result pages)
  // keep the stadium going so it doesn't flicker on and off.
  const LEVEL = { game_pre: 0.85, g_injury: 0.45, g_moment: 0.62, g_mres: 0.7, g_clutch: 1, g_cmid: 0.95, g_cres: 0.85, g_final: 0.6, g_press: 0.35 };
  let crowdOn = false;
  function wantsCrowd(id) {
    if (isGamePage(id)) return true;
    if (id === '_result' || (S && S.game && !S.game.done && screen === 'play')) return crowdOn;
    return false;
  }
  function ambience(id) {
    const want = wantsCrowd(id);
    crowdOn = want;
    if (!want) { Crowd.stopAll(); return; }
    if (!gestured || !Sound.on) return;
    const lvl = LEVEL[id] != null ? LEVEL[id] : 0.6;
    Crowd.murmur(lvl, id === 'g_press');
    if (id === 'g_clutch') Crowd.heartbeat(); else Crowd.stopBeat();
  }

  // ---------- Kickoff title card ----------
  let kick = null;                    // { el, done(), queue: [] }
  function afterKickoff(fn) { if (kick) kick.queue.push(fn); else fn(); }
  function kickoff(g) {
    if (kick) kick.done();
    const opp = oppOf(g.n);
    const words = String(opp.team).split(' ');
    const nick = words.pop(), city = words.join(' ');
    const yr = (S.year || 1) > 1 ? `Year ${S.year} · ` : '';
    const tag = g.n >= 10 ? (opp.round || 'Playoffs') : `${yr}Week ${g.n + 1} of 10${opp.rival ? ' · Rivalry game' : ''}`;
    const role = { starter: 'Starting', rotation: 'Split snaps', backup: 'Backup', practice: 'On the sideline' }[S.role] || '';
    const el = document.createElement('div');
    el.className = 'kickoff-card' + (RM ? ' still' : '');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="ko-stripes"></div>
      <div class="ko-inner">
        <div class="ko-tag">Game day</div>
        <div class="ko-team us"><span class="ko-city">Harbor City</span><span class="ko-nick">Hammerheads</span></div>
        <div class="ko-vs"><span>vs</span></div>
        <div class="ko-team them"><span class="ko-city">${esc(city)}</span><span class="ko-nick">${esc(nick)}</span></div>
        <div class="ko-foot">${esc(tag)}${role ? ` · No. ${esc(S.num)} · ${esc(role)}` : ''}</div>
      </div>
      <div class="ko-skip">${fine() ? 'Click' : 'Tap'} or press any key</div>`;
    const helm = (name, flip) => (typeof helmetSVG === 'function' ? helmetSVG(name, flip) : '');
    const col = name => (typeof teamStyle === 'function' ? teamStyle(name).c1 : '');
    const home = typeof HOME_TEAM === 'string' ? HOME_TEAM : 'Harbor City Hammerheads';
    el.style.setProperty('--ko-us', col(home) || '#D2500A');
    el.style.setProperty('--ko-them', col(opp.team) || '#E9EEE7');
    el.querySelector('.ko-team.us').insertAdjacentHTML('afterbegin', `<span class="ko-helm">${helm(home)}</span>`);
    el.querySelector('.ko-team.them').insertAdjacentHTML('afterbegin', `<span class="ko-helm">${helm(opp.team, true)}</span>`);
    const queue = [];
    let gone = false;
    const done = () => {
      if (gone) return;
      gone = true;
      window.removeEventListener('keydown', onKey, true);
      el.classList.add('out');
      later(() => el.remove(), RM ? 0 : 220);
      if (kick && kick.el === el) kick = null;
      queue.splice(0).forEach(fn => later(fn, RM ? 0 : 120));
    };
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      done();
      if (e.key === 'Tab') return;          // never get in the way of focus moving
      e.preventDefault(); e.stopImmediatePropagation();
    };
    el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); done(); });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(el);
    kick = { el, done, queue };
    Crowd.drums();
    later(done, RM ? 900 : 1250);
    setTimeout(done, 1500);               // hard limit, no matter what
    if (!RM) later(() => { if (!gone) shake(el.querySelector('.ko-inner'), 0.6); }, 430);
  }

  // ---------- Scoreboard: rolling LED digits, scoring pulse, quarter/clock chip ----------
  function tickDown(clock, secs) {
    const m = String(clock || '').match(/(\d+):(\d+)/);
    if (!m) return '';
    const t = Math.max(0, +m[1] * 60 + +m[2] - secs);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }
  function clockFor(id, g) {
    if (id === 'g_injury') return '9:14';
    if (id === 'g_moment') { const p = g.plan[g.mi]; return p ? p.clock : ''; }
    if (id === 'g_mres') { const p = g.plan[g.mi - 1]; return p ? tickDown(p.clock, 6 + hash(p.clock + g.n) % 30) : ''; }
    if (id === 'g_clutch' || id === 'g_cmid') return typeof clutchClock === 'function' ? clutchClock(g) : g.clock;
    return '';
  }
  function rollHTML(from, to) {
    const a = String(from), b = String(to), len = Math.max(a.length, b.length);
    const pa = a.padStart(len, ' '), pb = b.padStart(len, ' ');
    let h = '', steps = 0;
    for (let i = 0; i < len; i++) {
      const seq = [pa[i]];
      if (pa[i] !== pb[i]) {
        let d = pa[i] === ' ' ? -1 : +pa[i];
        const target = +pb[i];
        let guard = 0;
        while (d !== target && guard++ < 12) { d = (d + 1) % 10; seq.push(String(d)); }
      }
      steps = Math.max(steps, seq.length - 1);
      h += `<span class="jx-col"><span class="jx-strip" data-n="${seq.length - 1}">${seq.map(x => `<span>${x === ' ' ? '&nbsp;' : x}</span>`).join('')}</span></span>`;
    }
    return { h, steps };
  }
  function scoreBoard(el, id) {
    const b = el.querySelector('.board');
    const g = S && S.game;
    if (!b || !g) return;
    const st = J(), key = gameKey(g);
    const prev = st.board && st.board.key === key ? st.board : { us: 0, them: 0 };
    st.board = { key, us: g.us, them: g.them };
    // go() saved the career before this page drew, so save again: a reload must not replay this roll.
    if (prev.us !== g.us || prev.them !== g.them) save();
    const final = !!b.querySelector('.bmid') && /final/i.test(b.querySelector('.bmid').textContent);
    const ot = st.ot === key || g.recap.some(t => /^OT/.test(t));
    // Quarter / clock chip
    const mid = b.querySelector('.bmid');
    if (mid) {
      const q = Math.max(1, Math.min(4, g.q));
      const clock = final ? '' : clockFor(id, g);
      const pips = [1, 2, 3, 4].map(i => `<i class="${final || i <= q ? 'on' : ''}${!final && i === q ? ' now' : ''}"></i>`).join('') + (ot ? '<i class="on ot"></i>' : '');
      mid.innerHTML = `<span class="jx-mid"><span class="jx-q${final ? ' fin' : ''}">${final ? (ot ? 'Final/OT' : 'Final') : 'Q' + q}</span>${clock ? `<span class="jx-clock">${esc(clock)}</span>` : ''}<span class="jx-pips" aria-hidden="true">${pips}</span></span>`;
    }
    const sc = b.querySelectorAll('.bscore'), teams = b.querySelectorAll('.bteam');
    const sides = [['us', prev.us, g.us], ['them', prev.them, g.them]];
    const moving = [];
    sides.forEach(([who, from, to], i) => {
      const s = sc[i];
      if (!s) return;
      if (to === from || RM) return;
      if (to < from) return;             // a fresh game or edited save: just show the number
      const r = rollHTML(from, to);
      s.innerHTML = r.h;
      s.classList.add('jx-rolling');
      moving.push({ s, team: teams[i], who, d: to - from, to, steps: r.steps });
    });
    if (RM) {
      sides.forEach(([who, from, to], i) => { if (to > from && teams[i]) teams[i].classList.add('jx-scored-still'); });
      return;
    }
    if (!moving.length) return;
    const delay = id === 'g_mres' || id === 'g_cres' ? 520 : 260;
    afterKickoff(() => later(() => {
      moving.forEach((m, k) => {
        if (!m.s.isConnected) return;
        const dur = Math.min(1400, 520 + m.steps * 80);
        $$('.jx-strip', m.s).forEach((strip, ci) => {
          strip.style.transition = `transform ${dur}ms cubic-bezier(.2,.9,.25,1.08) ${ci * 70}ms`;
          strip.style.transform = `translateY(-${strip.dataset.n}em)`;
        });
        later(() => { if (m.s.isConnected) { m.s.textContent = String(m.to); m.s.classList.remove('jx-rolling'); } }, dur + 260);
        if (m.team) {
          m.team.classList.remove('jx-scored'); void m.team.offsetWidth; m.team.classList.add('jx-scored', m.who);
          // TV score bug: the team name flips to "+7 TD" for a moment, then back. It sits over the name,
          // so it can never cover the digits or the quarter chip, at any width.
          const nm = m.team.querySelector('.bname');
          if (nm) {
            const what = { 6: 'TD', 7: 'TD', 8: 'TD', 3: 'FG', 2: '2-pt' }[m.d];
            const plus = document.createElement('span');
            plus.className = 'jx-plus ' + m.who;
            plus.setAttribute('aria-hidden', 'true');
            plus.innerHTML = `<b>+${m.d}</b>${what ? `<i>${what}</i>` : ''}`;
            nm.appendChild(plus);
            later(() => plus.remove(), 1900);
          }
        }
        later(() => Crowd.chime(m.who === 'us'), k * 160);
      });
      const sw = document.createElement('span');
      sw.className = 'jx-sweep';
      sw.setAttribute('aria-hidden', 'true');
      b.appendChild(sw);
      later(() => sw.remove(), 1100);
    }, delay));
  }

  // ---------- Big-play stamps on result pages ----------
  const STAMP = {
    TD: ['Touchdown!', 'hype', ['Six on the board. Dance responsibly.', 'Paint the end zone orange.', 'Somebody cue the highlight reel.', 'Somewhere, {fam} just spilled a drink.', 'Hand the ball to the ref like you\'ve been there.', 'Tiny lifts you off the ground. Both feet.', 'The PA guy is losing his voice.', 'That one goes on the fridge.']],
    PICK6: ['Pick six!', 'hype', ['Ball, then end zone. In that order.', 'The defense scores. The building shakes.']],
    SCOOP: ['Scoop & score!', 'hype', ['Ball on the ground, then ball in the end zone.']],
    BIG: ['Big play', 'hype', ['Chunk yardage. The sideline is up.', 'That one goes on a poster.', 'The crowd is on its feet.', 'Okafor allows herself one fist pump.', 'The sideline is waving towels.']],
    FIRST: ['First down', 'good', ['Move the chains.', 'Not pretty. Still counts.', 'The chain gang jogs. You did that.', 'Bramble nods once. That\'s a lot, for Bramble.']],
    GAIN: ['Nice gain', 'good', ['Positive yards. Positive vibes.', 'Fall forward. Always fall forward.', 'Every yard counts.', 'Tiny slaps your helmet on the way back.', 'Bramble nods once. That\'s a lot, for Bramble.']],
    DOOR: ['Knocking on the door', 'good', ['Close enough to smell it.', 'The end zone is right there.', 'Inches. Just inches.']],
    SMART: ['Smart play', 'good', ['Live to fight another down.', 'The boring play is the right play.', 'No harm done. Next snap.']],
    RET: ['Nice return', 'good', ['Field position matters.', 'The coverage team is still looking for you.']],
    NICE: ['Nice play', 'good', ['Bramble nods once. That\'s a lot, for Bramble.', 'Not pretty. Still counts.', 'Tiny slaps your helmet on the way back.']],
    TKL: ['Tackle', 'good', ['Wrap up. Drive through.', 'Textbook.', 'You were there before the ball was.']],
    HELD: ['Fourth-down stop', 'good', ['Turnover on downs. Hammerheads ball.', 'They went for it. The answer was no.']],
    SAVED: ['Play comes back', 'flag', ['Flag on them. Do over.', 'Yellow laundry, and for once it\'s theirs.', 'The ref giveth.', 'Wiped off the books. Breathe.']],
    SACK: ['Sack!', 'hype', ['Quarterback, meet grass.', 'Drive him into the turf.', 'Somebody get that man a map.', 'He never saw you. Nobody ever does.']],
    INTX: ['Interception!', 'hype', ['Thank you very much.', 'Wrong jersey, buddy.']],
    FUMX: ['Fumble!', 'hype', ["Ball out. Ball's ours.", 'Strip, scramble, and it\'s Hammerheads ball.']],
    TAKE: ['Takeaway!', 'hype', ['Hammerheads ball.', 'The defense takes it back.']],
    HIT: ['Big hit', 'hype', ['They heard that in the upper deck.', 'Somebody check on him. Not you. Keep going.']],
    STOP: ['Stuffed', 'hype', ['Nowhere to go.', 'Stonewalled at the line.', 'Wrong gap, pal.', 'Second and long. Your favorite.', 'You were there before the ball was.']],
    PUNT: ['Forced punt', 'good', ['Three and out. Get off the field.', 'Bring out the punter.', 'Their punter finally gets some work.', 'Get off the field. Get some water.']],
    INT: ['Intercepted', 'bad', ['Wrong jersey.', 'The other team says thanks.']],
    SACKED: ['Sacked', 'bad', ["You'll feel that one on Tuesday.", 'Grass stains and regret.', 'Tiny apologizes on the way back to the huddle.']],
    FUMBLE: ['Fumble', 'bad', ["Ball's on the ground.", 'Ball security, rookie.']],
    DROP: ['Dropped', 'bad', ['Right through the hands.', 'It happens. Just not twice.']],
    STUFFED: ['Stuffed', 'bad', ['Nowhere to go.', 'A wall of very large men.', 'The hole closed like a garage door.', 'Get up. Hand the ball back. Go again.']],
    INC: ['Incomplete', 'bad', ['Nothing doing.', 'Clock stops. Shake it off.', 'The ball had other plans.', 'Next play. Short memory.']],
    FLAG: ['Flag on the play', 'bad', ['Yellow laundry.', 'Five yards and a stern look.']],
    DELAY: ['Delay of game', 'bad', ['The play clock wins this one.']],
    BROKEN: ['Broken tackle', 'bad', ["He's still running.", 'Wrap up. Always wrap up.']],
    BURNED: ['Burned', 'bad', ['Back to the film room.', 'They found the soft spot.', 'Vane will have notes.', 'You\'ll see this one on Monday. Twice.']],
    BALLGAME: ['Ballgame', 'hype', ['Victory formation. Take a knee.', 'Shake hands. Go home happy.']],
    DBALL: ['Ballgame', 'hype', ['The defense closes the door.', 'Lights out. Game over.']],
    WALKOFF: ['Walk-off', 'hype', ['The kick is good as time expires.', 'Bedlam in Harbor City.']],
    WALKTD: ['Walk-off TD', 'hype', ['Hammerheads win it at the gun.', 'Nobody is sitting down.']],
    TD2: ['Walk-off TD', 'hype', ['And the two-point try is good!']],
    TWO: ['Two-point good!', 'hype', ['Hammerheads win by one!', 'Two yards. Whole season.']],
    TWOFAIL: ['No good', 'bad', ['A foot short. A game of inches.', 'So close you can taste the turf.']],
    ALIVE: ['Still alive', 'good', ['Clock running. Hurry.', 'Not dead yet. One more.']],
    NOTYET: ['One more snap', 'good', ['Not over yet. Get back out there.', 'Close. Do it again.']],
    DSCORE: ['Touchdown!', 'hype', ['The offense punches it in. Two-point try next.']],
    TDGO: ['Touchdown!', 'hype', ['Now the two-point try decides it.']],
    OTW: ['Overtime win', 'hype', ['Tie it, flip it, win it.']],
    DTAKE: ['Takeaway!', 'hype', ['The offense finishes it. Hammerheads win!']],
    HEART: ['Heartbreak', 'bad', ['Stunned silence.', 'Sixty-eight thousand people go quiet at once.']],
    OTL: ['Lost in OT', 'bad', ['So close it hurts.']],
    DOWNS: ['Turnover on downs', 'bad', ['That was the last chance.']],
    KNEEL: ['Clock runs out', 'bad', ['They kneel on it. Final.']],
    CHAMPS: ['Champions!', 'hype', ['Hammerheads. Champions. Say it again.', 'The confetti is real. So is the ring.']],
  };
  function badCue(t) {
    if (/delay of game/.test(t)) return 'DELAY';
    if (/\bflag\b|false start|offside/.test(t)) return 'FLAG';
    if (!/nearly/.test(t) && /intercept|takes it back the other way|picked off/.test(t)) return 'INT';
    if (/\bsack|on your back/.test(t)) return 'SACKED';
    if (/fumble|pops loose|fall on it/.test(t)) return 'FUMBLE';
    if (/no gain|stuff|for a loss|gang-tackled|behind the line|right where you stood|wraps you up/.test(t)) return 'STUFFED';
    if (/dropped|off your fingertips|through (his|your) hands/.test(t)) return 'DROP';
    if (/incomplete|throw it away|out of bounds|goes somewhere else|overthrown|batted/.test(t)) return 'INC';
    return null;
  }
  // A 'good' play is not always a first down. Read the words: "first down" / "chains move" or a gain that
  // covers the distance in the setup ("Third and six" ... "for eight") earns FIRST; otherwise a neutral stamp.
  const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
  const num = w => (/^\d+$/.test(w) ? +w : NUM[w] || 0);
  const FIRST_RX = /first down|chains move|move the chains|moves the chains|the chains come out|past the (sticks|marker)|at the sticks|over the marker/;
  const NOT_FIRST_RX = /not quite (the first|enough)|short of the (first|marker|sticks)|not (a|the) first down|isn't enough|not enough/;
  function toGo(setup) {
    const m = String(setup || '').toLowerCase().match(/\b(?:first|second|third|fourth|1st|2nd|3rd|4th)[ -]and[ -](goal|inches|a yard|\d+|[a-z]+)/);
    if (!m) return 0;
    if (m[1] === 'goal') return 'goal';
    return m[1] === 'inches' || m[1] === 'a yard' ? 1 : num(m[1]);
  }
  function gained(t) {
    for (const rx of [/\b(\d+|[a-z]+) (?:more |hard |tough |big )?yards?\b(?! short)/g, /\bpicks? up (\d+|[a-z]+)\b/g, /\bfor (\d+|[a-z]+)\b/g]) {
      for (const m of t.matchAll(rx)) { const v = num(m[1]); if (v) return v; }
    }
    return 0;
  }
  function goodOffense(t, setup) {
    const no = NOT_FIRST_RX.test(t);
    if (FIRST_RX.test(t) && !no) return 'FIRST';
    if (/throws? it away|throws? it into the stands|incomplete/.test(t)) return 'SMART';
    if (/\bfield (it|the punt|the kick)\b|kickoff|\breturn/.test(t)) return 'RET';
    if (/end zone|goal line|the plane/.test(t)) return 'NICE';
    const go = toGo(setup), yd = gained(t);
    if (go === 'goal' || /\bat the [1-5]\b|so close|inches short|smell it|and goal\b/.test(t)) return 'DOOR';
    if (!no && yd && go && yd >= go) return 'FIRST';
    if (yd || /gain|yards|catch|caught|hauls? it in|picks? up/.test(t)) return 'GAIN';
    return 'NICE';
  }
  // Turn a play into a stamp code. p = { r, td, note, moment, clutch, success, saved, pending }, text = what happened,
  // notes = the drive notes under it.
  function classify(p, text, notes) {
    const t = String(text || '').toLowerCase(), lb = S.pos === 'LB', tag = p.moment && p.moment.tag;
    const n = String(notes || (p.clutch ? '' : p.note) || '').toLowerCase();
    // A rescued play: a flag on them wiped it out. Only the clutch drive's final result outranks that.
    if (p.saved && !(p.clutch && (p.success || p.note === 'td'))) return 'SAVED';
    if (p.clutch) {
      if (p.pending) {
        if (p.note === 'td') return lb ? 'DSCORE' : 'TDGO';
        return p.chase ? 'ALIVE' : 'NOTYET';
      }
      if (p.success) {
        if (p.note === 'two') return 'TWO';
        if (p.note === 'ot') return 'OTW';
        if (lb) return p.note === 'hold' ? 'DBALL' : 'DTAKE';
        return { hold: 'BALLGAME', fg: 'WALKOFF', td: 'WALKTD', td2: 'TD2' }[p.note] || 'BALLGAME';
      }
      if (p.note === 'twofail') return 'TWOFAIL';
      if (p.note === 'otl') return 'OTL';
      if (p.note === 'lost') return 'HEART';
      return badCue(t) || (lb ? 'KNEEL' : 'DOWNS');
    }
    if (p.r === 'great') {
      if (lb) {
        if (p.td) return /fumble|punch|rip/.test(t) ? 'SCOOP' : 'PICK6';
        if (tag === 'sack' || /\bsack/.test(t)) return 'SACK';
        if (/intercept/.test(t)) return 'INTX';
        if (/fumble|punch it out|rip the ball/.test(t)) return 'FUMX';
        if (tag === 'take') return 'TAKE';
        if (/on his back|lawn chair|erupts|bury/.test(t)) return 'HIT';
        return 'STOP';
      }
      return p.td ? 'TD' : 'BIG';
    }
    if (p.r === 'good') {
      if (!lb) return goodOffense(t, p.moment && p.moment.setup);
      const all = t + ' ' + n;
      if (/on downs/.test(all)) return 'HELD';
      return /punt|three and out/.test(all) ? 'PUNT' : 'TKL';
    }
    const cue = badCue(t);
    if (lb) {
      if (cue === 'FLAG' || cue === 'DELAY') return cue;
      return /juke|slip|spin|stroll|keeps going|swallows|flying/.test(t) ? 'BROKEN' : 'BURNED';
    }
    return cue || (S.pos === 'RB' ? 'STUFFED' : 'INC');
  }
  function stampHTML(code, key, tagText, subText) {
    const s = STAMP[code];
    if (!s) return '';
    const sub = subText || pickBy(s[2], key);
    let style = '';
    if (s[1] === 'flag' && typeof teamStyle === 'function') {
      const ts = teamStyle(typeof HOME_TEAM === 'string' ? HOME_TEAM : 'Harbor City Hammerheads');
      if (ts && ts.c1) style = ` style="--jx-team:${esc(ts.c1)}"`;
    }
    return `<div class="jx-stamp tone-${s[1]}${RM ? ' still' : ''}" data-code="${code}"${style}>
      <div class="jx-st-bar"><span class="jx-st-tag">${esc(tagText)}</span><span class="jx-st-word">${esc(s[0])}</span><span class="jx-st-shine" aria-hidden="true"></span></div>
      <div class="jx-st-sub">${fmt(sub)}</div></div>`;
  }
  // Rebuild what happened on a result page from its saved args, so a reload shows the same stamp.
  function playFromPage(id) {
    const g = S.game, a = (S.at && S.at.args) || {};
    const body = Array.isArray(a.body) ? a.body : [];
    const text = body.filter(x => typeof x === 'string').join(' ');
    const notes = body.filter(x => x && typeof x === 'object' && x.note).map(x => x.note).join(' ');
    // The result page on screen is always the latest play, so the engine's lastSaved flag belongs to it.
    const saved = !!g.lastSaved || (/yellow flag|there's a flag/i.test(notes) && /comes back|do over/i.test(notes));
    if (id === 'g_mres') {
      const pl = g.plan[g.mi - 1];
      const m = pl ? MOMENTS[S.pos][pl.m] : null;
      return { r: a.r, td: /touchdown/i.test(notes), moment: m, clutch: false, success: a.r !== 'bad', saved, text, notes };
    }
    const chase = !!(g.cl && g.cl.d0 <= 0);
    if (id === 'g_cmid') return { r: 'good', note: a.title === 'Touchdown!' ? 'td' : '', clutch: true, pending: true, success: null, chase, saved, text, notes };
    const note = Object.keys(CLUTCH_NOTES).find(k => notes.indexOf(CLUTCH_NOTES[k]) >= 0) || (a.success ? 'hold' : 'short');
    return { r: a.success ? 'good' : 'bad', note, clutch: true, success: !!a.success, chase, saved, text, notes };
  }
  let fresh = null;          // the last 'play' event, until its result page renders
  function resultPage(el, id) {
    const g = S.game;
    if (!g) return;
    const live = fresh && Date.now() - fresh.at < 4000 ? fresh.p : null;
    fresh = null;
    const fromPage = playFromPage(id);
    const p = live ? Object.assign({ chase: fromPage.chase }, live) : fromPage;
    if (p.saved == null) p.saved = fromPage.saved;
    if (!p.moment && fromPage.moment) p.moment = fromPage.moment;
    const code = classify(p, fromPage.text, fromPage.notes);
    const clk = clockFor(id, g);
    const tagText = id === 'g_cres' ? 'Final play' : `Q${id === 'g_mres' ? Math.max(1, g.q) : 4}${clk ? ' · ' + clk : ''}`;
    // The two-point line has to match the score: down 1 after the touchdown wins it, down 2 only ties it.
    const d = g.us - g.them;
    const sub = code === 'TDGO' ? (d === -1 ? 'Six on the board. Two more to win it.' : d === -2 ? 'Six on the board. Two more to tie it.' : '') : '';
    const h = stampHTML(code, `${gameKey(g)}-${g.res.length}-${code}`, tagText || 'Q4', sub);
    if (!h) return;
    const anchor = el.querySelector('.board') || el.querySelector('.story');
    if (!anchor) return;
    anchor.insertAdjacentHTML('beforebegin', h);
    if (!live) return;                    // a reload: show the stamp, skip the fireworks
    const stamp = el.querySelector('.jx-stamp');
    const tone = STAMP[code][1];
    const big = p.td || (p.clutch && p.success) || code === 'PICK6' || code === 'SCOOP' || code === 'DSCORE';
    afterKickoff(() => later(() => {
      if (pageId !== id || !(stamp && stamp.isConnected)) return;   // the player already moved on
      const r = stamp.getBoundingClientRect();
      const cx = r ? r.left + r.width / 2 : null, cy = r ? r.top + r.height / 2 : null;
      if (big) {
        Confetti.touchdown(cx, cy != null ? Math.max(40, cy) : null);
        flash('great');
        Crowd.roar(p.clutch ? 1.5 : 1.25, p.clutch ? 3.2 : 2.6);
        buzz([45, 70, 45]);
      } else if (tone === 'hype') {
        flash('great');
        if (cx != null) Confetti.sparkle(cx, Math.max(40, cy), 22);
        if (code === 'SACK' || code === 'HIT' || code === 'STOP') { shake($('#sheet'), 0.8); buzz(40); }
      } else if (tone === 'flag') {
        // Relief, not celebration: a puff of yellow off the flag and the crowd exhaling.
        if (cx != null) Confetti.sparkle(r.left + 26, Math.max(40, cy), 14, { colors: [['#FFD21E', '#FFF3C4'], ['#FFC400', '#FFE680']], speed: 240 });
        Crowd.roar(0.5, 1.3);
        buzz(30);
      } else if (tone === 'bad') {
        shake($('#sheet'), code === 'SACKED' || code === 'FUMBLE' || code === 'INT' || code === 'HEART' || code === 'OTL' ? 1.25 : 0.9);
        flash('bad');
        buzz(90);
        if (p.clutch && !p.pending) Crowd.groan();
      }
    }, RM ? 0 : 170));
  }

  // ---------- Stat floats on the player card ----------
  const Floats = (() => {
    let layer = null, raf = 0, pending = [];
    const list = [];
    const MINI = { skill: 1, conf: 2, energy: 3, money: 4 };
    function ensure() {
      if (!layer) { layer = document.createElement('div'); layer.className = 'jx-floats'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); }
    }
    function target(k) {
      const card = $('#card');
      if (!card) return null;
      const body = card.querySelector('.pc-body');
      const open = body && body.offsetParent !== null && body.getClientRects().length;
      if (open) {
        if (k === 'money') return { el: card.querySelector('.pc-money b') };
        if (k === 'vane') return { el: card.querySelector('.meter-row[title^="Marcus"] .mv') };
        return { el: card.querySelector(`.meter-row[data-stat="${k}"] .mv`) };
      }
      // Collapsed card (phones): only the four headline numbers are visible. The chip sits inside that
      // number's own cell; the other stats are already spelled out in the toast.
      if (MINI[k]) return { el: card.querySelector(`.pc-mini > span:nth-child(${MINI[k]}) b`), cell: true };
      return null;
    }
    function txt(k, d) {
      const sign = d > 0 ? '+' : '−';
      if (k === 'money') { const a = Math.abs(d); return sign + (a >= 1000 ? '$' + Math.round(a / 1000) + 'K' : money(a)); }
      return `${sign}${Math.abs(d)}`;
    }
    function spawn(changes) {
      if (screen !== 'play' || !$('#card')) return;
      ensure();
      const now = performance.now();
      changes.forEach(([k, d], i) => {
        const tg = target(k);
        if (!tg || !tg.el) return;
        // One chip per stat. A second change while the first is still up adds to it, so chips never
        // stack up out of their row and over the labels above.
        const old = list.findIndex(f => f.k === k);
        if (old >= 0) { const o = list[old]; if (now - o.born < 900) d += o.d; o.el.remove(); list.splice(old, 1); }
        if (!d) return;
        if (tg.cell && !RM) {
          // Pop the number itself too.
          tg.el.classList.remove('jx-pop-up', 'jx-pop-down'); void tg.el.offsetWidth;
          tg.el.classList.add(d > 0 ? 'jx-pop-up' : 'jx-pop-down');
        }
        const el = document.createElement('div');
        el.className = 'jx-float ' + (d > 0 ? 'up' : 'down') + (k === 'money' ? ' cash' : '') + (tg.cell ? ' cell' : '') + (RM ? ' still' : '');
        el.innerHTML = `<span>${esc(txt(k, d))}</span>`;
        layer.appendChild(el);
        list.push({ el, k, d, cell: !!tg.cell, born: now + i * 40, popEl: tg.el });
      });
      if (!raf && list.length) raf = requestAnimationFrame(tick);
    }
    function tick() {
      const now = performance.now(), vw = window.innerWidth;
      for (let i = list.length - 1; i >= 0; i--) {
        const f = list[i];
        if (now - f.born > (RM ? 1700 : 1300)) { f.el.remove(); list.splice(i, 1); continue; }
        const tg = target(f.k);
        const r = tg && tg.el && tg.el.getClientRects().length ? tg.el.getBoundingClientRect() : null;
        if (!r || r.top < 52 || r.top > window.innerHeight - 10 || !!tg.cell !== f.cell) { f.el.style.visibility = 'hidden'; continue; }
        f.el.style.visibility = '';
        if (f.cell && !RM && tg.el !== f.popEl && now - f.born < 450) { tg.el.classList.add(f.d > 0 ? 'jx-pop-up' : 'jx-pop-down'); f.popEl = tg.el; }
        const w = f.el.offsetWidth || 40, h = f.el.offsetHeight || 20;
        let x = Math.min(vw - w - 6, r.right + 6);
        const y = r.top + r.height / 2 - h / 2;
        if (f.cell) {
          // Over the stat's own label ("Skill 47" reads "+2 47" for a moment). The money cell has no label,
          // so its chip sits just right of the number, short of the "Show card" text.
          const cell = tg.el.parentElement, cr = cell.getBoundingClientRect(), room = r.left - cr.left;
          if (room >= w + 2) x = r.left - w - 3;
          else if (room > 8) x = cr.left - 2;
          else {
            const tog = tg.el.closest('.pc-toggle'), lab = tog && tog.lastElementChild;
            const limit = lab && !lab.contains(tg.el) ? lab.getBoundingClientRect().left - 4 : vw - 6;
            x = Math.max(cr.left, Math.min(r.right + 4, limit - w));
          }
        }
        f.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
      raf = list.length ? requestAnimationFrame(tick) : 0;
    }
    return {
      queue(changes) { pending.push({ at: Date.now(), changes }); },
      flush() {
        const p = pending.filter(x => Date.now() - x.at < 600);
        pending = [];
        p.forEach(x => spawn(x.changes));
      },
      clear() { pending = []; list.splice(0).forEach(f => f.el.remove()); },
    };
  })();

  // ---------- Toasts on phones: one at a time, in order ----------
  // The engine keeps a single toast on narrow screens by dropping the older one at once, so a "Challenge
  // complete" could vanish before anyone read it when a stat toast followed. Queue them instead: each one
  // gets at least ~1.3 s (trophies longer) before the next slides in, and the stack never grows down over
  // the player card.
  if (typeof toast === 'function') {
    const orig = toast, q = [];
    let timer = 0, shownAt = 0, curCls = '';
    const narrow = () => window.innerWidth <= 880;
    const minFor = cls => (cls === 'trophy' ? 2400 : 1300);
    const showNow = (text, cls) => { shownAt = Date.now(); curCls = cls || ''; orig(text, cls); };
    const advance = () => {
      timer = 0;
      const box = $('#toasts');
      if (box) [...box.children].forEach(t => { if (!t.classList.contains('out')) { t.classList.add('out'); setTimeout(() => t.remove(), 320); } });
      timer = setTimeout(() => {
        timer = 0;
        const n = q.shift();
        if (!n) return;
        showNow(n[0], n[1]);
        if (q.length) timer = setTimeout(advance, minFor(n[1]));
      }, 180);
    };
    toast = function (text, cls) {
      if (!narrow()) { q.length = 0; return orig.apply(this, arguments); }
      const box = $('#toasts');
      const live = box && [...box.children].some(t => !t.classList.contains('out'));
      if (!live && !q.length && !timer) return showNow(text, cls);
      q.push([text, cls]);
      // Too many waiting: drop the oldest stat-change row first (the card's chips already showed it), so a
      // level-up, perk, challenge or award message is never the one that gets thrown away.
      while (q.length > 4) {
        const i = q.findIndex(x => Array.isArray(x[0]));
        q.splice(i >= 0 ? i : 0, 1);
      }
      if (!timer) timer = setTimeout(advance, Math.max(0, shownAt + minFor(curCls) - Date.now()));
    };
  }

  // ---------- Hooks ----------
  const markGesture = () => {
    if (gestured) return;
    gestured = true;
    // If the page was reloaded mid-game, the crowd comes back on the first tap.
    if (S && S.at && screen === 'play') later(() => ambience(S.at.id), 0);
  };
  window.addEventListener('pointerdown', markGesture, { capture: true, passive: true });
  window.addEventListener('keydown', markGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', markGesture, { capture: true, passive: true });
  const sb = $('#soundBtn');
  if (sb) sb.addEventListener('click', () => later(() => {
    if (!Sound.on) Crowd.stopAll();
    else if (S && S.at && screen === 'play') ambience(S.at.id);
  }, 0));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Crowd.stopAll();
    else if (S && S.at && screen === 'play') ambience(S.at.id);
  });

  on('title', () => { pageId = null; crowdOn = false; Crowd.stopAll(); Floats.clear(); document.body.classList.remove('jx-clutch'); if (kick) kick.done(); });

  on('gameStart', g => {
    if (!g) return;
    const st = J();
    st.board = { key: gameKey(g), us: 0, them: 0 };
    if (st.ot === gameKey(g)) st.ot = null;
    kickoff(g);
  });

  on('play', p => {
    if (!p || !S || !S.game) return;
    fresh = { at: Date.now(), p };
    if (p.clutch && (p.note === 'ot' || p.note === 'otl')) J().ot = gameKey(S.game);
  });

  let finalFx = null;
  on('gameEnd', g => { if (g) finalFx = { n: g.n, key: gameKey(g), won: !!g.won, champ: g.won && g.n === 12, po: g.n >= 10, at: Date.now() }; });

  on('miniEnd', r => {
    const inGame = S && S.game && !S.game.done && isGamePage(pageId);
    const mg = $('#mini .mg');
    if (r === 'great') {
      flash('great');
      if (mg) { const b = mg.getBoundingClientRect(); Confetti.sparkle(b.left + b.width / 2, b.top + b.height / 2, 26, { speed: 380 }); }
      if (inGame) Crowd.roar(0.75, 1.6);
    } else if (r === 'bad') {
      if (mg) shake(mg, 0.7);
      if (inGame) Crowd.groan();
      buzz(60);
    } else if (inGame) Crowd.roar(0.4, 1.1);
    if (pageId === 'g_clutch') Crowd.stopBeat();
  });

  let endingFx = null, chargedFor = '';
  on('ending', id => { endingFx = { id, at: Date.now() }; });

  // Trophy unlocks: the engine shows one .trophy-pop card at a time (queued), so sparkle on each card as it
  // slides in, from its star and from its far edge. If no card shows up at all, sparkle near the top instead.
  const sparkleTrophy = el => {
    if (!el.isConnected) return;
    const star = el.querySelector('.tp-star') || el, r = star.getBoundingClientRect(), box = el.getBoundingClientRect();
    if (!r.width) return;
    Confetti.sparkle(r.left + r.width / 2, r.top + r.height / 2, 22, { speed: 300 });
    Confetti.sparkle(box.right - 18, box.top + box.height / 2, 12, { speed: 220 });
  };
  try {
    new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && n.classList.contains('trophy-pop')) later(() => sparkleTrophy(n), RM ? 0 : 480);
    }))).observe(document.body, { childList: true });
  } catch (e) { /* no observer: the fallback below still sparkles */ }
  on('award', () => later(() => { if (!document.querySelector('.trophy-pop')) Confetti.sparkle(window.innerWidth / 2, 84, 24); }, 120));

  on('fx', changes => { if (Array.isArray(changes) && changes.length) Floats.queue(changes); });
  on('card', () => Floats.flush());

  on('page', (pg, el, id) => {
    // Confetti belongs to the page that fired it. A new page lets it drift away; a mini-game page clears it
    // at once so nothing falls across a timing bar or a reaction pad.
    if (pg && pg.mini) Confetti.clear(0.18);
    else if (id !== pageId) Confetti.clear(0.6);
    pageId = id;
    document.body.classList.toggle('jx-clutch', id === 'g_clutch');
    ambience(id);
    if (!el || !S) return;
    if (pg && pg.board) scoreBoard(el, id);
    if (id === 'g_mres' || id === 'g_cres' || id === 'g_cmid') resultPage(el, id);
    else fresh = null;
    if (id === 'g_clutch') {
      // The organ plays CHARGE! on the first snap of the drive; later snaps get the crowd clapping.
      const snap = (S.game && S.game.cl && S.game.cl.snap) || 0, key = S.game ? `${gameKey(S.game)}-${snap}` : '';
      if (key !== chargedFor) {          // once per snap, not again when the page re-renders
        chargedFor = key;
        afterKickoff(() => later(() => { if (pageId !== 'g_clutch') return; if (!snap) Crowd.charge(); else { Crowd.claps(); Crowd.roar(0.5, 1.4); } }, 250));
      }
    }
    if (id === 'g_final' && S.game) {
      const g = S.game, f = finalFx && finalFx.key === gameKey(g) && Date.now() - finalFx.at < 5000 ? finalFx : null;
      finalFx = null;
      if (g.won && g.n === 12) {
        const anchor = el.querySelector('.board');
        if (anchor) anchor.insertAdjacentHTML('beforebegin', stampHTML('CHAMPS', gameKey(g), 'Final'));
      }
      if (f) afterKickoff(() => later(() => {
        if (pageId !== 'g_final') return;
        if (f.champ) { Confetti.huge(); Crowd.horn(3); Crowd.roar(1.8, 4.5); buzz([60, 80, 60, 80, 120]); }
        else if (f.won) { Confetti.win(); if (f.po) later(() => { if (pageId === 'g_final') Confetti.cannons(120); }, 700); Crowd.horn(f.po ? 2 : 1); Crowd.roar(1.1, 2.6); }
        else Crowd.groan();
      }, 380));
    }
    if (id === 'ending' && endingFx) {
      const e = endingFx;
      endingFx = null;
      if (Date.now() - e.at < 5000) {
        if (e.id === 'legend') later(() => { if (pageId === 'ending') Confetti.huge(); }, 300);
        else if (S.flags.champion) later(() => { if (pageId === 'ending') Confetti.win(); }, 300);
      }
    }
  });

  // Public helpers for other modules (all respect reduced motion and the sound toggle).
  return {
    confetti: Confetti,               // .pop(x,y) .touchdown(x,y) .win() .huge() .sparkle(x,y,n) .burst({...})
    flash, shake, buzz,
    crowd: Crowd,                     // .roar(power, dur) .groan() .horn(times) .charge() .claps() .chime(us)
    afterKickoff,
    get kickoffActive() { return !!kick; },
    classify,
  };
})();
// Let automated tests peek at the effects (window.__undrafted is created by 99-boot, after this file runs).
setTimeout(() => { if (window.__undrafted && !window.__undrafted.juice) window.__undrafted.juice = Juice; }, 0);
