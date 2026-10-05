// =========================================================
//   ARCADE PASS GAME — shared helpers (APass) + quarterback 'throw'
// =========================================================
// World coordinates for both pass games: x 0..100 is sideline to sideline, y is in yards with the line of
// scrimmage at y = 0 and upfield NEGATIVE (the offense moves up the screen). The camera value `cam` is the world
// y at the top of the canvas, so a world point draws at screen field units (x, y - cam).
// Mod keys: 'throw.ease' (>1 = easier: slower rush, looser coverage, clearer rings, more accurate),
//           'catch.ease' (see 64-arcade-wr.js).
const APass = (() => {
  const A = {};
  A.ease = (key, cfg) => clamp(mod(key, 1, cfg), 0.35, 3);
  A.who = () => (S && S.st ? { skill: S.st.skill, conf: S.st.conf, energy: S.st.energy, num: S.num } : { skill: 45, conf: 50, energy: 80, num: 7 });
  A.gauss = () => { let a = 0; while (!a) a = Math.random(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * Math.random()); };
  A.pickW = list => { let t = list.reduce((s, x) => s + x[1], 0) * Math.random(); for (const [v, w] of list) { t -= w; if (t <= 0) return v; } return list[0][0]; };
  A.lerp = (a, b, t) => a + (b - a) * t;
  A.smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  A.len = (x, y) => Math.hypot(x, y);
  A.oppNick = () => { try { return S && S.game ? shortName(oppOf(S.game.n).team) : ''; } catch (e) { return ''; } };

  // Field position. los = yard line counted from our own goal (0-100). goal = world y of their goal line.
  // In the final minutes (cfg.clutch) the spot follows the engine's drive: a two-point try from the 2, a lead to
  // protect (move the chains), a field goal to win (get into range) or a touchdown to win (red zone; the
  // second snap of the drive starts closer).
  //   mode: 'open' | 'td' | 'two' | 'fg' | 'ice'
  A.spot = (cfg, mo) => {
    mo = mo || {};
    let los = mo.los, need = mo.need || 0, mode = 'open', last = false;
    if (cfg.clutch) {
      const g = S && S.game, cl = g && g.cl;
      const margin = g ? g.us - g.them : -4;
      if (cl && cl.twoPt) { los = 98; mode = 'two'; need = 0; }
      else if (margin > 0) { los = ri(32, 46); mode = 'ice'; need = ri(3, 6); }
      else if (-margin <= 2) { los = cl && cl.snap ? 70 : 64; mode = 'fg'; need = 0; }
      else { los = cl && cl.snap ? 92 : (mo.rzLos || 86); mode = 'td'; need = 0; }
      // The engine scores any completion on a later snap of the drive as a success (touchdown / ballgame).
      last = !!(cl && cl.snap >= 1 && !cl.twoPt);
    }
    if (los == null) los = ri(24, 58);
    const goal = -(100 - los);
    return { los, need, mode, goal, endLine: goal - 10, ez: mode === 'td' || mode === 'two', last };
  };
  // Scoreboard line for the HUD.
  A.down = (spot, fallback) => spot.mode === 'two' ? 'TWO-POINT TRY' : spot.mode === 'td' ? (spot.los >= 90 ? 'GOAL TO GO' : `${100 - spot.los} TO THE END ZONE`)
    : spot.mode === 'fg' ? 'GET INTO FG RANGE' : spot.mode === 'ice' ? `3RD & ${spot.need} · ICE IT` : spot.need ? `3RD & ${spot.need}` : fallback;
  // What a completion means on this snap: { r, yards, short, td } given the grade from separation.
  A.grade = (spot, r, catchY, depth, yac) => {
    const toGoal = 100 - spot.los;
    if (r === 'bad') return { r, yards: 0, short: false, td: false };
    let yards = clamp(depth + yac, 1, toGoal), short = false, td = false, nose = false;
    if (spot.mode === 'td') {
      // In the end zone (or run into it) is the touchdown; anything short keeps the drive alive.
      if (catchY <= spot.goal || depth + yac >= toGoal) { r = 'great'; yards = toGoal; td = true; }
      else if (spot.last) { yards = toGoal; td = true; } // last snap: he fights his way across
      else { r = 'good'; yards = clamp(depth + Math.min(yac, 2), 1, toGoal - 1); }
    } else if (spot.mode === 'two') { yards = toGoal; td = true; }
    else if (spot.mode === 'ice') {
      // Protecting a lead, any catch past the sticks ends the game; anything short means one more snap.
      // Short of it, he falls forward to a yard short, so the next snap is fourth and one.
      if (yards >= spot.need) r = 'great'; else if (spot.last) yards = spot.need; else { r = 'good'; short = true; yards = Math.max(yards, spot.need - 1); }
    } else if (spot.need && r === 'great' && yards < spot.need) { r = 'good'; short = true; }
    // A contested catch on a must-convert down falls forward for the first down (that is what 'good' means there).
    else if (spot.need && r === 'good' && yards < spot.need) { yards = Math.min(spot.need, toGoal); nose = true; }
    return { r, yards, short, td, nose };
  };

  // Turf with real yard lines (drawTurf counts 10-unit stripes from the scroll origin, so shift it so the
  // stripes land on the 10s and the numbers read correctly), our own end zone art and sideline chalk.
  A.turf = (f, cam, spot) => {
    const shift = ((10 - (spot.los % 10)) % 10);
    Field.drawTurf(f, { scroll: cam + shift, baseYard: spot.los + shift, los: shift, firstDown: spot.need ? -spot.need + shift : null });
    A.endZone(f, cam, spot);
    const { ctx, u, H } = f;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(0, 0, u * 0.7, H); ctx.fillRect(f.W - u * 0.7, 0, u * 0.7, H);
  };
  A.endZone = (f, cam, spot) => {
    const { ctx, u, W, H, c } = f;
    const yG = (spot.goal - cam) * u, yE = (spot.endLine - cam) * u;
    if (yG < -2 || yE > H + 2) return;
    ctx.save();
    ctx.fillStyle = c.turfB; ctx.fillRect(0, yE, W, yG - yE);
    // Their end zone, painted in their colors when the team kit (48-teams.js) knows them.
    let tint = 'rgba(210,80,10,.22)';
    try { if (typeof teamStyle === 'function' && S && S.game) { tint = teamStyle(oppOf(S.game.n).team).c1; ctx.globalAlpha = 0.42; } } catch (e) { /* ignore */ }
    ctx.fillStyle = tint; ctx.fillRect(0, yE, W, yG - yE);
    ctx.globalAlpha = 1;
    // diagonal hatching
    ctx.beginPath(); ctx.rect(0, yE, W, yG - yE); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = u * 1.2;
    for (let x = -H; x < W + H; x += u * 5) { ctx.beginPath(); ctx.moveTo(x, yE); ctx.lineTo(x + (yG - yE), yG); ctx.stroke(); }
    const nick = (A.oppNick() || 'End zone').toUpperCase();
    ctx.fillStyle = 'rgba(255,255,255,.34)';
    ctx.font = `${Math.round(u * 5.2)}px Graduate, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(nick, W / 2, (yE + yG) / 2);
    ctx.restore();
    if (yE > 0) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(0, 0, W, yE); }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, yG - u * 0.5, W, u * 1.0);
    ctx.fillRect(0, yE - u * 0.4, W, u * 0.8);
    ctx.fillStyle = c.us;
    for (const y of [yG, yE]) { ctx.fillRect(0, y - u * 1.1, u * 1.6, u * 2.2); ctx.fillRect(W - u * 1.6, y - u * 1.1, u * 1.6, u * 2.2); }
  };

  // Chalk line through world points, optional arrowhead at the end.
  A.chalk = (f, pts, cam, o) => {
    o = o || {};
    if (pts.length < 2) return;
    const { ctx, u } = f;
    ctx.save();
    ctx.globalAlpha = o.alpha != null ? o.alpha : 0.85;
    ctx.strokeStyle = o.color || '#FFFFFF'; ctx.lineWidth = Math.max(1.5, u * (o.w || 0.55));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.dash) ctx.setLineDash([u * 1.4, u * 1.1]);
    ctx.beginPath(); ctx.moveTo(pts[0][0] * u, (pts[0][1] - cam) * u);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * u, (pts[i][1] - cam) * u);
    ctx.stroke();
    if (o.arrow !== false) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s = u * 2.1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(b[0] * u - Math.cos(ang - 0.5) * s, (b[1] - cam) * u - Math.sin(ang - 0.5) * s);
      ctx.lineTo(b[0] * u, (b[1] - cam) * u);
      ctx.lineTo(b[0] * u - Math.cos(ang + 0.5) * s, (b[1] - cam) * u - Math.sin(ang + 0.5) * s);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Small HUD pill in canvas field units (not world). align: 'left' | 'right' | 'center'.
  A.pill = (f, text, x, y, o) => {
    o = o || {};
    const { ctx, u } = f;
    const size = Math.max(11, Math.round(u * (o.size || 3.2)));
    ctx.save();
    ctx.font = `700 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const tw = ctx.measureText(text).width, padX = size * 0.55, h = size * 1.55, w = tw + padX * 2;
    let px = x * u;
    if (o.align === 'right') px -= w; else if (o.align === 'center') px -= w / 2;
    const py = y * u;
    ctx.fillStyle = o.bg || 'rgba(8,14,10,.72)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, w, h, h * 0.28); else ctx.rect(px, py, w, h);
    ctx.fill();
    ctx.fillStyle = o.color || '#FFFFFF'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, px + padX, py + h / 2 + 0.5);
    ctx.restore();
    return { x: px / u, y, w: w / u, h: h / u };
  };

  // Big callout that pops in (scale) — drawn in canvas field units.
  A.callout = (f, text, sub, age, color, yAt) => {
    const s = reduceMotion ? 1 : 1 + 0.35 * Math.max(0, 1 - age / 0.18);
    const { ctx, u } = f;
    const y = yAt != null ? yAt : Math.min(16, f.H / u * 0.24);
    ctx.save();
    ctx.translate(50 * u, y * u); ctx.scale(s, s); ctx.translate(-50 * u, -y * u);
    Field.text(f, text, 50, y, { display: true, size: f.W < 420 ? 8 : 6.4, color: color || '#FFFFFF', weight: 400 });
    if (sub) Field.text(f, sub, 50, y + (f.W < 420 ? 7.5 : 6), { size: f.W < 420 ? 4.6 : 3.6, color: '#FFFFFF' });
    ctx.restore();
  };

  // Mounts the canvas panel and keeps it sized on window resizes. Token scale is bigger on phones.
  A.mount = (host, cfg, opts, cls) => {
    const w = host.clientWidth || 600;
    const f = Field.mount(host, cfg, Object.assign({ aspect: w < 520 ? 0.8 : 0.58, minH: 220, maxH: 470 }, opts));
    f.panel.classList.add('mg-pass', cls);
    f.big = () => (f.W < 460 ? 1.28 : 1);
    const onResize = () => { try { f.resize(); if (f.redraw) f.redraw(); } catch (e) { /* ignore */ } };
    window.addEventListener('resize', onResize);
    f.unmount = () => window.removeEventListener('resize', onResize);
    return f;
  };

  // Bring the play into view when it starts (story text above can push it below the fold).
  A.reveal = f => {
    try {
      const r = f.panel.getBoundingClientRect();
      if (r.top < 56 || r.bottom > window.innerHeight) f.panel.scrollIntoView({ block: r.height > window.innerHeight - 70 ? 'end' : 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    } catch (e) { /* ignore */ }
  };

  A.shakeOffset = (st, dt) => {
    if (reduceMotion || !st.shake) return [0, 0];
    st.shake = Math.max(0, st.shake - dt);
    const a = st.shake * 10;
    return [(Math.random() - 0.5) * a, (Math.random() - 0.5) * a];
  };

  A.sfx = {
    snap: () => Sound.play('tick'),
    whoosh: () => { if (Sound.on) { Sound.noise(0.28, 0.035, 0, 1500); Sound.tone(520, 0.22, 'sine', 0.018, 0, 380); } },
    catch: () => { if (Sound.on) { Sound.tone(150, 0.09, 'sine', 0.09); Sound.noise(0.06, 0.05, 0, 700); } },
    hit: () => { if (Sound.on) { Sound.noise(0.22, 0.09, 0, 260); Sound.tone(90, 0.16, 'sine', 0.08); } },
    tink: () => { if (Sound.on) Sound.tone(1250, 0.05, 'triangle', 0.03); },
    alarm: () => { if (Sound.on) Sound.tone(740, 0.06, 'square', 0.02); },
    cut: () => { if (Sound.on) { Sound.noise(0.1, 0.05, 0, 2200); Sound.tone(300, 0.07, 'triangle', 0.035); } },
  };

  // A bad play in a real game can still be rescued (rabbit's foot, chemistry): the engine does that itself with a
  // flag on the other team that wipes the play out, so our "incomplete" text stays true and no stats are recorded.

  // The engine adds random yardage for a completed moment; make the season line match what actually
  // happened on the canvas (yards, and interceptions thrown in the 'throw' game).
  A.pending = null;
  A.mark = (moment, key, yards, r, int) => {
    const g = S && S.game;
    A.pending = g && moment ? { moment, key, yards: Math.round(yards || 0), r, int: !!int, gY: g.line[key] || 0, gI: g.line.int || 0 } : null;
  };
  on('play', ev => {
    const p = A.pending;
    A.pending = null;
    if (!p || !S || !S.game || !ev || ev.saved || ev.moment !== p.moment || ev.r !== p.r) return;
    const g = S.game;
    if (ev.r !== 'bad') {
      const added = (g.line[p.key] || 0) - p.gY;
      const diff = p.yards - added;
      if (diff && added) { g.line[p.key] = (g.line[p.key] || 0) + diff; S.line[p.key] = (S.line[p.key] || 0) + diff; }
    } else if (p.int && (g.line.int || 0) === p.gI) {
      g.line.int = (g.line.int || 0) + 1; S.line.int = (S.line.int || 0) + 1;
    }
  });
  return A;
})();

// =========================================================
//   'throw' — quarterback pass play
// =========================================================
TAGS.throw = 'Pass play';
DEFAULT_PROMPT.throw = 'Find the open man before the pocket collapses, then tap him to throw.';

// Route library: points relative to the receiver's alignment. i = toward the middle (+1/-1), o = toward the sideline.
const QB_ROUTES = {
  slant: { name: 'slant', deep: false, pts: (i, o) => [[0, -3], [i * 13, -13], [i * 34, -28]] },
  out: { name: 'out', deep: false, pts: (i, o) => [[0, -9], [o * 1.2, -10.2], [o * 32, -10.6]] },
  curl: { name: 'curl', deep: false, settle: true, pts: (i, o) => [[0, -12.5], [i * 1.6, -13.3], [i * 2.6, -10.2]] },
  drag: { name: 'drag', deep: false, pts: (i, o) => [[0, -2], [i * 7, -5], [i * 80, -6.5]] },
  post: { name: 'post', deep: true, pts: (i, o) => [[0, -11], [i * 14, -25], [i * 26, -48]] },
  go: { name: 'go', deep: true, pts: (i, o) => [[o * 1.5, -12], [o * 2.5, -60]] },
  corner: { name: 'corner', deep: true, pts: (i, o) => [[0, -10], [o * 12, -22], [o * 22, -38]] },
};

// Receivers keep this far from the sideline (token radius on a phone + ring + chalk), and routes stay this far apart.
const QB_EDGE = 6.6, QB_MIN_GAP = 8.5;
// Where a receiver is t seconds after the snap (r from qbModel; yMin = how far upfield the routes may go).
function recPosOf(r, t, yMin) {
  if (yMin == null) yMin = r.yMin != null ? r.yMin : -95;
  const TA = 0.32;
  const s = t <= 0 ? 0 : t < TA ? 0.5 * r.v / TA * t * t : r.v * (t - TA / 2);
  const P = r.pts, C = r.cum, L = C[C.length - 1];
  if (s >= L) {
    if (r.route.settle) return { x: P[P.length - 1][0], y: P[P.length - 1][1] };
    const a = P[P.length - 2], b = P[P.length - 1], seg = C[C.length - 1] - C[C.length - 2] || 1;
    const e = s - L;
    return { x: clamp(b[0] + (b[0] - a[0]) / seg * e, QB_EDGE, 100 - QB_EDGE), y: Math.max(yMin, b[1] + (b[1] - a[1]) / seg * e) };
  }
  let j = 1;
  while (j < C.length - 1 && C[j] < s) j++;
  const a = P[j - 1], b = P[j], q = (s - C[j - 1]) / ((C[j] - C[j - 1]) || 1);
  return { x: a[0] + (b[0] - a[0]) * q, y: a[1] + (b[1] - a[1]) * q };
}
// Closest any two receivers get during the part of the play you can still throw (and a little after).
function qbMinGap(recs, pos, tEnd) {
  let m = 99;
  for (let t = 0.3; t <= (tEnd || 3.6); t += 0.1) {
    const P = recs.map(r => pos(r, t));
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) m = Math.min(m, Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y));
  }
  return m;
}
// The quarterback's receivers by where they line up: Walt Okonjo wide left, Shay Mercado wide right, the tight end
// flexed out in the slot. Used in the result text (the canvas numbers 1-2-3 are only tap targets).
function qbReceiverName(x0) { return x0 < 22 ? 'Walt' : x0 > 78 ? 'Shay' : 'your tight end'; }

function qbModel(cfg) {
  const who = APass.who(), d = clamp(cfg.diff || 2, 0.6, 5.5), ease = APass.ease('throw.ease', cfg), cl = !!cfg.clutch;
  const tired = who.energy < 30, sk = clamp((who.skill - 45) / 55, -1, 1);
  const mo = Object.assign({}, cfg.moment && cfg.moment.arcade, cfg.arcade);
  const spot = APass.spot(cfg, mo);
  const td = spot.ez; // red zone or two-point try: everything happens in a short field
  const shell = mo.shell || APass.pickW([['cover1', 0.5], ['cover2', 0.34], ['cover0', 0.1 + 0.025 * d]]);

  // Formation: receivers 1-2-3 numbered left to right so the keys match what you see.
  const FORMS = [[11, 31, 88], [12, 69, 89]];
  let xs = mo.xs || pick(FORMS);
  let names = mo.routes ? mo.routes.slice() : null;
  if (!names) {
    if (spot.mode === 'two') names = shuffle(['slant', 'out', pick(['corner', 'drag'])]);
    else if (td) names = shuffle(['slant', 'corner', pick(['post', 'go', 'out'])]);
    else if (spot.mode === 'ice') names = shuffle(['out', 'slant', pick(['curl', 'drag'])]);
    else if (spot.mode === 'fg') names = shuffle(['out', pick(['curl', 'slant']), pick(['drag', 'post'])]);
    else names = shuffle([pick(['slant', 'drag', 'out']), pick(['curl', 'out', 'slant']), pick(['post', 'go', 'corner'])]);
    // Two of the same route? Swap the second for something else.
    for (let k = 1; k < 3; k++) if (names.indexOf(names[k]) < k) names[k] = ['curl', 'post', 'drag', 'corner', 'out'].find(n => !names.includes(n) && !(td && (n === 'curl' || n === 'drag')));
  }
  const yMin = td ? spot.endLine + 1.6 : -95;

  // Pass rush clock (seconds until the sack). Worked out first: the receiver spacing check covers the whole pocket.
  const rushT = clamp((3.6 - 0.19 * d + 0.5 * sk + (who.conf - 50) * 0.004 - (tired ? 0.35 : 0) - (cl ? 0.22 : 0) + (mo.pa ? 0.35 : 0) + (mo.rush || 0))
    * (shell === 'cover0' ? 0.8 : 1) * Math.sqrt(ease), 1.7, 6);
  const vR = 10.2 + (tired ? -0.4 : 0);
  // Receivers stay a full token (plus its ring) inside the sidelines, so nobody is drawn half off the field.
  const XL = QB_EDGE, XR = 100 - QB_EDGE;
  const build = (xs, names) => xs.map((x0, k) => {
    const def = QB_ROUTES[names[k]] || QB_ROUTES.slant;
    const i = x0 < 50 ? 1 : -1, o = -i;
    const pts = [[x0, 1]].concat(def.pts(i, o).map(([dx, dy]) => [clamp(x0 + dx, XL, XR), Math.max(yMin, 1 + dy)]));
    const cum = [0];
    for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    return { k, x0, route: def, name: def.name, deep: def.deep, pts, cum, v: vR * rand(0.97, 1.04), side: i, who: qbReceiverName(x0) };
  });
  // Two receivers whose routes cross or stack (a post across a go, a corner flattened along the end line) are hard
  // to tell apart and to tap. Try the other orders of the same routes, and the other formation, until every pair
  // stays apart for the whole play; keep the best if nothing is perfect.
  const tryOrders = (xs, names) => {
    const out = [names];
    for (const q of [[0, 2, 1], [1, 0, 2], [2, 1, 0], [1, 2, 0], [2, 0, 1]]) out.push(q.map(j => names[j]));
    return out.map(n => [xs, n]);
  };
  let cands = tryOrders(xs, names);
  if (!mo.xs) for (const F of FORMS) if (F !== xs) cands = cands.concat(tryOrders(F, names));
  let recs = null, bestSep = -1;
  for (const [cx, cn] of cands) {
    const rs = build(cx, cn), sep = qbMinGap(rs, (r, t) => recPosOf(r, t, yMin), rushT + 0.3);
    if (sep > bestSep) { bestSep = sep; recs = rs; xs = cx; names = cn; }
    if (sep >= QB_MIN_GAP) break;
  }
  function recPos(r, t) { return recPosOf(r, t, yMin); }
  const recVel = (r, t) => { const a = recPos(r, t - 0.03), b = recPos(r, t); return { x: (b.x - a.x) / 0.03, y: (b.y - a.y) / 0.03 }; };

  // Coverage. tight in 0..1 (diff pushes it up, ease and skill pull it down).
  const baseTight = 0.24 + 0.11 * d - 0.1 * sk - (ease - 1) * 0.35 + (cl ? 0.08 : 0) + (shell === 'cover0' ? 0.12 : 0) + (td ? -0.24 : 0) + (mo.tight || 0);
  const defs = recs.map(r => {
    const tight = clamp(baseTight + rand(-0.22, 0.22), 0.04, 1);
    const press = shell === 'cover0' || (tight > 0.62 && chance(0.7));
    const inside = chance(0.62);
    const lev = r.side * (inside ? 1 : -1);
    const cushion = press ? 1.1 : 3.4 + (1 - tight) * 4.2;
    const O0 = { x: lev * (press ? 0.6 : 1.2), y: mo.pa ? -Math.min(cushion, 4.4) : -cushion }, O1 = { x: lev * 1.3, y: press ? -0.2 : -0.6 };
    return {
      kind: 'man', tgt: r.k, x: r.x0 + O0.x, y: 1 + O0.y, tight, press, lev, O0, O1,
      lag: 0.62 - 0.3 * tight, k: 0.5 + 1.1 * tight, vmax: r.v * (0.86 + 0.13 * tight),
      react: clamp(0.6 - 0.25 * tight - (cl ? 0.04 : 0), 0.25, 0.65) + (r.deep ? 0.22 : 0), vBreak: 8.6 + 1.4 * tight - (r.deep ? 0.5 : 0), range: 99,
    };
  });
  const deepIdx = recs.filter(r => r.deep).map(r => r.k);
  const rotTo = deepIdx.length ? deepIdx[Math.floor(Math.random() * deepIdx.length)] : null;
  const rotate = shell === 'cover1' && rotTo != null && chance(clamp(0.22 + 0.1 * d - (ease - 1) * 0.3 + (mo.pa ? 0.25 : 0), 0.15, 0.85));
  if (shell === 'cover1') defs.push({ kind: 'safety', x: 50, y: td ? Math.max(spot.endLine + 3, -20) : -21, home: { x: 50, y: td ? Math.max(spot.endLine + 3, -22) : mo.pa ? -20 : -24 }, rotate, rotTo, react: (rotate ? 0.4 : 0.5) + (mo.pa ? 0.08 : 0), vBreak: rotate ? 10 : 9.5, range: rotate ? 24 : 17, vmax: 8.2 });
  if (shell === 'cover2') for (const hx of [27, 73]) defs.push({ kind: 'safety2', x: hx, y: td ? Math.max(spot.endLine + 3, -18) : -19, home: { x: hx, y: td ? Math.max(spot.endLine + 3, -22) : -22 }, half: hx < 50 ? -1 : 1, react: 0.5, vBreak: 9.5, range: 16, vmax: 7.6 });
  if (shell !== 'cover0') defs.push({ kind: 'lb', x: 50 + rand(-4, 4), y: -5, home: { x: 50, y: -9.5 }, react: mo.spy ? 0.3 : 0.36, vBreak: mo.spy ? 8.8 : 8, range: mo.spy ? 14 : 10, vmax: mo.spy ? 8 : 7 });

  // How readable the openness rings are.
  const ringDelay = clamp((0.1 * (d - 1.2) + (50 - who.skill) * 0.006 + (cl ? 0.1 : 0)) * (cfg.edge ? 0.6 : 1) / ease, 0, 0.95);
  const noiseAmp = clamp((0.35 * (d - 2) + (50 - who.skill) * 0.022 + (cl ? 0.2 : 0)) / ease, 0, 2.4);
  const tau = 0.07 + noiseAmp * 0.07;
  const ballV = 39 + who.skill * 0.12;
  const accBase = clamp((0.22 + 0.1 * d) * (1.25 - 0.6 * clamp(who.skill / 100, 0, 1)) * (tired ? 1.2 : 1) * (cl ? 1.12 : 1) / ease, 0.08, 2);
  const GREAT = 4.6, GOOD = 2.0;

  const QB = { x: 50, y: 4.6 };
  const st = {
    cfg, spot, shell, recs, defs, rushT, ringDelay, noiseAmp, GREAT, GOOD, rotate, rotTo, who, d, ease,
    t: 0, phase: 'pre', qb: { x: 50, y: 5.4 }, disp: [0, 0, 0], pred: [null, null, null], ph: [rand(0, 6), rand(0, 6), rand(0, 6)],
    ball: null, res: null,
  };

  const flight = dist => 0.2 + dist / ballV;
  const qbAt = t => ({ x: 50, y: 5.4 + 2.2 * APass.smooth(t / 0.5) });

  // One defender update. ball = { t0, C } once thrown.
  function stepDef(o, t, dt, ball, all) {
    if (ball && t >= ball.t0 + o.react && (o.kind === 'man' && o.tgt === ball.i || Math.hypot(o.x - ball.C.x, o.y - ball.C.y) <= o.range)) {
      const dx = ball.C.x - o.x, dy = ball.C.y - o.y, L = Math.hypot(dx, dy);
      const step = Math.min(L, o.vBreak * dt);
      if (L > 0.001) { o.x += dx / L * step; o.y += dy / L * step; }
      o.vx = dx / (L || 1) * o.vBreak; o.vy = dy / (L || 1) * o.vBreak;
      return;
    }
    let tx, ty, vmax = o.vmax, gain = 2.4;
    if (o.kind === 'man') {
      const r = recs[o.tgt];
      const R = recPos(r, t), V = recVel(r, Math.max(0, t - o.lag));
      const q = APass.smooth((t - 0.2) / 1.1);
      const Ox = APass.lerp(o.O0.x, o.O1.x, q), Oy = APass.lerp(o.O0.y, o.O1.y, q);
      let vx = V.x + (R.x + Ox - o.x) * o.k, vy = V.y + (R.y + Oy - o.y) * o.k;
      const sp = Math.hypot(vx, vy);
      if (sp > o.vmax) { vx *= o.vmax / sp; vy *= o.vmax / sp; }
      o.x += vx * dt; o.y += vy * dt; o.vx = vx; o.vy = vy;
      return;
    }
    if (o.kind === 'safety') {
      if (o.rotate && t > 0.45) { const R = recPos(recs[o.rotTo], t); tx = R.x; ty = Math.min(R.y - 6.5, -11); vmax = 9; gain = 3; }
      else { let mx = 0, n = 0; for (const r of recs) if (r.deep) { mx += recPos(r, t).x; n++; } tx = n ? 50 + (mx / n - 50) * 0.2 : 50; ty = o.home.y; }
    } else if (o.kind === 'safety2') {
      let best = null;
      for (const r of recs) { const R = recPos(r, t); if ((R.x - 50) * o.half > -4 && R.y < -9 && (!best || R.y < best.y)) best = R; }
      if (best) { tx = best.x; ty = Math.min(best.y - 5.5, -12); } else { tx = o.home.x; ty = o.home.y; }
    } else { // lb: hook zone, sinks under crossers
      tx = o.home.x; ty = o.home.y;
      let best = null, bd = 99;
      for (const r of recs) { const R = recPos(r, t); const dd = Math.abs(R.x - 50); if (dd < 20 && R.y > -18 && R.y < -1.5 && dd < bd) { bd = dd; best = R; } }
      if (best) { tx = APass.lerp(tx, best.x, 0.65); ty = APass.lerp(ty, best.y - 1.5, 0.5); }
    }
    let vx = (tx - o.x) * gain, vy = (ty - o.y) * gain;
    const sp = Math.hypot(vx, vy);
    if (sp > vmax) { vx *= vmax / sp; vy *= vmax / sp; }
    o.x += vx * dt; o.y += vy * dt; o.vx = vx; o.vy = vy;
  }

  // Predict what happens if you throw to receiver i at time t0. rec = true records defender frames for the animation.
  function predict(i, t0, rec) {
    const r = recs[i], q0 = qbAt(t0), from = { x: q0.x, y: q0.y - 1 };
    let T = 0.6, C = recPos(r, t0 + T);
    for (let n = 0; n < 4; n++) { T = flight(Math.hypot(C.x - from.x, C.y - from.y)); C = recPos(r, t0 + T); }
    const ds = defs.map(o => Object.assign({}, o));
    const ball = { t0, C, i };
    const dt = rec ? 1 / 60 : 1 / 30, steps = Math.max(1, Math.ceil(T / dt)), h = T / steps;
    const frames = rec ? [ds.map(o => ({ x: o.x, y: o.y }))] : null;
    for (let s = 0; s < steps; s++) {
      const t = t0 + s * h;
      for (const o of ds) stepDef(o, t, h, ball, ds);
      if (rec) frames.push(ds.map(o => ({ x: o.x, y: o.y })));
    }
    let sep = 99, near = null;
    ds.forEach((o, j) => { const dd = Math.hypot(o.x - C.x, o.y - C.y); if (dd < sep) { sep = dd; near = j; } });
    return { i, T, C, from, sep, near, frames, h };
  }

  function update(dt) {
    if (st.phase === 'pre' || st.phase === 'done') return;
    if (st.phase === 'set') { st.setT -= dt; if (st.setT <= 0) { st.phase = 'live'; st.t = 0; if (st.onSnap) st.onSnap(); } return; }
    // Substep the physics so a slow frame never lets anyone teleport.
    const n = Math.max(1, Math.ceil(dt / (1 / 60))), h = dt / n;
    for (let s = 0; s < n; s++) {
      if (st.phase === 'live') {
        for (const o of defs) stepDef(o, st.t, h, null, defs);
        st.t += h;
        st.qb = qbAt(st.t);
      } else st.t += h;
    }
    if (st.phase === 'live') {
      for (let k = 0; k < 3; k++) {
        const p = predict(k, st.t, false);
        st.pred[k] = p;
        const noise = st.noiseAmp * (Math.sin(st.t * 2.1 + st.ph[k]) * 0.7 + Math.sin(st.t * 5.3 + st.ph[k] * 2) * 0.3);
        const target = p.sep + noise;
        st.disp[k] += (target - st.disp[k]) * (1 - Math.exp(-dt / tau));
      }
      if (st.t >= st.rushT) sack();
    } else if (st.phase === 'air') {
      if (st.t >= st.ball.t0 + st.ball.T) arrive();
    } else if (st.phase === 'post') {
      st.postT += dt;
    }
  }

  function sack() {
    st.phase = 'post'; st.postT = 0;
    const loss = ri(5, 9);
    st.res = { r: 'bad', kind: 'sack', yards: -loss };
    if (st.onEvent) st.onEvent('sack');
  }

  function throwTo(i) {
    if (st.phase !== 'live' || i < 0 || i > 2) return false;
    const p = predict(i, st.t, true);
    const pressure = clamp((st.t / st.rushT - 0.68) / 0.32, 0, 1);
    let err = (accBase + pressure * 1.5) * Math.abs(APass.gauss()) * 0.85;
    if (p.T > 1.05) err *= 1.15; // deep balls are harder to place
    const ang = Math.random() * Math.PI * 2;
    const Cp = { x: clamp(p.C.x + Math.cos(ang) * err, 2, 98), y: p.C.y + Math.sin(ang) * err };
    st.ball = Object.assign(p, { t0: st.t, Cp, err, pressure, hitAsThrown: st.t / st.rushT > 0.86 });
    st.phase = 'air';
    if (st.onEvent) st.onEvent('throw');
    return true;
  }

  function arrive() {
    const b = st.ball, r = recs[b.i];
    const effSep = b.sep - b.err * 0.55;
    const uncatchable = b.err > 3.3;
    let grade = uncatchable ? 'bad' : effSep >= GREAT ? 'great' : effSep >= GOOD ? 'good' : 'bad';
    let kind = grade === 'bad' ? (uncatchable ? 'wild' : 'pbu') : 'catch';
    if (grade === 'bad') {
      const deepAdd = r.deep ? 0.06 : 0;
      const pInt = uncatchable ? (b.sep < 4 ? 0.2 : 0.04) : b.sep < 1.1 ? 0.22 + deepAdd : b.sep < GOOD ? 0.06 + deepAdd : 0.02;
      if (chance(pInt)) kind = 'int';
    }
    const depth = Math.round(-(b.Cp.y - 1));
    let yac = 0;
    if (grade === 'great') yac = Math.round(clamp(2 + effSep * 1.4 + rand(0, 7) + (r.deep ? 3 : 0), 2, 45));
    if (grade === 'good') yac = Math.round(rand(0, 2.6));
    const G = APass.grade(spot, grade, b.Cp.y, depth, yac);
    grade = G.r;
    const yards = G.yards, short = G.short;
    if (G.td) yac = Math.max(0, yards - depth);
    if (G.nose) yac = Math.max(0, yards - depth);
    st.res = { r: grade, kind, yards, depth, yac, short, nose: G.nose, td: G.td, rec: r, sep: b.sep, err: b.err };
    st.phase = 'post'; st.postT = 0;
    if (st.onEvent) st.onEvent(kind);
  }

  Object.assign(st, { update, throwTo, predict, recPos, recVel, qbAt, snap() { if (st.phase === 'pre') { st.phase = 'set'; st.setT = 0.55; } } });
  return st;
}

// Words for what happened, in the game's voice. Receivers go by name here: the 1-2-3 on the canvas are tap
// targets, not jersey numbers.
function qbStory(st) {
  const R = st.res, r = R.rec, rt = r ? r.name : '', y = Math.abs(R.yards);
  const cap = t => t[0].toUpperCase() + t.slice(1);
  const nm = r ? (r.who || qbReceiverName(r.x0)) : 'your receiver', Nm = cap(nm), his = `${nm}'s`;
  const yd = v => `${v} yard${v === 1 ? '' : 's'}`, Yd = v => cap(yd(v));
  if (R.kind === 'sack') return pick([
    `You hold it one beat too long. The defensive end gets there first. Sack, and the ground is very hard today.`,
    `Nobody comes open in time, and a 290-pound man explains the situation to you personally. Sack. Loss of ${yd(y)}.`,
    `You pat the ball, wait for somebody to break open, and get folded in half from the blind side. Sack.`,
  ]);
  if (R.kind === 'int') return pick([
    `The coverage was sitting on the ${rt} the whole time. The defender catches it cleaner than ${nm} would have. Interception.`,
    `You throw it to ${nm}. The linebacker was reading your eyes the whole way. Picked off, and now you have to go make the tackle yourself.`,
    `The ball hangs a hair too long on the ${rt}, and a white jersey steps in front of it. Interception. The sideline goes quiet.`,
  ]);
  if (R.kind === 'wild') return pick([
    `The pocket closes as you let go, and the ball sails a good three yards over ${his} head. Incomplete.`,
    `You throw it under pressure and it dies at ${his} shoelaces. Incomplete.`,
  ]);
  if (R.kind === 'pbu') return pick([
    `The defender is all over the ${rt}. He gets a hand in at the last second and knocks it away from ${nm}.`,
    `It's a tight window, and it closes. Broken up. ${Nm} glares at the cornerback like it's personal.`,
    `${Nm} is covered, and you throw it anyway. The ball pings off a white helmet and dies on the grass.`,
  ]);
  const mode = st.spot.mode, open = R.sep >= st.GREAT;
  if (mode === 'two') return open ? `Two-point try. ${Nm} breaks open on the ${rt}, and you hit him in the chest in the end zone.`
    : `Two-point try. ${Nm} gets bumped all the way across the end zone on the ${rt} and holds on anyway.`;
  if (mode === 'td' && R.td) return R.depth < 100 - st.spot.los ? `${Nm} catches the ${rt} short of the goal line and drags a defender across it. Touchdown.`
    : open ? pick([`You read it, you rip it. ${Nm} catches the ${rt} in the end zone with nobody within three steps of him.`, `${Nm} breaks open on the ${rt}, and you put it right on his numbers. He's standing in the end zone before the defense turns around.`])
    : `It's a fistfight for the ball on the ${rt}, and ${nm} comes down with it in the end zone. You'll take it.`;
  // Short of the goal line: no yard line here, the next snap's setup picks up from wherever the drive is.
  if (mode === 'td') { const left = 100 - st.spot.los - y; return `${Nm} catches the ${rt} and gets dragged down ${left <= 2 ? 'inches ' : left <= 5 ? 'a few yards ' : ''}short of the goal line. Not in. Not over, either.`; }
  if (mode === 'fg') return `${Nm} catches the ${rt} for ${yd(y)}. That's field goal range, and the kicker is already warming up.`;
  if (mode === 'ice' && (R.r === 'great' || st.spot.last)) return `${Nm} catches the ${rt} past the sticks. First down. Somewhere, a coach starts breathing again.`;
  const gap = Math.max(1, (st.spot.need || 0) - y), shortBy = gap === 1 ? 'a yard' : `${gap} yards`;
  if (R.short) return mode === 'ice' ? `${Nm} catches the ${rt} and lunges for the marker, but he comes down ${shortBy} short. Fourth down.` : `${Nm} catches the ${rt}, but ${shortBy} short of the sticks. Good throw. Wrong spot.`;
  if (R.r === 'great') return r.deep && R.depth >= 18 ? pick([
    `You let it rip. ${Nm} runs under the ${rt} without breaking stride, and it's ${yd(y)} before anybody catches him.`,
    `The ball drops out of the sky and into ${his} hands on the ${rt}. ${Yd(y)}. The sideline is jumping.`,
  ]) : pick([
    `You hit ${nm} on the ${rt} in stride for ${yd(y)}.`,
    `${Nm} breaks open on the ${rt}, and you put it right on his numbers. He turns it into ${yd(y)}.`,
    `Quick eyes, quick feet, quick release. ${Nm} catches the ${rt} in stride and picks up ${yd(y)}.`,
  ]);
  const nose = R.nose ? ' He lunges forward and gets the first down by a nose.' : '';
  return pick([
    `You fit it into a tight window on the ${rt}. ${Nm} hauls it in with a defender draped all over him. ${Yd(y)}.${nose}`,
    `It's a contested catch, but ${nm} wins it. ${Yd(y)} on the ${rt}, and he pops right back up.${nose}`,
    `Not much room on the ${rt}, but you put it where only ${nm} can get it. He holds on through the hit for ${yd(y)}.${nose}`,
  ]);
}
// Short receiver name for labels and callouts: 'Walt', 'Shay', 'Tight end'.
const qbShort = r => { const w = r.who || qbReceiverName(r.x0); return /tight end/.test(w) ? 'Tight end' : w; };
function qbLabel(st) {
  const R = st.res;
  if (R.kind === 'sack') return `Sacked · ${R.yards} yds`;
  if (R.kind === 'int') return 'Intercepted';
  if (R.kind === 'pbu') return 'Broken up';
  if (R.kind === 'wild') return 'Incomplete';
  return `${qbShort(R.rec)} · ${R.rec.name} · ${R.yards} yds`;
}

MINIGAMES.throw = function arcadeThrow(cfg, host) {
  const st = qbModel(cfg);
  MINIGAMES.throw.live = st; // read by automated tests only
  const help = `<span class="kb-only">Press <kbd>Space</kbd> to snap, then <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> to throw. </span>Tap a receiver to throw. <b class="ap-g">Green</b> ring = open, <b class="ap-y">yellow</b> = tight, <b class="ap-r">red</b> = covered. Beat the orange pocket clock.`;
  // Show only the yards the play can use: the pocket at the bottom, and up to just past the end line near the goal.
  const hw = host.clientWidth || 600, bottom = hw < 480 ? 15.5 : 17.5;
  const aspect = st.spot.ez ? clamp((bottom - st.spot.endLine + 3) / 100, 0.36, 0.7) : hw < 520 ? 0.64 : 0.58;
  const f = APass.mount(host, cfg, { aria: 'Pass play: three numbered receivers run routes while the pocket collapses', startLabel: cfg.btn && !/^throw$/i.test(cfg.btn) ? cfg.btn : 'Snap it', help, aspect, minH: st.spot.ez ? 150 : 220 }, 'mg-throw');
  const inp = Field.input(f, { hover: true, onTap: p => onTap(p) });
  const big = f.big();
  // A short red-zone field: tuck the snap button into the top corner so it doesn't hide the end zone.
  const short = st.spot.ez && f.H < 260;
  if (short) f.panel.classList.add('ap-short');
  let loop = null, done = false, hover = -1, lastAlarm = 0, msg = null, final = false;
  const vfx = { shake: 0, trail: [] };

  APass.pending = null;
  const camFor = () => bottom - f.H / f.u; // bottom of the view sits just behind the pocket
  // Once the ball is in the air the camera may drift upfield to keep a deep ball (and the run after it) in view.
  let camY = null;
  function camNow(dt) {
    const base = camFor();
    let want = base;
    if (st.ball && (st.phase === 'air' || st.phase === 'post')) {
      let top = st.ball.Cp.y;
      if (st.res && st.res.kind === 'catch') top = Math.min(top, targetPos(st.recPos(st.res.rec, st.t)).y);
      want = Math.min(base, top - 9);
    }
    if (camY == null || !dt || reduceMotion) camY = want;
    else camY += (want - camY) * (1 - Math.exp(-dt * 5));
    return camY;
  }

  function receiverAt(p) {
    if (st.phase !== 'live' || !p) return -1;
    const cam = camY == null ? camFor() : camY;
    let best = -1, bd = 11 * big;
    st.recs.forEach((r, k) => { const R = st.recPos(r, st.t); const dd = Math.hypot(R.x - p.x, R.y - cam - p.y); if (dd < bd) { bd = dd; best = k; } });
    return best;
  }
  function onTap(p) {
    if (done) return;
    if (!f.started) { f.start(); return; }
    if (st.phase === 'live') {
      const k = receiverAt(p);
      if (k >= 0) throwIt(k); else { msg = { text: 'Tap a receiver', t: 0 }; }
    }
  }
  function throwIt(k) {
    if (st.throwTo(k)) { APass.sfx.whoosh(); }
  }

  st.onSnap = () => { APass.sfx.snap(); };
  st.onEvent = kind => {
    if (kind === 'sack') { APass.sfx.hit(); vfx.shake = 0.35; }
    else if (kind === 'catch') APass.sfx.catch();
    else if (kind === 'pbu' || kind === 'wild') APass.sfx.tink();
    else if (kind === 'int') { APass.sfx.hit(); vfx.shake = 0.2; }
  };

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
    APass.mark(cfg.moment, 'passYds', R.kind === 'catch' ? R.yards : 0, R.r, R.kind === 'int');
    finishWith(R.r, qbLabel(st), qbStory(st).replace(/\s+/g, ' ').trim());
  }

  // ---------- drawing ----------
  function draw(dt) {
    const { ctx, u } = f;
    const cam = camNow(dt);
    st.view = { cam, z: 1, camX: 0, u: f.W / 100 };
    const [sx, sy] = APass.shakeOffset(vfx, dt || 0);
    ctx.save(); ctx.translate(sx, sy);
    APass.turf(f, cam, st.spot);
    const P = (x, y) => [x, y - cam];
    const live = st.phase === 'live' || st.phase === 'air' || st.phase === 'post';
    const t = st.t;

    // Play diagram: bold before the snap, a faint ghost after it.
    const diagA = st.phase === 'pre' || st.phase === 'set' ? 0.92 : Math.max(0.16, 0.92 - t * 1.6);
    st.recs.forEach(r => {
      if (!r.chalk) { r.chalk = []; for (let tt = 0; tt <= 3.3001; tt += 0.1) { const q = st.recPos(r, tt); r.chalk.push([q.x, q.y]); } }
      const pre = st.phase === 'pre' || st.phase === 'set';
      APass.chalk(f, r.chalk, cam, { alpha: diagA, dash: !pre, w: 0.5 });
      if (pre) {
        APass.pill(f, r.name.toUpperCase(), clamp(r.x0, 7, 93), 1 + 3.25 * big + 1.2 - cam, { align: 'center', size: 2.7 * Math.min(big, 1.15), bg: 'rgba(8,14,10,.6)' });
      }
    });

    // Offensive line, pass rush, quarterback.
    const p = st.phase === 'pre' || st.phase === 'set' ? 0 : clamp(Math.min(t, st.ball ? st.ball.t0 + 0.45 : t) / st.rushT, 0, 1.08);
    const qb = st.qb;
    const pp = Math.pow(Math.min(p, 1), 1.3);
    const olY = 2.1 + 2.3 * pp, dlY = olY - 4.5 + 0.5 * pp;
    const sackSide = st.sackSide || (st.sackSide = chance(0.5) ? -1 : 1);
    [39.5, 44.75, 50, 55.25, 60.5].forEach(x => Field.drawPlayer(f, ...P(50 + (x - 50) * (1 - 0.12 * pp), olY), { r: 2.25 }));
    [42.2, 47.4, 52.6, 57.8].forEach(x => Field.drawPlayer(f, ...P(50 + (x - 50) * (1 - 0.12 * pp), dlY), { team: 'them', r: 2.25 }));
    // Edge rushers: the far one gets washed out, the near one loops around the tackle and comes for you.
    const e = Math.pow(Math.min(p, 1), 1.55);
    const ex0 = 50 + sackSide * 15.5, ey0 = -1.8;
    const bx = APass.lerp(APass.lerp(ex0, 50 + sackSide * 17, e), APass.lerp(50 + sackSide * 17, qb.x + sackSide * 2.2, e), e);
    const by = APass.lerp(APass.lerp(ey0, 3.2, e), APass.lerp(3.2, qb.y - 1.2, e), e);
    Field.drawPlayer(f, ...P(50 - sackSide * (15.5 + 3 * e), -1.8 + 3.4 * e), { team: 'them', r: 2.4 });
    if (st.shell === 'cover0') { // blitzers through the A gaps
      for (const s of [-1, 1]) Field.drawPlayer(f, ...P(50 + s * (4 - 2 * e), -7 + (olY + 2.2 + 7) * Math.min(e * 1.15, 0.85)), { team: 'them', r: 2.4 });
    }

    // Rush clock arc around the QB.
    const sackPost = st.res && st.res.kind === 'sack';
    if (!sackPost) {
      const left = st.phase === 'pre' || st.phase === 'set' ? 1 : clamp(1 - (st.ball ? st.ball.t0 : t) / st.rushT, 0, 1);
      const [qx, qy] = P(qb.x, qb.y);
      const R0 = 5.2 * big * u;
      ctx.save();
      ctx.lineWidth = Math.max(3, u * 0.95); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.arc(qx * u, qy * u, R0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = left > 0.45 ? f.c.led : left > 0.22 ? '#FF8A3D' : f.c.bad;
      if (left > 0) { ctx.beginPath(); ctx.arc(qx * u, qy * u, R0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke(); }
      ctx.restore();
    }
    // No jersey number on you: the numbered tokens are the receivers you can throw to.
    Field.drawPlayer(f, ...P(qb.x, qb.y + (sackPost ? 0.8 : 0)), { r: 3.2 * big, ring: '#FFFFFF', ball: !st.ball && !sackPost });
    if (st.phase === 'pre' || st.phase === 'set') Field.text(f, 'YOU', qb.x + 5.2 * big + 4.4 * big, qb.y - cam + 1.2, { size: 3 * big, color: f.c.led });
    Field.drawPlayer(f, ...P(bx, by), { team: 'them', r: 2.6 });
    if (sackPost) Field.drawBall(f, ...P(qb.x + 2.5, qb.y + 2.4), 0.9, 0, 1.2);

    // Defenders.
    const frames = st.ball && st.ball.frames;
    const fi = frames ? Math.min(frames.length - 1, Math.max(0, Math.round((t - st.ball.t0) / st.ball.h))) : -1;
    st.defs.forEach((o, j) => {
      let x = o.x, y = o.y;
      if (frames && st.phase === 'air') { x = frames[fi][j].x; y = frames[fi][j].y; }
      if (st.phase === 'post' && st.res && st.res.kind !== 'sack' && frames) { const fr = frames[frames.length - 1][j]; x = fr.x; y = fr.y; const pp = postPos(j, fr); x = pp.x; y = pp.y; }
      Field.drawPlayer(f, ...P(x, y), { team: 'them', r: 2.5 * (big > 1 ? 1.15 : 1) });
      if (st.res && st.res.kind === 'int' && st.ball && j === st.ball.near && st.phase === 'post') Field.drawBall(f, ...P(x + 1.6, y + 0.3), 0.85);
    });

    // Receivers with openness rings.
    const showRings = st.phase === 'live' && t >= st.ringDelay;
    st.recs.forEach((r, k) => {
      let R = st.recPos(r, t);
      if (st.ball && st.ball.i === k) R = targetPos(R);
      let ring = null;
      if (showRings) {
        const v = st.disp[k];
        ring = v >= st.GREAT ? f.c.good : v >= st.GOOD ? f.c.led : f.c.bad;
      }
      if (hover === k && st.phase === 'live') {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.setLineDash([u, u * 0.8]); ctx.lineWidth = Math.max(1.5, u * 0.4);
        ctx.beginPath(); ctx.arc(R.x * u, (R.y - cam) * u, (3.25 * big + 2.8) * u, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      const carry = st.phase === 'post' && st.res && st.res.kind === 'catch' && st.ball.i === k;
      Field.drawPlayer(f, R.x, R.y - cam, { num: k + 1, r: 3.25 * big, ring, ball: carry });
      if (showRings && st.disp[k] >= st.GREAT && st.noiseAmp < 1.2) Field.text(f, 'OPEN', R.x, R.y - cam - (3.25 * big + 3.4), { size: 2.8 * big, color: f.c.good });
    });

    // Ball in flight.
    if (st.phase === 'air') {
      const b = st.ball, q = clamp((t - b.t0) / b.T, 0, 1);
      const x = APass.lerp(b.from.x, b.Cp.x, q), y = APass.lerp(b.from.y, b.Cp.y, q);
      const dist = Math.hypot(b.Cp.x - b.from.x, b.Cp.y - b.from.y);
      const lift = (1.2 + dist * 0.16) * 4 * q * (1 - q);
      const ang = Math.atan2(b.Cp.y - b.from.y, b.Cp.x - b.from.x) + (b.err > 1.6 ? Math.sin(t * 30) * 0.5 : 0);
      if (!reduceMotion) { vfx.trail.push([x, y - lift]); if (vfx.trail.length > 7) vfx.trail.shift(); vfx.trail.forEach(([tx, ty], i) => { ctx.fillStyle = `rgba(255,255,255,${0.05 + i * 0.03})`; ctx.beginPath(); ctx.arc(tx * u, (ty - cam) * u, u * 0.5, 0, Math.PI * 2); ctx.fill(); }); }
      Field.drawBall(f, x, y - cam, 1 + lift * 0.03, lift, ang);
      // landing marker
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, u * 0.3);
      ctx.beginPath(); ctx.arc(b.Cp.x * u, (b.Cp.y - cam) * u, u * (1.4 + 2 * (1 - q)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (st.phase === 'post' && st.res && (st.res.kind === 'pbu' || st.res.kind === 'wild')) {
      const b = st.ball, q = clamp(st.postT / 0.5, 0, 1);
      const dx = b.Cp.x - b.from.x, dy = b.Cp.y - b.from.y, L = Math.hypot(dx, dy) || 1;
      const kx = st.res.kind === 'pbu' ? -dy / L * 5 : dx / L * 6, ky = st.res.kind === 'pbu' ? dx / L * 5 : dy / L * 6;
      Field.drawBall(f, b.Cp.x + kx * q, b.Cp.y + ky * q - cam, 1, 2.2 * Math.abs(Math.sin(q * Math.PI * 1.6)) * (1 - q), q * 9);
    }

    // HUD: down & distance, coverage note, pocket clock.
    const dn = APass.down(st.spot, '1ST & 10');
    const dp = APass.pill(f, dn, 2.2, 1.8, { color: f.c.led });
    if (cfg.edge && (st.phase === 'pre' || st.phase === 'set')) {
      const note = { cover0: 'FILM: ZERO BLITZ, THROW HOT', cover1: st.rotate ? 'FILM: SAFETY ROTATES LATE' : 'FILM: SINGLE HIGH, MAN UNDER', cover2: 'FILM: TWO DEEP, ATTACK UNDERNEATH' }[st.shell];
      if (short) APass.pill(f, note, 2.2, 1.8 + dp.h + 0.8, { color: '#FFFFFF', bg: 'rgba(210,80,10,.85)' });
      else APass.pill(f, note, 97.8, 1.8, { align: 'right', color: '#FFFFFF', bg: 'rgba(210,80,10,.85)' });
    } else if (live) {
      const left = clamp(1 - (st.ball ? st.ball.t0 : t) / st.rushT, 0, 1);
      APass.pill(f, left > 0 ? 'POCKET' : 'SACK', 97.8, 1.8, { align: 'right', color: left > 0.22 ? '#FFFFFF' : f.c.bad });
    }
    if (st.phase === 'set') { const k = st.setT > 0.27 ? 'SET…' : 'HUT!'; Field.text(f, k, 50, (qb.y - cam) - 9 * big, { display: true, size: 5 * big, color: f.c.led, weight: 400 }); }
    if (msg && st.phase === 'live') { msg.t += dt || 0; if (msg.t < 1) Field.text(f, msg.text, 50, (qb.y - cam) - 9 * big, { size: 3.6 * big, color: '#FFFFFF' }); }

    // Result callouts.
    if (st.phase === 'post' && st.res && !final) {
      const R = st.res, age = st.postT;
      // Keep the callout off the catch: a deep ball lands in the top half, so say it lower down.
      const D = f.H / u, cy = st.ball ? st.ball.Cp.y - cam : D;
      const yAt = cy < D * 0.45 ? D * (f.W < 420 ? 0.56 : 0.52) : null;
      const callout = (a, b, c, d, e) => APass.callout(a, b, c, d, e, yAt);
      if (R.kind === 'sack') callout(f, 'SACKED', `${R.yards} YARDS`, age, f.c.bad);
      else if (R.kind === 'int') callout(f, 'PICKED OFF', null, age, f.c.bad);
      else if (R.kind === 'pbu') callout(f, 'BROKEN UP', 'INCOMPLETE', age, '#FFFFFF');
      else if (R.kind === 'wild') callout(f, 'INCOMPLETE', null, age, '#FFFFFF');
      else if (st.spot.mode === 'two') callout(f, 'GOOD!', 'TWO POINTS', age, f.c.led);
      else if (R.td) callout(f, 'TOUCHDOWN', `${qbShort(R.rec).toUpperCase()} ON THE ${R.rec.name.toUpperCase()}`, age, f.c.led);
      else if (st.spot.mode === 'td') callout(f, 'CAUGHT', 'SHORT OF THE GOAL LINE', age, '#FFFFFF');
      else if (st.spot.mode === 'fg') callout(f, 'CAUGHT', `+${R.yards} · FIELD GOAL RANGE`, age, R.r === 'great' ? f.c.led : '#FFFFFF');
      else if (st.spot.mode === 'ice' && (R.r === 'great' || st.spot.last)) callout(f, 'FIRST DOWN', `+${R.yards} YARDS`, age, f.c.led);
      else callout(f, R.r === 'great' ? 'COMPLETE' : 'CONTESTED', `+${Math.round(Math.min(R.yards, R.depth) + Math.max(0, R.yards - R.depth) * clamp(age / 0.8, 0, 1))} YARDS${R.short ? ' · SHORT OF THE STICKS' : ''}`, age, R.r === 'great' ? f.c.led : '#FFFFFF');
      if (st.ball && R.kind === 'catch' && !reduceMotion && age < 0.5) {
        const C = targetPos(st.recPos(R.rec, t));
        ctx.save(); ctx.strokeStyle = `rgba(255,178,30,${0.8 * (1 - age / 0.5)})`; ctx.lineWidth = u * 0.6;
        ctx.beginPath(); ctx.arc(C.x * u, (C.y - cam) * u, u * (4 + age * 18), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }
  // Target receiver adjusts to the ball while it's in the air, then runs after the catch.
  function targetPos(R) {
    const b = st.ball;
    if (!b) return R;
    const q = APass.smooth((st.t - b.t0) / b.T);
    const reach = b.err > 3.3 ? 0.45 : 1;
    if (st.phase === 'air') return { x: R.x + (b.Cp.x - b.C.x) * q * reach, y: R.y + (b.Cp.y - b.C.y) * q * reach };
    const C = { x: b.C.x + (b.Cp.x - b.C.x) * reach, y: b.C.y + (b.Cp.y - b.C.y) * reach };
    const res = st.res;
    if (res && res.kind === 'catch') {
      const run = Math.min(res.yac, res.yac * APass.smooth(st.postT / 0.85));
      const goalY = st.spot.goal - 2;
      return { x: C.x + (C.x < 50 ? 0.2 : -0.2) * run, y: Math.max(goalY, C.y - (res.td ? Math.max(run, C.y - goalY) * APass.smooth(st.postT / 0.6) : run)) };
    }
    return C;
  }
  function postPos(j, fr) {
    const res = st.res, b = st.ball;
    if (!res || !b) return fr;
    const q = APass.smooth(st.postT / 0.85);
    if (res.kind === 'int' && j === b.near) return { x: fr.x + (fr.x < 50 ? -3 : 3) * q, y: fr.y + 12 * q };
    if (res.kind === 'catch') {
      const C = targetPos(st.recPos(res.rec, st.t));
      const dx = C.x - fr.x, dy = C.y - fr.y, L = Math.hypot(dx, dy);
      const close = res.r === 'great' ? 0.45 : 0.9;
      if (L < 0.1) return fr;
      const m = Math.min(L - 2.2, L * close * q);
      return m > 0 ? { x: fr.x + dx / L * m, y: fr.y + dy / L * m } : fr;
    }
    return fr;
  }

  f.redraw = () => draw(0);
  draw(0);

  function frame(dt) {
    if (done) return false;
    // keyboard + pointer hover
    hover = inp.pointer && !inp.pointer.down ? receiverAt(inp.pointer) : -1;
    f.canvas.style.cursor = st.phase === 'live' ? (hover >= 0 ? 'pointer' : 'crosshair') : 'default';
    st.update(dt);
    if (st.phase === 'live') {
      const left = 1 - st.t / st.rushT;
      if (left < 0.3 && st.t - lastAlarm > 0.32) { lastAlarm = st.t; APass.sfx.alarm(); }
    }
    draw(dt);
    if (st.phase === 'post' && st.postT >= (st.res.kind === 'sack' ? 0.85 : 1.0)) { settle(); return false; }
  }
  f.onStart(() => {
    APass.reveal(f);
    inp.pressed('action'); inp.pressed('tap');
    st.snap();
    loop = Field.loop(frame);
  });

  setMini({
    stop() { done = true; if (loop) loop.stop(); inp.destroy(); f.unmount(); },
    key(e) {
      if (done) return true;
      if (!f.started) { if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) f.start(); return true; } return inp.claims(e); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 3) { if (!e.repeat) throwIt(n - 1); return true; }
      return inp.claims(e);
    },
    finish(r) {
      if (done) return;
      APass.pending = null;
      finishWith(r, null, null);
    },
  });
};
MINIGAMES.throw.model = qbModel;
MINIGAMES.throw.story = qbStory;

// ---------- Content: quarterback moments ----------
MOMENTS.QB.push(
  { type: 'throw', title: 'Third and Seven', btn: 'Snap it',
    setup: 'Third and seven near midfield. They\'re in man coverage, and Bramble calls a quick-game concept: a slant, a drag, and an out. The yellow line is the first-down marker. Get the ball past it.',
    prompt: 'Find the open man before the pocket caves in, then tap him to throw.',
    great: 'You read it fast and fire it to the open man. He catches it past the sticks and turns upfield. First down, and then some.',
    good: 'A tight window, a hard catch, and the chains move by a nose.',
    bad: 'Nobody gets open in time. The pocket folds, and you go down with the ball.',
    arcade: { routes: ['slant', 'drag', 'out'], need: 7, los: 48, tight: -0.04, rush: -0.15, spy: true } },
  { type: 'throw', title: 'Shot Play', btn: 'Snap it',
    setup: 'Play-action. You fake the handoff, the linebackers bite, and Bramble finally calls the play he\'s been saving all week: three receivers, three deep routes. Somebody will be open. Somebody will be double-covered.',
    prompt: 'The fake buys you time. Watch the safety, then let it fly.',
    great: 'You let it rip. Your receiver runs under it in stride, and nobody in a white jersey gets close.',
    good: 'Under pressure and into coverage, but your receiver goes up and takes it away from the cornerback.',
    bad: 'You wait one count too long for the deep ball to come open. It doesn\'t.',
    arcade: { routes: ['corner', 'go', 'post'], pa: true, los: 34, shell: 'cover1', tight: -0.18 } },
);

// Swap a clutch moment for an arcade one. CLUTCH entries may be a single moment or a list of variants.
APass.setClutch = (pos, side, m, replaces) => {
  const v = CLUTCH[pos] && CLUTCH[pos][side];
  if (Array.isArray(v)) { const i = v.findIndex(x => x && x.type === replaces); if (i >= 0) v[i] = m; else v.push(m); }
  else CLUTCH[pos][side] = m;
};
// The two-minute drill now ends with a real throw.
APass.setClutch('QB', 'chase', { type: 'throw', title: 'Two-Minute Drill', btn: 'Snap it',
  setup: 'No huddle. You march them down the field one completion at a time, and now it comes down to one snap. Three receivers. One throw. Everybody in the building is standing.',
  prompt: 'One throw. Find the open man before the rush gets home.',
  great: 'You fire it between two defenders. Your receiver catches it with both hands, and the stadium detonates.',
  good: 'It wobbles. It\'s caught anyway.',
  bad: 'The pass sails high. The defender gets a hand on it.' }, 'timing');
