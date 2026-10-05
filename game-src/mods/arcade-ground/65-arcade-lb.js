// =========================================================
//   ARCADE: 'pursuit' — linebacker run-defense mini-game
// =========================================================
// You line up on defense; the offense (white) comes DOWN the screen. The back takes a handoff (or a toss)
// and heads for a gap, sometimes with a fake and a cutback. One to three blockers come looking for you.
// Move: arrows / WASD / pad / drag. Burst (Space, Enter, BURST button, quick tap): a short speed boost.
// Burst close to the carrier and it becomes a dive with extra reach. Burst while a blocker has you and you
// shed him. Where you make the tackle decides the play. Mod keys: 'pursuit.ease', 'pursuit.burstCooldown'.
{
  TAGS.pursuit = 'Pursuit';
  DEFAULT_PROMPT.pursuit = 'Beat the blocks and make the tackle. Space or BURST to close.';
  const { R, lerp, sgn } = AG;

  function scenario(cfg) {
    const m = (cfg.moment && cfg.moment.pursuit) || cfg.pursuit || {};
    const tag = (cfg.moment && cfg.moment.tag) || m.tag || 'tkl';
    if (cfg.clutch) {
      const g = S && S.game, d0 = g ? (g.cl && g.cl.d0 != null ? g.cl.d0 : g.us - g.them) : 1;
      return { ballOn: m.ballOn || 30, good: m.good || 5, tag, clutch: true, chase: d0 <= 0 };
    }
    return { ballOn: m.ballOn || ri(35, 65), good: m.good || 5, tag };
  }

  const PLAYS = {
    dive: { say: pick => pick(['They run the dive straight at you', 'They hand it off up the middle', 'They try to run it right down your throat']) },
    tackle: { say: pick => pick(['They run off tackle', 'They run it off the edge of the line']) },
    sweep: { say: pick => pick(['They toss it wide', 'They pitch it out on a sweep']) },
    counter: { say: pick => pick(['They show one way and run the counter', 'The back steps one way and cuts back the other']) },
    draw: { say: pick => pick(['They show pass and run a draw', 'The quarterback drops back, then hands it off on a draw']) },
  };

  MINIGAMES.pursuit = (cfg, host) => {
    const sc = scenario(cfg);
    const diff = cfg.diff; // the engine already adds +1 (and +0.3 on a later snap) for clutch plays
    const E = AG.edge(cfg, 'pursuit.ease', diff);
    const hd = E.hd;
    // Play-calling and blocking schemes scale with a blend of the raw difficulty and your skill-adjusted one,
    // so a great player still sees counters and draws at high difficulty but isn't buried by them.
    const effD = (diff + 2 + hd) / 2;
    // Harder-than-normal settings ramp up more gently than easier ones ramp down (the clutch was a coin flip).
    const hp = hd > 0 ? hd * 0.6 : hd;
    const dScale = 1 + 0.045 * hp;
    const LOS = -2 * sc.ballOn;
    const GOOD_Y = LOS + 2 * sc.good;
    const OUR_GOAL = 0;
    const top = 16.8 * (E.tired ? 0.96 : 1);
    const cdMax = clamp(mod('pursuit.burstCooldown', 1.3 + 0.05 * hd, cfg), 0.7, 2.2);
    const holdK = clamp(1 + 0.11 * hp, 0.4, 2);
    const WADE = clamp(0.72 - 0.02 * hd, 0.6, 0.85), WADE_BURST = 1.05;

    const me = { x: rand(46, 54), y: LOS + 14, vx: 0, vy: 0, face: 0, phase: 0, cd: 0, burst: 0, dive: false, held: 0, heldBy: null, down: 0, trail: [] };
    const O = [], T = [], pairs = []; // O = offense (them), T = teammates (us)
    const off = (kind, x, y, o) => { const p = Object.assign({ kind, x, y, x0: x, vx: 0, vy: 0, face: Math.PI, st: 'idle', t: 0, phase: rand(0, 6), num: null }, o || {}); O.push(p); return p; };
    const mate = (kind, x, y, o) => { const p = Object.assign({ kind, x, y, vx: 0, vy: 0, face: 0, st: 'idle', t: 0, phase: rand(0, 6), num: null }, o || {}); T.push(p); return p; };

    // offense
    const ol = [37.6, 43.8, 50, 56.2, 62.4].map((x, i) => off('OL', x, LOS - 2.9, { num: [74, 66, 60, 63, 79][i] }));
    const te = off('TE', 69, LOS - 2.9, { num: 86 });
    off('WR', 9, LOS - 2.9, { num: 13 }); off('WR', 91, LOS - 2.9, { num: 80 });
    const qb = off('QB', 50, LOS - 5.2, { num: 12 });
    const useFB = effD >= 2.1 || sc.clutch || chance(0.35);
    const fb = useFB ? off('FB', 50, LOS - 9.5, { num: 44 }) : null;
    const rb = off('RB', 50 + (useFB ? 0 : pick([-4, 0, 4])), LOS - 11, { num: pick([20, 23, 25, 28, 34]), carrier: true });
    // defense (your teammates)
    const dl = [41, 47.2, 53.3, 59.5].map((x, i) => mate('DL', x, LOS + 2.9, { num: [91, 97, 93, 98][i] }));
    const olbs = [mate('LB', 33, LOS + 10, { num: 50 }), mate('LB', 67, LOS + 10, { num: 56 })];
    mate('CB', 9, LOS + 8, { num: 24 }); mate('CB', 91, LOS + 8, { num: 21 });
    const safeties = [mate('S', 35, LOS + 26, { num: 30, name: 'Ronnie Batiste' }), mate('S', 65, LOS + 26, { num: 39, name: 'the other safety' })];

    // the play call
    const pool = ['dive', 'dive', 'tackle', 'tackle', 'sweep'];
    if (effD >= 2.2 || sc.clutch) pool.push('counter', 'counter', 'draw');
    if (effD >= 3.2) pool.push('tackle');
    const play = pick(pool);
    const side = pick([-1, 1]);
    const path = [];
    let handT = 0.26;
    const hy = LOS - 8;
    if (play === 'dive') { const gx = 50 + side * 3.1; path.push([lerp(rb.x, gx, 0.5), hy], [gx, LOS - 0.5], [gx + side * 2, LOS + 24]); }
    else if (play === 'tackle') { const gx = 50 + side * 16; path.push([50 + side * 8, hy], [gx, LOS - 0.5], [gx + side * 3, LOS + 24]); }
    else if (play === 'sweep') { handT = 0.2; const gx = 50 + side * 32; path.push([50 + side * 18, LOS - 9], [gx, LOS - 4], [gx + side * 2, LOS + 22]); }
    else if (play === 'counter') { const gx = 50 - side * 9.5; path.push([50 + side * 9, LOS - 11], [50 + side * 6, hy - 1], [gx, LOS - 0.5], [gx - side * 3, LOS + 24]); handT = 0.62; }
    else { handT = 0.85; const gx = 50 + side * 4; path.push([50, LOS - 13], [50, hy], [gx, LOS - 0.5], [gx, LOS + 24]); }
    // the hint shows the first part of the path (at hard difficulty: none, unless you studied film)
    const hintLevel = cfg.edge ? 0.85 : effD <= 1.6 ? 0.85 : effD <= 2.7 ? 0.6 : effD <= 3.6 ? 0.4 : effD <= 4.4 ? 0.26 : 0;
    const hintPts = [[rb.x, rb.y]].concat(play === 'counter' && !cfg.edge && effD > 1.6 ? path.slice(0, 2) : path.slice(0, -1).concat([[path[path.length - 1][0], LOS + 6]]));

    // blockers coming for you
    const nBlk = clamp((effD < 1.5 ? 1 : effD < 3.4 ? (chance(0.55) ? 2 : 1) : (chance(0.75) ? 2 : 1)) + (sc.clutch && effD >= 4 ? 1 : 0), 1, 3);
    const hunters = [];
    if (fb) hunters.push(fb);
    // a guard pulls / climbs
    const g = side > 0 ? ol[1] : ol[3];
    if (hunters.length < nBlk) hunters.push(g);
    if (hunters.length < nBlk) hunters.push(te);
    hunters.forEach((h, i) => { h.hunter = true; h.delay = 0.15 + i * 0.3 + (h.kind === 'OL' ? 0.1 : 0); h.spd = (h.kind === 'FB' ? 14.6 : h.kind === 'TE' ? 14 : 12.8) * dScale; });

    const cs = 15.3 * dScale; // carrier top speed
    const jukeChance = clamp(0.15 + 0.12 * hp, 0, 0.6);

    // ---------- mount ----------
    const opts = {
      aspect: 0.8, minH: 300, maxH: 520, controls: ['left', 'up', 'right', 'down', 'action'], actionLabel: 'Burst',
      startLabel: 'Snap it', aria: 'Linebacker mini-game field',
      help: '<span class="ag-hk">Move: arrows or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, the pad, or drag on the field. Burst: <kbd>Space</kbd>, the BURST button, or a quick click on the field. Burst into a blocker to shed him. Burst near the ball carrier to dive.</span><span class="ag-ht">Hold the pad or drag anywhere on the field to move. Tap BURST (or the field) to close fast, shed a block, or dive.</span>',
    };
    const f = Field.mount(host, cfg, opts);
    const v = AG.view(f, { aspectSet: narrow => { opts.aspect = narrow ? 1.22 : 0.8; opts.minH = narrow ? 330 : 300; } });
    v.fit();
    const playLbl = `${sc.clutch ? (sc.chase ? 'Get the ball back' : 'Last stand') : 'Run D'} · ${AG.spot(sc.ballOn).replace('your own', 'your')}`;
    const dom = AG.decorate(f, { cls: 'ag-pursuit', play: playLbl, tips: ['<b>Move</b><span class="ag-hk">arrows or WASD</span><span class="ag-ht">drag or the pad</span>', '<b>Burst</b><span class="ag-hk">Space</span><span class="ag-ht">tap BURST</span>'] });
    const ctl = AG.controls(f);
    const L = AG.fxLayer();
    const st = { phase: 'pre', t: 0, pt: 0, handed: false, through: false, over: null, events: [], shed: 0, stuck: 0, diveMiss: 0, juked: false, gain: 0, hit: false, ball: null, tackler: null };
    f.canvas.__ag = { st, me, O, T, rb, sc, LOS, play, gapX: path[path.length - 2][0], hint: hintLevel };
    let loop = null, done = false;
    v.follow(50, LOS, 0.36, 0, true);

    const onResize = () => { v.fit(); if (!loop) { v.follow(50, LOS, 0.36, 0, true); draw(); draw(); } };
    window.addEventListener('resize', onResize);

    function startPlay() {
      if (st.phase !== 'pre' || done) return;
      ctl.clear();
      st.phase = 'cad'; st.pt = 0;
      try { const r = f.panel.getBoundingClientRect(); if (r.bottom > window.innerHeight || r.top < 0) f.panel.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
      loop = Field.loop(step);
    }
    f.onStart(startPlay);

    function pair(a, b, hold, push) { a.st = 'eng'; b.st = 'eng'; pairs.push({ a, b, t: hold, push: push || 0 }); }

    function snap() {
      st.phase = 'live'; st.pt = 0;
      AG.sfx.hut();
      // trench battles: every DL is engaged for the whole play (they're good, but so is their line)
      const freeOl = ol.filter(o => !o.hunter);
      dl.forEach((d, i) => { const o = freeOl.slice().sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0]; if (o) { freeOl.splice(freeOl.indexOf(o), 1); pair(o, d, 99, 0); } });
      // receivers block corners, tight end (if not hunting) seals an outside linebacker
      O.filter(o => o.kind === 'WR').forEach(w => { const c = T.find(t => t.kind === 'CB' && Math.abs(t.x - w.x) < 10); if (c) pair(w, c, 99, 0); });
      olbs.forEach(lb => {
        const blocker = !te.hunter && Math.abs(te.x - lb.x) < 10 ? te : freeOl.shift();
        if (blocker) pair(blocker, lb, 99, 0); else { lb.st = 'contain'; }
      });
      O.forEach(o => { if (o.hunter) { o.st = 'hunt'; o.t = o.delay; } });
      rb.st = 'path'; rb.pi = 0;
      qb.st = 'qb';
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

    function stepMe(dt) {
      const a = ctl.axis();
      const live = st.phase === 'live' || st.phase === 'cad';
      if (me.down > 0) { me.down -= dt; me.vx *= 0.85; me.vy *= 0.85; me.x += me.vx * dt; me.y += me.vy * dt; ctl.action(); return; }
      if (st.phase === 'cad') { // pre-snap: you can shuffle, not fly
        const mx = a.x * 5, my = a.y * 3;
        me.vx += clamp(mx - me.vx, -40 * dt, 40 * dt); me.vy += clamp(my - me.vy, -40 * dt, 40 * dt);
        me.x += me.vx * dt; me.y = clamp(me.y + me.vy * dt, LOS + 9, LOS + 17);
        ctl.action();
        return;
      }
      if (!live) return;
      const want = me.held > 0 ? top * 0.18 : me.burst > 0 ? top * 1.7 : top;
      let ax = a.x, ay = a.y;
      const mag = Math.hypot(ax, ay); if (mag > 1) { ax /= mag; ay /= mag; }
      const acc = me.burst > 0 ? 230 : 150;
      if (me.burst > 0 && mag < 0.2) { // burst with no direction: toward the ball
        const dx = rb.x - me.x, dy = rb.y - me.y, dd = Math.hypot(dx, dy) || 1; ax = dx / dd; ay = dy / dd;
      }
      me.vx += clamp(ax * want - me.vx, -acc * dt, acc * dt);
      me.vy += clamp(ay * want - me.vy, -acc * dt, acc * dt);
      if (me.held > 0 && me.heldBy) { // the blocker drives you back
        const hb = me.heldBy, dx = me.x - hb.x, dy = me.y - hb.y, dd = Math.hypot(dx, dy) || 1;
        me.vx += dx / dd * 6 * dt * 10; me.vy += dy / dd * 6 * dt * 10;
        const sp2 = Math.hypot(me.vx, me.vy); if (sp2 > 6) { me.vx *= 6 / sp2; me.vy *= 6 / sp2; }
      }
      // The trenches are crowded: wading through the linemen's scrum is slow (a burst gets you through faster).
      me.wade = false;
      if (st.phase === 'live' && me.held <= 0) {
        for (const p of pairs) {
          if (Math.hypot(p.a.x - me.x, p.a.y - me.y) < R * 1.75 || Math.hypot(p.b.x - me.x, p.b.y - me.y) < R * 1.75) { me.wade = true; break; }
        }
        if (me.wade) {
          const cap = me.burst > 0 ? top * WADE_BURST : top * WADE, sp0 = Math.hypot(me.vx, me.vy);
          if (sp0 > cap) { me.vx *= cap / sp0; me.vy *= cap / sp0; }
        }
      }
      me.x += me.vx * dt; me.y += me.vy * dt;
      me.x = clamp(me.x, AG.SIDE_L + R, AG.SIDE_R - R);
      me.y = Math.max(me.y, LOS + 0.5 - 30); // you can shoot the gap, but the line is the line
      const sp = Math.hypot(me.vx, me.vy);
      me.phase += sp * dt * 0.75;
      if (sp > 2) me.face = Math.atan2(me.vx, -me.vy);
      // burst / shed / dive
      const act = ctl.action();
      if (act && me.held > 0 && me.cd > 0 && st.phase === 'live' && (me.rip || 0) <= 0) {
        // burst still recharging: you can still fight the block, a rip at a time
        me.held *= 0.55; me.rip = 0.22;
        L.ring(me.x, me.y - 1, 'rgba(255,255,255,.6)');
      }
      me.rip = Math.max(0, (me.rip || 0) - dt);
      if (act && me.cd <= 0 && st.phase === 'live') {
        me.cd = cdMax;
        if (me.held > 0) {
          me.held = 0.06; st.shed++;
          L.pop('SHED!', me.x, me.y - 6, { color: v.colors.led, size: 4 });
          AG.sfx.pop();
          if (me.heldBy) { me.heldBy.st = 'beat'; me.heldBy.t = 0.9; const hb = me.heldBy; hb.vx = (hb.x - me.x) * 2; hb.vy = (hb.y - me.y) * 2; }
        } else {
          me.burst = 0.32;
          me.dive = st.handed && Math.hypot(rb.x - me.x, rb.y - me.y) < 10;
          AG.sfx.whoosh();
          L.dust(me.x, me.y + 2, 6);
        }
      }
      if (me.burst > 0) {
        me.burst -= dt;
        if (me.burst <= 0 && me.dive && st.phase === 'live') { me.down = 0.42; me.dive = false; st.diveMiss++; L.pop('WHIFF', me.x, me.y - 5, { size: 3.4 }); }
        if (me.burst <= 0) me.dive = false;
      }
      me.cd = Math.max(0, me.cd - dt);
      if (me.held > 0) { me.held -= dt; if (me.held <= 0 && me.heldBy) { me.heldBy.st = 'beat'; me.heldBy.t = 0.8; me.heldBy = null; me.free = 0.85; } }
      me.free = Math.max(0, (me.free || 0) - dt);
      if (!reduceMotion) { me.trail.push({ x: me.x, y: me.y, t: 0, f: me.face, on: me.burst > 0 }); }
      me.trail.forEach(p => { p.t += dt; });
      while (me.trail.length && me.trail[0].t > 0.18) me.trail.shift();
    }

    function stepCarrier(dt) {
      if (rb.st === 'idle') return;
      if (rb.st === 'tackled') return;
      if (!st.handed && st.pt >= handT) { st.handed = true; AG.sfx.step(); }
      if (rb.st === 'path') {
        const wp = path[rb.pi];
        const ramp = Math.min(1, 0.72 + st.pt * 1.8);
        const spd = cs * (play === 'draw' && st.pt < 0.7 ? 0.25 : ramp) * (rb.pi === 0 ? 0.85 : 1);
        moveToward(rb, wp[0], wp[1], spd, 80, dt);
        if (Math.hypot(rb.x - wp[0], rb.y - wp[1]) < 2.2) rb.pi++;
        if (rb.pi >= path.length - 1 || rb.y > LOS + 1) rb.st = 'open';
        // see the hole close? bounce it (a little smart at high difficulty)
        if (rb.pi >= 1 && rb.y < LOS && effD >= 3.2 && !rb.bounced && Math.abs(me.x - rb.x) < 5 && me.y < LOS + 7 && Math.hypot(me.x - rb.x, me.y - rb.y) > 5) {
          rb.bounced = true;
          if (chance(0.6)) return;
          const nx = clamp(rb.x + (rb.x >= me.x ? 6.5 : -6.5), 20, 80);
          path.splice(rb.pi, path.length - rb.pi, [nx, LOS - 0.5], [nx, LOS + 24]);
        }
        return;
      }
      // open field: downhill, away from you, away from the sidelines
      let tvx = 0, tvy = cs;
      const dx = rb.x - me.x, dy = me.y - rb.y; // dy > 0: you're in front of him
      if (dy > -2 && Math.abs(dx) < 16 && me.down <= 0) tvx = (sgn(dx) || side) * cs * 0.62 * (1 - Math.abs(dx) / 20);
      if (rb.x < 12) tvx = Math.max(tvx, 4); if (rb.x > 88) tvx = Math.min(tvx, -4);
      if (rb.jk > 0) { rb.jk -= dt; } else {
        // the one cut: if you close without a burst, he might make you miss
        const dd = Math.hypot(dx, dy);
        if (!rb.juked && dd < 7.5 && dy > 0 && me.burst <= 0 && chance(jukeChance * dt * 8)) {
          rb.juked = true; rb.jk = 0.22; rb.vx = (sgn(dx) || side) * 30; st.juked = true;
          L.pop('CUT!', rb.x, rb.y - 5, { size: 3.6 });
        }
      }
      const acc = rb.jk > 0 ? 10 : 70;
      rb.vx += clamp(tvx - rb.vx, -acc * dt, acc * dt);
      rb.vy += clamp(tvy - rb.vy, -acc * dt, acc * dt);
      rb.x = clamp(rb.x + rb.vx * dt, AG.SIDE_L + R, AG.SIDE_R - R); rb.y += rb.vy * dt;
      const sp = Math.hypot(rb.vx, rb.vy);
      if (sp > 1) rb.face = Math.atan2(rb.vx, -rb.vy);
      rb.phase += sp * dt * 0.75;
    }

    function stepHunters(dt) {
      O.forEach(h => {
        if (!h.hunter) return;
        if (h.st === 'hunt') {
          h.t -= dt; if (h.t > 0) return;
          // get between you and the ball
          const tx = lerp(me.x, rb.x, 0.28), ty = lerp(me.y, rb.y, 0.28);
          moveToward(h, tx, ty, h.spd * (st.through ? 0.5 : 1), 60, dt);
          if (me.down <= 0 && me.held <= 0 && !(me.free > 0) && Math.hypot(h.x - me.x, h.y - me.y) < R * 2.05 && me.burst <= 0.12) {
            h.st = 'block'; me.held = 0.8 * holdK * rand(0.75, 1.25) * (st.stuck ? 0.6 : 1); me.heldBy = h; st.stuck++; // a second blocker gets less of you
            L.ring((h.x + me.x) / 2, (h.y + me.y) / 2, 'rgba(255,255,255,.8)');
            AG.sfx.thud();
          } else if (me.burst > 0.12 && Math.hypot(h.x - me.x, h.y - me.y) < R * 2.05) {
            // you burst right through him
            h.st = 'beat'; h.t = 0.9; h.vx = (h.x - me.x) * 3; h.vy = (h.y - me.y) * 3; st.shed++;
            L.pop('BLOWN UP!', h.x, h.y - 5, { color: v.colors.led, size: 3.6 });
            AG.sfx.pop();
          }
        } else if (h.st === 'block') {
          // locked on you
          const ang = Math.atan2(me.x - h.x, -(me.y - h.y));
          h.x = me.x - Math.sin(ang) * R * 1.9; h.y = me.y + Math.cos(ang) * R * 1.9; h.face = ang;
          if (me.held <= 0) { h.st = 'beat'; h.t = 0.8; }
        } else if (h.st === 'trail') {
          moveToward(h, lerp(h.x, rb.x, 0.5), h.y + 3, 6, 30, dt);
        } else if (h.st === 'beat') {
          h.vx *= 0.9; h.vy *= 0.9; h.x += h.vx * dt; h.y += h.vy * dt;
          h.t -= dt; if (h.t <= 0) h.st = 'trail';
        }
      });
    }

    function stepMates(dt) {
      // trench battles wobble; the line slowly gets pushed by the run
      for (const p of pairs) {
        const wob = Math.sin(st.t * 8 + p.a.x) * 0.9;
        const mx = (p.a.x + p.b.x) / 2 + wob * dt, my = (p.a.y + p.b.y) / 2 + (st.handed ? 0.6 : 0.2) * dt;
        const ang = Math.atan2(p.b.x - p.a.x, -(p.b.y - p.a.y));
        p.a.x = mx - Math.sin(ang) * R * 0.95; p.a.y = my + Math.cos(ang) * R * 0.95;
        p.b.x = mx + Math.sin(ang) * R * 0.95; p.b.y = my - Math.cos(ang) * R * 0.95;
        p.a.face = ang; p.b.face = ang + Math.PI;
      }
      // a free outside linebacker / the safeties only matter once he's through (they clean up)
      T.forEach(t => {
        if (t.st === 'contain') {
          // keeps contain on his side; only joins the chase once the back is through
          if (st.through || st.pt > 7.5) { t.st = 'pursue'; t.slow = 1.2; }
          else moveToward(t, clamp(lerp(t.x, rb.x, 0.25), 12, 88), Math.max(LOS + 8, rb.y + 7), 7, 30, dt);
        }
        if (t.st === 'pursue') { moveToward(t, rb.x, rb.y + 4, 11 * (t.slow || 1), 40, dt); }
        if (t.kind === 'S') {
          if (st.through || st.pt > 7.5) { t.st = 'pursue'; t.slow = 1.4; }
          else if (st.phase === 'live') moveToward(t, lerp(t.x, rb.x, 0.3), Math.max(t.y, rb.y + 16), 6, 30, dt);
        }
      });
      // QB carries out his fake
      if (qb.st === 'qb') { if (play === 'draw' && st.pt < 0.8) moveToward(qb, 50, LOS - 11, 7, 40, dt); else moveToward(qb, 50 - side * 6, qb.y - 1, st.handed ? 5 : 2, 30, dt); }
    }

    function checkTackle() {
      if (!st.handed || st.phase !== 'live') return;
      const dd = Math.hypot(rb.x - me.x, rb.y - me.y);
      const reach = me.down > 0 ? 0 : me.held > 0 ? R * 1.55 : R * 1.85 + (me.dive ? 1.5 : me.burst > 0 ? 0.6 : 0);
      if (reach > 0 && dd < reach) return makeTackle(me.burst > 0);
      // teammates clean up once he's through
      for (const t of T) {
        if (t.st !== 'pursue') continue;
        if (Math.hypot(rb.x - t.x, rb.y - t.y) < R * 1.9) return teamTackle(t);
      }
      // he's through you
      if (!st.through && rb.y > me.y + 7 && rb.y > GOOD_Y + 4) {
        st.through = true;
        L.pop('HE’S THROUGH', rb.x, rb.y - 6, { color: '#FF8A7A', size: 3.8 });
      }
      if (rb.y >= OUR_GOAL) return scoreThem();
      if (st.pt > 9.5) return teamTackle(safeties[0]);
    }

    function makeTackle(hit) {
      st.phase = 'over'; st.pt = 0; st.over = 'me';
      // a square hit from the front stops him cold (or knocks him back); anything else, he falls forward
      const square = hit && me.y > rb.y + 1 && Math.abs(me.x - rb.x) < R * 1.6;
      st.hit = hit;
      const fwd = square ? -1.2 : Math.max(0, rb.vy) * (hit ? 0.12 : 0.2) + (me.y < rb.y ? 1 : 0);
      rb.y += fwd;
      st.gain = Math.round((rb.y - LOS) / 2);
      rb.st = 'tackled';
      const take = sc.tag === 'take' && (st.gain <= -2 || (hit && st.gain <= 1));
      if (take) {
        st.over = 'strip';
        st.ball = { x: rb.x, y: rb.y, vx: rand(-14, 14), vy: rand(4, 12), t: 0 };
        L.pop('FUMBLE!', rb.x, rb.y - 7, { color: v.colors.led, size: 5.6, display: true, life: 1.4 });
      } else if (st.gain < 0) L.pop(`LOSS OF ${-st.gain}`, rb.x, rb.y - 7, { color: v.colors.led, size: 4.6, display: true, life: 1.3 });
      else if (hit) L.pop('BIG HIT!', rb.x, rb.y - 7, { color: '#FFFFFF', size: 4.6, display: true, life: 1.3 });
      else L.pop(st.gain === 0 ? 'NO GAIN' : `TACKLE +${st.gain}`, rb.x, rb.y - 7, { color: '#FFFFFF', size: 4, life: 1.2 });
      L.ring(rb.x, rb.y, hit ? v.colors.led : '#FFFFFF');
      L.dust(rb.x, rb.y, 10);
      AG.sfx.thud(); if (hit) AG.sfx.pop();
      v.shake = hit ? 2.8 : 1.8;
      // you wrap him up
      me.vx = (rb.x - me.x) * 3; me.vy = (rb.y - me.y) * 3;
    }
    function teamTackle(t) {
      st.phase = 'over'; st.pt = 0; st.over = 'team'; st.tackler = t;
      st.gain = Math.round((rb.y - LOS) / 2);
      rb.st = 'tackled';
      L.pop(`+${st.gain}`, rb.x, rb.y - 6, { color: '#FF8A7A', size: 4.4, display: true });
      L.ring(rb.x, rb.y, 'rgba(255,255,255,.7)');
      AG.sfx.thud();
    }
    function scoreThem() {
      st.phase = 'over'; st.pt = 0; st.over = 'td';
      st.gain = Math.round((OUR_GOAL - LOS) / 2);
      L.pop('TOUCHDOWN', rb.x, rb.y - 6, { color: '#FF8A7A', size: 5.4, display: true });
    }

    function step(dt) {
      if (done) return false;
      st.t += dt; st.pt += dt;
      v.shake = Math.max(0, v.shake - dt * 8);
      if (st.phase === 'cad') {
        stepMe(dt);
        if (st.pt > 0.05 && !st.saidSet) { st.saidSet = true; L.pop('SET…', 50, LOS - 18, { size: 4, life: 0.7 }); AG.sfx.hut(); }
        if (st.pt > 0.6) { L.pop('HUT!', 50, LOS - 18, { size: 5, life: 0.6, color: v.colors.led }); snap(); }
      } else if (st.phase === 'live') {
        stepMe(dt);
        stepCarrier(dt);
        stepHunters(dt);
        stepMates(dt);
        checkTackle();
      } else if (st.phase === 'over') {
        // wrap-up animation
        if (st.over === 'me' || st.over === 'strip') {
          me.x = lerp(me.x, rb.x - Math.sin(me.face) * R, 0.25); me.y = lerp(me.y, rb.y + Math.cos(me.face) * R, 0.25);
          rb.vx *= 0.85; rb.vy *= 0.85; rb.x += rb.vx * dt; rb.y += rb.vy * dt * 0.5;
        } else {
          rb.vx *= 0.9; rb.vy *= 0.9; rb.x += rb.vx * dt; rb.y += rb.vy * dt;
          me.vx *= 0.9; me.vy *= 0.9; me.x += me.vx * dt; me.y += me.vy * dt;
        }
        if (st.ball) { const b = st.ball; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.94; b.vy *= 0.94; if (b.t > 0.55 && !b.rec) { b.rec = true; L.pop('RECOVERED!', b.x, b.y - 5, { color: v.colors.led, size: 4.2, life: 1 }); AG.sfx.roar(); } }
        if (st.pt > (st.over === 'strip' ? 1.25 : 0.95)) { finishPlay(); return false; }
      }
      L.step(dt);
      // camera: hold on the line, follow the ball if it gets past you
      const fy = Math.max(LOS, Math.max(rb.y, me.y) - 6);
      v.follow(lerp(me.x, rb.x, 0.5), fy, 0.36, dt);
      dom.cooldown(me.cd > 0 ? 1 - me.cd / cdMax : 1);
      draw();
      return true;
    }

    // ---------- drawing ----------
    function draw() {
      AG.begin(v);
      AG.drawField(v);
      AG.line(v, LOS, 'rgba(90,160,255,.95)', 'LINE');
      AG.line(v, GOOD_Y, 'rgba(255,255,255,.85)', `STOP HIM · +${sc.good}`, true);
      if (hintLevel > 0 && (st.phase === 'pre' || st.phase === 'cad' || (st.phase === 'live' && st.pt < 0.55))) {
        const fade = st.phase === 'live' ? 1 - st.pt / 0.55 : 1;
        AG.arrow(v, hintPts, 'rgba(255,255,255,.95)', hintLevel * fade * 0.8);
      }
      me.trail.forEach(p => { if (p.on) AG.guy(v, { x: p.x, y: p.y, face: p.f, team: 'us', alpha: 0.25 * (1 - p.t / 0.18) }); });
      const list = O.concat(T, [me]).sort((a, b) => a.y - b.y);
      for (const p of list) {
        if (p === me) {
          AG.guy(v, { x: me.x, y: me.y, face: me.face, team: 'us', num: S ? S.num : 54, me: true, meColor: me.held > 0 ? '#FF8A7A' : me.burst > 0 ? '#FFFFFF' : null, moving: Math.hypot(me.vx, me.vy) > 2, phase: me.phase, state: me.down > 0 ? 'down' : me.dive || (st.over === 'me' || st.over === 'strip') ? 'lunge' : me.held > 0 || me.wade ? 'block' : null });
          continue;
        }
        const team = O.includes(p) ? 'them' : 'us';
        const state = p.st === 'eng' || p.st === 'block' ? 'block' : p === rb && rb.st === 'tackled' && st.pt > 0.25 ? 'down' : null;
        AG.guy(v, { x: p.x, y: p.y, face: p.face, team, num: p.num, moving: Math.hypot(p.vx, p.vy) > 2, phase: p.phase, state, ball: p === rb && st.handed && !st.ball, me: false });
      }
      // ball before the handoff: in the QB's hands
      if (!st.handed && st.phase !== 'pre') AG.ball(v, qb.x + 1.3, qb.y + 0.8, 0, 0.4);
      if (st.phase === 'pre') AG.ball(v, ol[2].x, LOS - 0.8, 0, Math.PI / 2);
      if (st.ball) AG.ball(v, st.ball.x, st.ball.y, Math.max(0, Math.sin(st.ball.t * 9) * 3 * (1 - st.ball.t)), st.ball.t * 18);
      // carrier marker so you always know who has it
      if (st.handed && rb.st !== 'tackled') {
        const { ctx } = v.f, k = v.k;
        ctx.save(); ctx.strokeStyle = 'rgba(255,216,74,.9)'; ctx.lineWidth = Math.max(2, k * 0.45); ctx.setLineDash([k, k * 0.8]);
        ctx.beginPath(); ctx.arc(v.sx(rb.x), v.sy(rb.y), R * k * 1.55, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      AG.labels(v);
      L.draw(v);
      AG.end(v);
      const gain = st.phase === 'live' || st.phase === 'over' ? Math.round((rb.y - LOS) / 2) : 0;
      AG.hud(v, {
        yards: st.handed || st.phase === 'over' ? gain : 0, unit: 'THEIR YDS',
        yardsColor: gain <= 0 ? '#FFD84A' : gain <= sc.good ? '#FFFFFF' : '#FF8A7A',
        meter: { label: me.held > 0 ? 'SHED' : 'BURST', value: me.cd > 0 ? 1 - me.cd / cdMax : 1 },
        goal: sc.tag === 'take' ? 'HIT HIM TO FORCE A FUMBLE' : 'STOP HIM SHORT',
      });
      if (ctl.joy.on) AG.stick(v, ctl.joy);
    }

    // ---------- results ----------
    function outcome() {
      const gain = st.gain;
      if (st.over === 'strip') return 'great';
      if (st.over === 'td' || st.over === 'team') return gain <= sc.good ? 'good' : 'bad';
      return gain < 0 && sc.tag !== 'take' ? 'great' : gain <= sc.good ? 'good' : 'bad';
    }
    function story(r) {
      const gain = st.gain;
      const lead = PLAYS[play].say(pick);
      const ev = [];
      if (st.shed) ev.push(pick(['you rip past your blocker', 'you shed the block', 'you throw the blocker aside']));
      else if (st.stuck) ev.push(r === 'bad' ? pick(['a blocker gets his hands on you', 'the fullback finds you first']) : 'you fight through a block');
      if (st.diveMiss) ev.push('you lay out once and come up with a handful of turf');
      if (st.juked) ev.push('he cuts on you');
      const evTxt = ev.length ? `, ${ev.join(', ')}` : '';
      if (st.over === 'strip') return `${lead}${evTxt}, and you arrive with your helmet on the ball. It squirts loose, and when the pile clears there's a Hammerheads jersey on top. Fumble recovered!`;
      if (st.over === 'td') return `${lead}${evTxt}, and he's gone. Nobody touches him until he's standing in the end zone.`;
      if (st.over === 'team') {
        const t = st.tackler, who = t && t.name ? t.name : t && t.kind === 'S' ? 'a safety' : 'a teammate';
        return gain <= sc.good ? `${lead}${evTxt}, but your teammates swarm him after ${AG.yardsWord(gain)}.` : `${lead}${evTxt}, and he gets past you. ${AG.cap(who)} finally drags him down ${gain} yards later.`;
      }
      if (gain < 0) return st.hit ? `${lead}${evTxt}, and you bury the back in the backfield. ${AG.cap(AG.yardsWord(gain))}. The sideline feels that one.` : `${lead}${evTxt}, and you meet the back in the backfield. ${AG.cap(AG.yardsWord(gain))}.`;
      if (gain === 0) return `${lead}${evTxt}, and you stop him cold at the line. No gain.`;
      if (gain <= sc.good) return `${lead}${evTxt}, and you drop him after ${AG.yardsWord(gain)}.${st.hit ? ' He gets up slowly.' : ''}`;
      return `${lead}${evTxt}, and by the time you get there he has ${gain} yards.`;
    }
    function finishPlay() {
      if (done) return;
      const r = outcome();
      finishWith(r, story(r));
    }
    function finishWith(r, text) {
      if (done) return;
      done = true;
      cleanup();
      const gain = st.gain;
      AG.setResult(cfg.moment, { tkl: st.over === 'me' || st.over === 'strip' ? 1 : 0 });
      const label = st.over === 'strip' ? 'Fumble!' : st.over === 'td' ? 'Touchdown' : gain < 0 ? `Loss of ${-gain}` : gain === 0 ? 'No gain' : `+${gain} yards`;
      endMini(host, r, label, cfg.onDone, { text });
    }
    function cleanup() {
      if (loop) loop.stop();
      ctl.destroy();
      window.removeEventListener('resize', onResize);
    }
    function forced(r) {
      if (done) return;
      st.hit = chance(0.4);
      if (r === 'great') { if (sc.tag === 'take') { st.over = 'strip'; st.gain = ri(-1, 1); } else { st.over = 'me'; st.gain = ri(-3, -1); } }
      else if (r === 'good') { st.over = 'me'; st.gain = ri(0, sc.good); }
      else { st.over = 'team'; st.gain = ri(sc.good + 4, 24); st.tackler = safeties[0]; }
      finishWith(r, story(r));
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
  MOMENTS.LB.push(
    { type: 'pursuit', title: 'Fill the Gap', tag: 'tkl',
      setup: 'They have run the same play at you three times this drive, like they found a weakness and wrote it on a whiteboard. {coach} catches your eye from the sideline and points at the ground: *right here.*',
      prompt: 'Read the run, beat the block, make the tackle. Burst to close.',
      great: 'You read it at the snap, shoot the gap, and meet the back in the backfield.',
      good: 'You fill your gap and drop him after a short gain.',
      bad: 'A blocker gets his hands on you, and the back runs right past.' },
    { type: 'pursuit', title: 'Rip It Loose', tag: 'take',
      setup: 'Their running back carries the ball like a loaf of bread, away from his body. {coachLast} saw it on film. You saw it on film. Now go get it.',
      prompt: 'Hit him with a burst to jar the ball loose.',
      great: 'You arrive with your helmet on the ball. Fumble, and the Hammerheads come out of the pile with it!',
      good: 'You don\'t get the ball, but you stop him cold.',
      bad: 'You go for the ball instead of the man, and he spins free.' },
  );
  // The last stand when protecting a lead: a real run to stop.
  AG.setClutch('LB', 'hold', { type: 'pursuit', title: 'The Last Stand', tag: 'tkl',
    setup: 'They\'re on your 30 with the clock running down, and they\'re handing it to their best back. Everybody in the building knows it. Stop him here and the game is as good as over.',
    prompt: 'One more stop. Beat the block. Burst to close.',
    great: 'You read it, close, and drop the ball carrier in the backfield.',
    good: 'You get there and drag him down short.',
    bad: 'He slips your tackle and keeps going.' });
}
