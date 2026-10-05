
// =========================================================
//   FIELD KIT — shared canvas, drawing and input helpers for the arcade mini-games
// =========================================================
// Coordinates: every arcade game works in "field units": x from 0 (left sideline) to 100 (right sideline),
// y grows downward. Field.mount() gives a canvas plus a `u` scale (pixels per field unit) so games stay
// resolution independent. The turf is drawn top-down with yard lines every 10 units.
const Field = {
  colors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => (cs.getPropertyValue(n).trim() || d);
    return {
      turfA: v('--turf-a', '#2E6E3E'), turfB: v('--turf-b', '#245A32'), chalk: '#FFFFFF',
      us: v('--pylon', '#D2500A'), usInk: '#FFFFFF', them: '#F4F6F2', themInk: '#14203A', themEdge: '#14203A',
      led: v('--led', '#FFB21E'), bad: '#FF6E61', good: '#5BD68A', ball: '#7A3E1D', shadow: 'rgba(0,0,0,.28)',
    };
  },

  // Builds the panel: header, canvas, touch controls, help row. Returns { canvas, ctx, W, H, u, c, panel, ... }.
  // opts: { aspect: height/width (default .62), minH, maxH, controls: ['left','right','action'] | [], actionLabel, help }
  mount(host, cfg, opts) {
    opts = opts || {};
    host.innerHTML = `<div class="mg mg-arcade">${mgHead(cfg)}
      <div class="arcade-wrap"><canvas class="arcade-canvas" role="img" aria-label="${esc(opts.aria || 'Play field')}"></canvas>
        <div class="arcade-overlay"><button class="mg-btn arcade-start" type="button">${esc(opts.startLabel || 'Snap it')}</button></div>
      </div>
      ${(opts.controls || []).length ? `<div class="arcade-pad">${opts.controls.map(c => `<button class="pad-btn arcade-ctl" type="button" data-ctl="${c}" aria-label="${c}">${{ left: '◀', right: '▶', up: '▲', down: '▼', action: esc(opts.actionLabel || 'GO') }[c] || esc(c)}</button>`).join('')}</div>` : ''}
      <div class="mg-row"><span class="mg-help">${opts.help || ''}</span></div></div>`;
    const panel = host.querySelector('.mg');
    const canvas = host.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const f = { host, panel, canvas, ctx, c: Field.colors(), W: 0, H: 0, u: 1, dpr: 1 };
    f.resize = () => {
      const w = canvas.parentElement.clientWidth || 600;
      const h = clamp(Math.round(w * (opts.aspect || 0.62)), opts.minH || 220, opts.maxH || 420);
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Object.assign(f, { W: w, H: h, u: w / 100, dpr });
    };
    f.resize();
    f.onStart = fn => {
      const b = host.querySelector('.arcade-start');
      const go = () => { if (f.started) return; f.started = true; host.querySelector('.arcade-overlay').hidden = true; Sound.play('whistle'); fn(); };
      b.addEventListener('click', go);
      f.start = go;
    };
    return f;
  },

  // Continuous input: keyboard (arrows/WASD + Space/Enter), on-screen pad buttons (hold), and pointer on canvas.
  // Returns { s: {left,right,up,down,action}, pointer: {x,y,down} (field units) | null, pressed(name) one-shot, destroy() }
  input(f, opts) {
    opts = opts || {};
    const s = { left: false, right: false, up: false, down: false, action: false };
    const shots = new Set();
    const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'action', Enter: 'action' };
    const api = { s, pointer: null, map };
    const set = (name, v) => { if (v && !s[name]) shots.add(name); s[name] = v; if (opts.onChange) opts.onChange(name, v); };
    const kd = e => { const n = map[e.key]; if (n && !e.metaKey && !e.ctrlKey) { set(n, true); } };
    const ku = e => { const n = map[e.key]; if (n) set(n, false); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const blur = () => Object.keys(s).forEach(k => { s[k] = false; });
    window.addEventListener('blur', blur);
    // Pad buttons: hold to press.
    $$('.arcade-ctl', f.host).forEach(b => {
      const n = b.dataset.ctl;
      b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } set(n, true); b.classList.add('on'); });
      const up = () => { set(n, false); b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    // Pointer on the canvas (field units).
    const toField = e => { const r = f.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / f.u, y: (e.clientY - r.top) / f.u }; };
    if (opts.pointer !== false) {
      f.canvas.addEventListener('pointerdown', e => { e.preventDefault(); api.pointer = Object.assign(toField(e), { down: true }); shots.add('tap'); try { f.canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } if (opts.onTap) opts.onTap(api.pointer); });
      f.canvas.addEventListener('pointermove', e => { if (api.pointer && api.pointer.down) Object.assign(api.pointer, toField(e)); else if (opts.hover) api.pointer = Object.assign(toField(e), { down: false }); });
      const end = () => { if (api.pointer) api.pointer.down = false; };
      f.canvas.addEventListener('pointerup', end); f.canvas.addEventListener('pointercancel', end);
    }
    api.pressed = n => { const had = shots.has(n); shots.delete(n); return had; };
    // Use as mini.key: claim the game keys so the page doesn't scroll or pick choices.
    api.claims = e => !!map[e.key] || /^[1-9]$/.test(e.key);
    api.destroy = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
    return api;
  },

  // requestAnimationFrame loop. step(dt seconds, elapsed seconds) returns false to stop.
  loop(step) {
    let raf = 0, last = 0, t = 0, alive = true;
    const frame = now => {
      if (!alive) return;
      if (!last) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      if (step(dt, t) === false) { alive = false; return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return { stop() { alive = false; cancelAnimationFrame(raf); } };
  },

  // Top-down turf. scroll moves the yard lines (field units); los / firstDown draw the blue/yellow TV lines.
  drawTurf(f, o) {
    o = o || {};
    const { ctx, W, H, u, c } = f;
    const scroll = o.scroll || 0;
    const stripe = 10 * u;
    for (let y = -((scroll * u) % (stripe * 2)) - stripe * 2; y < H + stripe; y += stripe) {
      const i = Math.round((y + scroll * u) / stripe);
      ctx.fillStyle = i % 2 ? c.turfA : c.turfB;
      ctx.fillRect(0, y, W, stripe + 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = Math.max(1, u * 0.35);
    const off = ((scroll * u) % stripe + stripe) % stripe;
    for (let y = -off; y < H + stripe; y += stripe) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      // hash marks
      ctx.beginPath();
      for (const hx of [36, 64]) { ctx.moveTo(hx * u - u, y + stripe / 2); ctx.lineTo(hx * u + u, y + stripe / 2); }
      ctx.stroke();
    }
    if (o.yardNumbers !== false) {
      // Yard lines sit every 10 units of field y. Line at field y = 0 is yard `baseYard`; yards count up going up the screen.
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.font = `${Math.round(u * 5)}px Graduate, Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const first = Math.floor(scroll / 10) - 1, last = Math.ceil((scroll + H / u) / 10) + 1;
      for (let k = first; k <= last; k++) {
        const y = (k * 10 - scroll) * u;
        let yard = (((o.baseYard != null ? o.baseYard : 30) - k * 10) % 100 + 100) % 100;
        if (yard > 50) yard = 100 - yard;
        if (yard === 0) continue;
        ctx.save(); ctx.translate(9 * u, y); ctx.rotate(-Math.PI / 2); ctx.fillText(String(yard), 0, 0); ctx.restore();
        ctx.save(); ctx.translate(91 * u, y); ctx.rotate(Math.PI / 2); ctx.fillText(String(yard), 0, 0); ctx.restore();
      }
    }
    if (o.los != null) { ctx.fillStyle = 'rgba(80,150,255,.8)'; ctx.fillRect(0, (o.los - scroll) * u - u * 0.35, W, u * 0.7); }
    if (o.firstDown != null) { ctx.fillStyle = 'rgba(255,214,0,.85)'; ctx.fillRect(0, (o.firstDown - scroll) * u - u * 0.35, W, u * 0.7); }
    if (o.endZone != null) {
      const y = (o.endZone - scroll) * u;
      if (y > -H) { ctx.fillStyle = 'rgba(210,80,10,.32)'; ctx.fillRect(0, y - 10 * stripe, W, 10 * stripe); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(0, y - u * 0.4, W, u * 0.8); }
    }
  },

  // A player token seen from above. team: 'us' | 'them'. Optional: num, ball (carrying), ring (highlight color), r (radius in units).
  drawPlayer(f, x, y, o) {
    o = o || {};
    const { ctx, u, c } = f;
    const r = (o.r || 3.2) * u;
    const px = x * u, py = y * u;
    ctx.fillStyle = c.shadow;
    ctx.beginPath(); ctx.ellipse(px + r * 0.18, py + r * 0.28, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = Math.max(2, u * 0.7); ctx.beginPath(); ctx.arc(px, py, r + u * 1.1, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = o.team === 'them' ? c.them : c.us;
    ctx.strokeStyle = o.team === 'them' ? c.themEdge : 'rgba(0,0,0,.35)';
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (o.num != null) {
      ctx.fillStyle = o.team === 'them' ? c.themInk : c.usInk;
      ctx.font = `700 ${Math.round(r * 0.95)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(o.num), px, py + r * 0.04);
    }
    if (o.ball) Field.drawBall(f, x + (o.r || 3.2) * 0.7, y - (o.r || 3.2) * 0.2, 0.8);
  },

  // Football: s = scale (1 = normal), lift = height in units for a pass in flight (draws a shadow below).
  drawBall(f, x, y, s, lift, angle) {
    const { ctx, u, c } = f;
    s = s || 1; lift = lift || 0;
    const px = x * u, py = y * u;
    if (lift > 0) { ctx.fillStyle = c.shadow; ctx.beginPath(); ctx.ellipse(px, py, u * 1.2 * s, u * 0.7 * s, 0, 0, Math.PI * 2); ctx.fill(); }
    const by = py - lift * u;
    ctx.save(); ctx.translate(px, by); ctx.rotate(angle || -0.5);
    ctx.fillStyle = c.ball; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = Math.max(1, u * 0.2);
    ctx.beginPath(); ctx.ellipse(0, 0, u * 1.6 * s, u * 1.0 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1, u * 0.18);
    ctx.beginPath(); ctx.moveTo(-u * 0.6 * s, 0); ctx.lineTo(u * 0.6 * s, 0); ctx.stroke();
    ctx.restore();
  },

  // Centered label drawn on the canvas, e.g. a "TACKLED" callout. size in field units.
  text(f, str, x, y, o) {
    o = o || {};
    const { ctx, u } = f;
    ctx.font = `${o.weight || 700} ${Math.round((o.size || 5) * u)}px ${o.display ? 'Graduate, Georgia, serif' : '"Barlow Condensed", "Arial Narrow", sans-serif'}`;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    if (o.stroke !== false) { ctx.lineWidth = Math.max(2, u * 0.8); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(str, x * u, y * u); }
    ctx.fillStyle = o.color || '#FFFFFF';
    ctx.fillText(str, x * u, y * u);
  },

  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
};
