// =========================================================
//   ARCADE: 'run' — running back open-field mini-game
// =========================================================
// You carry the ball UP the screen. Orange blockers engage white defenders; defenders pursue with
// different angles and speeds (one always over-pursues), and wind up before they dive at you.
// Steer: arrows / WASD / pad / drag. Juke (Space, Enter, JUKE button, quick tap): a sideways burst that
// makes you untouchable for ~0.36 s, then a cooldown. Your first contact can be a broken tackle.
// Modes (moment.run.mode): 'inside' (handoff from scrimmage), 'kick' (kickoff return), 'goal' (clutch).
// Mod keys: 'run.ease' (1 = normal, higher = easier), 'run.break' (broken-tackle chance), 'run.jukeCooldown' (s).
{
  TAGS.run = 'Open field';
  DEFAULT_PROMPT.run = 'Steer with the arrows or drag the field. Space or JUKE makes a man miss.';
  const { R, lerp, sgn } = AG;

  // Which field situation are we in?
  function scenario(cfg) {
    const m = (cfg.moment && cfg.moment.run) || cfg.run || {};
    let mode = m.mode || (cfg.clutch ? 'goal' : 'inside');
    const g = S && S.game;
    if (mode === 'goal') {
      const d = g ? g.us - g.them : -4;
      const fg = d >= -2; // a field goal ties/wins it (or we're protecting a lead): get into range and go down
      return fg ? { mode, fg: true, ballOn: 69, good: 7, target: 19 } : { mode, fg: false, ballOn: 90, good: 5, target: 10 };
    }
    if (mode === 'kick') return { mode, ballOn: 2, good: m.good || 23, target: m.target || 33 };
    const ballOn = m.ballOn || ri(22, 38);
    return { mode: 'inside', ballOn, good: m.good || 7, target: m.target || 12 };
  }

  function nameFor(d) {
    if (d.name) return d.name;
    switch (d.kind) {
      case 'DL': return Math.abs(d.x0 - 50) < 5 ? 'the nose tackle' : Math.abs(d.x0 - 50) < 9 ? 'the defensive tackle' : 'the defensive end';
      case 'LB': return d.x0 < 44 ? 'the weakside linebacker' : d.x0 > 56 ? 'the strongside linebacker' : 'the middle linebacker';
      case 'S': return d.x0 < 50 ? 'the free safety' : 'the strong safety';
      case 'CB': return 'the cornerback';
      case 'K': return 'their kicker';
      default: return pick(['a gunner', 'their special teams captain', 'a linebacker on the coverage team']);
    }
  }

  MINIGAMES.run = (cfg, host) => {
    const sc = scenario(cfg);
    const diff = cfg.diff; // the engine already adds +1 (and +0.3 on a later snap) for clutch plays
    const E = AG.edge(cfg, 'run.ease', diff);
    const hd = E.hd;
    const dScale = 1 + 0.045 * hd;
    const LOS = -2 * sc.ballOn;
    const GOOD_Y = LOS - 2 * sc.good, TARGET_Y = LOS - 2 * sc.target;
    const OPP_GOAL = -200;
    const me = { x: 50, y: LOS + 12, vx: 0, vy: 0, face: 0, phase: 0, ifr: 0, cd: 0, cdMax: 1.5, slow: 0, ball: false, trail: [], firstContact: true, dive: 0 };
    const top = 17 * (E.tired ? 0.96 : 1);
    me.cdMax = clamp(mod('run.jukeCooldown', 1.05 + 0.04 * hd, cfg), 0.65, 2.2);
    const pBreak = clamp(mod('run.break', 0.17 - 0.042 * hd, cfg), 0.04, 0.6);
    const lungeR = 7.4 + 0.4 * hd;
    const windT = clamp(0.3 - 0.03 * hd, 0.17, 0.38);
    const holdK = clamp(1 - 0.09 * hd, 0.45, 1.8);

    const D = [], B = [], pairs = [];
    let qb = null, holeX = 50, hint = null, sideTag = '';
    const def = (kind, x, y, spd, o) => { const d = Object.assign({ kind, x, y, x0: x, vx: 0, vy: 0, face: Math.PI, spd: spd * dScale, st: 'idle', t: 0, lead: rand(0.55, 0.95), acc: 62, num: null, phase: rand(0, 6) }, o || {}); d.lead = clamp(d.lead + 0.08 * hd, 0.3, 1.3); D.push(d); return d; };
    const blk = (kind, x, y, o) => { const b = Object.assign({ kind, x, y, vx: 0, vy: 0, face: 0, st: 'idle', t: 0, spd: 13.5, num: null, phase: rand(0, 6) }, o || {}); B.push(b); return b; };
    const nums = shuffle([51, 54, 57, 90, 93, 97, 99, 24, 31, 38, 21, 26, 42, 45, 29, 36, 47, 95]);

    if (sc.mode === 'kick') {
      me.x = rand(42, 58); me.y = -4; me.face = 0;
      const side = pick(['left', 'right', 'middle']);
      sideTag = side;
      holeX = side === 'left' ? 24 : side === 'right' ? 76 : 50;
      // nine coverage men in lanes, then a safety net: the kicker and a safety hang back
      for (let i = 0; i < 9; i++) def('COV', 9 + i * 10.25, -88 + rand(-3, 3), rand(15.2, 16.6), { num: nums[i] });
      def('K', rand(40, 60), -112, 13.5, { num: 3, lead: 0.6, deep: true, name: 'their kicker' });
      def('S', pick([30, 70]), -118, 16, { num: nums[10], lead: 0.7, deep: true, name: 'their last man back' });
      const front = [18, 34, 50, 66, 82], back = [30, 44, 56, 70];
      front.forEach((x, i) => blk('RT', x, -54, { num: [41, 48, 53, 59, 46][i], spd: 14 }));
      back.forEach((x, i) => blk('RT', x, -34, { num: [27, 85, 88, 44][i], spd: 14 }));
      hint = [[me.x, me.y - 3], [lerp(me.x, holeX, 0.5), me.y - 22], [holeX, me.y - 48]];
    } else {
      const goal = sc.mode === 'goal' && !sc.fg;
      me.x = 50; me.y = LOS + 12;
      // offense
      [36, 43, 50, 57, 64].forEach((x, i) => blk('OL', x, LOS + 2.9, { num: [72, 64, 68, 61, 77][i], spd: 10.5, tiny: i === 2 }));
      blk('TE', 71, LOS + 2.9, { num: 87, spd: 13 });
      blk('WR', 9, LOS + 2.9, { num: 11, spd: 15 });
      blk('WR', 91, LOS + 2.9, { num: 17, spd: 15 });
      qb = blk('QB', 50, LOS + 5.2, { num: 9, spd: 8, qb: true });
      // defense
      const dl = [39.5, 46.5, 53.5, 60.5].map(x => def('DL', x, LOS - 2.9, 12.6, { num: nums.pop() }));
      // The designed hole: between two of the DL. Those two get driven apart.
      const gaps = [[0, 1], [1, 2], [2, 3]];
      const gi = goal ? ri(0, 2) : pick([0, 1, 1, 2, 2, 0]);
      const [a, b] = gaps[gi];
      holeX = (dl[a].x + dl[b].x) / 2;
      dl[a].hole = -1; dl[b].hole = 1;
      const lbs = (goal ? [35, 50, 65] : [33, 50, 67]).map(x => def('LB', x, LOS - (goal ? 10 : 13), 15.1, { num: nums.pop() }));
      const ss = goal ? [def('S', 40, LOS - 17, 16, { num: nums.pop() }), def('S', 62, LOS - 23, 16, { num: nums.pop() })]
        : [def('S', rand(26, 36), LOS - rand(30, 44), 16, { num: nums.pop(), lead: rand(0.4, 0.75), cushion: rand(16, 26) }), def('S', rand(64, 74), LOS - rand(30, 44), 16, { num: nums.pop(), lead: rand(0.4, 0.75), cushion: rand(16, 26) })];
      // the backside corner is the fastest man on the field and takes a good angle
      def('CB', 10, LOS - (goal ? 5 : 9), holeX >= 50 ? 16.7 : 15.8, { num: nums.pop(), lead: holeX >= 50 ? 1 : 0.7 });
      def('CB', 90, LOS - (goal ? 5 : 9), holeX < 50 ? 16.7 : 15.8, { num: nums.pop(), lead: holeX < 50 ? 1 : 0.7 });
      // one linebacker over-pursues every play
      const op = pick(lbs); op.lead = 1.75; op.acc = 38; op.over = true;
      ss.forEach(s => { s.deep = true; });
      hint = [[me.x, me.y - 3], [holeX, LOS + 1], [holeX + (holeX - 50) * 0.2, LOS - 14]];
    }

    // How visible is the hint? Easy games show the hole; hard ones barely do. Film study (cfg.edge) always shows it.
    const hintLevel = cfg.edge ? 0.85 : diff <= 1.6 ? 0.85 : diff <= 2.7 ? 0.6 : diff <= 3.6 ? 0.35 : 0;
    const hintTime = cfg.edge ? 1.4 : diff <= 1.6 ? 1.6 : diff <= 2.7 ? 1.0 : 0.6;

    // ---------- mount ----------
    const playName = sc.mode === 'kick' ? `Kickoff return · ${AG.spot(sc.ballOn)}` : sc.mode === 'goal' ? (sc.fg ? `Final carry · ${AG.spot(sc.ballOn)} · get in range` : `Final carry · ${AG.spot(sc.ballOn)} · goal to go`) : `Handoff · ${AG.spot(sc.ballOn)}`;
    const opts = {
      aspect: 0.8, minH: 300, maxH: 520, controls: ['left', 'right', 'action'], actionLabel: 'Juke',
      startLabel: sc.mode === 'kick' ? 'Field the kick' : 'Snap it', aria: 'Running back mini-game field',
      help: '<span class="ag-hk">Steer: <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd>, or drag on the field. <kbd>↑</kbd> hits the gas, <kbd>↓</kbd> waits on your blocks. Juke: <kbd>Space</kbd>, the JUKE button, or a quick click on the field.</span><span class="ag-ht">Hold the arrows or drag anywhere on the field to steer (drag up for speed, down to wait on blocks). Tap JUKE, or tap the field, to make a man miss.</span>',
    };
    const f = Field.mount(host, cfg, opts);
    const v = AG.view(f, { aspectSet: narrow => { opts.aspect = narrow ? 1.22 : 0.8; opts.minH = narrow ? 330 : 300; } });
    v.fit();
    const dom = AG.decorate(f, { cls: 'ag-run', play: playName, tips: ['<b>Steer</b><span class="ag-hk">arrows or A D</span><span class="ag-ht">drag or ◀ ▶</span>', '<b>Juke</b><span class="ag-hk">Space</span><span class="ag-ht">tap JUKE</span>'] });
    const ctl = AG.controls(f);
    const L = AG.fxLayer();
    const st = { phase: 'pre', t: 0, pt: 0, yards: 0, reached: false, goodReached: false, over: null, kickT: 0, lineX: null, juked: [], broke: null, tackler: null, maxY: me.y };
    f.canvas.__ag = { st, me, D, B, sc, LOS, hole: holeX };
    let loop = null, done = false;

    // Before the snap the camera sits a little lower so you can read the defense above the start bar.
    const preFrame = () => v.follow(me.x, me.y, sc.mode === 'kick' ? 0.5 : 0.56, 0, true);
    preFrame();

    const onResize = () => { v.fit(); if (!loop) { preFrame(); draw(); draw(); } };
    window.addEventListener('resize', onResize);

    // ---------- simulation ----------
    function startPlay() {
      if (st.phase !== 'pre' || done) return;
      ctl.clear();
      st.phase = 'cad'; st.pt = 0;
      if (sc.mode === 'kick') { L.pop('KICK IS AWAY', 50, me.y - 30, { size: 4, life: 0.9 }); AG.sfx.hut(); }
      try { const r = f.panel.getBoundingClientRect(); if (r.bottom > window.innerHeight || r.top < 0) f.panel.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
      loop = Field.loop(step);
    }
    f.onStart(startPlay);

    const allPlayers = () => D.concat(B);

    function engage(b, d, hold) {
      if (b.st === 'eng' || d.st === 'eng') return;
      b.st = 'eng'; d.st = 'eng';
      const dirX = d.hole ? d.hole : sgn(d.x - me.x) * 0.25;
      pairs.push({ b, d, t: hold, push: dirX * (d.hole ? 5 : 1.2) });
    }

    function snap() {
      st.phase = 'live'; st.pt = 0;
      AG.sfx.hut();
      if (sc.mode === 'kick') return;
      // Linemen fire out: each DL is engaged by the nearest OL. The center climbs if he's spare.
      const ol = B.filter(b => b.kind === 'OL');
      const dl = D.filter(d => d.kind === 'DL');
      const used = new Set();
      dl.forEach(d => {
        let best = null, bd = 1e9;
        ol.forEach(b => { if (used.has(b)) return; const q = Math.abs(b.x - d.x); if (q < bd) { bd = q; best = b; } });
        if (best) { used.add(best); engage(best, d, 1.55 * holdK * rand(0.75, 1.25) * (d.hole ? 1.5 : 1)); }
      });
      ol.forEach(b => { if (!used.has(b)) { b.st = 'free'; b.climb = true; } });
      // Receivers block corners; tight end takes the near linebacker.
      B.forEach(b => { if (b.kind === 'WR' || b.kind === 'TE') b.st = 'free'; });
      D.forEach(d => { if (d.st === 'idle') { d.st = d.kind === 'LB' ? 'read' : d.deep ? 'deep' : 'chase'; d.t = d.kind === 'LB' ? rand(0.12, 0.3) : rand(0.2, 0.4); } });
    }

    function startKickLive() {
      st.phase = 'live'; st.pt = 0;
      me.ball = true;
      AG.sfx.step();
      L.pop('GO!', me.x, me.y - 6, { color: '#FFFFFF', size: 4.6 });
      B.forEach(b => { b.st = 'free'; });
      D.forEach(d => { d.st = d.deep ? 'deep' : 'chase'; d.t = 0; });
    }

    function stepMe(dt) {
      const a = ctl.axis();
      const live = st.phase === 'live';
      // forward speed: cruise, gas (up), patience (down)
      const want = a.y < -0.2 ? top * 1.07 : a.y > 0.2 ? top * 0.45 : top * 0.93;
      let slowK = me.slow > 0 ? 0.6 : 1;
      if (sc.mode === 'kick' && st.phase === 'kick') {
        // settling under the kick: shuffle only
        me.vx += clamp(a.x * 6 - me.vx, -40 * dt, 40 * dt);
        me.vy = 0;
      } else {
        const tvx = a.x * top * 0.92;
        const latAcc = 175;
        me.vx += clamp(tvx - me.vx, -latAcc * dt, latAcc * dt);
        const tvy = -want * slowK;
        me.vy += clamp(tvy - me.vy, -48 * dt, 60 * dt);
        if (live && me.vy > -top * 0.3) me.vy = Math.min(me.vy, -top * 0.3);
        // lateral moves cost forward speed
        const sp = Math.hypot(me.vx, me.vy), cap = top * 1.1 * slowK + (me.ifr > 0 ? 22 : 0);
        if (sp > cap) { const k2 = cap / sp; me.vy *= k2; if (me.ifr <= 0) me.vx *= k2; }
      }
      // juke
      if (ctl.action() && live && me.cd <= 0 && me.ball) {
        let dir = sgn(a.x);
        if (!dir) {
          // away from the nearest free defender
          let nd = null, best = 1e9;
          D.forEach(d => { if (d.st === 'down' || d.st === 'eng') return; const q = Math.hypot(d.x - me.x, d.y - me.y); if (q < best) { best = q; nd = d; } });
          dir = nd ? (sgn(me.x - nd.x) || pick([-1, 1])) : pick([-1, 1]);
        }
        if (me.x < 12) dir = 1; else if (me.x > 88) dir = -1;
        me.vx = dir * 34; me.ifr = 0.4; me.cd = me.cdMax; me.jukes = (me.jukes || 0) + 1;
        AG.sfx.whoosh();
        L.dust(me.x - dir * 2, me.y + 1.5, 7);
      }
      me.x += me.vx * dt; me.y += me.vy * dt;
      if (me.x < AG.SIDE_L + R) { me.x = AG.SIDE_L + R; me.vx = Math.max(0, me.vx); }
      if (me.x > AG.SIDE_R - R) { me.x = AG.SIDE_R - R; me.vx = Math.min(0, me.vx); }
      me.ifr = Math.max(0, me.ifr - dt); me.cd = Math.max(0, me.cd - dt); me.slow = Math.max(0, me.slow - dt);
      const sp = Math.hypot(me.vx, me.vy);
      me.phase += sp * dt * 0.75;
      if (sp > 2) me.face = lerp(me.face, Math.atan2(me.vx, -me.vy) * 0.6, Math.min(1, dt * 10));
      if (!reduceMotion) { me.trail.push({ x: me.x, y: me.y, t: 0, f: me.face, ifr: me.ifr > 0 }); }
      me.trail.forEach(p => { p.t += dt; });
      while (me.trail.length && me.trail[0].t > 0.2) me.trail.shift();
      if (st.lineX == null && me.y < LOS) st.lineX = me.x;
    }

    function moveToward(o, tx, ty, spd, acc, dt) {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy) || 1;
      const vx = dx / dd * spd, vy = dy / dd * spd;
      o.vx += clamp(vx - o.vx, -acc * dt, acc * dt);
      o.vy += clamp(vy - o.vy, -acc * dt, acc * dt);
      o.x += o.vx * dt; o.y += o.vy * dt;
      const sp = Math.hypot(o.vx, o.vy);
      if (sp > 1) o.face = Math.atan2(o.vx, -o.vy);
      o.phase = (o.phase || 0) + sp * dt * 0.75;
    }

    function stepD(d, dt) {
      d.t -= dt;
      const dist = Math.hypot(me.x - d.x, me.y - d.y);
      const late = st.pt > 8 ? 1.12 : 1;
      switch (d.st) {
        case 'down':
          d.vx *= 0.85; d.vy *= 0.85;
          if (d.t <= 0) { d.st = 'chase'; d.lungeCd = 0.6; }
          return;
        case 'eng': return;
        case 'idle': return;
        case 'read':
          if (d.t > 0) return;
          // mirror the runner from depth; fill downhill once he commits
          if (me.y < LOS - 1 || dist < 11) { d.st = 'chase'; break; }
          moveToward(d, me.x + (d.over ? me.vx * 0.9 : 0), LOS - 7, d.spd * 0.45, d.acc, dt);
          return;
        case 'deep':
          if (d.t > 0) return;
          if (dist < (d.cushion || 22) || me.y < d.y + 10) { d.st = 'chase'; break; }
          moveToward(d, lerp(d.x, me.x, 0.5), Math.max(d.y, me.y - (d.cushion || 22)) + 1, d.spd * 0.55, d.acc, dt);
          return;
        case 'wind':
          d.vx *= 0.8; d.vy *= 0.8;
          d.face = Math.atan2(me.x - d.x, -(me.y - d.y));
          if (d.t <= 0) {
            d.st = 'lunge'; d.t = 0.3;
            const tx = me.x + me.vx * 0.1, ty = me.y + me.vy * 0.1, dd = Math.hypot(tx - d.x, ty - d.y) || 1;
            d.vx = (tx - d.x) / dd * d.spd * 2.05; d.vy = (ty - d.y) / dd * d.spd * 2.05;
          }
          return;
        case 'lunge':
          d.x += d.vx * dt; d.y += d.vy * dt;
          if (d.t <= 0) { d.st = 'down'; d.t = 0.85; whiff(d, false); }
          return;
      }
      if (d.st !== 'chase' || d.t > 0) return;
      // pursue with an angle (lead), some better than others
      const tau = clamp(dist / d.spd, 0, 1.1) * d.lead;
      const tx = me.x + me.vx * tau, ty = me.y + me.vy * tau;
      moveToward(d, tx, ty, d.spd * late, d.acc, dt);
      d.lungeCd = Math.max(0, (d.lungeCd || 0) - dt);
      if (dist < lungeR && d.lungeCd <= 0 && me.ball && st.phase === 'live' && d.y < me.y + 3) { d.st = 'wind'; d.t = windT; }
    }

    function whiff(d, juke) {
      if (d.whiffed) return;
      d.whiffed = true;
      if (juke) {
        st.juked.push(nameFor(d));
        L.pop(pick(['JUKED!', 'MISSED!', 'SEE YA!']), d.x, d.y - 5, { color: '#FFFFFF', size: 3.8 });
      }
    }

    function stepB(b, dt) {
      if (b.qb) {
        if (st.phase === 'live' && !me.ball) moveToward(b, lerp(b.x, me.x, 0.6), b.y + 2, 6, 40, dt);
        else { b.vx *= 0.8; b.vy *= 0.8; }
        return;
      }
      if (b.st === 'beat') { b.t -= dt; b.vx *= 0.9; b.vy *= 0.9; if (b.t <= 0) b.st = 'free'; return; }
      if (b.st !== 'free') return;
      // pick the nearest free defender that nobody else is on (receivers prefer corners)
      if (!b.tgt || b.tgt.st === 'eng' || b.tgt.st === 'down' || (b.tgtT = (b.tgtT || 0) - dt) < 0) {
        let best = null, bd = 1e9;
        D.forEach(d => {
          if (d.st === 'eng' || d.st === 'down') return;
          if (B.some(o => o !== b && o.tgt === d && o.st === 'free')) return;
          let q = Math.hypot(d.x - b.x, d.y - b.y);
          if (b.kind === 'WR' && d.kind !== 'CB') q += 30;
          if (b.kind === 'TE' && d.kind !== 'LB') q += 18;
          if (b.climb && d.kind !== 'LB') q += 25;
          if (q < bd) { bd = q; best = d; }
        });
        b.tgt = bd < 45 ? best : null; b.tgtT = 0.4;
      }
      if (b.tgt) {
        const d = b.tgt;
        const tx = lerp(d.x, me.x, 0.22), ty = lerp(d.y, me.y, 0.22);
        moveToward(b, tx, ty, b.spd, 70, dt);
      } else {
        // escort the runner
        moveToward(b, me.x + (b.x < me.x ? -5 : 5), me.y - 7, b.spd * 0.9, 50, dt);
      }
    }

    function collide(dt) {
      // pairs: struggle, drift, shed
      for (let i = pairs.length - 1; i >= 0; i--) {
        const p = pairs[i];
        p.t -= dt;
        const wob = Math.sin(st.t * 9 + i) * 0.6;
        p.b.x += (p.push * 0.5 + wob) * dt; p.d.x += (p.push + wob) * dt;
        const mx = (p.b.x + p.d.x) / 2, my = (p.b.y + p.d.y) / 2;
        const ang = Math.atan2(p.d.x - p.b.x, -(p.d.y - p.b.y));
        p.b.x = mx - Math.sin(ang) * R * 0.95; p.b.y = my + Math.cos(ang) * R * 0.95;
        p.d.x = mx + Math.sin(ang) * R * 0.95; p.d.y = my - Math.cos(ang) * R * 0.95;
        p.b.face = ang; p.d.face = ang + Math.PI;
        p.b.state = 'block'; p.d.state = 'block';
        if (p.t <= 0) {
          pairs.splice(i, 1);
          p.b.st = 'beat'; p.b.t = 0.55; p.b.state = null;
          p.d.st = 'chase'; p.d.t = 0.12; p.d.state = null;
          p.d.vx = 0; p.d.vy = 0;
          p.b.tgt = null;
        }
      }
      // free blockers stick to free defenders on contact
      B.forEach(b => {
        if (b.st !== 'free' || b.qb) return;
        D.forEach(d => {
          if (b.st !== 'free' || (d.st !== 'chase' && d.st !== 'read' && d.st !== 'deep' && d.st !== 'wind')) return;
          if (Math.hypot(b.x - d.x, b.y - d.y) < R * 2) engage(b, d, (b.kind === 'RT' ? 0.85 : 0.7) * holdK * rand(0.7, 1.3));
        });
      });
      // defenders keep a little space between each other
      for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
        const a = D[i], b = D[j];
        if (a.st === 'eng' || b.st === 'eng') continue;
        const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy);
        if (dd > 0.01 && dd < R * 2) { const push = (R * 2 - dd) / 2; a.x -= dx / dd * push; a.y -= dy / dd * push; b.x += dx / dd * push; b.y += dy / dd * push; }
      }
      // contact with the runner
      if (!me.ball || st.phase !== 'live') return;
      for (const d of D) {
        if (d.st === 'down' || d.st === 'idle') continue;
        const dd = Math.hypot(d.x - me.x, d.y - me.y);
        const reach = d.st === 'lunge' ? R * 2 + 0.6 : d.st === 'eng' || d.st === 'wind' ? R * 1.25 : R * 1.65;
        if (dd > reach) continue;
        if (d.st === 'eng') { if (me.ifr > 0) continue; return tackle(d); }
        if (me.ifr > 0) { d.st = 'down'; d.t = 0.8; whiff(d, true); AG.sfx.whoosh(); continue; }
        if (me.firstContact) {
          me.firstContact = false;
          if (chance(pBreak)) {
            st.broke = nameFor(d);
            d.st = 'down'; d.t = 1.1; d.vx = 0; d.vy = 0;
            d.x += sgn(d.x - me.x || 1) * 2; d.y += 1.5;
            me.slow = 0.35; me.vx *= 0.4;
            L.pop('BROKEN TACKLE!', me.x, me.y - 7, { color: v.colors.led, size: 4.4, life: 1.2 });
            L.ring(me.x, me.y - 1, v.colors.led);
            AG.sfx.pop();
            v.shake = 1.2;
            continue;
          }
        }
        return tackle(d);
      }
    }

    function tackle(d) {
      st.diag = { kind: d.kind, how: d.st, t: +st.t.toFixed(2), jukes: me.jukes || 0, whiffs: st.juked.length, broke: !!st.broke, x: Math.round(me.x) };
      st.phase = 'over'; st.pt = 0; st.tackler = d;
      for (let i = pairs.length - 1; i >= 0; i--) if (pairs[i].d === d) { pairs[i].b.st = 'beat'; pairs[i].b.t = 9; pairs[i].b.state = null; pairs.splice(i, 1); }
      st.over = 'tackle';
      // fall forward with your momentum
      const fwd = clamp(-me.vy / top, 0, 1) * rand(1.2, 2.6) * (d.y > me.y ? 1.3 : 0.8);
      me.fall = { y0: me.y, y1: me.y - fwd, x0: me.x, x1: me.x + me.vx * 0.05 };
      d.st = 'tack'; d.state = 'lunge'; d.face = Math.atan2(me.x - d.x, -(me.y - d.y));
      L.ring(me.x, me.y, '#FFFFFF');
      L.dust(me.x, me.y, 10);
      AG.sfx.thud();
      v.shake = 2.2;
    }

    function score() {
      st.phase = 'over'; st.pt = 0; st.over = 'td';
      L.pop('TOUCHDOWN!', me.x, me.y - 6, { color: v.colors.led, size: 6.5, display: true, life: 1.6 });
      AG.sfx.roar();
    }
    function slide() {
      st.phase = 'over'; st.pt = 0; st.over = 'slide';
      me.y = Math.max(me.y, TARGET_Y - 1);
      me.fall = { y0: me.y, y1: me.y - 1.5, x0: me.x, x1: me.x };
      L.pop('IN RANGE', me.x, me.y - 6, { color: v.colors.led, size: 5, display: true, life: 1.4 });
      AG.sfx.roar();
    }

    function step(dt) {
      if (done) return false;
      st.t += dt; st.pt += dt;
      v.shake = Math.max(0, v.shake - dt * 8);
      if (st.phase === 'cad') {
        if (st.pt > 0.05 && !st.saidSet) { st.saidSet = true; L.pop(sc.mode === 'kick' ? 'KICK IS AWAY' : 'SET…', 50, v.camY + v.Hu * 0.3, { size: 4, life: 0.7 }); AG.sfx.hut(); }
        if (sc.mode === 'kick') { st.phase = 'kick'; st.pt = 0; }
        else if (st.pt > 0.55) { L.pop('HUT!', 50, v.camY + v.Hu * 0.3, { size: 5, life: 0.6, color: v.colors.led }); snap(); }
        // everyone frozen
      } else if (st.phase === 'kick') {
        const T = 1.25;
        st.kickT = st.pt / T;
        // coverage runs down, return team sets up
        D.forEach(d => moveToward(d, lerp(d.x, me.x, 0.15), d.y + 30, d.spd * (d.deep ? 0.6 : 0.95), 50, dt));
        B.forEach((b, i) => {
          const tx = lerp(b.x, holeX + (b.x - 50) * 0.35, 0.03), ty = Math.min(b.y + 10, -26 - (i % 2) * 6);
          moveToward(b, tx, ty, 9, 40, dt);
          b.face = Math.PI;
        });
        stepMe(dt);
        if (st.pt >= T) startKickLive();
      } else if (st.phase === 'live') {
        if (!me.ball && sc.mode !== 'kick' && (st.pt > 0.32 || Math.hypot(me.x - qb.x, me.y - qb.y) < 5)) { me.ball = true; AG.sfx.step(); }
        stepMe(dt);
        D.forEach(d => stepD(d, dt));
        B.forEach(b => stepB(b, dt));
        collide(dt);
        if (st.phase === 'live') {
          if (!st.goodReached && me.y <= GOOD_Y) { st.goodReached = true; if (sc.mode !== 'goal') L.pop(sc.mode === 'kick' ? 'GOOD RETURN' : 'CHAINS MOVING', me.x, me.y - 6, { size: 3.6, color: '#FFFFFF' }); AG.sfx.step(); }
          if (!st.reached && me.y <= TARGET_Y) {
            st.reached = true;
            if (sc.mode === 'goal' && sc.fg) slide();
            else if (TARGET_Y > OPP_GOAL) { L.pop('BIG PLAY!', me.x, me.y - 7, { color: v.colors.led, size: 5.4, display: true, life: 1.3 }); AG.sfx.roar(); }
          }
          if (st.phase === 'live' && me.y <= OPP_GOAL) score();
          // safety valve: nobody plays forever
          if (st.phase === 'live' && st.pt > 13) { const d = D.slice().sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0]; tackle(d); }
        }
        st.maxY = Math.min(st.maxY, me.y);
      } else if (st.phase === 'over') {
        const q = clamp(st.pt / 0.3, 0, 1);
        if (me.fall) { me.x = lerp(me.fall.x0, me.fall.x1, q); me.y = lerp(me.fall.y0, me.fall.y1, q); }
        if (st.over === 'td') { me.vy *= 0.92; me.vx *= 0.9; me.y += me.vy * dt; me.x += me.vx * dt; me.y = Math.max(me.y, -216); }
        if (st.tackler && st.tackler.st === 'tack') { const d = st.tackler; d.x = lerp(d.x, me.x + Math.sin(d.face) * -R * 0.9, 0.3); d.y = lerp(d.y, me.y + Math.cos(d.face) * R * 0.9, 0.3); }
        // the rest coast
        D.forEach(d => { if (d !== st.tackler && d.st !== 'eng') { d.vx *= 0.92; d.vy *= 0.92; d.x += d.vx * dt; d.y += d.vy * dt; } });
        if (st.pt > (st.over === 'td' ? 1.15 : 0.95)) { finishPlay(); return false; }
      }
      st.yards = Math.round((LOS - Math.min(me.y, LOS + 40)) / 2);
      if (sc.mode === 'kick' && st.phase !== 'kick' && st.phase !== 'pre' && st.phase !== 'cad') st.yards = Math.round((-4 - me.y) / 2);
      L.step(dt);
      const yFrac = sc.mode === 'kick' && st.phase === 'kick' ? 0.82 : 0.68;
      v.follow(me.x, me.y, yFrac, dt);
      dom.cooldown(me.cd > 0 ? 1 - me.cd / me.cdMax : 1);
      draw();
      return true;
    }

    // ---------- drawing ----------
    function draw() {
      AG.begin(v);
      AG.drawField(v);
      if (sc.mode !== 'kick') AG.line(v, LOS, 'rgba(90,160,255,.95)', 'LINE');
      if (sc.mode === 'kick') {
        AG.line(v, GOOD_Y, 'rgba(255,255,255,.85)', `BEAT THE ${2 + sc.good}`, true);
        AG.line(v, TARGET_Y, '#FFD84A', `BIG RETURN · ${2 + sc.target}`);
      } else if (sc.mode === 'goal') {
        AG.line(v, GOOD_Y, 'rgba(255,255,255,.85)', sc.fg ? 'FIELD GOAL RANGE' : 'KEEP IT ALIVE', true);
        if (sc.fg) AG.line(v, TARGET_Y, '#FFD84A', 'CHIP SHOT');
      } else {
        AG.line(v, GOOD_Y, 'rgba(255,255,255,.85)', `FIRST DOWN`, true);
        AG.line(v, TARGET_Y, '#FFD84A', `BIG PLAY · +${sc.target}`);
      }
      // hint arrow
      if (hint && hintLevel > 0 && (st.phase === 'pre' || st.phase === 'cad' || st.phase === 'kick' || (st.phase === 'live' && st.pt < hintTime))) {
        const fade = st.phase === 'live' ? 1 - st.pt / hintTime : 1;
        AG.arrow(v, hint, '#FFE27A', hintLevel * fade);
      }
      // trail (afterimages while juking)
      me.trail.forEach(p => { if (p.ifr) AG.guy(v, { x: p.x, y: p.y, face: p.f, team: 'us', alpha: 0.28 * (1 - p.t / 0.2) }); });
      const list = allPlayers().slice();
      list.push(me);
      list.sort((a, b) => a.y - b.y);
      for (const p of list) {
        if (p === me) {
          AG.guy(v, { x: me.x, y: me.y, face: me.face, team: 'us', num: S ? S.num : 22, me: true, meColor: me.ifr > 0 ? '#FFFFFF' : null, moving: st.phase === 'live' || st.phase === 'kick', phase: me.phase, ball: me.ball, state: st.over === 'tackle' && st.pt > 0.2 ? 'down' : null, alpha: me.ifr > 0 ? 0.75 : 1 });
          continue;
        }
        const team = D.includes(p) ? 'them' : 'us';
        const stt = p.st === 'down' || p.st === 'tack' && st.pt > 0.2 ? 'down' : p.st === 'lunge' || p.st === 'tack' ? 'lunge' : p.st === 'wind' ? 'wind' : p.state === 'block' && p.st === 'eng' ? 'block' : null;
        AG.guy(v, { x: p.x, y: p.y, face: p.face, team, num: p.num, moving: Math.hypot(p.vx, p.vy) > 2, phase: p.phase, state: stt });
        if (p.st === 'wind' && team === 'them') markWind(p);
      }
      // the kick in the air
      if (sc.mode === 'kick' && (st.phase === 'kick' || st.phase === 'pre' || st.phase === 'cad')) {
        const q = st.phase === 'kick' ? st.kickT : 0;
        const by = lerp(-150, me.y, q), bx = lerp(50, me.x, q);
        AG.ball(v, bx, by, Math.sin(q * Math.PI) * 26 + (1 - q) * 4, q * 20);
      }
      // the handoff: ball in the QB's hands until it's yours
      if (qb && !me.ball) AG.ball(v, qb.x + 1.5, qb.y - 0.5, 0, -0.4);
      AG.labels(v);
      L.draw(v);
      AG.end(v);
      AG.hud(v, {
        yards: st.phase === 'pre' || st.phase === 'cad' || st.phase === 'kick' ? 0 : st.phase === 'live' ? Math.max(0, st.yards) : st.yards,
        unit: sc.mode === 'kick' ? 'RET YDS' : 'YDS',
        yardsColor: st.reached ? '#FFD84A' : st.goodReached ? '#FFFFFF' : null,
        meter: { label: 'JUKE', value: me.cd > 0 ? 1 - me.cd / me.cdMax : 1 },
        goal: sc.mode === 'goal' ? (sc.fg ? 'GET INTO FIELD GOAL RANGE' : 'GET IN THE END ZONE') : sc.mode === 'kick' ? `GOAL: PAST YOUR ${2 + sc.target}` : `GOAL: ${sc.target}+ YDS`,
      });
      if (ctl.joy.on) AG.stick(v, ctl.joy);
    }
    function markWind(p) {
      const { ctx } = v.f, k = v.k;
      ctx.save();
      ctx.font = `700 ${Math.round(k * 3.4)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, k * 0.6); ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText('!', v.sx(p.x), v.sy(p.y - R * 2.1));
      ctx.fillStyle = '#FFD84A'; ctx.fillText('!', v.sx(p.x), v.sy(p.y - R * 2.1));
      ctx.restore();
    }

    // ---------- results ----------
    function outcome() {
      const yd = sc.mode === 'kick' ? Math.round((-4 - me.y) / 2) : Math.round((LOS - me.y) / 2);
      const td = st.over === 'td';
      const r = td || yd >= sc.target || (sc.mode === 'goal' && st.over === 'slide') ? 'great' : yd >= sc.good ? 'good' : 'bad';
      return { r, yd, td };
    }

    function story(r, yd, td, tackler) {
      const endYd = sc.mode === 'kick' ? 2 + yd : sc.ballOn + yd;
      const where = AG.spot(endYd);
      const juked = st.juked.length ? (st.juked.length > 1 ? `make ${st.juked.length === 2 ? 'two' : 'three'} defenders miss` : `make ${st.juked[0]} grab air`) : '';
      const broke = st.broke ? `bounce off ${st.broke}` : '';
      const mid = [juked, broke].filter(Boolean);
      const midTxt = mid.length ? mid.join(', ') + ', ' : '';
      const who = tackler ? (tackler.kind === 'K' ? 'their kicker, of all people,' : nameFor(tackler)) : 'a defender';
      const sideline = me.x < 10 || me.x > 90;
      const behind = tackler && tackler.y > me.y + 1;
      const verb = sideline ? 'shoves you over the sideline' : behind ? 'catches you from behind' : pick(['drags you down', 'wraps you up', 'brings you down']);
      if (sc.mode === 'kick') {
        const lane = me.x < 40 ? 'up the left side' : me.x > 60 ? 'up the right side' : 'straight up the middle';
        if (td) return `You field it at your own 2, follow the wall ${lane}, ${midTxt}and nobody touches you after that. Ninety-eight yards. The kickoff team is still lying on the turf.`;
        if (r === 'great') return `You field it at your own 2, find the wall ${lane}, ${midTxt}and take it to ${where} before ${who} ${verb}.`;
        if (r === 'good') return `You field it at your own 2${midTxt ? ', ' + midTxt + 'and' : ' and'} get it out to ${where} before ${who} ${verb}. Decent field position.`;
        if (yd < 12) return `You field it at your own 2, and ${who} is on you almost immediately. Down at ${where}. Coach Bramble looks at the ceiling.`;
        return `You field it at your own 2${midTxt ? ', ' + midTxt + 'and' : ' and'} get it out to ${where} before ${who} ${sideline ? verb : 'brings you down'}, short of the ${2 + sc.good}. Coach Bramble looks at the ceiling.`;
      }
      const lineX = st.lineX == null ? me.x : st.lineX;
      const how = Math.abs(lineX - holeX) <= 6 ? pick(['You hit the hole at full speed', 'You burst through the hole', 'You hit the crease before it closes'])
        : (lineX < 33 || lineX > 67) ? pick(['You bounce it outside', 'You bounce it to the edge'])
          : (sgn(lineX - 50) !== sgn(holeX - 50) && Math.abs(lineX - holeX) > 8) ? pick(['You cut it back against the grain', 'You plant and cut back'])
            : pick(['You find a crease', 'You slip through a seam']);
      // "You find a crease and go 41 yards" / "You find a crease, make the linebacker grab air, and go 41 yards"
      const then = rest => (midTxt ? `${how}, ${midTxt}and ${rest}` : `${how} and ${rest}`);
      if (sc.mode === 'goal') {
        if (td) return then(`dive across the goal line with the ball stretched out in front of you.`);
        if (sc.fg && r === 'great') return then(`slide down at ${where} on purpose. The clock keeps running. The kicker jogs out.`);
        if (r !== 'bad') return sc.fg ? `${how} and fall forward to ${where} before ${who} ${verb}. That's field-goal range.` : then(`get dragged down at ${where}. Close enough to smell it. Tiny looks back at you and nods.`);
        return yd <= 0 ? `${AG.cap(who)} meets you ${yd < 0 ? 'in the backfield' : 'at the line'}. Stuffed for ${AG.yardsWord(yd)}, with the clock running.` : `You fight for ${AG.yardsWord(yd)} before ${who} ${verb}. It isn't enough.`;
      }
      if (td) return `${how}, ${midTxt}and nobody touches you after that. ${yd} yards. Touchdown.`;
      if (r === 'great') return then(`go ${yd} yards before ${who} ${verb} at ${where}.`);
      if (r === 'good') return then(`pick up ${yd} hard yards before ${who} ${verb}. Chains move.`);
      if (yd <= 0) return `${AG.cap(who)} ${pick(['sheds his block and ', 'slips through and ', ''])}meets you ${yd < 0 ? 'in the backfield' : 'at the line'}. Stuffed for ${AG.yardsWord(yd)}.`;
      return `You squeeze out ${AG.yardsWord(yd)} before ${who} ${verb}. Not enough.`;
    }

    function finishPlay() {
      if (done) return;
      const o = outcome();
      const text = story(o.r, o.yd, o.td, st.tackler);
      finishWith(o.r, o.yd, o.td, text);
    }
    function finishWith(r, yd, td, text) {
      if (done) return;
      done = true;
      cleanup();
      const spotYd = sc.mode === 'kick' ? 2 + yd : sc.ballOn + yd;
      AG.setResult(cfg.moment, { yards: yd, td: !!td, fgYds: sc.mode === 'goal' && sc.fg && r !== 'bad' ? clamp(Math.round(100 - spotYd + 17), 18, 60) : 0 });
      const label = td ? 'Touchdown' : sc.mode === 'goal' && sc.fg && r === 'great' ? 'In range' : `${yd > 0 ? '+' : ''}${yd} yards`;
      endMini(host, r, label, cfg.onDone, { text });
    }
    function cleanup() {
      if (loop) loop.stop();
      ctl.destroy();
      window.removeEventListener('resize', onResize);
    }

    // finish(r) for tests: invent a believable play with that result.
    function forced(r) {
      if (done) return;
      let yd, td = false;
      const room = sc.mode === 'kick' ? 98 : 100 - sc.ballOn;
      if (r === 'great') { yd = Math.min(room, sc.target + ri(0, 14)); td = yd >= room; if (sc.mode === 'goal' && sc.fg) { yd = sc.target; } }
      else if (r === 'good') yd = ri(sc.good, sc.target - 1);
      else yd = ri(-2, sc.good - 1);
      me.y = sc.mode === 'kick' ? -4 - yd * 2 : LOS - yd * 2;
      me.x = rand(20, 80);
      st.lineX = holeX;
      if (sc.mode === 'goal' && sc.fg && r === 'great') st.over = 'slide';
      const front = D.filter(d => (r === 'bad' ? d.kind === 'DL' || d.kind === 'LB' : r === 'good' ? d.kind === 'LB' || d.kind === 'S' || d.kind === 'COV' : d.kind === 'S' || d.kind === 'CB' || d.kind === 'K'));
      const tk = pick(front.length ? front : D);
      finishWith(r, yd, td, story(r, yd, td, td ? null : tk));
    }

    setMini({
      stop() { done = true; cleanup(); },
      key(e) {
        if (st.phase === 'pre' && (e.key === ' ' || e.key === 'Enter')) { if (!e.repeat) f.start(); return true; }
        return ctl.claims(e);
      },
      finish(r) { forced(r); },
    });
    draw(); draw(); // twice: the second pass knows where the HUD boxes are, so line tags avoid them
  };

  // ---------- content ----------
  MOMENTS.RB.push(
    { type: 'run', title: 'Daylight', run: { mode: 'inside', target: 12, good: 7 },
      setup: 'Inside zone. Tiny wants the nose tackle moved, and Tiny usually gets what he wants. Press the hole, read your blocks, and the second level is all yours.',
      prompt: 'Find the hole, then find the grass. Juke anyone who dives at you.',
      great: 'You hit the hole, make the linebacker miss, and the secondary gets a long look at your back.',
      good: 'You find a crease and lean forward for a first down.',
      bad: 'The hole closes before you get there. Stuffed.' },
    { type: 'run', title: 'Kick Return', run: { mode: 'kick', target: 33, good: 23 },
      setup: 'Bramble sends you deep for the kickoff. Rocco tapes your wrists on the sideline and says the same thing he says to every returner: "Catch it first. Get famous second."',
      prompt: 'Catch it, find your wall, and go. Juke the first man who dives.',
      great: 'You find the seam in the coverage and take it past midfield before anybody lays a hand on you.',
      good: 'You follow your blockers and get it out past the 20.',
      bad: 'The coverage team swarms you before you reach the 15.' },
  );
  // The final carry of a game you're chasing: a real goal-line run.
  AG.setClutch('RB', 'chase', { type: 'run', title: 'Final Drive',
    setup: 'Bramble puts the game in your hands. The ball has gone to you on every snap of the final drive, and now it comes down to this carry.',
    prompt: 'One carry. Everything you have. Juke the first man who dives.',
    great: 'You bounce off a safety, spin past a linebacker, and keep your legs moving long after you should be down.',
    good: 'Nothing pretty about it. Just enough.',
    bad: 'They stuff you at the line.' });
}
