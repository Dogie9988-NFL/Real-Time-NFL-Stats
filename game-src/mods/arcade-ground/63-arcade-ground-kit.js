// =========================================================
//   ARCADE GROUND KIT — shared helpers for the 'run' (RB) and 'pursuit' (LB) arcade mini-games
// =========================================================
// Everything lives under one name, AG, so nothing collides with other modules in the shared scope.
// World coordinates: x = 0..100 across the field (sidelines at 3 and 97), y grows DOWN the screen.
// Two world units = one yard. The Hammerheads' own goal line is y = 0 (bottom); the opponent's goal line
// is y = -200 (top). A spot `yd` yards from the Hammerheads' goal line is world y = -2 * yd.
const AG = (() => {
  const R = 2.7;           // player radius (world units)
  const SIDE_L = 3, SIDE_R = 97;
  // Helmet colors for opponents (by nickname). Anything else gets a deep maroon.
  const HELMETS = {
    Gulls: ['#127A80', '#F2F7F4'], Vipers: ['#2B2B2B', '#D9B36C'], Lumberjacks: ['#9E1F1F', '#1E1E1E'], Smelters: ['#232323', '#F2C230'],
    Monarchs: ['#4A2C82', '#E8C25A'], Hurricanes: ['#1F4E8C', '#9FD4F0'], Mustangs: ['#2350B8', '#F2F2F2'], Bison: ['#5A3A22', '#E8D3A9'],
    Jackpots: ['#1C1C1C', '#E4B634'], Grizzlies: ['#4B2E1E', '#C9A66B'], Sentinels: ['#20304F', '#C8CFD8'],
  };
  const US = { helmet: '#16213B', stripe: '#FF8A3D' };

  // ---------- small utils ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const stat = () => (S && S.st) || { skill: 45, conf: 50, energy: 80 };
  const oppName = () => { try { return S && S.game ? shortName(oppOf(S.game.n).team) : null; } catch (e) { return null; } };
  const oppHelmet = () => HELMETS[oppName()] || ['#7A1F2B', '#F1E6D8'];
  function cssVar(n, d) { const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || d; }

  // Field spot names. yd = yards from the Hammerheads' goal line.
  function spot(yd) {
    const v = Math.round(yd);
    if (v <= 0) return 'your own end zone';
    if (v >= 100) return 'the end zone';
    if (v === 50) return 'midfield';
    return v < 50 ? `your own ${v}` : `their ${100 - v}`;
  }
  function yardsWord(n) {
    const a = Math.abs(n);
    if (n === 0) return 'no gain';
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const w = a < 10 ? words[a] : String(a);
    return n < 0 ? `a loss of ${w}` : `${w} yard${a === 1 ? '' : 's'}`;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- sound (respects the sound toggle; Sound.tone/noise do not check it themselves) ----------
  const sfx = {
    whoosh() { if (Sound.on) { Sound.noise(0.14, 0.05, 0, 2600); } },
    thud() { if (Sound.on) { Sound.noise(0.2, 0.11, 0, 170); Sound.tone(95, 0.16, 'sine', 0.07, 0, -40); } },
    pop() { if (Sound.on) { Sound.tone(330, 0.09, 'square', 0.03, 0, 260); Sound.noise(0.1, 0.06, 0, 500); } },
    roar() { if (Sound.on) { Sound.noise(1.3, 0.05, 0, 700); Sound.noise(1.1, 0.03, 0.15, 1300); } },
    hut() { if (Sound.on) { Sound.tone(210, 0.09, 'sawtooth', 0.025, 0, -30); } },
    step() { if (Sound.on) { Sound.tone(1250, 0.03, 'square', 0.015); } },
  };

  // ---------- view: canvas + camera + zoom ----------
  // A view wraps the Field kit mount and adds a camera (camX, camY in world units) and a zoom.
  function view(f, o) {
    const v = { f, camX: 0, camY: 0, k: 1, Wu: 100, Hu: 60, zoom: 1, shake: 0, o: o || {} };
    v.fit = () => {
      const narrow = f.canvas.parentElement.clientWidth < 480;
      v.o.aspectSet(narrow);
      f.resize();
      v.zoom = narrow ? (v.o.zoomNarrow || 1.32) : 1;
      v.k = f.u * v.zoom;
      v.Wu = f.W / v.k; v.Hu = f.H / v.k;
      v.colors = Field.colors();
      v.colors.pylon = cssVar('--pylon', '#D2500A');
    };
    v.sx = x => (x - v.camX) * v.k;
    v.sy = y => (y - v.camY) * v.k;
    v.follow = (x, y, yFrac, dt, snap) => {
      const tx = clamp(x - v.Wu / 2, 0, Math.max(0, 100 - v.Wu));
      const ty = y - v.Hu * yFrac;
      const a = snap ? 1 : Math.min(1, dt * 5.5);
      v.camX += (tx - v.camX) * a;
      v.camY += (ty - v.camY) * a;
      v.camY = clamp(v.camY, -232, 40 - v.Hu);
    };
    return v;
  }

  // ---------- drawing ----------
  function begin(v) {
    const { ctx, W, H } = v.f;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (v.shake > 0 && !reduceMotion) ctx.translate((Math.random() - 0.5) * v.shake * v.k, (Math.random() - 0.5) * v.shake * v.k);
  }
  function end(v) { v.f.ctx.restore(); }

  // The whole field: turf stripes, sidelines, yard lines, hashes, numbers, end zones.
  function drawField(v) {
    const { ctx, W, H } = v.f, k = v.k, c = v.colors;
    const top = v.camY, bot = v.camY + v.Hu;
    // out-of-bounds base
    ctx.fillStyle = c.turfB; ctx.fillRect(0, 0, W, H);
    // 5-yard stripes (10 units)
    for (let y = Math.floor(top / 10) * 10; y < bot; y += 10) {
      const i = Math.round(y / 10);
      ctx.fillStyle = (i & 1) ? c.turfA : c.turfB;
      ctx.fillRect(0, v.sy(y), W, 10 * k + 1);
    }
    // end zones
    const ez = (y0, y1, name, col) => {
      if (y1 < top || y0 > bot) return;
      ctx.fillStyle = col; ctx.fillRect(v.sx(SIDE_L), v.sy(y0), (SIDE_R - SIDE_L) * k, (y1 - y0) * k);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      const fs = Math.min(9 * k, (SIDE_R - SIDE_L) * k / Math.max(6, name.length) * 1.25);
      ctx.font = `${Math.round(fs)}px Graduate, Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, v.sx(50), v.sy((y0 + y1) / 2));
      ctx.restore();
    };
    const oh = oppHelmet();
    ez(-220, -200, (oppName() || 'Visitors').toUpperCase(), hexA(oh[0], 0.62));
    ez(0, 20, 'HAMMERHEADS', hexA('#D2500A', 0.55));
    // darker beyond the end lines
    if (top < -220) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, 0, W, v.sy(-220)); }
    if (bot > 20) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, v.sy(20), W, H - v.sy(20)); }
    // sideline shading outside the field
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(0, 0, v.sx(SIDE_L), H); ctx.fillRect(v.sx(SIDE_R), 0, W - v.sx(SIDE_R), H);
    // chalk
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = Math.max(2, k * 0.7);
    ctx.beginPath(); ctx.moveTo(v.sx(SIDE_L), 0); ctx.lineTo(v.sx(SIDE_L), H); ctx.moveTo(v.sx(SIDE_R), 0); ctx.lineTo(v.sx(SIDE_R), H); ctx.stroke();
    // yard lines every 5 yards, goal lines thicker
    for (let y = Math.max(-220, Math.floor(top / 10) * 10); y <= Math.min(20, bot + 10); y += 10) {
      const goal = y === 0 || y === -200, endl = y === 20 || y === -220;
      ctx.strokeStyle = goal ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.5)';
      ctx.lineWidth = Math.max(1, k * (goal || endl ? 0.8 : 0.3));
      ctx.beginPath(); ctx.moveTo(v.sx(SIDE_L), v.sy(y)); ctx.lineTo(v.sx(SIDE_R), v.sy(y)); ctx.stroke();
    }
    // hash marks every yard (2 units) inside the field of play
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = Math.max(1, k * 0.25);
    ctx.beginPath();
    for (let y = Math.max(-200, Math.floor(top / 2) * 2); y <= Math.min(0, bot); y += 2) {
      if (y % 10 === 0) continue;
      const py = v.sy(y);
      for (const hx of [41, 59]) { ctx.moveTo(v.sx(hx - 1), py); ctx.lineTo(v.sx(hx + 1), py); }
      ctx.moveTo(v.sx(SIDE_L), py); ctx.lineTo(v.sx(SIDE_L + 1.4), py);
      ctx.moveTo(v.sx(SIDE_R - 1.4), py); ctx.lineTo(v.sx(SIDE_R), py);
    }
    ctx.stroke();
    // yard numbers every 10 yards
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.font = `${Math.round(k * 5.4)}px Graduate, Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let y = Math.max(-180, Math.floor(top / 20) * 20); y <= Math.min(-20, bot + 20); y += 20) {
      let yd = -y / 2; if (yd > 50) yd = 100 - yd;
      const label = String(yd);
      ctx.save(); ctx.translate(v.sx(13), v.sy(y)); ctx.rotate(-Math.PI / 2); ctx.fillText(label, 0, 0); ctx.restore();
      ctx.save(); ctx.translate(v.sx(87), v.sy(y)); ctx.rotate(Math.PI / 2); ctx.fillText(label, 0, 0); ctx.restore();
    }
    // goal posts (top-down: a yellow crossbar on each end line)
    ctx.strokeStyle = '#F2D23C'; ctx.lineWidth = Math.max(2, k * 0.9);
    for (const y of [-220, 20]) { if (y < top - 4 || y > bot + 4) continue; ctx.beginPath(); ctx.moveTo(v.sx(44.5), v.sy(y)); ctx.lineTo(v.sx(55.5), v.sy(y)); ctx.stroke(); }
    // pylons
    ctx.fillStyle = '#FF7A2E';
    for (const y of [-220, -200, 0, 20]) for (const x of [SIDE_L, SIDE_R]) { if (y < top - 4 || y > bot + 4) continue; ctx.fillRect(v.sx(x) - k * 0.8, v.sy(y) - k * 0.8, k * 1.6, k * 1.6); }
  }

  // A TV-style line across the field with a small tag at the right edge.
  function line(v, y, color, label, dashed) {
    const { ctx } = v.f, k = v.k;
    const py = v.sy(y);
    if (py < -10 || py > v.f.H + 10) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, k * 0.75);
    if (dashed) ctx.setLineDash([k * 2.2, k * 1.6]);
    ctx.beginPath(); ctx.moveTo(v.sx(SIDE_L), py); ctx.lineTo(v.sx(SIDE_R), py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (label) (v.labels = v.labels || []).push([py, color, label]);
  }
  // Line tags are drawn after the players so they stay readable.
  function labels(v) {
    const { ctx } = v.f, k = v.k;
    for (const [py, color, label] of v.labels || []) {
      ctx.save();
      ctx.font = `700 ${Math.max(11, Math.round(k * 2.6))}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      const tw = ctx.measureText(label).width + k * 1.6, th = k * 3.8;
      let x1 = Math.min(v.sx(SIDE_R), v.f.W) - tw - 4;
      // Keep the tag out from under the HUD boxes (yard counter, meter): slide it into the gap between them.
      const hit = b => x1 < b[0] + b[2] && x1 + tw > b[0] && py - th / 2 < b[1] + b[3] && py + th / 2 > b[1];
      if ((v.hudBoxes || []).some(hit)) {
        const L = Math.max(0, ...v.hudBoxes.filter(b => b[0] < v.f.W / 2).map(b => b[0] + b[2]));
        const Rr = Math.min(v.f.W, ...v.hudBoxes.filter(b => b[0] >= v.f.W / 2).map(b => b[0]));
        x1 = Rr - L >= tw + 8 ? (L + Rr) / 2 - tw / 2 : Math.max(4, (v.f.W - tw) / 2);
      }
      ctx.fillStyle = 'rgba(8,14,10,.72)';
      roundRect(ctx, x1, py - k * 1.9, tw, k * 3.8, k * 0.8); ctx.fill();
      ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x1 + k * 0.8, py + 0.5);
      ctx.restore();
    }
    v.labels = [];
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // A football player seen from above.
  // p: { x, y, face (radians, 0 = facing up the screen), team 'us'|'them', num, phase (stride), moving,
  //      state: 'down' | 'lunge' | 'block' | ..., ball (carrying), me (highlight), ghost (alpha) }
  function guy(v, p) {
    const { ctx } = v.f, k = v.k, r = R * k;
    const px = v.sx(p.x), py = v.sy(p.y);
    if (px < -r * 3 || px > v.f.W + r * 3 || py < -r * 3 || py > v.f.H + r * 3) return;
    const us = p.team === 'us';
    const oh = oppHelmet();
    const jersey = us ? v.colors.pylon : '#F4F6F2';
    const helmet = us ? US.helmet : oh[0];
    const stripe = us ? US.stripe : oh[1];
    const ink = us ? '#FFFFFF' : '#14203A';
    ctx.save();
    if (p.alpha != null) ctx.globalAlpha = p.alpha;
    // highlight ring under you
    if (p.me) {
      ctx.strokeStyle = p.meColor || v.colors.led; ctx.lineWidth = Math.max(2, k * 0.55);
      ctx.beginPath(); ctx.arc(px, py, r * 1.55, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.translate(px, py);
    const down = p.state === 'down';
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(r * 0.22, r * 0.34, r * (down ? 1.25 : 1.05), r * (down ? 0.95 : 0.8), 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.face || 0);
    if (down) {
      // flat on the turf: body stretched along the facing direction
      ctx.fillStyle = jersey; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = Math.max(1, k * 0.3);
      ctx.beginPath(); ctx.ellipse(0, r * 0.2, r * 0.75, r * 1.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = helmet; ctx.beginPath(); ctx.arc(0, -r * 1.0, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    // legs (stride)
    if (p.moving) {
      const s = Math.sin(p.phase || 0) * r * 0.55;
      ctx.fillStyle = 'rgba(20,20,20,.75)';
      ctx.beginPath(); ctx.ellipse(-r * 0.42, s, r * 0.24, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.42, -s, r * 0.24, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    }
    // arms: reaching for a tackle / blocking
    if (p.state === 'lunge' || p.state === 'block' || p.state === 'wind') {
      ctx.strokeStyle = jersey; ctx.lineWidth = r * 0.42; ctx.lineCap = 'round';
      const reach = p.state === 'lunge' ? r * 1.35 : p.state === 'wind' ? r * 0.7 : r * 0.95;
      ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.1); ctx.lineTo(-r * 0.45, -reach); ctx.moveTo(r * 0.7, -r * 0.1); ctx.lineTo(r * 0.45, -reach); ctx.stroke();
      ctx.fillStyle = '#8A5A3C';
      ctx.beginPath(); ctx.arc(-r * 0.45, -reach, r * 0.2, 0, Math.PI * 2); ctx.arc(r * 0.45, -reach, r * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    // shoulder pads + jersey
    ctx.fillStyle = jersey; ctx.strokeStyle = us ? 'rgba(0,0,0,.42)' : 'rgba(20,32,58,.85)'; ctx.lineWidth = Math.max(1, k * 0.32);
    ctx.beginPath(); ctx.ellipse(0, r * 0.08, r * 1.02, r * 0.66, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // ball tucked under the outside arm
    if (p.ball) {
      ctx.save(); ctx.translate(r * 0.95, -r * 0.05); ctx.rotate(-0.35);
      ctx.fillStyle = '#7A3E1D'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = Math.max(1, k * 0.2);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.32, r * 0.52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1, k * 0.14);
      ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(0, r * 0.2); ctx.stroke();
      ctx.restore();
    }
    // helmet with a center stripe
    ctx.fillStyle = helmet; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = Math.max(1, k * 0.25);
    ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = stripe; ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath(); ctx.moveTo(0, -r * 0.66); ctx.lineTo(0, r * 0.3); ctx.stroke();
    // facemask hint (front of helmet)
    ctx.strokeStyle = 'rgba(230,230,230,.9)'; ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.58, -Math.PI * 0.78, -Math.PI * 0.22); ctx.stroke();
    ctx.restore();
    // number, upright, on the back of the jersey
    if (p.num != null) {
      ctx.save();
      if (p.alpha != null) ctx.globalAlpha = p.alpha;
      const f = p.face || 0;
      const bx = px - Math.sin(f) * r * 0.62, by = py + Math.cos(f) * r * 0.62;
      ctx.font = `700 ${Math.max(8, Math.round(r * 0.78))}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, r * 0.22); ctx.strokeStyle = us ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.9)';
      ctx.strokeText(String(p.num), bx, by);
      ctx.fillStyle = ink; ctx.fillText(String(p.num), bx, by);
      ctx.restore();
    }
  }

  // A loose or flying ball (world coords). lift = height in units.
  function ball(v, x, y, lift, spin) {
    const { ctx } = v.f, k = v.k;
    const px = v.sx(x), py = v.sy(y);
    if (lift > 0) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(px, py, k * 1.1, k * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    const s = 1 + Math.min(0.9, (lift || 0) / 30);
    ctx.save(); ctx.translate(px, py - (lift || 0) * k); ctx.rotate(spin || -0.5);
    ctx.fillStyle = '#7A3E1D'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = Math.max(1, k * 0.2);
    ctx.beginPath(); ctx.ellipse(0, 0, k * 1.3 * s, k * 0.8 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1, k * 0.16);
    ctx.beginPath(); ctx.moveTo(-k * 0.5 * s, 0); ctx.lineTo(k * 0.5 * s, 0); ctx.stroke();
    ctx.restore();
  }

  // Dashed arrow along a list of world points (path hints).
  function arrow(v, pts, color, alpha) {
    if (!pts || pts.length < 2 || alpha <= 0) return;
    const { ctx } = v.f, k = v.k;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, k * 0.65); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([k * 1.6, k * 1.3]);
    ctx.beginPath(); ctx.moveTo(v.sx(pts[0][0]), v.sy(pts[0][1]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(v.sx(pts[i][0]), v.sy(pts[i][1]));
    ctx.stroke(); ctx.setLineDash([]);
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const ang = Math.atan2(v.sy(b[1]) - v.sy(a[1]), v.sx(b[0]) - v.sx(a[0]));
    ctx.fillStyle = color;
    ctx.translate(v.sx(b[0]), v.sy(b[1])); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(k * 1.8, 0); ctx.lineTo(-k * 1.2, -k * 1.4); ctx.lineTo(-k * 1.2, k * 1.4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- effects: floating callouts, particles, impact rings ----------
  function fxLayer() {
    const L = { pops: [], parts: [], rings: [] };
    L.pop = (text, x, y, o) => { L.pops.push(Object.assign({ text, x, y, t: 0, life: 1.1, color: '#FFFFFF', size: 4.2 }, o || {})); };
    L.dust = (x, y, n, col) => {
      if (reduceMotion) return;
      for (let i = 0; i < n; i++) L.parts.push({ x, y, vx: rand(-14, 14), vy: rand(-14, 10), t: 0, life: rand(0.25, 0.5), col: col || pick(['#7FA35B', '#5E3B22', '#A8C47A']) });
    };
    L.ring = (x, y, col) => { if (!reduceMotion) L.rings.push({ x, y, t: 0, life: 0.38, col: col || '#FFFFFF' }); };
    L.step = dt => {
      for (const a of [L.pops, L.parts, L.rings]) for (let i = a.length - 1; i >= 0; i--) { a[i].t += dt; if (a[i].t >= a[i].life) a.splice(i, 1); }
      for (const p of L.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
    };
    L.draw = v => {
      const { ctx } = v.f, k = v.k;
      for (const p of L.parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.fillRect(v.sx(p.x) - k * 0.35, v.sy(p.y) - k * 0.35, k * 0.7, k * 0.7); }
      ctx.globalAlpha = 1;
      for (const g of L.rings) {
        const q = g.t / g.life;
        ctx.globalAlpha = 1 - q; ctx.strokeStyle = g.col; ctx.lineWidth = Math.max(2, k * 0.7);
        ctx.beginPath(); ctx.arc(v.sx(g.x), v.sy(g.y), k * (2 + q * 9), 0, Math.PI * 2); ctx.stroke();
        // impact spikes
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.3; const r1 = k * (3 + q * 6), r2 = k * (5 + q * 9); ctx.moveTo(v.sx(g.x) + Math.cos(a) * r1, v.sy(g.y) + Math.sin(a) * r1); ctx.lineTo(v.sx(g.x) + Math.cos(a) * r2, v.sy(g.y) + Math.sin(a) * r2); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const p of L.pops) {
        const q = p.t / p.life;
        const rise = reduceMotion ? 0 : q * 5;
        const sc = reduceMotion ? 1 : (q < 0.12 ? 0.6 + q / 0.12 * 0.4 : 1);
        ctx.globalAlpha = q > 0.75 ? (1 - q) / 0.25 : 1;
        // keep callouts inside the canvas
        let x = v.sx(p.x); const y = v.sy(p.y - rise);
        ctx.font = `${p.display ? '' : '700 '}${Math.round(p.size * k * sc)}px ${p.display ? 'Graduate, Georgia, serif' : '"Barlow Condensed", "Arial Narrow", sans-serif'}`;
        const w = ctx.measureText(p.text).width;
        x = clamp(x, w / 2 + 6, v.f.W - w / 2 - 6);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, k * 0.9); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineJoin = 'round';
        ctx.strokeText(p.text, x, y);
        ctx.fillStyle = p.color; ctx.fillText(p.text, x, y);
      }
      ctx.globalAlpha = 1;
    };
    return L;
  }

  // ---------- HUD (screen space) ----------
  // Big yard counter top-left, a meter top-right (cooldown), optional center banner.
  function hud(v, o) {
    const { ctx, W } = v.f;
    const s = clamp(W / 100, 4.3, 6.2);
    ctx.save();
    // yards pill
    const val = o.yards > 0 ? `+${o.yards}` : String(o.yards);
    ctx.font = `${Math.round(s * 6)}px Graduate, Georgia, serif`;
    const tw = ctx.measureText(val).width;
    ctx.font = `700 ${Math.round(s * 2.6)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const lw = ctx.measureText(o.unit || 'YDS').width;
    const pw = tw + lw + s * 5.5, ph = s * 9;
    v.hudBoxes = [[8, 8, pw, ph]];
    ctx.fillStyle = 'rgba(8,14,10,.78)';
    roundRect(ctx, 8, 8, pw, ph, s * 1.6); ctx.fill();
    ctx.fillStyle = o.yardsColor || v.colors.led;
    ctx.font = `${Math.round(s * 6)}px Graduate, Georgia, serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(val, 8 + s * 2, 8 + ph / 2 + s * 0.3);
    ctx.fillStyle = 'rgba(233,238,231,.8)';
    ctx.font = `700 ${Math.round(s * 2.6)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.fillText(o.unit || 'YDS', 8 + s * 3 + tw, 8 + ph / 2 + s * 0.6);
    // cooldown meter
    if (o.meter) {
      const ready = o.meter.value >= 1;
      const mtxt = ready ? `${o.meter.label} READY` : o.meter.label;
      ctx.font = `700 ${Math.round(s * 2.4)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      const mw = Math.max(s * 15, ctx.measureText(`${o.meter.label} READY`).width + s * 2.8), mh = s * 4.4, mx = W - mw - 8, my = 8;
      ctx.fillStyle = 'rgba(8,14,10,.78)'; roundRect(ctx, mx, my, mw, mh + s * 3.2, s * 1.4); ctx.fill();
      v.hudBoxes.push([mx, my, mw, mh + s * 3.2]);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = ready ? v.colors.led : 'rgba(233,238,231,.7)';
      ctx.fillText(mtxt, mx + s * 1.4, my + s * 0.9);
      const bx = mx + s * 1.4, by = my + s * 4, bw = mw - s * 2.8, bh = s * 1.6;
      ctx.fillStyle = 'rgba(255,255,255,.18)'; roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = ready ? v.colors.led : 'rgba(255,255,255,.65)';
      roundRect(ctx, bx, by, Math.max(bh, bw * clamp(o.meter.value, 0, 1)), bh, bh / 2); ctx.fill();
    }
    // goal chip under the yard pill
    if (o.goal) {
      ctx.font = `700 ${Math.round(s * 2.3)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      const gw = ctx.measureText(o.goal).width + s * 2.6;
      ctx.fillStyle = 'rgba(8,14,10,.62)'; roundRect(ctx, 8, 8 + ph + s * 1.2, gw, s * 4, s * 1.2); ctx.fill();
      v.hudBoxes.push([8, 8 + ph + s * 1.2, gw, s * 4]);
      ctx.fillStyle = o.goalColor || 'rgba(255,230,120,.95)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(o.goal, 8 + s * 1.3, 8 + ph + s * 3.25);
    }
    if (o.banner) {
      ctx.font = `${Math.round(s * 7)}px Graduate, Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, s); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineJoin = 'round';
      ctx.strokeText(o.banner, W / 2, v.f.H * 0.42);
      ctx.fillStyle = o.bannerColor || '#FFFFFF'; ctx.fillText(o.banner, W / 2, v.f.H * 0.42);
    }
    ctx.restore();
  }

  // Joystick ring drawn where a drag started (screen px).
  function stick(v, j) {
    if (!j) return;
    const { ctx } = v.f, k = v.f.u;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(j.ox * k, j.oy * k, k * 7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    const dx = clamp(j.x - j.ox, -7, 7), dy = clamp(j.y - j.oy, -7, 7);
    ctx.beginPath(); ctx.arc((j.ox + dx) * k, (j.oy + dy) * k, k * 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---------- input: keys / pad / drag-joystick / tap ----------
  // Wraps Field.input. Returns { axis() -> {x, y} in -1..1, tap() one-shot (quick tap on canvas),
  // action() one-shot, joy (for drawing), destroy() }.
  function controls(f) {
    const joy = { on: false, ox: 0, oy: 0, x: 0, y: 0, t0: 0, moved: 0 };
    let tapShot = false;
    const inp = Field.input(f, {
      onTap(p) { Object.assign(joy, { on: true, ox: p.x, oy: p.y, x: p.x, y: p.y, t0: performance.now(), moved: 0 }); },
    });
    const c = { inp, joy };
    c.axis = () => {
      const s = inp.s;
      let x = (s.right ? 1 : 0) - (s.left ? 1 : 0), y = (s.down ? 1 : 0) - (s.up ? 1 : 0);
      const p = inp.pointer;
      if (p && p.down && joy.on) {
        joy.x = p.x; joy.y = p.y;
        joy.moved = Math.max(joy.moved, Math.hypot(p.x - joy.ox, p.y - joy.oy));
        const dx = (p.x - joy.ox) / 5.5, dy = (p.y - joy.oy) / 5.5;
        if (Math.abs(dx) > 0.12) x = clamp(dx, -1, 1);
        if (Math.abs(dy) > 0.12) y = clamp(dy, -1, 1);
      } else if (joy.on) {
        // released: a quick tap with little movement counts as the action
        if (performance.now() - joy.t0 < 240 && joy.moved < 2.5) tapShot = true;
        joy.on = false;
      }
      return { x, y };
    };
    c.action = () => { const a = inp.pressed('action'); const t = tapShot; tapShot = false; return a || t; };
    c.clear = () => { inp.pressed('action'); inp.pressed('tap'); tapShot = false; };
    c.claims = e => inp.claims(e);
    c.destroy = () => inp.destroy();
    return c;
  }

  // ---------- DOM extras: start-overlay tips, cooldown on the action button ----------
  function decorate(f, o) {
    f.panel.classList.add('ag', o.cls);
    const ov = f.host.querySelector('.arcade-overlay');
    if (ov) {
      const box = document.createElement('div');
      box.className = 'ag-intro';
      box.innerHTML = `${o.play ? `<div class="ag-play">${esc(o.play)}</div>` : ''}`;
      const btn = ov.querySelector('.arcade-start');
      ov.insertBefore(box, btn);
      const tips = document.createElement('div');
      tips.className = 'ag-tips';
      tips.innerHTML = o.tips.map(t => `<span>${t}</span>`).join('');
      ov.appendChild(tips);
      const wrapIn = document.createElement('div');
      wrapIn.className = 'ag-intro-wrap';
      ov.insertBefore(wrapIn, box);
      wrapIn.appendChild(box); wrapIn.appendChild(btn); wrapIn.appendChild(tips);
    }
    const act = f.host.querySelector('.arcade-ctl[data-ctl="action"]');
    let last = -1;
    return {
      cooldown(v) { if (!act) return; const q = Math.round(clamp(v, 0, 1) * 20) / 20; if (q === last) return; last = q; act.style.setProperty('--cd', String(q)); act.classList.toggle('cooling', q < 1); },
    };
  }

  // ---------- engine bridge: real yards and on-screen touchdowns ----------
  // The engine rolls random yards in statsFor() and decides touchdowns in playResult(). When an arcade run
  // just happened, we replace the random yards with the yards you actually gained, and make sure a run you
  // carried into the end zone on screen is scored as a touchdown. Only applies to the moment object the
  // arcade game was started for, so it never touches other plays.
  let pending = null, kick = null;
  function setResult(moment, data) {
    pending = moment ? Object.assign({ m: moment, at: Date.now() }, data) : null;
    // A clutch run that sets up the walk-off kick remembers how long that kick is.
    kick = moment && data && data.fgYds ? { m: moment, yds: data.fgYds, at: Date.now() } : null;
  }
  function peek(m) { return pending && pending.m === m && Date.now() - pending.at < 120000 ? pending : null; }
  // A bad play the engine rescues (rabbit's foot, chemistry) is wiped out by a penalty flag and records no stats.
  // Our on-screen yards / tackles belong to that wiped play, so drop them instead of letting them linger.
  const wiped = () => !!(S && S.game && S.game.lastSaved);
  on('play', p => { if (p && p.saved) { pending = null; kick = null; } });
  if (typeof statsFor === 'function') {
    const orig = statsFor;
    statsFor = function (r, td, m) {
      if (wiped()) { pending = null; kick = null; return orig.apply(this, arguments); }
      const p = peek(m);
      if (!p || !S.line) return orig.apply(this, arguments);
      const g = S.game || { line: {} };
      g.line = g.line || {};
      if (S.pos === 'RB' && p.yards != null) {
        pending = null;
        const b = { a: S.line.rushYds || 0, b: g.line.rushYds || 0, la: S.line.long, lb: g.line.long };
        const out = orig.apply(this, arguments);
        S.line.rushYds = b.a + p.yards;
        g.line.rushYds = b.b + p.yards;
        S.line.long = Math.max(b.la || 0, p.yards);
        g.line.long = Math.max(b.lb || 0, p.yards);
        return out;
      }
      if (S.pos === 'LB' && p.tkl != null) {
        // Count the tackles you actually made on screen (the engine would roll 1-2 for any stop).
        pending = null;
        const a = S.line.tkl || 0, b = g.line.tkl || 0;
        const out = orig.apply(this, arguments);
        S.line.tkl = a + p.tkl;
        g.line.tkl = b + p.tkl;
        return out;
      }
      return orig.apply(this, arguments);
    };
  }
  // The walk-off field goal note says "a 41-yarder"; make it match where the clutch run actually ended.
  if (typeof clutchEnd === 'function' && typeof CLUTCH_NOTES === 'object') {
    const orig = clutchEnd;
    clutchEnd = function (r, success, note, body, td, c) {
      const k = kick;
      if (!(k && k.m === c && note === 'fg' && Date.now() - k.at < 120000)) return orig.apply(this, arguments);
      kick = null;
      const was = CLUTCH_NOTES.fg;
      try {
        CLUTCH_NOTES.fg = String(was).replace(/\b\d+-yarder\b/, `${k.yds}-yarder`);
        return orig.apply(this, arguments);
      } finally { CLUTCH_NOTES.fg = was; }
    };
  }
  // Put an arcade play into CLUTCH[pos][side]. Entries may be one moment or a list of variants
  // (the content module uses lists); replace the variant with the same title, or add to the list.
  function setClutch(pos, side, m) {
    if (!CLUTCH[pos]) return;
    const cur = CLUTCH[pos][side];
    if (Array.isArray(cur)) { const i = cur.findIndex(x => x && x.title === m.title); if (i >= 0) cur[i] = m; else cur.push(m); }
    else CLUTCH[pos][side] = m;
  }
  if (typeof playResult === 'function') {
    const orig = playResult;
    playResult = function (r, m) {
      const p = wiped() ? null : peek(m);
      const res = orig.apply(this, arguments);
      if (p && p.td && r === 'great' && S.pos !== 'LB' && res && !res.td && S.game) {
        // The engine rolled a stalled drive (+3). The run was a touchdown on screen: make it +7.
        S.game.us += 4;
        res.td = true;
        res.note = '**Touchdown, Hammerheads!**';
        addLine({ td: 1 });
        fx({ fame: 2 }, true);
        award('six');
      }
      return res;
    };
  }

  // Shared difficulty numbers. Positive edge = easier. Roughly -1.5 (brutal) .. +1.5 (easy).
  // Everything that makes a play harder or easier folds into one number, hd ("hardness" in difficulty units):
  // 0 = skill 45, confidence 50, rested, at diff 2. Each +1 is like one more point of difficulty.
  function edge(cfg, easeKey, diff) {
    const s = stat();
    const ease = mod(easeKey, 1, cfg) + (cfg.clutch && S && S.items && S.items.band ? 0.08 : 0);
    const e = (s.skill - 45) / 45 + (s.conf - 50) / 160 - ((diff != null ? diff : cfg.diff) - 2) / 2.6 - (s.energy < 30 ? 0.3 : 0) + (ease - 1) * 1.6;
    return { e: clamp(e, -2, 2), hd: clamp(-(e + 0.3) * 2.0, -3, 4.5), ease, tired: s.energy < 30, skill: s.skill };
  }

  return { R, SIDE_L, SIDE_R, lerp, sgn, stat, spot, yardsWord, cap, sfx, view, begin, end, drawField, line, labels, guy, ball, arrow,
    fxLayer, hud, stick, controls, decorate, setResult, peek, edge, oppName, hexA, roundRect, setClutch };
})();
