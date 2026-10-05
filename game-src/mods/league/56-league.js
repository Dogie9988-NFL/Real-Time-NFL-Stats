
// =========================================================
//   LEAGUE — standings, around-the-league headlines, Rookie of the Year race
// =========================================================
// Everything lives inside one closure so nothing collides with other modules. Per-career state is
// S.ext.league = { v, seasons: { [year]: season } }, and every piece of it is rebuilt from S when missing,
// so old saves, debug jumps and reloads all land somewhere sensible.
TROPHIES.push(['roy', 'Rookie of the Year', 'Win Rookie of the Year.']);

const League = (() => {
  // ---------- The conference ----------
  // c1/c2 are team colors. They are only ever drawn on the fixed dark board surface.
  const TEAMS = [
    { id: 'HAM', name: 'Harbor City Hammerheads', nick: 'Hammerheads', abbr: 'HAM', base: 52, c1: '#FF7A2E', c2: '#1B3A5C', coach: 'Bramble' },
    { id: 'CAP', name: 'Capital Monarchs', nick: 'Monarchs', abbr: 'CAP', base: 70, c1: '#9B7BFF', c2: '#F2C14E', coach: 'Vic Harrow' },
    { id: 'LAK', name: 'Lakeshore Gulls', nick: 'Gulls', abbr: 'LAK', base: 46, c1: '#2EC4B6', c2: '#E9EEE7', coach: 'Pete Lindgren' },
    { id: 'STV', name: 'Steel Valley Smelters', nick: 'Smelters', abbr: 'STV', base: 50, c1: '#FFD23F', c2: '#2B2B2B', coach: 'Gus Mrozek' },
    { id: 'NFK', name: 'Northfork Lumberjacks', nick: 'Lumberjacks', abbr: 'NFK', base: 55, c1: '#E0413A', c2: '#1F5135', coach: 'Hank Thibodeaux' },
    { id: 'GCH', name: 'Gulf Coast Hurricanes', nick: 'Hurricanes', abbr: 'GCH', base: 58, c1: '#4CC9F0', c2: '#D7263D', coach: 'Ricky Salas' },
    { id: 'PRB', name: 'Prairie Bison', nick: 'Bison', abbr: 'PRB', base: 49, c1: '#C98B4A', c2: '#F3E2B3', coach: 'Dale Amundsen' },
    { id: 'NEO', name: 'Neon City Jackpots', nick: 'Jackpots', abbr: 'NEO', base: 61, c1: '#F15BB5', c2: '#FFD23F', coach: 'Lance Duvall' },
  ];
  // The engine's team identity (src/48-teams.js) is the source of truth for colors and abbreviations,
  // so the table, the ticker and the matchup helmets always agree.
  if (typeof teamStyle === 'function') TEAMS.forEach(t => { const st = teamStyle(t.name); if (st) { t.abbr = st.abbr || t.abbr; t.c1 = st.c1 || t.c1; t.c2 = st.c2 || t.c2; } });
  const T = {};
  TEAMS.forEach(t => { T[t.id] = t; });
  const byName = name => TEAMS.find(t => t.name === name || t.nick === name) || null;
  // Teams from the other conference, used when the odd team out plays outside the conference.
  const NONCONF = ['Desert Vipers', 'Frontier Mustangs', 'Redwood Grizzlies', 'Empire Sentinels', 'Tundra Huskies', 'Canyon Coyotes', 'Bayou Crawdads', 'Sierra Condors'];
  const PLAYOFF_WINS = 6;      // the game's rule: 6+ wins, or 5 wins with Chemistry 55+
  const TIEBREAK_CHEM = 55;
  const GAMES = 10;
  const BRYCE_SCHOOL = 'Southern Pines'; // matches the year2 module's draft card
  const UI_KEY = 'undrafted.league.ui.v1';

  // ---------- Rookie of the Year field ----------
  const POSNAME = { QB: 'quarterback', RB: 'running back', WR: 'receiver', LB: 'linebacker', DE: 'defensive end', CB: 'cornerback', K: 'kicker' };
  const ROOKIES = [
    { id: 'pike', name: 'Coltrane Pike', pos: 'QB', team: 'NEO', big: 'throws for 402 yards and four touchdowns, then signs a fan\'s forehead on the way to the tunnel' },
    { id: 'hatch', name: 'Dorian Hatch', pos: 'RB', team: 'PRB', big: 'runs for 211 yards and hurdles a safety. The safety has asked for a rematch' },
    { id: 'lavallee', name: 'Zeke Lavallee', pos: 'WR', team: 'GCH', big: 'catches 12 balls for 198 yards. One of them he caught with his facemask' },
    { id: 'boone', name: 'Ulysses Boone', pos: 'LB', team: 'NFK', big: 'makes 17 tackles. Three of them were the same guy on the same play' },
    { id: 'asante', name: 'Kofi Asante-Ward', pos: 'DE', team: 'CAP', big: 'has three sacks. Dante Kingsley calls him "my little prince" on the podcast. He hates it' },
    { id: 'dufresne', name: 'Remy Dufresne', pos: 'CB', team: 'LAK', big: 'picks off two passes and returns one 99 yards, then lies down in the end zone for a while' },
    { id: 'gunderson', name: 'Pell Gunderson', pos: 'K', team: 'STV', big: 'kicks a 63-yard field goal, then a 61-yarder to make sure everyone saw the first one' },
  ];
  const RK = {};
  ROOKIES.forEach(r => { RK[r.id] = r; });
  const TIERS = [7.7, 6.9, 6.2, 5.3]; // weekly ballot points: favorite, contender, dark horse, long shot

  // ---------- Small helpers ----------
  const nth = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const wordNum = n => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);
  const yearOf = () => (S && S.year) || 1;
  const nickOf = id => (T[id] ? T[id].nick : shortName(String(id).replace(/^X:/, '')));
  const isConf = id => !!T[id];
  const posName = () => POSNAME[S.pos] || 'player';
  const sideOf = () => (S.pos === 'LB' ? 'Defensive' : 'Offensive');
  const fill = (s, map) => s.replace(/\{(\w+)\}/g, (m, k) => (map[k] != null ? map[k] : m));
  // Pick a template this season hasn't used yet, so the same joke doesn't run twice in one year.
  function fresh(sea, pool) {
    const used = sea.used || (sea.used = {});
    let left = pool.filter(t => !used[t]);
    if (!left.length) { pool.forEach(t => { delete used[t]; }); left = pool.slice(); }
    const t = pick(left);
    used[t] = 1;
    return t;
  }

  // League state is often created while a page renders (a new season's ratings, a week's headlines, playoff
  // scores), after go() has already saved. Anything random that gets stored marks the career dirty, and the
  // page hook saves once rendering is done, so a reload shows the same scores instead of rolling new ones.
  let dirty = false;
  const touch = () => { dirty = true; };
  function persist() { if (dirty && S) { dirty = false; save(); } }

  function root() {
    const L = ext('league', () => ({ v: 1, seasons: {} }));
    if (!L.seasons) L.seasons = {};
    return L;
  }
  function uiPrefs() { const p = store.get(UI_KEY, null); return p && typeof p === 'object' ? p : {}; }
  function setUiPrefs(o) { store.set(UI_KEY, Object.assign(uiPrefs(), o)); }

  // Ratings for a season come from the schedule (average of every appearance), else a drifted base value.
  function ratingFor(team, year) {
    const sch = (SCHEDULE_Y && SCHEDULE_Y[year]) ? scheduleFor(year) : SCHEDULE;
    const rs = sch.filter(o => o && (o.team === team.name || o.team === team.nick)).map(o => o.r);
    if (rs.length) return rs.reduce((a, b) => a + b, 0) / rs.length;
    return team.base + (year > 1 ? ri(-4, 4) : 0);
  }
  function hamOppId(n, year) {
    const sch = scheduleFor(year);
    const o = sch[n];
    if (!o) return null;
    const t = byName(o.team);
    return t && t.id !== 'HAM' ? t.id : 'X:' + o.team;
  }

  // ---------- Season setup ----------
  function newSeason(year) {
    const sea = { year, teams: {}, sched: [], res: {}, done: {}, ham: {}, news: {}, hot: {}, inj: {}, potw: [], roy: null };
    TEAMS.forEach(t => {
      if (t.id === 'HAM') return;
      sea.teams[t.id] = { r: Math.round(ratingFor(t, year) + rand(-2.5, 2.5)), w: 0, l: 0, pf: 0, pa: 0, form: [] };
    });
    // Pair up the other seven teams for each week, avoiding repeat matchups where possible.
    const met = {};
    const key = (a, b) => [a, b].sort().join('-');
    const nc = shuffle(NONCONF);
    let nci = 0;
    for (let n = 0; n < GAMES; n++) {
      const busy = hamOppId(n, year);
      let pool = shuffle(Object.keys(sea.teams).filter(id => id !== busy));
      const week = [];
      while (pool.length >= 2) {
        const a = pool.shift();
        let best = null, bestN = 99;
        for (const b of shuffle(pool)) { const m = met[key(a, b)] || 0; if (m < bestN) { best = b; bestN = m; } }
        pool = pool.filter(x => x !== best);
        met[key(a, best)] = bestN + 1;
        week.push([a, best]);
      }
      if (pool.length) week.push([pool[0], 'X:' + nc[nci++ % nc.length]]);
      sea.sched.push(week);
    }
    if (year === 1) {
      sea.roy = newRoy();
      // Three college headlines about Bryce Calloway: early, middle and late in the season.
      sea.bryce = [ri(1, 3), ri(4, 6), ri(7, 9)];
    }
    sea.news[0] = preseasonNews(sea);
    return sea;
  }
  function newRoy() {
    const mine = S.pos;
    const field = shuffle(ROOKIES.filter(r => r.pos !== mine && r.pos !== 'K'));
    const picks = field.slice(0, chance(0.45) ? 3 : 4);
    if (picks.length < 4) picks.push(ROOKIES.find(r => r.id === 'gunderson'));
    // The kicker is always the long shot; everyone else gets a random tier.
    const tiers = {};
    const order = shuffle(picks.filter(r => r.pos !== 'K'));
    order.forEach((r, i) => { tiers[r.id] = TIERS[i]; });
    picks.forEach(r => { if (r.pos === 'K') tiers[r.id] = TIERS[3]; });
    if (order.length === 4) tiers[order[3].id] = TIERS[3];
    // Preseason hype: the drafted rookies start with a head start. You start with nothing.
    const pts = {}, pre = {};
    picks.forEach(r => { pts[r.id] = []; pre[r.id] = Math.round(tiers[r.id] * 0.9 * 10) / 10; });
    return { ids: picks.map(r => r.id), tier: tiers, pre, pts, you: [], out: {}, mv: {}, rankHist: [], events: {}, final: null, shown: false, awarded: false, led: false };
  }
  function season(year) {
    if (!S) return null;
    const y = year || yearOf();
    const L = root();
    if (!L.seasons[y]) { L.seasons[y] = newSeason(y); touch(); }
    const sea = L.seasons[y];
    if (y === 1 && !sea.roy) { sea.roy = newRoy(); touch(); }
    return sea;
  }

  // ---------- Simulating the rest of the league ----------
  const LOSER_PTS = [0, 3, 3, 6, 7, 7, 10, 10, 10, 13, 13, 14, 14, 16, 17, 17, 17, 20, 20, 21, 21, 23, 24, 24, 27, 28];
  function scoreLine(gap) {
    // gap: how lopsided this one was expected to be (0 = coin flip, ~25 = mismatch)
    const blow = chance(clamp(0.06 + gap * 0.012, 0.06, 0.35));
    const close = !blow && chance(0.38);
    let lo = pick(LOSER_PTS);
    const m = blow ? pick([17, 20, 21, 24, 27, 28, 31]) : close ? pick([1, 2, 3, 3, 3, 4, 4]) : pick([5, 6, 7, 7, 7, 8, 10, 10, 11, 13, 14]);
    if (lo === 0 && m < 6) lo = 3;
    if (lo === 0 && blow) lo = 0;
    if (lo + m > 45) lo = Math.max(0, 45 - m);
    let hi = lo + m;
    if (hi === 1 || hi === 2) hi = 3;
    if (hi === 4 || hi === 5) hi = 6;
    return [hi, lo];
  }
  function winsNeededGuard(sea, id, n) {
    // Teams that appear in this season's playoff bracket must actually make the playoffs.
    const po = playoffsFor(sea.year) || [];
    if (!po.some(o => { const t = byName(o.team); return t && t.id === id; })) return false;
    const t = sea.teams[id];
    let left = 0;
    for (let k = n; k < GAMES; k++) if ((sea.sched[k] || []).some(p => p[0] === id || p[1] === id)) left++;
    return PLAYOFF_WINS - t.w >= left && t.w < PLAYOFF_WINS;
  }
  function rateOf(sea, id) {
    if (isConf(id) && sea.teams[id]) return sea.teams[id].r;
    const nm = String(id).replace(/^X:/, '');
    const o = scheduleFor(sea.year).concat(playoffsFor(sea.year) || []).find(x => x.team === nm);
    return o ? o.r - 2 : 53;
  }
  function recordGame(sea, n, a, b, as, bs, tag) {
    const add = (id, f, ag) => {
      const t = sea.teams[id];
      if (!t) return;
      t.pf += f; t.pa += ag;
      if (f > ag) t.w++; else t.l++;
      t.form.push(f > ag ? 'W' : 'L');
    };
    add(a, as, bs); add(b, bs, as);
    (sea.res[n] = sea.res[n] || []).push({ a, b, as, bs, tag: tag || '' });
  }
  function simGame(sea, n, a, b) {
    const ra = rateOf(sea, a), rb = rateOf(sea, b);
    const home = n % 2 ? 1.5 : -1.5;
    let p = 1 / (1 + Math.exp(-(ra - rb + home) / 10));
    p = clamp(p, 0.16, 0.84); // any given Sunday
    let aWins = chance(p);
    if (winsNeededGuard(sea, a, n)) aWins = true;
    else if (winsNeededGuard(sea, b, n)) aWins = false;
    const [hi, lo] = scoreLine(Math.abs(ra - rb));
    const upset = aWins ? ra < rb - 5 : rb < ra - 5;
    recordGame(sea, n, a, b, aWins ? hi : lo, aWins ? lo : hi, upset ? 'upset' : '');
  }
  // What the Hammerheads did in week n of this season (from the live game, or the history on old saves).
  function hamResult(sea, n) {
    if (sea.ham[n]) return sea.ham[n];
    if (sea.year !== yearOf()) return null;
    const h = (S.hist || []).filter(x => x.n === n).pop();
    if (!h) return null;
    sea.ham[n] = { us: h.us, them: h.them, won: !!h.won };
    return sea.ham[n];
  }
  function simWeek(sea, n) {
    if (sea.done[n] || n >= GAMES) return;
    // The ladder the player saw before this week: the last week hub's snapshot (fame can move the ladder
    // between the hub and the final whistle), or else the ladder without your week-n points (gameEnd has
    // already recorded them; the rivals' week-n points don't exist yet).
    const seen = sea.roy && sea.roy.seen;
    const before = seen && seen.n === n ? seen.r : royRanks(sea, n);
    for (const [a, b] of sea.sched[n] || []) simGame(sea, n, a, b);
    // The Hammerheads' opponent gets the real result.
    const opp = hamOppId(n, sea.year), hr = hamResult(sea, n);
    if (hr && opp && isConf(opp) && sea.teams[opp]) {
      const t = sea.teams[opp];
      t.pf += hr.them; t.pa += hr.us;
      if (hr.won) t.l++; else t.w++;
      t.form.push(hr.won ? 'L' : 'W');
    }
    if (sea.roy) royWeek(sea, n, before);
    sea.done[n] = true;
    touch();
    sea.news[n + 1] = weekNews(sea, n);
    if (n === GAMES - 1 && sea.roy && !sea.roy.final) royFinalize(sea);
  }
  // Catch the league up to `upTo` completed weeks. Safe to call any time; it never re-simulates a week.
  function sync(upTo) {
    const sea = season();
    if (!sea) return null;
    const lim = Math.min(GAMES, upTo == null ? Math.min(S.slate || 0, GAMES) : upTo);
    for (let n = 0; n < lim; n++) if (!sea.done[n]) simWeek(sea, n);
    return sea;
  }

  // ---------- Standings ----------
  function hamRow(sea) {
    let pf = 0, pa = 0;
    const form = [];
    for (let n = 0; n < GAMES; n++) {
      const h = sea.ham[n] || (sea.done[n] ? hamResult(sea, n) : null);
      if (!h) continue;
      pf += h.us; pa += h.them; form.push(h.won ? 'W' : 'L');
    }
    const cur = sea.year === yearOf();
    return { id: 'HAM', w: cur ? S.record.w : form.filter(x => x === 'W').length, l: cur ? S.record.l : form.filter(x => x === 'L').length, pf, pa, form };
  }
  function streak(form) {
    if (!form.length) return '–';
    const last = form[form.length - 1];
    let k = 0;
    for (let i = form.length - 1; i >= 0 && form[i] === last; i--) k++;
    return last + k;
  }
  function seasonOver(sea) { return !!sea.done[GAMES - 1] && (sea.year < yearOf() || (S.slate || 0) >= GAMES); }
  function standings(sea) {
    const over = seasonOver(sea);
    const rows = TEAMS.map(t => (t.id === 'HAM' ? hamRow(sea) : Object.assign({ id: t.id }, sea.teams[t.id])));
    rows.forEach(r => {
      r.gp = r.w + r.l;
      r.left = Math.max(0, GAMES - r.gp);
      r.pd = r.pf - r.pa;
      r.strk = streak(r.form || []);
      const ham = r.id === 'HAM';
      if (over) {
        let inPO = r.w >= PLAYOFF_WINS;
        if (ham && sea.year === yearOf()) inPO = S.flags.inPO != null ? !!S.flags.inPO : inPO || (r.w === PLAYOFF_WINS - 1 && S.st.chem >= TIEBREAK_CHEM);
        r.st = inPO ? 'x' : 'e';
      } else if (r.w >= PLAYOFF_WINS) r.st = 'x';
      else if (r.w + r.left < (ham ? PLAYOFF_WINS - 1 : PLAYOFF_WINS)) r.st = 'e';
      else r.st = '';
      r.pace = r.gp ? r.w / r.gp * GAMES : 0;
      r.above = over ? r.st === 'x' : r.gp > 0 && r.st !== 'e' && (r.st === 'x' || r.pace >= PLAYOFF_WINS - 0.01);
    });
    rows.sort((a, b) => (b.above - a.above) || (b.w - a.w) || (a.l - b.l) || (b.pd - a.pd) || (a.id === 'HAM' ? -1 : b.id === 'HAM' ? 1 : 0));
    rows.forEach((r, i) => { r.rank = i + 1; });
    const line = rows.some(r => r.gp > 0) ? rows.filter(r => r.above).length : -1;
    return { rows, line, over };
  }
  function hamStatus(sea, rows) {
    const h = rows.find(r => r.id === 'HAM');
    const w = h.w, left = h.left, chem = S.st.chem;
    if (seasonOver(sea)) return S.flags.inPO ? (w >= PLAYOFF_WINS ? `In. ${w} wins cleared the line.` : `In, on the tiebreaker. Chemistry carried you.`) : `Out. ${w} wins wasn't enough.`;
    if (w >= PLAYOFF_WINS) return `Clinched. The Hammerheads are playoff bound.`;
    const need = PLAYOFF_WINS - w;
    const tbOk = chem >= TIEBREAK_CHEM ? `you're at ${chem}, so it would go your way today` : `you're at ${chem}`;
    if (w + left < PLAYOFF_WINS - 1) return `Eliminated. Play for pride, and for next year.`;
    if (need > left) return `Must win out to reach 5 wins, then it comes down to the tiebreaker: Chemistry ${TIEBREAK_CHEM}+ (${tbOk}).`;
    if (need === left && left > 1) return `Win out, all ${wordNum(left)}, and you're in. Or win ${wordNum(need - 1)} and lean on the tiebreaker: Chemistry ${TIEBREAK_CHEM}+ (${tbOk}).`;
    if (need === 1) return `One more win clinches it.${w === PLAYOFF_WINS - 1 ? ` Already at 5: the tiebreaker needs Chemistry ${TIEBREAK_CHEM}+ (${tbOk}).` : ''}`;
    return `Need ${wordNum(need)} more wins in ${wordNum(left)} game${left > 1 ? 's' : ''}. Or ${wordNum(need - 1)} plus the tiebreaker: Chemistry ${TIEBREAK_CHEM}+ (${tbOk}).`;
  }

  // ---------- Rookie of the Year ----------
  // upTo: only count your games before that week (the ladder as it stood before week upTo's results).
  function youTotal(roy, upTo) { return roy.you.reduce((a, b, i) => a + (upTo == null || i < upTo ? b || 0 : 0), 0) + buzz(); }
  function buzz() { return S ? Math.round(S.st.fame * 0.08 * 10) / 10 : 0; }
  function rkTotal(roy, id) { return (roy.pre && roy.pre[id] || 0) + (roy.pts[id] || []).reduce((a, b) => a + (b || 0), 0); }
  function royRanks(sea, upTo) {
    const roy = sea.roy;
    if (!roy) return null;
    const list = [{ id: 'you', v: youTotal(roy, upTo) }].concat(roy.ids.map(id => ({ id, v: rkTotal(roy, id) })));
    list.sort((a, b) => b.v - a.v || (a.id === 'you' ? -1 : 1));
    const out = {};
    list.forEach((x, i) => { out[x.id] = i + 1; });
    return out;
  }
  // Remember the ladder as the week hub shows it before a week is played, so that week's arrows
  // compare against what the player actually saw.
  function noteSeen(sea) {
    const roy = sea.roy, n = S.slate || 0;
    if (!roy || roy.final || n >= GAMES || sea.done[n]) return;
    const r = royRanks(sea, n);
    if (roy.seen && roy.seen.n === n && JSON.stringify(roy.seen.r) === JSON.stringify(r)) return;
    roy.seen = { n, r };
    touch();
  }
  function ladder(sea) {
    const roy = sea.roy;
    const ranks = royRanks(sea);
    const rows = [{ id: 'you', name: `${S.first} ${S.last}`, pos: S.pos, team: 'HAM', v: youTotal(roy), you: true }]
      .concat(roy.ids.map(id => ({ id, name: RK[id].name, pos: RK[id].pos, team: RK[id].team, v: rkTotal(roy, id), out: roy.out[id] && roy.out[id] > 0 })));
    // Arrows compare with the ladder as the hub showed it before the latest week, so they stay in step with the
    // ranks shown now (fame keeps nudging your total between weeks). Old saves fall back to the sim-time move.
    const base = roy.base && !roy.final ? roy.base : null;
    rows.forEach(r => { r.rank = ranks[r.id]; r.mv = base && base[r.id] != null ? base[r.id] - r.rank : roy.mv[r.id] || 0; });
    rows.sort((a, b) => a.rank - b.rank);
    return rows;
  }
  // Your ballot points for one game: game grade, the stat line, winning, clutch, and how much you played.
  function youPts(g) {
    if (!g || !g.res || !g.res.length || g.grade == null) return 0;
    const L = g.line || {};
    let stat = 0;
    switch (S.pos) {
      case 'QB': stat = (L.passYds || 0) / 70 + (L.td || 0) * 1.1 - (L.int || 0) * 0.8; break;
      case 'RB': stat = (L.rushYds || 0) / 32 + (L.td || 0) * 1.1; break;
      case 'WR': stat = (L.recYds || 0) / 28 + (L.rec || 0) * 0.15 + (L.td || 0) * 1.1; break;
      default: stat = (L.tkl || 0) * 0.35 + (L.sacks || 0) * 1.2 + (L.take || 0) * 1.6 + (L.td || 0) * 1.5;
    }
    const role = { starter: 1, rotation: 0.8, backup: 0.55 }[S.role] || 0.5;
    let p = ((g.grade - 1) * 3.2 + Math.max(0, stat)) * role;
    if (g.won) p += 0.8;
    if (g.clutchPlayed && g.won) p += 1.2;
    if (g.grade >= 2.5 && g.res.length >= 2) p += 1;
    return Math.round(clamp(p, -1, 16) * 10) / 10;
  }
  function royWeek(sea, n, before) {
    const roy = sea.roy;
    if (roy.you[n] == null) {
      // Old saves and skipped weeks: estimate from the stored grade.
      const gr = sea.year === yearOf() ? (S.grades || []).find(x => x.n === n) : null;
      roy.you[n] = gr ? Math.round(((gr.v - 1) * 3.2 + 2.5) * 10) / 10 : 0;
    }
    roy.events = roy.events || {};
    for (const id of roy.ids) {
      let v = 0;
      if (roy.out[id] > 0) { roy.out[id]--; v = 0; }
      else {
        const mean = roy.tier[id] || 6;
        v = mean + (Math.random() + Math.random() + Math.random() - 1.5) * 4.2;
        if (chance(0.07)) { v += 7; (roy.events[n] = roy.events[n] || []).push(['big', id]); }
        else if (chance(0.035) && n < GAMES - 1) { roy.out[id] = ri(1, 2); v *= 0.4; (roy.events[n] = roy.events[n] || []).push(['hurt', id, roy.out[id]]); }
        v = Math.max(0, v);
      }
      roy.pts[id][n] = Math.round(v * 10) / 10;
    }
    const after = royRanks(sea);
    for (const id in after) roy.mv[id] = before ? before[id] - after[id] : 0;
    roy.base = before || null;
    roy.rankHist[n] = after.you;
  }
  function royFinalize(sea) {
    const lad = ladder(sea);
    const win = lad[0];
    // Whole ballot points, strictly decreasing, so a winner never shows the same total as the runner-up.
    let prev = Infinity;
    const order = lad.map(r => { const v = Math.max(0, Math.min(Math.round(r.v), prev - 1)); prev = v; return { id: r.id, name: r.name, pos: r.pos, team: r.team, v }; });
    sea.roy.final = { winner: win.id, you: lad.find(r => r.you).rank, order };
  }

  // ---------- Headlines ----------
  const TEAM_WIN = {
    CAP: ['Monarchs {s} over the {L}. Dante Kingsley celebrates by crowning the {L} mascot. The mascot did not consent.', 'Monarchs beat the {L} {s}. Fans throw plastic crowns onto the field. The grounds crew collects 1,400 of them.'],
    LAK: ['Gulls win {s} over the {L}! Rookie head coach Pete Lindgren gets a Gatorade bath. It was teal Gatorade. He is still teal.', 'Gulls {s} over the {L}. The Lakeshore crowd chants "WE ARE TEAL" for nine straight minutes. It is not clear what that means.'],
    STV: ['Smelters {s} over the {L}. The yellow towels wave so hard that a man in section 112 dislocates his shoulder. He calls it worth it.', 'Smelters beat the {L} {s}. Their secondary waves at only one receiver going by. Progress.'],
    NFK: ['Lumberjacks {s} over the {L}. They ran it 46 times and threw it twice. Both throws were accidents.', 'Lumberjacks grind past the {L}, {s}. The game takes four hours and nobody enjoys it except the Lumberjacks.'],
    GCH: ['Hurricanes {s} over the {L}. Their quarterback throws 51 passes. His arm is now resting in a bucket of ice at the team hotel.', 'Hurricanes outlast the {L} {s} in a game with 900 combined passing yards and roughly four tackles.'],
    PRB: ['Bison beat the {L} {s}. A real bison attended the game. Nobody knows who brought it, and nobody is asking.', 'Bison {s} over the {L}. Their coach, Dale Amundsen, celebrates by allowing himself one (1) cookie.'],
    NEO: ['Jackpots {s} over the {L} on a triple-reverse flea-flicker. It worked. It should not have worked.', 'Jackpots beat the {L} {s}. Their kicker wore gold cleats, a gold helmet, and gold eye black. He also missed an extra point.'],
  };
  const TEAM_LOSS = {
    CAP: ['{W} beat the Monarchs {s}! Somewhere, a podcast microphone is quietly unplugged.'],
    LAK: ['{W} {s} over the Gulls. Coach Pete Lindgren has started saying "process" in his sleep.'],
    STV: ['{W} {s} over the Smelters, whose secondary waves at three different receivers going by.'],
    NFK: ['{W} beat the Lumberjacks {s} by doing the unthinkable: tackling.'],
    GCH: ['{W} {s} over the Hurricanes. A Hurricanes receiver is flagged for excessive celebration in a game they lost.'],
    PRB: ['{W} top the Bison {s}. Prairie fans start making Thanksgiving plans that do not involve a TV.'],
    NEO: ['{W} {s} over the Jackpots, who tried five trick plays. Four of them tricked the Jackpots.'],
  };
  const UPSET = ['The {W} stun the {L}, {s}. Somebody is going to frame this box score.', '{W} {s} over the {L}. Vegas oddsmakers have gone for "a long walk."', 'The {W} beat the {L} {s}. The {L} coach calls it "a learning experience" for the third time this year.', 'Nobody gave the {W} a chance. They beat the {L} {s} anyway, and their coach would like a word with "nobody."'];
  const CLOSE = ['{W} edge the {L} {s} on a field goal that hits both uprights and the crossbar. Physicists are reviewing it.', '{W} {s} over the {L}. The two-minute drill takes nineteen real-life minutes and one very long replay review.', '{W} survive the {L}, {s}, when a Hail Mary is batted down by a backup safety named Gus.', '{W} {s} over the {L}. The winning kick wobbles like a shopping cart and goes in anyway.', '{W} {s} over the {L} in overtime. Both head coaches aged about a year.', '{W} hold off the {L}, {s}. The last play has eleven laterals and ends with a lineman holding the ball, confused.'];
  const BLOWOUT = ['{W} {s} over the {L}. The {L} fans were gone by halftime. So was the {L} punter, who had a dinner reservation.', '{W} hang {hi} on the {L}. It was over before the halftime show finished setting up.', '{W} {s} over the {L}. The {L} quarterback spends the fourth quarter on the bench reading a book.', '{W} {s} over the {L}. The {L} punted nine times. Their punter gets the game ball.'];
  const NORMAL = ['{W} beat the {L} {s} behind three takeaways and one very confused mascot.', '{W} {s} over the {L}. Nothing weird happened, which for this league is weird.', '{W} handle the {L}, {s}. The {L} coach calls the loss "a speed bump." It was more of a wall.', '{W} {s} over the {L}. The {L} mascot fell down the stadium stairs at halftime. He is fine. The {L} are not.'];
  const INJ_CAUSE = [
    'pulling a hamstring during a touchdown dance he had rehearsed since July',
    'a golf-cart accident at practice. He was the passenger. He is very embarrassed',
    'slipping on a celebration towel',
    'tripping over the team\'s live mascot, a goat named Pancake',
    'an argument with a vending machine. The vending machine won',
    'spraining an ankle stepping off the team bus. The bus was parked',
    'a sneeze. Team doctors are calling it "a significant sneeze"',
    'getting hit in the face by his own kicker\'s warmup kick',
  ];
  const INJ_POS = ['quarterback', 'running back', 'left tackle', 'receiver', 'cornerback', 'safety', 'tight end', 'pass rusher'];
  const HOT = [
    'Hot seat: the {T} are {rec}. Coach {coach} says he has "full confidence in the plan." The plan was seen updating its résumé.',
    'Hot seat: the {T} fall to {rec}. Fans fly a plane over practice with a banner that says FIRE {COACH}. The banner has a typo.',
    'Hot seat: the {T} owner gives coach {coach} a vote of confidence. In this league, that is usually the last vote before the other vote.',
  ];
  const STREAK_W = ['The {T} have won {k} straight. Their kicker has started wearing a cape to practice. Nobody has told him to stop.', 'The {T} have won {k} in a row. Their coach, {coach}, has not changed his socks since the streak began. The locker room has opinions.'];
  const STREAK_L = ['The {T} have lost {k} straight. Their mascot has been spotted sitting alone in the parking lot.', 'The {T} have dropped {k} in a row. Their coach, {coach}, has started holding practice at 5 a.m. "to find out who wants it." Nobody does.'];
  const BRYCE = {
    QB: 'throws for 488 yards and six touchdowns. He punts once, for 61 yards, just to show he can',
    RB: 'runs for 287 yards and four touchdowns. On the last one, he high-fives his own mascot mid-run',
    WR: 'makes a one-handed catch while losing a shoe, then scores in one sock. The shoe has its own highlight now',
    LB: 'records four sacks and 19 tackles. The other team asks the refs to check his jersey for magnets',
  };

  function gameText(sea, g) {
    const aw = g.as > g.bs;
    const W = aw ? g.a : g.b, L = aw ? g.b : g.a;
    const hi = Math.max(g.as, g.bs), lo = Math.min(g.as, g.bs);
    const map = { W: nickOf(W), L: nickOf(L), s: `${hi}-${lo}`, hi };
    let pool;
    if (g.tag === 'upset') pool = UPSET;
    else if (hi - lo >= 17) pool = BLOWOUT;
    else if (hi - lo <= 4) pool = CLOSE;
    else if (TEAM_WIN[W] && chance(0.6)) pool = TEAM_WIN[W];
    else if (TEAM_LOSS[L] && chance(0.5)) pool = TEAM_LOSS[L];
    else pool = NORMAL;
    return fill(fresh(sea, pool), map);
  }
  const KING_QB = [
    'Dante Kingsley vs the {o}: {y} yards, {td} touchdowns, and one crown gesture per touchdown.',
    'Dante Kingsley throws for {y} yards against the {o}. He spends halftime recording an ad for his own cologne, "Heavy Is the Head."',
    'Dante Kingsley beats the {o} and awards the game ball to himself. He gives a speech. It is about him.',
    'Dante Kingsley throws {td} touchdowns against the {o}, then answers every postgame question in the third person. "Dante saw the safety. Dante made him pay."',
  ];
  const KING_LB = [
    'Dante Kingsley vs the {o}: {t} tackles, {s} sacks, and a 51-minute podcast about the sacks.',
    'Dante Kingsley forces two fumbles against the {o}, then pretends to put a crown on the ball. Twice.',
    'Dante Kingsley sacks the {o} quarterback and stays down on one knee "for the photographers." There are no photographers on that side of the field.',
    'Dante Kingsley makes {t} tackles against the {o} and debuts a new nickname for himself, "The Crown Jewel." Nobody else uses it.',
  ];
  const KING_LOSS = [
    'Dante Kingsley after losing to the {o}: "I don\'t lose. I take notes." His notes episode runs three hours.',
    'The Monarchs lose to the {o}. Dante Kingsley leaves through a side door in sunglasses and a fake mustache. It is very obviously him.',
  ];
  function kingsleyLine(sea, n) {
    const qb = S.pos === 'LB'; // Kingsley plays the position you face: QB if you're a linebacker
    const opp = hamOppId(n, sea.year);
    const capRes = (sea.res[n] || []).find(r => r.a === 'CAP' || r.b === 'CAP');
    if (opp === 'CAP') {
      const hr = hamResult(sea, n);
      if (!hr) return null;
      return hr.won
        ? { tag: 'Kingsley', h: fresh(sea, [`Dante Kingsley skips his postgame podcast. The episode is replaced by forty minutes of rain sounds.`, `Dante Kingsley after losing to Harbor City: "We didn't lose. We ran out of time." The Monarchs lost by {m}.`]).replace('{m}', wordNum(hr.us - hr.them)) }
        : { tag: 'Kingsley', h: fresh(sea, [`Dante Kingsley on the Hammerheads: "Tell the undrafted kid the raffle's closed."`, `Dante Kingsley wears a crown to his postgame press conference. It is a real crown. It is from a costume store.`]), sub: 'You save the clip. For later.' };
    }
    if (!capRes) return null;
    const capWon = capRes.a === 'CAP' ? capRes.as > capRes.bs : capRes.bs > capRes.as;
    const map = { o: nickOf(capRes.a === 'CAP' ? capRes.b : capRes.a), y: ri(268, 361), td: wordNum(ri(2, 4)), t: ri(9, 14), s: ri(2, 3) };
    if (!capWon) return { tag: 'Kingsley', h: fill(fresh(sea, KING_LOSS), map), big: true };
    return { tag: 'Kingsley', h: fill(fresh(sea, qb ? KING_QB : KING_LB), map) };
  }
  function preseasonNews(sea) {
    if (sea.year > 1) {
      const y1 = S.y1 || {}, w = y1.record ? y1.record.w : null;
      const poll = y1.champion
        ? 'Preseason poll: the defending champion Hammerheads are picked first in the conference for the first time in franchise history. Coach Bramble calls it "a trap." He is right about most things.'
        : y1.inPO
          ? `Preseason poll: the Monarchs are picked first again. The Hammerheads, a playoff team last year, are picked third. ${tinyLeft() ? `${NEW_CENTER}, the new center, has` : 'Tiny has'} printed the poll and taped it inside his helmet.`
          : `Preseason poll: the Monarchs are picked first again. The Hammerheads are picked sixth${w != null ? ` after going ${w}-${y1.record.l}` : ''}. ${tinyLeft() ? `${NEW_CENTER}, the new center, has` : 'Tiny has'} printed the poll and taped it inside his helmet.`;
      return [
        { tag: 'Preseason', h: poll },
        // Only a hint: the year2 module owns the retirement announcement (Week 5, Monarchs week).
        { tag: 'Kingsley', h: 'Dante Kingsley opens season five of his podcast, "Heavy Is the Head." Asked whether this is his last year, he talks for forty minutes about a horse he owned as a kid. Nobody is sure if that was a yes.' },
        { tag: 'Preseason', h: `Year ${sea.year}. Every team is 0-0, and every fan base is "cautiously optimistic." It will not last.` },
      ];
    }
    const out = [
      { tag: 'Preseason', h: 'Preseason poll: the Capital Monarchs are picked to win the conference for the third straight year. The Hammerheads are picked "somewhere in there."' },
      { tag: 'Kingsley', h: 'Dante Kingsley launches season four of his podcast, "Heavy Is the Head." Episode one is two hours long. He is the only guest.' },
    ];
    if (sea.roy) {
      const fav = sea.roy.ids.reduce((a, b) => (sea.roy.tier[b] > sea.roy.tier[a] ? b : a));
      const r = RK[fav];
      out.push({ tag: 'Rookie watch', h: `Rookie of the Year odds: ${r.name}, the ${T[r.team].nick} ${POSNAME[r.pos]}, opens as the favorite. An undrafted ${posName()} in Harbor City is listed at 80-to-1.`, sub: 'Somebody put five dollars on you. Probably Tiny.' });
    } else out.push({ tag: 'Preseason', h: `Year ${sea.year}. Every team is 0-0, and every fan base is "cautiously optimistic." It will not last.` });
    return out;
  }
  function weekNews(sea, n) {
    const out = [];
    const res = (sea.res[n] || []).slice();
    // 1. The game everybody is talking about: an upset, a thriller, or a team with a good story.
    if (res.length) {
      res.sort((x, y) => (y.tag === 'upset') - (x.tag === 'upset') || Math.abs(x.as - x.bs) - Math.abs(y.as - y.bs));
      const top = chance(0.75) ? res[0] : pick(res);
      out.push({ tag: top.tag === 'upset' ? 'Upset' : 'Final', h: gameText(sea, top) });
    }
    const extra = [];
    // 2. Your Rookie of the Year storyline (year 1).
    const roy = sea.roy;
    if (roy) {
      const evs = (roy.events && roy.events[n]) || [];
      const big = evs.find(e => e[0] === 'big'), hurt = evs.find(e => e[0] === 'hurt');
      if (big) { const r = RK[big[1]]; extra.push({ p: 3, tag: 'Rookie watch', h: `${r.name} (${r.pos}, ${T[r.team].nick}) ${r.big}. The Rookie of the Year race just got loud.` }); }
      if (hurt) { const r = RK[hurt[1]]; extra.push({ p: 3, tag: 'Injury', h: `${r.name}, the ${T[r.team].nick} rookie ${POSNAME[r.pos]}, will miss ${hurt[2] === 1 ? 'a week' : 'two weeks'} after ${fresh(sea, INJ_CAUSE)}.`, sub: 'His Rookie of the Year campaign takes a hit.' }); }
      const ranks = royRanks(sea), mv = roy.mv.you || 0;
      if (ranks.you === 1 && !roy.led) {
        roy.led = true;
        extra.push({ p: 5, tag: 'Rookie watch', h: `${S.first} ${S.last} now leads the Rookie of the Year race. In April, 257 names were called in the draft. None of them were ${S.last}.`, sub: 'Coach Okafor tapes the article to your locker. Then she writes "ONE WEEK AT A TIME" over it in marker.' });
      } else if (mv >= 1 && ranks.you <= 3) {
        extra.push({ p: 4, tag: 'Rookie watch', h: `The undrafted ${posName()} in Harbor City jumps to ${nth(ranks.you)} on the Rookie of the Year ladder. Voters love a story.` });
      }
    }
    // 3. Player of the Week.
    if (sea.potw.includes(n)) extra.push({ p: 6, tag: 'Hammerheads', h: `${S.first} ${S.last} is the league's ${sideOf()} Player of the Week. ${tinyLeft() ? `${NEW_CENTER} buys the whole offensive line breakfast.` : 'Tiny celebrates with a second breakfast. And a third.'}` });
    // 4. Bryce Calloway, the college star at your position (year 1 foreshadowing).
    if (sea.bryce) {
      const i = sea.bryce.indexOf(n + 1);
      if (i === 0) extra.push({ p: 5, tag: 'College', h: `College: Bryce Calloway, a ${posName()} at ${BRYCE_SCHOOL}, ${BRYCE[S.pos] || BRYCE.QB}.` });
      if (i === 1) extra.push({ p: 5, tag: 'College', h: `Bryce Calloway trademarks his touchdown celebration, "The Calloway," before his junior season. His highlight tape passes fifty million views. It's set to a live orchestra. He hired the orchestra.`, sub: `He plays your position. You watch the tape twice. Then a third time, for research.` });
      if (i === 2) extra.push({ p: 5, tag: 'College', h: `Bryce Calloway announces he's entering the draft, in a video with a drone, a smoke machine, gold cleats and his grandmother. Mock drafts have him going in the top 15. One has him going to Harbor City.`, sub: 'You read that one twice.' });
    }
    // 5. Dante Kingsley.
    // Kingsley gets airtime when he plays you or loses; his ordinary big games show up about half the time.
    const capWeek = hamOppId(n, sea.year) === 'CAP';
    const kl = capWeek || chance(0.55) ? kingsleyLine(sea, n) : null;
    if (kl) { const big = kl.big; delete kl.big; extra.push(Object.assign({ p: capWeek ? 5 : big ? 2.6 : 1.5 + Math.random() }, kl)); }
    // 6. Injuries, hot seats and streaks from around the conference.
    if (chance(0.3)) {
      const id = pick(Object.keys(sea.teams));
      extra.push({ p: 1 + Math.random(), tag: 'Injury', h: `${T[id].nick} ${pick(INJ_POS)} ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} will miss ${wordNum(ri(2, 4))} weeks after ${fresh(sea, INJ_CAUSE)}.` });
    }
    const hot = Object.keys(sea.teams).filter(id => !sea.hot[id] && sea.teams[id].l >= 4 && sea.teams[id].w <= sea.teams[id].l - 3);
    if (hot.length) {
      const id = pick(hot);
      sea.hot[id] = true;
      const t = sea.teams[id];
      extra.push({ p: 2.5, tag: 'Hot seat', h: fill(fresh(sea, HOT), { T: T[id].nick, rec: `${t.w}-${t.l}`, coach: T[id].coach, COACH: T[id].coach.split(' ').pop().toUpperCase().replace(/(.)$/, '$1$1') }) });
    }
    const streaks = Object.keys(sea.teams).map(id => ({ id, s: streak(sea.teams[id].form) })).filter(x => +x.s.slice(1) >= 3);
    if (streaks.length && chance(0.6)) {
      const x = pick(streaks), k = +x.s.slice(1);
      extra.push({ p: 1.2 + Math.random(), tag: 'Streak', h: fill(fresh(sea, x.s[0] === 'W' ? STREAK_W : STREAK_L), { T: T[x.id].nick, k: wordNum(k), coach: T[x.id].coach }) });
    }
    const hs = streak(hamRow(sea).form);
    if (+hs.slice(1) >= 3 && chance(0.7)) {
      extra.push({ p: 2.2, tag: 'Hammerheads', h: hs[0] === 'W'
        ? `The Hammerheads have won ${wordNum(+hs.slice(1))} straight. Coach Bramble was seen smiling. Witnesses disagree on this.`
        : `The Hammerheads have lost ${wordNum(+hs.slice(1))} straight. Harbor City sports radio has run out of new ways to yell about it.` });
    }
    extra.sort((a, b) => b.p - a.p);
    const room = n === GAMES - 1 ? 2 : chance(0.35) ? 1 : 2;
    for (const e of extra.slice(0, room)) { delete e.p; out.push(e); }
    if (n === GAMES - 1 && sea.roy) out.push({ tag: 'Rookie watch', h: 'Rookie of the Year ballots are in. The winner will be announced at the league awards show in February.', sub: 'Playoff games do not count. Whatever happens next, the voters already decided.' });
    return out.slice(0, 3);
  }
  function playoffNews(sea, n) {
    const po = playoffsFor(sea.year) || [];
    const opp = po[n - 10];
    if (!opp) return [];
    const out = [];
    const [hi, lo] = scoreLine(8);
    const inConf = standings(sea).rows.filter(r => r.st === 'x' && r.id !== 'HAM' && T[r.id].name !== opp.team).map(r => T[r.id].name);
    const loser = pick(inConf.length ? inConf : NONCONF.filter(x => x !== opp.team));
    if (n === 10) {
      const inTeams = standings(sea).rows.filter(r => r.st === 'x' && r.id !== 'HAM').map(r => T[r.id].nick);
      out.push({ tag: 'Playoffs', h: `The bracket is set. ${inTeams.length ? `Joining the Hammerheads from the conference: the ${inTeams.join(', the ')}.` : 'The Hammerheads are in.'} Your Wild Card opponent: the ${opp.team}.` });
    } else if (n === 11) out.push({ tag: 'Playoffs', h: `The ${opp.team} advance with ${/^(8|11|18)$/.test(String(hi)) ? 'an' : 'a'} ${hi}-${lo} win over the ${shortName(loser)}. Next up: you.` });
    else out.push({ tag: 'Playoffs', h: `The ${opp.team} win the other conference, ${hi}-${lo}. They have not lost since October, and they would like you to know that.` });
    if (opp.team === 'Capital Monarchs' || (byName(opp.team) || {}).id === 'CAP') out.push({ tag: 'Kingsley', h: `Dante Kingsley on facing Harbor City again: "Third time's the charm. For me."` });
    if (sea.roy && sea.roy.final) out.push({ tag: 'Rookie watch', h: 'Rookie of the Year ballots are sealed in a vault until February. The vault is a filing cabinet. It is locked.' });
    return out.slice(0, 3);
  }
  function newsFor(sea, slate) {
    if (!sea.news[slate]) { sea.news[slate] = slate >= GAMES ? playoffNews(sea, slate) : slate === 0 ? preseasonNews(sea) : weekNews(sea, slate - 1); touch(); }
    return sea.news[slate] || [];
  }

  // ---------- Rendering ----------
  const teamName = id => (T[id] ? T[id].name : String(id || '').replace(/^X:/, ''));
  const abbrOf = id => (T[id] ? T[id].abbr : typeof teamStyle === 'function' ? teamStyle(teamName(id)).abbr : shortName(teamName(id)).slice(0, 3).toUpperCase());
  // A tiny helmet (the same drawing as the matchup card), or a color chip if the helmet art is missing.
  const swatch = id => {
    const name = teamName(id);
    if (name && typeof helmetSVG === 'function') return `<span class="lg-hm" aria-hidden="true">${helmetSVG(name)}</span>`;
    const t = T[id];
    return t ? `<i class="lg-sw" style="--c1:${t.c1};--c2:${t.c2}" aria-hidden="true"></i>` : '<i class="lg-sw nc" aria-hidden="true"></i>';
  };
  const teamCell = id => `<span class="lg-tn"><span class="lg-full">${esc(T[id].name)}</span><span class="lg-nick">${esc(T[id].nick)}</span><span class="lg-abbr">${esc(T[id].abbr)}</span></span>`;
  function pipsHTML(w) {
    let h = '';
    for (let i = 0; i < PLAYOFF_WINS; i++) h += `<i class="${i < w ? 'on' : ''}"></i>`;
    return `<span class="lg-pips" aria-hidden="true">${h}</span>`;
  }
  function tableHTML(sea, compact) {
    const { rows, line, over } = standings(sea);
    const lineRow = `<tr class="lg-line" aria-hidden="true"><td colspan="${compact ? 4 : 6}"><div class="lg-line-in"><span>Playoff line</span>${over ? '' : '<small>6-win pace above</small>'}</div></td></tr>`;
    let body = '';
    rows.forEach((r, i) => {
      if (i === line) body += lineRow;
      const ham = r.id === 'HAM';
      const mark = r.st === 'x' ? '<b class="lg-mk x" title="Clinched">x</b>' : r.st === 'e' ? '<b class="lg-mk e" title="Eliminated">e</b>' : '';
      const sk = r.strk === '–' ? '–' : `<span class="${r.strk[0] === 'W' ? 'w' : 'l'}">${r.strk}</span>`;
      body += `<tr class="${ham ? 'me' : ''}${r.st === 'e' ? ' out' : ''}">
        <td class="lg-rk">${r.rank}</td>
        <td class="lg-team"><span class="lg-hmw">${swatch(r.id)}${mark.replace('lg-mk ', 'lg-mk lg-mk-b ')}</span>${teamCell(r.id)}${mark}</td>
        <td class="lg-num"><span class="lg-wl">${r.w}-${r.l}</span></td>
        ${compact ? '' : `<td class="lg-num lg-pd">${r.pd > 0 ? '+' : ''}${r.pd}</td>`}
        <td class="lg-num lg-sk">${sk}</td>
        ${compact ? '' : `<td class="lg-pipc" title="${Math.min(r.w, PLAYOFF_WINS)} of ${PLAYOFF_WINS} wins to the line">${pipsHTML(r.w)}</td>`}
      </tr>`;
    });
    if (line === rows.length) body += lineRow;
    const cap = `Conference standings${over ? ', final' : ''}. ${PLAYOFF_WINS} wins makes the playoffs; 5 can get in on the tiebreaker with Chemistry ${TIEBREAK_CHEM} or more.`;
    return `<table class="lg-table${compact ? ' compact' : ''}"><caption class="lg-sr">${esc(cap)}</caption>
      <thead><tr><th scope="col" class="lg-rk">#</th><th scope="col">Team</th><th scope="col" class="lg-num">W-L</th>${compact ? '' : '<th scope="col" class="lg-num lg-pd">Diff</th>'}<th scope="col" class="lg-num lg-sk">Strk</th>${compact ? '' : `<th scope="col" class="lg-pipc">To ${PLAYOFF_WINS}</th>`}</tr></thead>
      <tbody>${body}</tbody></table>`;
  }
  function standingsPane(sea) {
    const { rows } = standings(sea);
    return `<div class="lg-status"><span class="lg-st-h">Playoff line</span><span>${esc(hamStatus(sea, rows))}</span></div>
      ${tableHTML(sea, false)}
      <p class="lg-legend"><b>${PLAYOFF_WINS} wins</b> gets you in. <b>5</b> can sneak in on the tiebreaker, which goes to the team that plays together (Chemistry ${TIEBREAK_CHEM}+). <span class="lg-key"><b class="lg-mk x">x</b> clinched</span> <span class="lg-key"><b class="lg-mk e">e</b> eliminated</span></p>`;
  }
  function newsPane(sea, slate) {
    const items = newsFor(sea, slate);
    if (!items.length) return '<p class="lg-empty">Quiet week around the league.</p>';
    return `<ul class="lg-news">${items.map(it => `<li><span class="lg-tag t-${esc(it.tag.toLowerCase().replace(/[^a-z]+/g, '-'))}">${esc(it.tag)}</span><p>${fmt(it.h)}${it.sub ? `<span class="lg-sub">${fmt(it.sub)}</span>` : ''}</p></li>`).join('')}</ul>`;
  }
  function mvHTML(mv) {
    if (!mv) return '<span class="lg-mv eq" aria-label="no change">–</span>';
    return `<span class="lg-mv ${mv > 0 ? 'up' : 'dn'}" aria-label="${mv > 0 ? 'up' : 'down'} ${Math.abs(mv)}"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="${mv > 0 ? 'M5 1.5 9 8H1z' : 'M5 8.5 1 2h8z'}"/></svg>${Math.abs(mv)}</span>`;
  }
  function royPane(sea, animate) {
    const roy = sea.roy;
    const lad = ladder(sea);
    const top = Math.max(1, lad[0].v);
    const played = roy.you.filter(v => v > 0).length;
    const weeks = Object.keys(sea.done).length;
    const rows = lad.map((r, i) => `<li class="${r.you ? 'me' : ''}${r.out ? ' hurt' : ''}">
      <span class="lg-rk">${r.rank}</span>
      <span class="lg-who"><b>${esc(r.name)}</b><span>${esc(r.pos)} · <span class="lg-long">${esc(T[r.team].nick)}</span><span class="lg-short">${esc(T[r.team].abbr)}</span>${r.out ? ' · injured' : ''}</span></span>
      <span class="lg-bar"><i style="width:${animate ? 0 : Math.round(Math.max(0, r.v) / top * 100)}%" data-w="${Math.round(Math.max(0, r.v) / top * 100)}"></i></span>
      <span class="lg-pts">${Math.round(r.v)}</span>${mvHTML(r.mv)}</li>`).join('');
    const me = lad.find(r => r.you);
    const lead = lad[0];
    let note;
    if (roy.final) note = `Ballots are in. You finished the regular season ${nth(me.rank)}. The winner is announced at the awards show in February.`;
    else if (!weeks) note = `Voters reward game grades, big stat lines, wins and clutch plays. Fame adds buzz. Practice-squad weeks don't count, so you start behind.`;
    else if (me.rank === 1) note = `You lead by ${Math.max(1, Math.round(me.v - lad[1].v))}. ${GAMES - weeks} week${GAMES - weeks === 1 ? '' : 's'} left before ballots are due.`;
    else {
      const gp = Math.max(1, Math.round(lead.v - me.v)), gap = `${gp} point${gp === 1 ? '' : 's'} behind ${esc(lead.name)}, ${GAMES - weeks} week${GAMES - weeks === 1 ? '' : 's'} left.`;
      note = S.role === 'practice' ? `${gap} Practice-squad weeks are worth zero. Get on the field.` : `${gap} As a ${S.role === 'rotation' ? 'split-snaps player' : S.role}, an A game is worth about ${Math.round(10 * ({ starter: 1, rotation: 0.8, backup: 0.55 }[S.role] || 0.5))} points.`;
    }
    return `<ol class="lg-ladder" aria-label="Rookie of the Year ladder">${rows}</ol>
      <p class="lg-legend">${note} <span class="lg-dim">Your points include ${buzz().toFixed(1)} buzz from Fame. Games played: ${played}.</span></p>`;
  }
  function teaser(sea) {
    const { rows } = standings(sea);
    const h = rows.find(r => r.id === 'HAM');
    const bits = [h.gp || rows.some(r => r.gp) ? `<span class="lg-chip"><b>${nth(h.rank)}</b> ${h.w}-${h.l}</span>` : `<span class="lg-chip">Week 1</span>`];
    if (sea.roy) { const me = ladder(sea).find(r => r.you); bits.push(`<span class="lg-chip">ROY <b>${nth(me.rank)}</b></span>`); }
    return bits.join('');
  }

  let lastAnimKey = '';
  function panelHTML(sea, slate) {
    const p = uiPrefs();
    const tabs = [['news', 'Headlines'], ['table', 'Standings']];
    if (sea.roy) tabs.push(['roy', 'Rookie race']);
    let tab = p.tab && tabs.some(t => t[0] === p.tab) ? p.tab : 'news';
    const open = p.open != null ? !!p.open : window.innerWidth > 600;
    const first = (newsFor(sea, slate)[0] || {}).h || '';
    const animKey = `${sea.year}:${slate}:${tab}`;
    const animate = !reduceMotion && animKey !== lastAnimKey;
    lastAnimKey = animKey;
    const pane = tab === 'table' ? standingsPane(sea) : tab === 'roy' ? royPane(sea, animate) : newsPane(sea, slate);
    return `<section class="lg-desk${open ? ' open' : ''}" id="lgDesk" aria-label="League desk">
      <button type="button" class="lg-head" aria-expanded="${open}" aria-controls="lgBody" aria-keyshortcuts="L">
        <span class="lg-title"><span class="lg-eyebrow">Around the league</span><span class="lg-name">League Desk</span></span>
        <span class="lg-teaser">${teaser(sea)}</span>
        <kbd class="lg-kbd" aria-hidden="true">L</kbd>
        <span class="lg-chev" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 4.2 6 8l4-3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </button>
      ${open ? '' : `<p class="lg-peek">${fmt(first)}</p>`}
      <div class="lg-body" id="lgBody"${open ? '' : ' hidden'}>
        <div class="lg-tabs" role="tablist" aria-label="League desk sections">
          ${tabs.map(([k, l]) => `<button type="button" role="tab" class="lg-tab" id="lgTab-${k}" data-tab="${k}" aria-selected="${k === tab}" aria-controls="lgPane" tabindex="${k === tab ? 0 : -1}">${k === 'roy' ? '<span class="lg-long">Rookie race</span><span class="lg-short">Rookies</span>' : l}</button>`).join('')}
        </div>
        <div class="lg-pane" id="lgPane" role="tabpanel" aria-labelledby="lgTab-${tab}" tabindex="0">${pane}</div>
      </div>
    </section>`;
  }
  function mountPanel(el, slate) {
    const sea = sync();
    if (!sea) return;
    noteSeen(sea);
    const old = $('#lgDesk', el);
    const wrap = document.createElement('div');
    wrap.innerHTML = panelHTML(sea, slate);
    const node = wrap.firstElementChild;
    if (old) old.replaceWith(node);
    else {
      const mu = $('.matchup', el);
      if (mu) mu.after(node);
      else { const st = $('.story', el); if (st) st.before(node); else el.prepend(node); }
    }
    wire(node, el, slate);
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.lg-bar > i[data-w]', node).forEach(i => { i.style.width = i.dataset.w + '%'; })));
  }
  function wire(node, el, slate) {
    const head = $('.lg-head', node);
    head.addEventListener('click', () => {
      Sound.play('click');
      setUiPrefs({ open: !node.classList.contains('open') });
      mountPanel(el, slate);
      const h = $('#lgDesk .lg-head', el);
      if (h) h.focus({ preventScroll: true });
    });
    const tabs = $$('.lg-tab', node);
    const choose = (k, focus) => {
      Sound.play('tick');
      setUiPrefs({ tab: k, open: true });
      mountPanel(el, slate);
      if (focus) { const b = $(`#lgDesk .lg-tab[data-tab="${k}"]`, el); if (b) b.focus({ preventScroll: true }); }
    };
    tabs.forEach((b, i) => {
      b.addEventListener('click', () => { if (b.getAttribute('aria-selected') !== 'true') choose(b.dataset.tab, true); });
      b.addEventListener('keydown', e => {
        let j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j == null) return;
        e.preventDefault();
        e.stopPropagation();
        choose(tabs[j].dataset.tab, true);
      });
    });
  }

  // Conference place under each team on the matchup card ("3-2 · 4th"), so the opponent has a record too.
  function matchupRecords(el) {
    if (S.slate >= GAMES || $('.lg-mu-rec', el)) return;
    const sea = season();
    const { rows } = standings(sea);
    if (!rows.some(r => r.gp > 0)) return;
    const opp = hamOppId(S.slate, sea.year);
    const subs = $$('.matchup .mu-sub', el);
    const them = rows.find(r => r.id === opp);
    if (subs[1] && them) subs[1].insertAdjacentHTML('beforebegin', `<div class="mu-sub lg-mu-rec">${them.w}-${them.l} · ${nth(them.rank)}</div>`);
  }

  // Final scores from elsewhere, shown under your own final.
  function tickerHTML(sea, n) {
    const res = sea.res[n] || [];
    if (!res.length) return '';
    const cell = (id, s, win) => `<span class="lg-tk-t${win ? ' win' : ''}">${swatch(id)}<span class="lg-tk-n">${esc(abbrOf(id))}</span><b>${s}</b></span>`;
    const h = standings(sea).rows.find(r => r.id === 'HAM');
    return `<div class="lg-ticker" role="group" aria-label="Other scores this week">
      <div class="lg-tk-top"><span class="lg-tk-h">Around the league</span><span class="lg-tk-me">Hammerheads <b>${h.w}-${h.l}</b> · ${nth(h.rank)} of 8</span></div>
      <div class="lg-tk-list">${res.map(r => `<span class="lg-tk" title="${esc(`${nickOf(r.a)} ${r.as}, ${nickOf(r.b)} ${r.bs}`)}">${cell(r.a, r.as, r.as > r.bs)}${cell(r.b, r.bs, r.bs > r.as)}${r.tag === 'upset' ? '<span class="lg-tk-up">Upset</span>' : ''}</span>`).join('')}</div>
    </div>`;
  }

  // ---------- Awards night (year-1 epilogue) ----------
  function awardsHTML(sea, live) {
    const f = sea.roy.final;
    const won = f.winner === 'you';
    const rows = f.order.map((r, i) => {
      const you = r.id === 'you';
      const delay = live ? `style="animation-delay:${(f.order.length - 1 - i) * 0.55 + 0.4}s"` : '';
      return `<li class="${you ? 'me' : ''}${i === 0 ? ' win' : ''}${live ? ' live' : ''}" ${delay}><span class="lg-rk">${i === 0 ? '<svg viewBox="0 0 24 24" aria-label="Winner"><path d="M12 2.5l2.8 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.2l-6.1 3.6 1.6-6.8-5.2-4.6 6.9-.6z"/></svg>' : nth(i + 1)}</span><span class="lg-who"><b>${esc(r.name)}</b><span>${esc(r.pos)} · ${esc(T[r.team] ? T[r.team].nick : r.team)}</span></span><span class="lg-pts">${r.v}</span></li>`;
    }).join('');
    const verdict = won ? `Rookie of the Year: you. Undrafted, and now the best rookie in the league.` : `${esc(f.order[0].name)} wins it. You finish ${nth(f.you)}.`;
    return `<div class="lg-awards${won ? ' won' : ''}${live ? ' live' : ''}" id="lgAwards" role="group" aria-label="Rookie of the Year voting">
      <div class="lg-aw-top"><span class="lg-eyebrow">League awards · February</span><span class="lg-aw-title">Rookie of the Year</span></div>
      <ol class="lg-aw-list">${rows}</ol>
      <p class="lg-aw-verdict" ${live ? `style="animation-delay:${f.order.length * 0.55 + 0.5}s"` : ''}>${verdict}</p>
    </div>`;
  }
  function grantRoy(sea) {
    if (!sea.roy || !sea.roy.final || sea.roy.final.winner !== 'you' || sea.roy.awarded) return;
    sea.roy.awarded = true;
    award('roy');
    save();
  }
  function revealDone(sea) {
    if (sea.roy.revealed) return;
    sea.roy.revealed = true;
    grantRoy(sea);
    save();
    renderCard();
  }

  // ---------- Hooks ----------
  on('newCareer', () => { lastAnimKey = ''; });

  on('gameEnd', g => {
    if (!S || !g) return;
    const sea = season();
    if (g.n >= GAMES) return;
    sea.ham[g.n] = { us: g.us, them: g.them, won: !!g.won };
    if (sea.roy && sea.roy.you[g.n] == null) sea.roy.you[g.n] = youPts(g);
    // Player of the Week: an A game in a win (or an A+ game, win or lose) with more than one snap.
    if (g.grade != null && (g.grade >= 2.75 || (g.grade >= 2.5 && g.won)) && g.res.length >= 2 && !sea.potw.includes(g.n)) {
      sea.potw.push(g.n);
      toast(`${sideOf()} Player of the Week`, 'trophy');
      fx({ fame: 2 }, true);
    }
    sync(g.n + 1);
  });

  on('page', (pg, el, id) => {
    if (!S || !el) return;
    try {
      if (id === 'week_hub') {
        mountPanel(el, Math.min(S.slate, 12));
        matchupRecords(el);
      } else if (id === 'g_final' && S.game && S.game.n < GAMES && S.game.done) {
        const sea = sync(S.game.n + 1);
        const h = tickerHTML(sea, S.game.n);
        const anchor = $('.grade-row', el) || $('#mini', el);
        if (h && anchor) anchor.insertAdjacentHTML(anchor.id === 'mini' ? 'beforebegin' : 'afterend', h);
      } else if (id === 'po_gate') {
        const sea = sync(GAMES);
        const st = $('.story', el);
        if (st) st.insertAdjacentHTML('afterend', `<div class="lg-mini"><div class="lg-mini-h"><span class="lg-eyebrow">Final standings</span><span class="lg-mini-sub">${PLAYOFF_WINS} wins is the line</span></div>${tableHTML(sea, true)}${sea.roy && sea.roy.final ? `<p class="lg-mini-roy">Rookie of the Year ballots are in. Going into the awards show, the race has you <b>${nth(sea.roy.final.you)}</b>.</p>` : ''}</div>`);
      } else if (id === 'ending') {
        const sea = season();
        const st = $('.story', el);
        if (sea && sea.year === 1 && sea.roy && sea.roy.final && st) {
          const live = !sea.roy.shown && !reduceMotion;
          st.insertAdjacentHTML('beforebegin', awardsHTML(sea, live));
          if (!sea.roy.shown) {
            sea.roy.shown = true;
            save();
            const cap = S, t0 = (sea.roy.final.order.length * 0.55 + 0.5) * 1000;
            if (!live) revealDone(sea);
            else {
              // Ticks only while the card is still on screen (leaving the page mid-reveal silences them).
              const card = $('#lgAwards', el);
              sea.roy.final.order.forEach((r, i) => setTimeout(() => { if (S === cap && card && card.isConnected) Sound.play(i === 0 ? 'great' : 'tick'); }, ((sea.roy.final.order.length - 1 - i) * 0.55 + 0.4) * 1000));
            }
            if (live) setTimeout(() => {
              if (S === cap) revealDone(sea);
              else if (sea.roy.final.winner === 'you' && !sea.roy.awarded) {
                // The player left before the envelope opened: still record the trophy.
                sea.roy.awarded = true;
                const d = trophyData();
                if (!d.got.roy) { d.got.roy = Date.now(); store.set(TROPHY_KEY, d); }
              }
            }, t0);
          } else if (!sea.roy.revealed) revealDone(sea);
        }
        // Summary tiles: where you finished in the conference and the ROY vote.
        const sum = $('.sumgrid', el);
        if (sea && sum) {
          const { rows } = standings(sea);
          const h = rows.find(r => r.id === 'HAM');
          let tiles = `<div class="lg-tile"><b>${nth(h.rank)} of 8</b><span>Conference</span></div>`;
          if (sea.year === 1 && sea.roy && sea.roy.final) tiles += `<div class="lg-tile"><b>${sea.roy.final.winner === 'you' ? 'Winner' : nth(sea.roy.final.you)}</b><span>Rookie of the Year</span></div>`;
          if (sea.potw.length) tiles += `<div class="lg-tile"><b>${sea.potw.length}</b><span>Player of the Week</span></div>`;
          sum.insertAdjacentHTML('beforeend', tiles);
        }
      }
    } catch (e) { console.error('[league]', e); }
    // Save after every page hook (ours and other modules', which may call League too) has run.
    queueMicrotask(persist);
  });

  on('card', el => {
    if (!S || !el || S.role === 'camp') return;
    try {
      const L = S.ext && S.ext.league;
      const y1 = L && L.seasons && L.seasons[1];
      let html = '';
      if (yearOf() === 1) {
        const sea = season();
        if (!sea || !sea.roy) return;
        const f = sea.roy.final;
        if (f && sea.roy.revealed) html = f.winner === 'you' ? `<span class="lg-cl-h">Rookie of the Year</span><b>Winner</b>` : `<span class="lg-cl-h">Rookie of the Year vote</span><b>${nth(f.you)} of 5</b>`;
        else if (f) html = `<span class="lg-cl-h">ROY ballots are in</span><b>${nth(f.you)} going in</b>`;
        else { const me = ladder(sea).find(r => r.you); html = `<span class="lg-cl-h">Rookie of the Year race</span><b>${nth(me.rank)} of 5</b>${mvHTML(me.mv)}`; }
        if (sea.potw.length) html += `<span class="lg-cl-potw">${sea.potw.length}× Player of the Week</span>`;
      } else if (y1 && y1.roy && y1.roy.final && y1.roy.final.winner === 'you') {
        html = `<span class="lg-cl-h">Reigning</span><b>Rookie of the Year</b>`;
      } else return;
      const row = document.createElement('div');
      row.className = 'lg-cardline';
      row.innerHTML = html;
      const tog = $('.pc-toggle', el), head = $('.pc-head', el);
      if (tog) tog.before(row); else if (head) head.after(row); else el.prepend(row);
    } catch (e) { console.error('[league card]', e); }
  });

  CODAS.push(() => {
    if (yearOf() !== 1) return null;
    const sea = season();
    if (!sea || !sea.roy) return null;
    if (!sea.roy.final) { sync(GAMES); if (!sea.roy.final) return null; }
    // The awards card above the epilogue already announces the result, so this line is only the aftermath.
    const f = sea.roy.final;
    if (f.winner === 'you') return [
      `Your acceptance speech is ninety seconds long. You thank {fam}, Coach Okafor, and Tiny's cereal, in that order. {fam} puts the trophy on the mantel and dusts it every day, whether it needs it or not.`,
      `Tiny cries harder than you do at the awards show. He says it's allergies. It is February. Coach Okafor sends a two-word text: *Told you.* She never told you. You keep the text anyway.`,
    ][(String(S.last).length + (+S.num || 0)) % 2];
    if (f.you === 2) return `Tiny makes you a runner-up trophy out of cereal boxes and duct tape. Honestly, it's better than the real one.`;
    return `Tiny frames the final ballot and hangs it in his bathroom, "where people will actually read it." Not bad for a guy who wasn't on a single draft board in April.`;
  });

  // L toggles the league desk on the week hub.
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if ((e.key !== 'l' && e.key !== 'L') || screen !== 'play' || mini || $('#menu')) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const b = $('#lgDesk .lg-head');
    if (b) { e.preventDefault(); b.click(); }
  });

  // Public surface for other modules and tests.
  return {
    TEAMS, ROOKIES, BRYCE_SCHOOL,
    season, sync, standings: () => { const s = sync(); return s ? standings(s).rows : []; },
    ladder: () => { const s = sync(); return s && s.roy ? ladder(s) : []; },
    news: slate => { const s = sync(); return s ? newsFor(s, slate == null ? S.slate : slate) : []; },
    youPts,
  };
})();
// Test hook (same spirit as window.__undrafted.debug): lets automated tests reach the league.
setTimeout(() => { try { if (window.__undrafted) window.__undrafted.league = League; } catch (e) { /* ignore */ } }, 0);
