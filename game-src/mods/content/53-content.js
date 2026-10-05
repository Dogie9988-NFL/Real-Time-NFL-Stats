// =========================================================
//   CONTENT RUNTIME (module: content)
//   Makes the bigger moment library play well:
//   - rotation: each game's plays are the ones you've seen least (per career), mixed by type, signature first,
//     and one real-time arcade play in every game with two or more snaps
//   - clutch: rotates the CLUTCH variants (and keeps arcade modules' clutch plays even if they assign a single object)
//   - red zone: a great play inside the 10 scores a touchdown, a good one ends in a field goal (text stays honest)
//   - follow-up snaps, scout team and camp scrimmage never pull a signature play out of context
//   - opponents: their scoring lines in the recap come from their trait, and a scouting card on kickoff day
//   - final drive: follow-up snaps and two-point tries use moments written for them (fu)
//   - stat line: a QB is charged with an interception exactly when the text says "Intercepted"
//   State: ext('content') = { seen: { 'type:title': count }, last: [moment indexes of the last game] }
// =========================================================
(() => {
  const ST = () => ext('content', () => ({ seen: {}, last: [] }));
  const keyOf = m => (m ? `${m.type}:${m.title}` : '');
  const seenOf = m => { const s = ST().seen || {}; return s[keyOf(m)] || 0; };
  function markSeen(m) {
    if (!S || !m) return;
    const st = ST();
    if (!st.seen) st.seen = {};
    const k = keyOf(m);
    st.seen[k] = (st.seen[k] || 0) + 1;
  }
  const ARCADE = ['throw', 'catch', 'run', 'pursuit'];
  // A moment that only makes sense in its own game (signature, story-gated, tied to a year, or a final-drive snap).
  const special = m => !!(m && (m.vs || m.when || m.year || m.fu));
  const lib = () => MOMENTS[S.pos] || [];
  // Plays that are safe anywhere: practice, scrimmage, follow-up snaps.
  function anywherePool() {
    const L = lib();
    return L.map((_, i) => i).filter(i => L[i] && !special(L[i]));
  }
  // Lowest score wins; ties are broken randomly.
  function lowest(items, score) {
    let best = null, bs = Infinity;
    for (const it of items) { const s = score(it) + Math.random() * 0.9; if (s < bs) { bs = s; best = it; } }
    return best;
  }

  // ---------- Game plan: least-seen plays, varied types, signature play first ----------
  on('gameStart', g => {
    try {
      if (!S || !g || !Array.isArray(g.plan) || !g.plan.length) return;
      const L = lib(), opp = oppOf(g.n), st = ST();
      const recent = Array.isArray(st.last) ? st.last : [];
      const ok = L.map((_, i) => i).filter(i => L[i] && momentAllowed(L[i], opp));
      const sig = ok.filter(i => L[i].vs);
      const rest = ok.filter(i => !L[i].vs);
      const chosen = [];
      if (sig.length) chosen.push(lowest(sig, i => -(L[i].pri || 0) * 100 + seenOf(L[i]) * 10));
      // Every game with two or more snaps gets one real-time arcade play (there are only a few per position, so
      // the plain rotation would show one every third or fourth game).
      const arc = rest.filter(i => ARCADE.includes(L[i].type));
      if (arc.length && g.plan.length >= 2 && chosen.length < g.plan.length) chosen.push(lowest(arc, i => seenOf(L[i]) * 10 + (recent.includes(i) ? 6 : 0)));
      while (chosen.length < g.plan.length) {
        const cand = rest.filter(i => !chosen.includes(i));
        if (!cand.length) break;
        const types = chosen.map(i => L[i].type);
        const reds = chosen.filter(i => L[i].zone === 'red').length;
        chosen.push(lowest(cand, i => seenOf(L[i]) * 10 + (recent.includes(i) ? 6 : 0) + (types.includes(L[i].type) ? 4 : 0) + (L[i].zone === 'red' && reds ? 5 : 0)));
      }
      // The signature play stays first; the others (arcade play included) land in a random quarter.
      for (let k = chosen.length - 1, lo = sig.length ? 1 : 0; k > lo; k--) { const j = lo + Math.floor(Math.random() * (k - lo + 1)); [chosen[k], chosen[j]] = [chosen[j], chosen[k]]; }
      g.plan.forEach((p, k) => { if (chosen[k] != null) p.m = chosen[k]; });
      g.plan.forEach(p => markSeen(L[p.m]));
      S.recentMoments = g.plan.map(p => p.m);
      st.last = S.recentMoments.slice();
    } catch (e) { console.error(e); }
  });

  // ---------- Follow-up snaps in the final minutes ----------
  // Each position has final-drive snaps written for exactly this spot (fu: 'chase' after "Still alive",
  // 'hold' after "Not over yet" / "One more stop", 'two' for the two-point try), so the text always fits.
  if (typeof pickFollowup === 'function') {
    const orig = pickFollowup;
    pickFollowup = function (twoPt) {
      try {
        const g = S.game, L = lib(), opp = oppOf(g.n), used = (g.plan || []).map(p => p.m), cur = clutchMoment(g);
        const cl = g.cl || {}, kind = twoPt ? 'two' : ((cl.d0 != null ? cl.d0 : g.us - g.them) <= 0 ? 'chase' : 'hold');
        const fit = L.map((_, i) => i).filter(i => L[i] && L[i].fu === kind && (!cur || L[i].type !== cur.type));
        if (fit.length) {
          const i = lowest(fit, j => seenOf(L[j]) * 10);
          markSeen(L[i]);
          return i;
        }
        // Red-zone plays carry field-position text ("first and goal at the 8") and are left out of the final drive.
        let idx = anywherePool().filter(i => L[i].zone !== 'red' && momentAllowed(L[i], opp) && !used.includes(i) && (!cur || L[i].type !== cur.type));
        if (twoPt) { const quick = idx.filter(i => ['read', 'timing', 'reaction', 'throw', 'catch'].includes(L[i].type)); if (quick.length) idx = quick; }
        if (!idx.length) return orig.apply(this, arguments);
        const i = lowest(idx, j => seenOf(L[j]) * 10);
        markSeen(L[i]);
        return i;
      } catch (e) { console.error(e); return orig.apply(this, arguments); }
    };
  }

  // ---------- Clutch variants ----------
  // Remember this module's variant lists now; arcade modules may later replace CLUTCH[pos][kind] with one object.
  const MINE = {};
  for (const p in CLUTCH) { MINE[p] = {}; for (const k of ['chase', 'hold']) MINE[p][k] = [].concat(CLUTCH[p][k] || []); }
  function clutchList(pos, kind) {
    const out = [];
    const add = m => { if (m && typeof m === 'object' && m.type && !out.includes(m)) out.push(m); };
    [].concat((CLUTCH[pos] && CLUTCH[pos][kind]) || []).forEach(add);
    ((MINE[pos] && MINE[pos][kind]) || []).forEach(add);
    return out;
  }
  if (typeof clutchMoment === 'function') {
    const orig = clutchMoment;
    clutchMoment = function (g) {
      try {
        const cl = g && g.cl;
        if (!S || !cl || (cl.snap >= 1 && cl.m2 != null && lib()[cl.m2])) return orig.apply(this, arguments);
        const kind = (cl.d0 != null ? cl.d0 : g.us - g.them) <= 0 ? 'chase' : 'hold';
        const all = clutchList(S.pos, kind), opp = oppOf(g.n);
        const allowed = all.filter(m => momentAllowed(m, opp));
        const list = allowed.length ? allowed : all;
        if (!list.length) return orig.apply(this, arguments);
        let m = cl.ck ? list.find(x => keyOf(x) === cl.ck) : null;
        if (!m) {
          // Least-seen first. Real-time arcade finishes count half, so they come up about twice as often.
          m = lowest(list, x => seenOf(x) * (ARCADE.includes(x.type) ? 5 : 10) - (x.vs ? 15 : 0));
          cl.ck = keyOf(m);
          markSeen(m);
          // go() saved before this page rendered; save again so a reload brings back the same play.
          save();
        }
        return m;
      } catch (e) { console.error(e); return orig.apply(this, arguments); }
    };
  }

  // ---------- Red zone: keep the scoreboard honest about what the text said ----------
  const RED_FG = [
    'The drive stalls inside the 5. Augie Szczepanski knocks through the chip shot.',
    'Two more shots at the end zone come up empty. Augie Szczepanski settles for three.',
    'Bramble thinks about going for it on fourth down, then sends out Augie Szczepanski. Field goal is good.',
  ];
  const GL_STOP = ['**Turnover on downs!** The crowd is so loud the press box windows rattle.', '**Turnover on downs!** The whole defense sprints off the field together.'];
  const GL_STOP_FG = ['**Turnover on downs!** The offense starts at its own 1, marches the length of the field, and Augie Szczepanski finishes it with a field goal.'];
  const GL_GOOD = [
    'They go for it on fourth down, and Ronnie Batiste knocks the pass down in the end zone. **Turnover on downs.**',
    'They run the same play again on fourth down, and the whole defense meets them there. **Turnover on downs.**',
  ];
  if (typeof playResult === 'function') {
    const orig = playResult;
    playResult = function (r, m) {
      const g = S && S.game, before = g ? g.us : 0;
      const res = orig.apply(this, arguments);
      try {
        if (!g || !res || !m || m.zone !== 'red') return res;
        if (S.pos !== 'LB') {
          if (r === 'great' && !res.td) {
            g.us += 7 - (g.us - before);
            res.td = true;
            res.note = '**Touchdown, Hammerheads!**';
            addLine({ td: 1 });
            fx({ fame: 2 }, true);
            award('six');
          } else if (r === 'good') {
            if (g.us === before) g.us += 3;
            res.note = pick(RED_FG);
          }
        } else if (r === 'great' && !res.td) res.note = pick(g.us > before ? GL_STOP_FG : GL_STOP);
        else if (r === 'good') res.note = pick(GL_GOOD);
      } catch (e) { console.error(e); }
      return res;
    };
  }

  // ---------- Stat line matches the words ----------
  // The engine guesses interceptions (half of all bad QB reads, never in the clutch). Here a QB is charged with an
  // interception exactly when the result text says so. Moments marked noStat (a punt return, a linebacker at
  // fullback) add nothing to your position's stat line.
  let said = null; // { m, text } for the play being resolved
  const saysInt = t => /intercept|picked off/i.test(String(t || ''));
  function sayWrap(orig, momentOf) {
    return function (r, x) {
      try { const m = momentOf(); said = m ? { m, text: x && x.text ? x.text : textFor(m, r) } : null; } catch (e) { said = null; }
      try { return orig.apply(this, arguments); } finally { said = null; }
    };
  }
  if (typeof momentDone === 'function') momentDone = sayWrap(momentDone, () => { const g = S.game; return lib()[g.plan[g.mi].m]; });
  if (typeof clutchDone === 'function') clutchDone = sayWrap(clutchDone, () => (S.game && S.game.cl ? clutchMoment(S.game) : null));
  if (typeof statsFor === 'function') {
    const orig = statsFor;
    statsFor = function (r, td, m) {
      const g = S && S.game;
      if (!g || !m) return orig.apply(this, arguments);
      const before = Object.assign({}, g.line), sBefore = Object.assign({}, S.line);
      const out = orig.apply(this, arguments);
      try {
        if (m.noStat) {
          for (const k of new Set(Object.keys(g.line).concat(Object.keys(before)))) g.line[k] = before[k] || 0;
          for (const k of new Set(Object.keys(S.line).concat(Object.keys(sBefore)))) S.line[k] = sBefore[k] || 0;
        } else if (S.pos === 'QB' && !ARCADE.includes(m.type) && said && said.m === m) {
          const want = r === 'bad' && saysInt(said.text) ? 1 : 0;
          const delta = want - ((g.line.int || 0) - (before.int || 0));
          if (delta) { g.line.int = (g.line.int || 0) + delta; S.line.int = (S.line.int || 0) + delta; }
        }
      } catch (e) { console.error(e); }
      return out;
    };
  }

  // ---------- Opponent flavor in the recap ----------
  if (typeof simQuarter === 'function') {
    const orig = simQuarter;
    simQuarter = function (q) {
      const g = S && S.game;
      const before = g ? g.them : 0, len = g ? g.recap.length : 0;
      const out = orig.apply(this, arguments);
      try {
        if (!g) return out;
        const add = g.them - before, t = oppTrait(g.n);
        const lines = add === 7 ? t.td : add === 3 ? t.fg : null;
        if (lines && lines.length && g.recap.length > len && chance(0.55)) g.recap[g.recap.length - 1] = `Q${q}: ${pick(lines)}`;
      } catch (e) { console.error(e); }
      return out;
    };
  }
  if (typeof TEAM_TD !== 'undefined') TEAM_TD.push(
    'Walt Okonjo catches a seam route, breaks one tackle, and drags a safety the last eight yards. Touchdown, Hammerheads.',
    'Shay Mercado reverses field on a punt return and goes 64 yards. Augie Szczepanski is somehow the first one to reach him.',
  );
  if (typeof TEAM_FG !== 'undefined') TEAM_FG.push('Augie Szczepanski hits from 49 into the wind and jogs off like he was never worried. He was worried.');

  // ---------- Scout team and camp scrimmage: ordinary plays only, least-seen ----------
  on('newCareer', s => {
    try {
      if (!s || !s.flags) return;
      const pool = anywherePool();
      if (pool.length < 2) return;
      const a = lowest(pool, () => 0);
      const b = lowest(pool.filter(i => i !== a), i => (lib()[i].type === lib()[a].type ? 5 : 0));
      s.flags.scrim = [a, b];
      markSeen(lib()[a]); markSeen(lib()[b]);
    } catch (e) { console.error(e); }
  });
  on('weekStart', () => {
    try {
      if (!S || !Array.isArray(S.queue)) return;
      for (const item of S.queue) {
        if (!item || item.id !== 'scout_team' || !item.args) continue;
        const pool = anywherePool();
        if (!pool.length) return;
        item.args.m = lowest(pool, i => seenOf(lib()[i]) * 10);
        markSeen(lib()[item.args.m]);
      }
    } catch (e) { console.error(e); }
  });
  // Year two's practice scrimmages (mods/year2) pick from the whole list; keep them on ordinary plays too.
  // P.y2p_scrim / P.y2_rival_rep are defined by a later file, so catch them when they are assigned.
  function guardY2(fn, key, other) {
    if (typeof fn !== 'function' || fn.__ctGuard) return fn;
    const w = function () {
      try {
        const y = S && S.ext && S.ext.year2, L = lib();
        if (y && (y[key] == null || !L[y[key]] || special(L[y[key]]))) {
          const pool = anywherePool().filter(i => i !== y[other]);
          if (pool.length) { y[key] = lowest(pool, i => seenOf(L[i]) * 10); markSeen(L[y[key]]); save(); }
        }
      } catch (e) { console.error(e); }
      return fn.apply(this, arguments);
    };
    w.__ctGuard = true;
    return w;
  }
  for (const [id, key, other] of [['y2p_scrim', 'scrimM', 'rivalM'], ['y2_rival_rep', 'rivalM', 'scrimM']]) {
    try {
      let fn = guardY2(P[id], key, other);
      Object.defineProperty(P, id, { configurable: true, enumerable: true, get: () => fn, set: v => { fn = guardY2(v, key, other); } });
    } catch (e) { console.error(e); }
  }

  // A saved index that points at a signature play (or nothing) is moved to an ordinary one, the same one every time.
  function safeIndex(i) {
    const L = lib();
    if (L[i] && !special(L[i])) return i;
    const pool = anywherePool();
    return pool.length ? pool[Math.abs(+i || 0) % pool.length] : 0;
  }
  if (P.scout_team) {
    const orig = P.scout_team;
    P.scout_team = function (a) { return orig.call(this, Object.assign({}, a, { m: safeIndex(a && a.m) })); };
  }
  if (P.camp_scrim) {
    const orig = P.camp_scrim;
    P.camp_scrim = function (a) {
      if (S && S.flags && Array.isArray(S.flags.scrim)) S.flags.scrim = S.flags.scrim.map(safeIndex);
      return orig.apply(this, arguments);
    };
  }

  // ---------- Kickoff: scouting card, and a tag on signature plays ----------
  function scoutChips(t) {
    const c = [];
    if (t.diff > 0) c.push(['Tougher plays', 'down']);
    if (t.diff < 0) c.push(['Easier plays', 'up']);
    if (t.energy > 0) c.push([`+${t.energy} Energy cost`, 'down']);
    if (t.energy < 0) c.push([`${t.energy} Energy cost`, 'up']);
    if (t.fakes > 0) c.push([t.fakes > 1 ? `+${t.fakes} fake counts` : '+1 fake count', 'down']);
    return c;
  }
  function scoutHTML(t, team) {
    // On the practice squad you watch from the sideline, so the game's effects don't apply to you.
    const chips = S.role === 'practice' ? '' : scoutChips(t).map(c => `<span class="fxc ${c[1]}">${esc(c[0])}</span>`).join('');
    // The position coach gives the tip: Okafor, or her replacement in Year Two if she took the Ridgeline job.
    let who = 'Okafor';
    try { if (typeof coach === 'function') who = coach().last || who; } catch (e) { /* keep Okafor */ }
    const tip = t.tip ? `<span class="ct-tip"><b>${esc(who)}:</b> ${fmt(t.tip)}</span>` : '';
    let col = '';
    try { if (typeof teamStyle === 'function') { const c1 = String(teamStyle(team).c1 || ''); if (/^(#[0-9a-f]{3,8}|hsl\([\d. %]+\))$/i.test(c1)) col = ` style="--c-them:${c1}"`; } } catch (e) { /* no team colors */ }
    return `<div class="ct-scout"${col} role="note" aria-label="Scouting report"><span class="ct-lbl">Scouting report</span><span class="ct-name">${fmt(t.name)}</span>${chips ? `<span class="ct-chips">${chips}</span>` : ''}${tip}</div>`;
  }
  on('page', (pg, el, id) => {
    try {
      if (!S || !el) return;
      if (id === 'game_pre') {
        const t = oppTrait(S.slate);
        if (!t || !t.name || el.querySelector('.ct-scout')) return;
        const anchor = el.querySelector('.matchup') || el.querySelector('.title');
        if (anchor) anchor.insertAdjacentHTML('afterend', scoutHTML(t, oppOf(S.slate).team));
      } else if (id === 'g_moment' && S.game) {
        const p = S.game.plan[S.game.mi], m = p && lib()[p.m];
        if (!m || !m.vs || el.querySelector('.ct-sig')) return;
        const tag = m.when ? 'A promise to keep' : `Only against the ${shortName(oppOf(S.game.n).team)}`;
        const title = el.querySelector('.title');
        if (title) title.insertAdjacentHTML('afterend', `<div class="ct-sig">${esc(tag)}</div>`);
      }
    } catch (e) { console.error(e); }
  });
})();
