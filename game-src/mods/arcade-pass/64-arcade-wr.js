// =========================================================
//   ARCADE PASS GAME — wide receiver 'catch'
// =========================================================
// Phase 1 (route): you run your stem with a cornerback on you. Press the action at the break marker to cut;
// a well-timed cut leaves him a step behind. Phase 2 (ball in the air): a shrinking circle shows where the
// ball will come down. Your route keeps running on its own; steer to get under the ball before he does.
TAGS.catch = 'Route & catch';
DEFAULT_PROMPT.catch = 'Cut at the marker, then run under the ball.';

// brk: direction after the cut, x in "toward the sideline" units. stem: yards before the break.
const WR_ROUTES = {
// help: how far the safety / linebacker will come to help on this route (x their base range).
// close: how fast the cornerback closes when you slow down or break back toward him (default 1.06).
// sep: how much daylight a good cut buys on this route (tuned so every route can come open, see _test/qa-sim-route.js).
  post: { name: 'post', stem: 12, brk: [-0.56, -0.83], deep: true, inside: true, chase: 0.82, sep: 1.4, help: 0.8 },
  dig: { name: 'dig', stem: 12, brk: [-1, -0.05], inside: true, sep: 1.3, help: 0.75 },
  slant: { name: 'slant', stem: 5, brk: [-0.72, -0.69], inside: true, sep: 1.35 },
  out: { name: 'out', stem: 10, brk: [1, 0.07], sep: 0.78, close: 1.32 },
  comeback: { name: 'comeback', stem: 15, brk: [0.45, 0.89], settle: 5, sep: 1.01, close: 1.4 },
  corner: { name: 'corner', stem: 11, brk: [0.62, -0.78], deep: true, chase: 0.95, sep: 1.4, help: 0.85 },
  outup: { name: 'out-and-up', stem: 7, fake: 4.5, brk: [0.1, -0.995], deep: true, sep: 1.12 },
  fade: { name: 'fade', stem: 5, brk: [0.3, -0.95], deep: true, chase: 0.94, sep: 1.12 },
};

function wrModel(cfg) {
  const who = APass.who(), d = clamp(cfg.diff || 2, 0.6, 5.5), ease = APass.ease('catch.ease', cfg), cl = !!cfg.clutch;
  const tired = who.energy < 30, sk = clamp((who.skill - 45) / 55, -1, 1);
  const mo = Object.assign({}, cfg.moment && cfg.moment.arcade, cfg.arcade);
  const spot = APass.spot(cfg, Object.assign({ rzLos: 86 }, mo));
  const td = spot.ez; // red zone or two-point try
  const rname = (!cl && mo.route) || (spot.mode === 'two' ? pick(['slant', 'fade', 'corner']) : td ? pick(['corner', 'fade', 'slant', 'post']) : spot.mode === 'fg' ? pick(['out', 'comeback', 'dig']) : spot.mode === 'ice' ? pick(['out', 'dig', 'slant']) : mo.route || pick(['post', 'out', 'dig', 'comeback', 'corner']));
  const R = WR_ROUTES[rname] || WR_ROUTES.out;
  const side = chance(0.5) ? 1 : -1; // +1: lined up on the right, so the sideline is to the right
  const x0 = 50 + side * (R.inside ? 34 : rname === 'comeback' || rname === 'fade' ? 30 : rname === 'outup' ? 27 : 22);
  const stem = spot.mode === 'two' ? Math.min(R.stem, 3.5) : td ? Math.min(R.stem, 6) : R.stem;
  const brk = { x: R.brk[0] * side, y: R.brk[1] };
  const yMin = td ? spot.endLine + 0.9 : -95;

  const v = (9.9 + 0.5 * sk - (tired ? 0.6 : 0)) * (mo.speed || 1);
  // Stem waypoints (world). The marker is the last one.
  const wps = [{ x: x0, y: -stem + 1 }];
  if (R.fake) wps.push({ x: x0 + side * R.fake, y: -stem - 0.6 });
  const marker = wps[wps.length - 1];
  const prevWp = wps.length > 1 ? wps[wps.length - 2] : { x: x0, y: 1 };
  const segL = Math.hypot(marker.x - prevWp.x, marker.y - prevWp.y) || 1;
  const segD = { x: (marker.x - prevWp.x) / segL, y: (marker.y - prevWp.y) / segL };

  // Timing windows (yards either side of the marker).
  const W1 = clamp((0.92 + 0.6 * sk - 0.06 * d - (tired ? 0.15 : 0) - (cl ? 0.08 : 0)) * Math.sqrt(ease), 0.45, 2.2);
  const W2 = W1 * 2.6;
  // Cornerback.
  const tight = clamp(0.28 + 0.1 * d - 0.08 * sk - (ease - 1) * 0.3 + (cl ? 0.08 : 0) + (mo.tight || 0) + rand(-0.12, 0.12), 0.04, 1);
  const press = tight > 0.55 && chance(0.6);
  const inside = R.inside ? chance(0.4) : chance(0.7);
  const lev = side * (inside ? -1 : 1);
  const cushion = press ? 1.3 : 3.6 + (1 - tight) * 3.4;
  const cb = {
    kind: 'cb', tight, x: x0 + lev * 1.0, y: 1 - cushion - 0.6, vx: 0, vy: 0,
    O0: { x: lev * 1.0, y: -cushion }, O1: { x: lev * 1.1, y: -0.7 },
    mlag: 0.16, k: 1.2 + 1.6 * tight, vmax: v * (0.97 + 0.08 * tight),
    lag: clamp(0.2 - 0.1 * tight - 0.01 * d, 0.05, 0.22), vChase: v * ((R.chase || (R.deep ? 0.97 : 1.02)) + 0.05 * tight + 0.03 * d - (td ? 0.03 : 0)) / Math.sqrt(ease),
  };
  const defs = [cb];
  if (R.deep && !td) defs.push({ kind: 'safety', x: 50 + rand(-6, 6), y: -30, vx: 0, vy: 0, react: 0.62, vAir: 9 + 0.15 * d, range: 14 * (R.help || 1), vmax: 7 });
  if ((rname === 'dig' || mo.lb) && !td) defs.push({ kind: 'lb', x: 50 + rand(-3, 3), y: -7, vx: 0, vy: 0, react: 0.7, vAir: 7.8 + 0.15 * d, range: 10 * (R.help || 1), vmax: 6.5 });
  if (td) defs.push({ kind: 'safety', x: 50 - side * 8, y: spot.endLine + 4, vx: 0, vy: 0, react: 0.55, vAir: 9 + 0.15 * d, range: 13, vmax: 6.5 });

  // Ball.
  const E = clamp((0.6 + 0.6 * d - 0.9 * sk + (cl ? 0.5 : 0) + (tired ? 0.4 : 0)) / ease, 0.35, 6);
  const Rc = clamp((2.75 + 0.9 * sk - 0.12 * d - (tired ? 0.3 : 0) - (cl ? 0.15 : 0)) * Math.sqrt(ease), 1.6, 4.6);

  const st = {
    cfg, spot, route: R, rname, side, x0, stem, brk, marker, wps, W1, W2, defs, cb, E, Rc, who, d, ease, v, yMin,
    t: 0, phase: 'pre', me: { x: x0, y: 1, vx: 0, vy: 0 }, hist: [], wi: 0, cut: null, ball: null, res: null,
    input: { dir: null, ptr: null, cut: false }, qb: { x: 50, y: 6 }, msg: null,
  };

  function velAt(t) { // your velocity t seconds into the play (history for the cornerback's mirror)
    const h = st.hist;
    if (!h.length || t <= h[0].t) return { x: 0, y: 0 };
    let lo = 0, hi = h.length - 1;
    if (t >= h[hi].t) return h[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (h[m].t <= t) lo = m; else hi = m; }
    return h[lo];
  }
  const sCut = () => (st.me.x - marker.x) * segD.x + (st.me.y - marker.y) * segD.y;

  function doCut(kind) {
    const s = sCut();
    let q = kind || (Math.abs(s) <= W1 ? 'perfect' : Math.abs(s) <= W2 ? 'good' : s < 0 ? 'early' : 'late');
    // How far the cornerback overruns depends on your timing, not the route's angle: a sharp out and a
    // gentle post both buy the same yards of daylight for the same quality of cut.
    const gap = { perfect: 5.0 - 1.1 * cb.tight - 0.2 * d, good: 3.0 - 0.7 * cb.tight - 0.14 * d, early: 0.8, late: 1.1 }[q] * (R.sep || 1) * (spot.mode === 'two' ? 0.8 : td ? 1.05 : 1);
    const ang = Math.acos(clamp(segD.x * brk.x + segD.y * brk.y, -1, 1));
    const bite = clamp(gap / (v * Math.max(0.35, 2 * Math.sin(ang / 2))), 0.05, 1.0);
    st.cut = { t: st.t, q, s, x: st.me.x, y: st.me.y, bite, stumble: q === 'perfect' ? 0.25 : 0 };
    // Plant and go: momentum drops, heading snaps to the break.
    const sp = Math.hypot(st.me.vx, st.me.vy) * (q === 'perfect' ? 0.85 : 0.7);
    st.me.vx = brk.x * sp; st.me.vy = brk.y * sp;
    st.phase = 'cut';
    if (st.onEvent) st.onEvent('cut', q);
    // Throw shortly after the break. Lead: simulate your route on autopilot to where you'll be.
    st.throwAt = st.t + 0.14;
  }

  function autopilot(me, sinceCut) {
    if (R.settle && st.cut) {
      const dd = Math.hypot(me.x - st.cut.x, me.y - st.cut.y);
      if (dd >= R.settle) return { x: 0, y: 0 };
    }
    return { x: brk.x * v, y: brk.y * v };
  }
  function moveMe(me, dt, inp, phase) {
    let tx, ty;
    if (phase === 'stem') {
      const w = wps[Math.min(st.wi, wps.length - 1)];
      let dx = w.x - me.x, dy = w.y - me.y; const L = Math.hypot(dx, dy);
      if (st.wi >= wps.length) { dx = segD.x; dy = segD.y; } else if (L < 0.6) { st.wi++; dx = segD.x; dy = segD.y; }
      const Ld = Math.hypot(dx, dy) || 1;
      tx = dx / Ld * v; ty = dy / Ld * v;
      if (inp.dir && inp.dir.x) tx += inp.dir.x * v * 0.42;
      else if (inp.ptr && Math.abs(inp.ptr.x - me.x) > 1.5) tx += Math.sign(inp.ptr.x - me.x) * v * 0.42;
    } else if (inp.dir && (inp.dir.x || inp.dir.y)) {
      const L = Math.hypot(inp.dir.x, inp.dir.y); tx = inp.dir.x / L * v; ty = inp.dir.y / L * v;
    } else if (inp.ptr) {
      const dx = inp.ptr.x - me.x, dy = inp.ptr.y - me.y, L = Math.hypot(dx, dy);
      const sp = L < 0.4 ? 0 : Math.min(v, L * 5);
      tx = L ? dx / L * sp : 0; ty = L ? dy / L * sp : 0;
    } else { const a = autopilot(me); tx = a.x; ty = a.y; }
    const acc = (phase === 'stem' && st.t < 0.4 ? 30 : 34) * dt;
    const ex = tx - me.vx, ey = ty - me.vy, el = Math.hypot(ex, ey);
    if (el > acc) { me.vx += ex / el * acc; me.vy += ey / el * acc; } else { me.vx = tx; me.vy = ty; }
    me.x += me.vx * dt; me.y += me.vy * dt;
    me.x = clamp(me.x, -1.5, 101.5); me.y = Math.max(me.y, yMin - 1.5);
  }

  function stepDef(o, t, dt) {
    const b = st.ball;
    const me = st.me;
    if (o.kind === 'cb' && st.cut) {
      const c = st.cut, since = t - c.t;
      if (o.cvx == null) { o.cvx = o.vx || 0; o.cvy = o.vy || 0; }
      if (since < c.bite) { // still running the way you were going
        const sl = c.stumble && since < c.stumble ? 0.55 : 1;
        o.x += o.cvx * sl * dt; o.y += o.cvy * sl * dt; o.vx = o.cvx * sl; o.vy = o.cvy * sl;
        return;
      }
      // He matches your pace: waiting under the ball doesn't hand him free yards, only his last lunge does.
      const mySp = Math.hypot(me.vx, me.vy);
      const close = R.close || 1.06; // routes that break toward him (outs, comebacks) let him close faster
      let tx = me.x + me.vx * 0.15, ty = me.y + me.vy * 0.15, sp = Math.min(o.vChase, Math.max(0.55 * v * close / 1.06, mySp * close));
      if (b && t >= b.t0 + b.T - 0.3) { tx = APass.lerp(b.L.x, me.x, 0.5); ty = APass.lerp(b.L.y, me.y, 0.5); sp *= 1.15; }
      const dx = tx - o.x, dy = ty - o.y, L = Math.hypot(dx, dy);
      // He turns and accelerates rather than teleporting onto the new line.
      const wx = L > 0.001 ? dx / L * sp : 0, wy = L > 0.001 ? dy / L * sp : 0;
      const acc = 44 * dt, ex = wx - o.vx, ey = wy - o.vy, el = Math.hypot(ex, ey);
      if (el > acc) { o.vx += ex / el * acc; o.vy += ey / el * acc; } else { o.vx = wx; o.vy = wy; }
      o.x += o.vx * dt; o.y += o.vy * dt;
      const gap = Math.hypot(o.x - me.x, o.y - me.y);
      if (gap < 1.1) { const k = 1.1 / (gap || 1); o.x = me.x + (o.x - me.x) * k; o.y = me.y + (o.y - me.y) * k; }
      return;
    }
    if (b && o.kind !== 'cb' && t >= b.t0 + o.react && Math.hypot(o.x - b.L.x, o.y - b.L.y) <= o.range) {
      const dx = b.L.x - o.x, dy = b.L.y - o.y, L = Math.hypot(dx, dy);
      const step = Math.min(L, o.vAir * dt);
      if (L > 0.001) { o.x += dx / L * step; o.y += dy / L * step; }
      return;
    }
    if (o.kind === 'cb') {
      const V = velAt(t - o.mlag);
      const q = APass.smooth((t - 0.2) / 1.0);
      const Ox = APass.lerp(o.O0.x, o.O1.x, q), Oy = APass.lerp(o.O0.y, o.O1.y, q);
      let vx = V.x + (me.x + Ox - o.x) * o.k, vy = V.y + (me.y + Oy - o.y) * o.k;
      const sp = Math.hypot(vx, vy);
      if (sp > o.vmax) { vx *= o.vmax / sp; vy *= o.vmax / sp; }
      o.x += vx * dt; o.y += vy * dt; o.vx = vx; o.vy = vy;
      return;
    }
    // safety / lb: drift toward you, staying deep (safety) or underneath (lb)
    const tx = APass.lerp(o.kind === 'safety' ? 50 : 50, me.x, t > 0.5 ? 0.5 : 0.15), ty = o.kind === 'safety' ? Math.min(me.y - 9, o.y + 0.2) : Math.max(-11, Math.min(-6, me.y + 2));
    let vx = (tx - o.x) * 1.8, vy = (ty - o.y) * 1.8; const sp = Math.hypot(vx, vy);
    if (sp > o.vmax) { vx *= o.vmax / sp; vy *= o.vmax / sp; }
    o.x += vx * dt; o.y += vy * dt;
  }

  function launch() {
    // Where will you be? Autopilot your route forward from now through the flight.
    const ghost = { x: st.me.x, y: st.me.y, vx: st.me.vx, vy: st.me.vy };
    const depth = -st.me.y;
    let T = clamp(1.2 + depth * 0.016 + (R.deep ? 0.25 : 0), 1.25, 2.05) * (mo.hang || 1);
    if (R.settle) T = 1.05;
    const h = 1 / 60;
    for (let s = 0; s < T / h; s++) { const a = autopilot(ghost); const ex = a.x - ghost.vx, ey = a.y - ghost.vy, el = Math.hypot(ex, ey), acc = 34 * h; if (el > acc) { ghost.vx += ex / el * acc; ghost.vy += ey / el * acc; } else { ghost.vx = a.x; ghost.vy = a.y; } ghost.x += ghost.vx * h; ghost.y += ghost.vy * h; }
    const L0 = { x: ghost.x, y: Math.max(ghost.y, yMin + 1.6) };
    // The throw is never perfect: mostly long/short along your path, a little side to side.
    const along = APass.gauss() * E * 0.75, lat = APass.gauss() * E * 0.45;
    const cap = E * 1.7, mag = Math.hypot(along, lat), sc = mag > cap ? cap / mag : 1;
    const hx = brk.x, hy = brk.y;
    let L = { x: L0.x + (hx * along - hy * lat) * sc, y: L0.y + (hy * along + hx * lat) * sc };
    L.x = clamp(L.x, 4, 96);
    L.y = Math.min(Math.max(L.y, yMin + 2.2), -2);
    st.ball = { t0: st.t, T, L, L0, from: { x: st.qb.x, y: st.qb.y + 1.4 * Math.min(1, st.t / 2.6) - 1 } };
    st.phase = 'air';
    if (st.onEvent) st.onEvent('throw');
  }

  function arrive() {
    const b = st.ball, me = st.me;
    const dP = Math.hypot(me.x - b.L.x, me.y - b.L.y);
    let dD = 99, dDL = 99, near = null;
    for (const o of defs) { const a = Math.hypot(o.x - me.x, o.y - me.y), c = Math.hypot(o.x - b.L.x, o.y - b.L.y); if (a < dD) { dD = a; near = o; } dDL = Math.min(dDL, c); }
    const oob = me.x < 0.9 || me.x > 99.1 || (td && me.y < spot.endLine + 0.5);
    const c = dP / Rc;
    let r, kind;
    if (dP > Rc) {
      r = 'bad';
      kind = dDL < 1.8 && chance(0.55) ? 'int' : dP > Rc * 1.6 ? 'miss' : 'tip';
    } else if (oob) { r = 'bad'; kind = 'oob'; }
    else if (dD >= 3.4 && c <= 0.85) { r = 'great'; kind = 'catch'; }
    else if (dD >= 1.5) { r = 'good'; kind = 'catch'; }
    else if (chance(clamp(0.38 + 0.35 * sk + (0.45 - c) * 0.7 + (ease - 1) * 0.3 - (cl ? 0.05 : 0), 0.1, 0.85))) { r = 'good'; kind = 'catch'; }
    else { r = 'bad'; kind = dD < 0.9 && chance(0.2) ? 'int' : 'pbu'; }
    const depth = Math.round(1 - me.y);
    let yac = 0;
    if (r === 'great') yac = Math.round(clamp(3 + (dD - 3) * 2 + rand(0, 8) + (R.deep ? 4 : 0), 3, 45));
    if (r === 'good') yac = Math.round(rand(0, 2.5));
    const G = APass.grade(spot, r, me.y, depth, yac);
    r = G.r;
    const yards = G.yards, short = G.short;
    if (G.td || G.nose) yac = Math.max(0, yards - depth); else if (r === 'good') yac = Math.max(0, Math.min(yac, yards - depth));
    st.res = { r, kind, yards, depth, yac, dP, dD, c, short, nose: G.nose, near, td: G.td, open: dD >= 3.4, ahead: ((b.L.x - me.x) * brk.x + (b.L.y - me.y) * brk.y) > 0 };
    st.phase = 'post'; st.postT = 0;
    if (st.onEvent) st.onEvent(kind);
  }

  function update(dt) {
    if (st.phase === 'pre' || st.phase === 'done') return;
    if (st.phase === 'set') { st.setT -= dt; if (st.setT <= 0) { st.phase = 'stem'; st.t = 0; if (st.onSnap) st.onSnap(); } return; }
    const n = Math.max(1, Math.ceil(dt / (1 / 60))), h = dt / n;
    for (let s = 0; s < n; s++) {
      if (st.phase === 'post') { st.t += h; st.postT += h; continue; }
      const inp = st.input;
      if (st.phase === 'stem') {
        if (inp.cut) { inp.cut = false; const sc = sCut(); if (sc >= -W2 * 1.9) { doCut(); } else { st.msg = { text: 'NOT YET', t: 0 }; } }
        else if (sCut() > W2 * 1.15) doCut('late');
      } else inp.cut = false;
      moveMe(st.me, h, st.phase === 'stem' ? inp : (st.phase === 'cut' ? {} : inp), st.phase === 'stem' ? 'stem' : 'air');
      st.hist.push({ t: st.t, x: st.me.vx, y: st.me.vy });
      if (st.hist.length > 600) st.hist.splice(0, 200);
      for (const o of defs) stepDef(o, st.t, h);
      st.t += h;
      if (st.phase === 'cut' && st.t >= st.throwAt) launch();
      if (st.phase === 'air' && st.t >= st.ball.t0 + st.ball.T) { arrive(); }
    }
  }

  Object.assign(st, { update, sCut, snap() { if (st.phase === 'pre') { st.phase = 'set'; st.setT = 0.5; } } });
  return st;
}

// Where the CUT label goes (world x): beside the timing band on the side you are not breaking to, inside the view,
// and clear of the rotated yard numbers (centered on x 9 and 91, about 2.5 wide) and the sideline. If that side is
// blocked, the other side, past the break arrow (arrow = how far the arrow reaches sideways) and past the path you
// run in on (back = how far that side your stem starts from the marker, e.g. the out-and-up's fake), so the label
// never sits on your own token as you reach the marker.
function wrCutLabelX(mx, away, arrow, half, camX, z, back) {
  const lo = Math.max(camX + 1.5 / z, 1.2) + half, hi = Math.min(camX + 98.5 / z, 98.8) - half;
  const bad = x => x < lo || x > hi || Math.abs(x - 9) < 2.6 + half || Math.abs(x - 91) < 2.6 + half;
  const near = 6.5 + half, far = Math.max(near, arrow + 2.2 + half, back > 0 ? back + 4.8 + half : 0);
  for (const [side, d] of [[away, near], [away, near + 3], [-away, far], [-away, far + 3]]) {
    const x = mx + side * d;
    if (!bad(x)) return x;
  }
  // Last resort: just inside the view on the side with more room.
  return clamp(mx + away * near, lo, hi);
}

function wrStory(st) {
  const R = st.res, rt = st.route.name, y = R.yards;
  const yd = n => `${n} yard${n === 1 ? '' : 's'}`;
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const cutLine = st.cut ? { perfect: `You plant at the top of the ${rt} and the cornerback keeps backpedaling into next week.`, good: `Your break on the ${rt} is sharp enough to buy a step.`, early: `You cut the ${rt} short, and the cornerback is sitting right on it.`, late: `You round off the ${rt}, and the cornerback never loses you.` }[st.cut.q] : '';
  if (R.kind === 'int') return `${cutLine} The ball hangs, the defender high-points it, and he's gone the other way. Interception.`;
  if (R.kind === 'oob') return pick([`You make the catch, but your foot comes down on the chalk. Incomplete. The replay shows it from four angles, and none of them help.`, `You haul it in a step out of bounds. Incomplete. So close you can taste the paint.`]);
  if (R.kind === 'miss') return R.ahead ? `${cutLine} The ball sails past your outstretched fingers. Overthrown, or you were a step slow. Either way: incomplete.` : `${cutLine} You run right past the spot where the ball comes down. Incomplete, and you hear about it in the huddle.`;
  if (R.kind === 'tip') return pick([`You get a fingertip on it, but only a fingertip. It bounces off your hand and hits the turf.`, `You lay out for it. It glances off your fingertips. Incomplete, and you have grass in your facemask.`]);
  if (R.kind === 'pbu') return pick([`You get there. So does the cornerback, and he gets a hand in at the last second. Broken up.`, `${cutLine} You both go up for it, and he rips it loose on the way down. Incomplete.`]);
  const mode = st.spot.mode;
  if (mode === 'two') return R.open ? `Two-point try. ${cutLine} You're wide open in the end zone, and you don't drop it.` : `Two-point try. It's a fistfight in the end zone, and you come down with it.`;
  if (mode === 'td' && R.td) return R.depth < 100 - st.spot.los ? `You catch it short of the goal line and drag a cornerback across it. Touchdown.`
    : R.open ? pick([`${cutLine} The ball drops into your hands in the end zone, and nobody is within three steps of you.`, `You run under it in the end zone like you're catching a set of car keys. Touchdown, and the stadium shakes.`])
    : `It's a fistfight for the ball in the end zone, and you come down with it. You'll take it.`;
  // Short of the goal line: no yard line here, the next snap's setup picks up from wherever the drive is.
  if (mode === 'td') { const left = 100 - st.spot.los - y; return `You catch it and get dragged down ${left <= 2 ? 'inches ' : left <= 5 ? 'a few yards ' : ''}short of the goal line. Not in. Not over, either.`; }
  if (mode === 'fg') return `${cutLine} You catch it for ${yd(y)}, and that's field goal range. The kicker jogs out before you're off the turf.`;
  if (mode === 'ice' && (R.r === 'great' || st.spot.last)) return `${cutLine} You catch it past the sticks. First down. That should just about do it.`;
  const gap = Math.max(1, (st.spot.need || 0) - y), shortBy = gap === 1 ? 'a yard' : `${gap} yards`;
  if (R.short) return mode === 'ice' ? `You catch it and stretch for the marker, but you come down ${shortBy} short. Fourth down.` : `You catch it clean, but ${shortBy} short of the sticks. The chains don't move.`;
  if (R.r === 'great') return pick([
    `${cutLine} The ball drops in over your shoulder, and you're gone for ${yd(y)}.`,
    `${cutLine} You catch it in stride and turn upfield. ${cap(yd(y))} before anyone touches you.`,
    `Clean break, clean catch, open grass. ${cap(yd(y))} on the ${rt}.`,
  ].filter(Boolean));
  const nose = R.nose ? ' You fall forward, and the chains move by a nose.' : '';
  return pick([
    `He's on your hip the whole way, but you come down with it. ${cap(yd(y))}, and you'll feel that one tomorrow.${nose}`,
    `You catch it with a cornerback wrapped around you like a winter coat. ${cap(yd(y))}.${nose}`,
    `Contested, but caught. You secure it against your chest as you hit the ground. ${cap(yd(y))}.${nose}`,
  ]);
}
function wrLabel(st) {
  const R = st.res;
  return { int: 'Intercepted', oob: 'Out of bounds', miss: 'Incomplete', tip: 'Off the fingertips', pbu: 'Broken up' }[R.kind] || `${st.route.name[0].toUpperCase() + st.route.name.slice(1)} · ${R.yards} yds`;
}

MINIGAMES.catch = function arcadeCatch(cfg, host) {
  const st = wrModel(cfg);
  MINIGAMES.catch.live = st; // read by automated tests only
  const help = `<span class="kb-only"><kbd>Space</kbd> to hike and to cut. Arrow keys or WASD to steer. </span>Tap the field or <b>Cut</b> at the marker. Then drag or hold the pad to get under the ball. Stay in bounds.`;
  const f = APass.mount(host, cfg, { aria: 'Route and catch: run your route, cut at the marker, and catch the ball', startLabel: 'Hike', help, controls: ['left', 'up', 'down', 'right', 'action'], actionLabel: 'Cut', aspect: (host.clientWidth || 600) < 520 ? 0.95 : 0.6 }, 'mg-catch');
  const inp = Field.input(f, { onTap: () => { if (!f.started) f.start(); else if (st.phase === 'stem') st.input.cut = true; } });
  const big = f.big();
  let loop = null, done = false, final = false;
  const vfx = { shake: 0, trail: [], cutFlash: null };
  let cam = null, camX = 0, view = { z: 1, camX: 0, cam: 0 };
  APass.pending = null;

  st.onSnap = () => APass.sfx.snap();
  st.onEvent = (k, q) => {
    if (k === 'cut') { APass.sfx.cut(); vfx.cutFlash = { q, t: 0 }; if (q === 'perfect') Sound.play('tick'); }
    else if (k === 'throw') APass.sfx.whoosh();
    else if (k === 'catch') APass.sfx.catch();
    else if (k === 'int' || k === 'pbu') { APass.sfx.hit(); vfx.shake = 0.22; }
    else APass.sfx.tink();
  };

  function readInput() {
    const s = inp.s;
    const x = (s.right ? 1 : 0) - (s.left ? 1 : 0), y = (s.down ? 1 : 0) - (s.up ? 1 : 0);
    st.input.dir = x || y ? { x, y } : null;
    st.input.ptr = inp.pointer && inp.pointer.down && cam != null ? { x: view.camX + inp.pointer.x / view.z, y: view.cam + inp.pointer.y / view.z } : null;
    if (inp.pressed('action')) { if (st.phase === 'stem') st.input.cut = true; }
    inp.pressed('tap');
  }

  function finishWith(r, label, text) {
    if (done) return;
    done = true;
    if (loop) loop.stop();
    inp.destroy(); f.unmount();
    final = true; try { draw(0); } catch (e) { /* ignore */ }
    endMini(host, r, label, cfg.onDone, text ? { text } : undefined);
  }
  function settle() {
    const R = st.res;
    // A bad play goes back to the engine as bad: it may wipe it out with a flag (and then records no stats).
    APass.mark(cfg.moment, 'recYds', R.kind === 'catch' ? R.yards : 0, R.r, false);
    finishWith(R.r, wrLabel(st), wrStory(st).replace(/\s+/g, ' ').trim());
  }

  // Camera: follows you (and the ball once it's thrown). On phones it zooms in and pans sideways,
  // because the whole sideline-to-sideline field at 300px wide makes everyone ant-sized.
  const zoomFor = () => (f.W < 460 ? 1.65 : 1.3);
  function camTarget(D, z) {
    const me = st.me;
    let focus = me.y, fx = me.x;
    if (st.ball) { focus = APass.lerp(me.y, st.ball.L.y, 0.45); fx = APass.lerp(me.x, st.ball.L.x, 0.5); }
    let c = focus - D * 0.56;
    if (st.phase === 'pre' || st.phase === 'set') c = Math.min(c, 9 - D);
    c = Math.min(c, 12 - D);
    const span = 100 / z;
    const x = clamp(fx - span / 2, 0, 100 - span);
    return { y: c, x };
  }

  function draw(dt) {
    const { ctx } = f;
    const baseU = f.W / 100, z = zoomFor();
    const u = baseU * z, D = f.H / u, W0 = f.W;
    const want = camTarget(D, z);
    const k = 1 - Math.exp(-(dt || 0) * 5);
    if (cam == null || reduceMotion || !dt) { cam = want.y; camX = want.x; }
    else { cam += (want.y - cam) * k; camX += (want.x - camX) * k; }
    view = { z, camX, cam };
    st.view = { z, camX, cam, u: baseU };
    const [sx, sy] = APass.shakeOffset(vfx, dt || 0);
    ctx.save(); ctx.clearRect(0, 0, W0, f.H); ctx.translate(sx - camX * u, sy);
    f.u = u; f.W = 100 * u;
    const tk = 1; // zoom already sizes the tokens
    try {
      APass.turf(f, cam, st.spot);
      const pre = st.phase === 'pre' || st.phase === 'set';
      const me = st.me, m = st.marker;

      // Route chalk: the stem, the marker, and the break.
      const brkEnd = { x: m.x + st.brk.x * (st.route.settle || 12), y: m.y + st.brk.y * (st.route.settle || 12) };
      const routePts = [[st.x0, 1]].concat(st.wps.map(w => [w.x, w.y]), [[brkEnd.x, Math.max(brkEnd.y, st.yMin + 1)]]);
      APass.chalk(f, routePts, cam, { alpha: pre ? 0.9 : st.cut ? 0.22 : 0.55, dash: !pre, w: 0.5 });

      // The line of scrimmage: five linemen holding up four rushers in front of the quarterback.
      const push = pre ? 0 : Math.min(1, st.t / 2.6), py0 = 2.2 + 1.6 * push;
      for (const x of [41, 45.5, 50, 54.5, 59]) Field.drawPlayer(f, 50 + (x - 50) * (1 - 0.1 * push), py0 - cam, { r: 2.1 });
      for (const x of [43.2, 47.7, 52.3, 56.8]) Field.drawPlayer(f, 50 + (x - 50) * (1 - 0.1 * push), py0 - 3.9 - cam, { team: 'them', r: 2.1 });
      // QB (a teammate) and the ball.
      Field.drawPlayer(f, st.qb.x, st.qb.y + 1.4 * push - cam, { r: 2.6, num: String(st.who.num) === '12' ? 9 : 12 });
      if (!st.ball) Field.drawBall(f, st.qb.x + 2.6, st.qb.y + 1.4 * push - cam + 1.2, 0.75);

      // Defenders.
      for (const o of st.defs) {
        // Keep a defender who's draped on you visible beside your token (outcomes use the true distance).
        let ox = o.x, oy = o.y; const dx = ox - st.me.x, dy = oy - st.me.y, dd = Math.hypot(dx, dy), minD = 4.2;
        if (dd < minD) { if (dd > 0.01) { ox = st.me.x + dx / dd * minD; oy = st.me.y + dy / dd * minD; } else { ox = st.me.x + minD; } }
        Field.drawPlayer(f, ox, oy - cam, { team: 'them', r: 2.8, ball: st.res && st.res.kind === 'int' && o === st.res.near && st.phase === 'post' });
      }

      if (!st.cut) {
        // Timing band across the stem at the break marker: the bright core is a perfect cut.
        const prev = st.wps.length > 1 ? st.wps[st.wps.length - 2] : { x: st.x0, y: 1 };
        const ang = Math.atan2(m.y - prev.y, m.x - prev.x);
        const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(st.t * 9);
        ctx.save();
        ctx.translate(m.x * u, (m.y - cam) * u); ctx.rotate(ang + Math.PI / 2);
        const wB = 11 * u;
        ctx.fillStyle = 'rgba(255,178,30,.26)'; ctx.fillRect(-wB / 2, -st.W2 * u, wB, st.W2 * 2 * u);
        ctx.fillStyle = `rgba(255,178,30,${0.6 + 0.25 * pulse})`; ctx.fillRect(-wB / 2, -st.W1 * u, wB, st.W1 * 2 * u);
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, u * 0.25);
        ctx.strokeRect(-wB / 2, -st.W2 * u, wB, st.W2 * 2 * u);
        ctx.restore();
        // Arrow showing which way you break.
        APass.chalk(f, [[m.x, m.y], [m.x + st.brk.x * 6, m.y + st.brk.y * 6]], cam, { color: f.c.led, w: 0.7, alpha: 0.95 });
        // Label on the side you are NOT coming from (a double move arrives from the inside) and away from the break.
        const fromX = m.x - prev.x, away = Math.abs(fromX) > 1.5 ? Math.sign(fromX) : -(Math.sign(st.brk.x) || st.side);
        const size = 3.6 * Math.min(tk, 1.2);
        ctx.font = `700 ${Math.round(size * u)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        const half = ctx.measureText('CUT').width / u / 2 + 0.6;
        const back = Math.sign(prev.x - m.x) === -away ? Math.abs(prev.x - m.x) : 0;
        Field.text(f, 'CUT', wrCutLabelX(m.x, away, Math.abs(st.brk.x) * 6, half, camX, z, back), m.y - cam, { size, color: f.c.led });
      }

      // Landing circle.
      const b = st.ball;
      if (b && st.phase === 'air') {
        const q = clamp((st.t - b.t0) / b.T, 0, 1);
        const rr = st.Rc + 9 * (1 - q);
        const inZone = Math.hypot(me.x - b.L.x, me.y - b.L.y) <= st.Rc;
        const lx = b.L.x * u, ly = (b.L.y - cam) * u;
        ctx.save();
        ctx.fillStyle = inZone ? 'rgba(91,214,138,.36)' : 'rgba(255,255,255,.2)';
        ctx.beginPath(); ctx.arc(lx, ly, st.Rc * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1, u * 0.22);
        ctx.beginPath(); ctx.arc(lx, ly, st.Rc * u, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = inZone ? f.c.good : f.c.led; ctx.lineWidth = Math.max(2, u * 0.65);
        ctx.beginPath(); ctx.arc(lx, ly, rr * u, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(lx, ly, u * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // You.
      const carry = st.res && st.res.kind === 'catch' && st.phase === 'post';
      let py = me.y;
      if (carry) { const run = st.res.yac * APass.smooth(st.postT / 0.85); py = Math.max(st.spot.goal - 3, me.y - run); }
      Field.drawPlayer(f, me.x, py - cam, { num: st.who.num, r: 3.3 * tk, ring: '#FFFFFF', ball: carry });
      if (pre) Field.text(f, 'YOU', me.x, py - cam + 3.3 * tk + 2.8, { size: 3 * Math.min(tk, 1.2), color: f.c.led });

      // Ball in flight.
      if (b && st.phase === 'air') {
        const q = clamp((st.t - b.t0) / b.T, 0, 1);
        const x = APass.lerp(b.from.x, b.L.x, q), y = APass.lerp(b.from.y, b.L.y, q);
        const dist = Math.hypot(b.L.x - b.from.x, b.L.y - b.from.y);
        const lift = (2 + dist * 0.2) * 4 * q * (1 - q);
        if (!reduceMotion) { vfx.trail.push([x, y - lift]); if (vfx.trail.length > 8) vfx.trail.shift(); vfx.trail.forEach(([tx, ty], i) => { ctx.fillStyle = `rgba(255,255,255,${0.04 + i * 0.03})`; ctx.beginPath(); ctx.arc(tx * u, (ty - cam) * u, u * 0.5, 0, Math.PI * 2); ctx.fill(); }); }
        Field.drawBall(f, x, y - cam, 1 + lift * 0.025, lift, Math.atan2(b.L.y - b.from.y, b.L.x - b.from.x));
      }
      if (st.phase === 'post' && st.res && st.res.kind !== 'catch' && st.res.kind !== 'int' && b) {
        const q = clamp(st.postT / 0.55, 0, 1);
        Field.drawBall(f, b.L.x + st.brk.x * 5 * q, b.L.y + st.brk.y * 5 * q - cam, 1, 2 * Math.abs(Math.sin(q * Math.PI * 1.5)) * (1 - q), q * 8);
      }
      if (st.phase === 'post' && st.res && st.res.kind === 'catch' && !reduceMotion && st.postT < 0.5 && !final) {
        const age = st.postT;
        ctx.save(); ctx.strokeStyle = `rgba(255,178,30,${0.8 * (1 - age / 0.5)})`; ctx.lineWidth = u * 0.6;
        ctx.beginPath(); ctx.arc(me.x * u, (me.y - cam) * u, u * (4 + age * 18), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    } finally {
      f.u = baseU; f.W = W0;
      ctx.restore();
    }

    // HUD (screen space).
    const Dh = f.H / baseU;
    const dn = APass.down(st.spot, st.route.name.toUpperCase());
    APass.pill(f, dn, 2.2, 1.8, { color: f.c.led });
    if (st.phase === 'set') Field.text(f, st.setT > 0.25 ? 'SET…' : 'HUT!', 50, Dh * 0.42, { display: true, size: 5 * big, color: f.c.led, weight: 400 });
    if (vfx.cutFlash && !final) {
      vfx.cutFlash.t += dt || 0;
      const cf = vfx.cutFlash;
      if (cf.t < 0.9 && st.phase !== 'post') {
        const txt = { perfect: 'PERFECT CUT', good: 'GOOD CUT', early: 'TOO EARLY', late: 'ROUNDED OFF' }[cf.q];
        APass.pill(f, txt, 97.8, 1.8, { align: 'right', color: cf.q === 'perfect' ? f.c.good : cf.q === 'good' ? '#FFFFFF' : f.c.bad });
      }
    }
    // An early tap: say so in the top corner (the cut flash and ball hints use the same spot later in the play).
    if (st.msg && !final) { st.msg.t += dt || 0; if (st.msg.t < 0.8 && st.phase === 'stem') APass.pill(f, st.msg.text, 97.8, 1.8, { align: 'right', color: '#FFFFFF', bg: 'rgba(180,40,30,.88)' }); }
    const b = st.ball, me = st.me;
    if (st.phase === 'air' && !final) {
      const inZone = Math.hypot(me.x - b.L.x, me.y - b.L.y) <= st.Rc;
      if (!vfx.cutFlash || vfx.cutFlash.t >= 0.9) APass.pill(f, inZone ? 'UNDER IT' : 'GET UNDER IT', 97.8, 1.8, { align: 'right', color: inZone ? f.c.good : '#FFFFFF' });
    }
    if (st.phase === 'post' && st.res && !final) {
      const R = st.res, age = st.postT;
      const t = { int: ['PICKED OFF', null, f.c.bad], oob: ['OUT OF BOUNDS', 'INCOMPLETE', '#FFFFFF'], miss: ['INCOMPLETE', null, '#FFFFFF'], tip: ['OFF THE FINGERS', 'INCOMPLETE', '#FFFFFF'], pbu: ['BROKEN UP', 'INCOMPLETE', '#FFFFFF'] }[R.kind];
      if (t) APass.callout(f, t[0], t[1], age, t[2]);
      else if (st.spot.mode === 'two') APass.callout(f, 'GOOD!', 'TWO POINTS', age, f.c.led);
      else if (R.td) APass.callout(f, 'TOUCHDOWN', R.open ? 'WIDE OPEN' : 'CONTESTED CATCH', age, f.c.led);
      else if (st.spot.mode === 'td') APass.callout(f, 'CAUGHT', 'SHORT OF THE GOAL LINE', age, '#FFFFFF');
      else if (st.spot.mode === 'fg') APass.callout(f, 'CAUGHT', `+${R.yards} · FIELD GOAL RANGE`, age, R.r === 'great' ? f.c.led : '#FFFFFF');
      else if (st.spot.mode === 'ice' && (R.r === 'great' || st.spot.last)) APass.callout(f, 'FIRST DOWN', `+${R.yards} YARDS`, age, f.c.led);
      else APass.callout(f, R.r === 'great' ? 'CAUGHT' : 'CONTESTED', `+${Math.round(Math.min(R.yards, R.depth) + Math.max(0, R.yards - R.depth) * clamp(age / 0.85, 0, 1))} YARDS${R.short ? ' · SHORT OF THE STICKS' : ''}`, age, R.r === 'great' ? f.c.led : '#FFFFFF');
    }
  }

  f.redraw = () => draw(0);
  draw(0);

  function frame(dt) {
    if (done) return false;
    readInput();
    st.update(dt);
    draw(dt);
    if (st.phase === 'post' && st.postT >= 1.0) { settle(); return false; }
  }
  f.onStart(() => {
    APass.reveal(f);
    inp.pressed('action'); inp.pressed('tap'); st.input.cut = false;
    st.snap();
    loop = Field.loop(frame);
  });

  setMini({
    stop() { done = true; if (loop) loop.stop(); inp.destroy(); f.unmount(); },
    key(e) {
      if (done) return true;
      if (!f.started) { if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) f.start(); return true; } return inp.claims(e); }
      return inp.claims(e);
    },
    finish(r) {
      if (done) return;
      APass.pending = null;
      finishWith(r, null, null);
    },
  });
};
MINIGAMES.catch.model = wrModel;
MINIGAMES.catch.story = wrStory;
MINIGAMES.catch.routes = WR_ROUTES; // tests tune these

// ---------- Content: wide receiver moments ----------
MOMENTS.WR.push(
  { type: 'catch', title: 'Double Move', btn: 'Hike',
    setup: 'The cornerback has jumped every short route you\'ve run all day. {coachLast} grins and signals the out-and-up. Sell the out, then go. If he bites, you\'re gone.',
    prompt: 'Sell the fake, cut up at the marker, then run under the ball.',
    great: 'He bites on the out so hard he nearly falls over. The ball drops into your hands forty yards downfield.',
    good: 'He recovers in time to make it a fight, but you win the fight.',
    bad: 'He doesn\'t bite. He just runs with you, and the ball falls incomplete between you.',
    arcade: { route: 'outup', los: 30 } },
  { type: 'catch', title: 'Third-Down Dig', btn: 'Hike',
    setup: 'Third and eight. You run a dig across the middle, where the linebackers live. Break it off sharp at twelve yards and catch it in traffic. The yellow line is the first down.',
    prompt: 'Snap the cut at the marker. Catch it past the yellow line.',
    great: 'You break it off flat and catch it in stride across the middle. First down, and some extra.',
    good: 'You take a shot from the linebacker as the ball arrives, and you hold on. First down.',
    bad: 'The linebacker reads it and gets a hand on the ball. Fourth down.',
    arcade: { route: 'dig', need: 8, los: 44 } },
);

// The last throw of the game is now yours to catch.
APass.setClutch('WR', 'chase', { type: 'catch', title: 'Last Throw', btn: 'Hike',
  setup: 'It comes down to one throw, and your quarterback is looking at you. Win your route, find the ball, and keep your feet in bounds.',
  prompt: 'One route. One ball. Cut at the marker and go get it.',
  great: 'You go up over two defenders and come down with it.',
  good: 'You bobble it, juggle it, and secure it against your chest.',
  bad: 'It goes off your fingertips.' }, 'timing');
