// =========================================================
//   YEAR TWO: a second season, started from the year-1 ending screen.
// =========================================================
/* You are the established starter now. The Hammerheads draft Bryce Calloway, a flashy first-round
   rookie at your position. Mentor him the way Vane eventually mentored you, or freeze him out.
   State:  S.y1       snapshot of year one (ending, record, playoffs, Vane, Leo, agent, stats...)
           S.career   { seasons: [...], line: totals }   (year-one totals added when year two starts)
           S.rel.bryce  0-100, year two only (fx({ bryce: n }) works like any relationship)
           S.ext.year2  arc choices: phase, contract, tone, target, tiny, scare, cover, vaneWeek, family...
   Hooks:  card, weekStart, gameStart, gameEnd, play, fx.   Mods: pay, diff, teamRating.
   Wraps:  P.ending, P.g_final, P.week_hub (activity swap), drawEvent, updateTopbar, contLabel.
   Custom hook emitted: 'newYear' (S) right after the year-two state is built. */

const isY2 = () => !!(S && S.year === 2);
function y2() {
  const y = ext('year2', () => ({ phase: 'season', tiny: {} }));
  if (!y.tiny) y.tiny = {};
  if (S.year === 2 && S.rel && S.rel.bryce == null) S.rel.bryce = 40;
  return y;
}
const Y1 = () => (S && S.y1) || { record: { w: 0, l: 0 }, line: {}, hist: [] };
const bryce = () => (S && S.rel && S.rel.bryce != null ? S.rel.bryce : 40);
const bnum = () => { const y = y2(); return y.bnum != null ? y.bnum : 1; };
// What happened to Marcus Vane after year one: the engine's four tiers, so both epilogues agree.
//   retired · signed (Frontier Mustangs) · quiet (released, "Eyes up, rook" on the way out) · released (no goodbye)
const vstat = () => vaneFate(S.y1 ? S.y1.vane : S.rel.vane);
const vaneGoneQuiet = () => { const v = vstat(); return v === 'quiet' || v === 'released'; };
// Tiny's year-one contract (story-arcs: S.ext.arcs.tiny.fate).
//   'one' or none: this is his contract year · 'three' / 'two' / 'gamble': under contract
//   'market' (Gulf Coast Hurricanes) / 'sly' (Neon City Jackpots): he plays somewhere else now
const tinyFate = () => (S && S.ext && S.ext.arcs && S.ext.arcs.tiny && S.ext.arcs.tiny.fate) || null;
const tinyGone = () => tinyFate() === 'market' || tinyFate() === 'sly';
const tinySigned = () => ['three', 'two', 'gamble'].includes(tinyFate());
const tinyCity = () => (tinyFate() === 'sly' ? 'Neon City' : 'Gulf Coast');
// Year-one Kingsley history (story-arcs: S.ext.arcs.dante) and year-one flags.
const danteArc = () => (S && S.ext && S.ext.arcs && S.ext.arcs.dante) || {};
const y1Flag = k => (Y1().flags || {})[k];
// The thing Bryce keeps asking you about, by position.
const READS = {
  QB: { what: 'safeties\' hips', text: 'what does the safety\'s hip tell you on a two-high look', act: 'read a defense from the way the safety stands' },
  RB: { what: 'cutback lanes', text: 'how do u know the backside cut is there before it\'s there', act: 'find the cutback lane from the way the backside linebacker flows' },
  WR: { what: 'cornerbacks\' hips', text: 'how do u know when the corner\'s hips are about to open', act: 'read a cornerback\'s hips before the snap' },
  LB: { what: 'guards\' stances', text: 'what does the guard\'s weight tell you, run or pass', act: 'read the play from where a guard puts his weight in his stance' },
};
const reads = () => READS[S.pos] || READS.QB;
const BODY = { QB: 'throwing shoulder', RB: 'hamstring', WR: 'hamstring', LB: 'knee' };
const famSir = () => (ORIGINS[S.origin].fp === 'he' ? 'sir' : 'ma\'am');
// Did something actually happen in year one? (Callbacks must not invent memories.)
const y1Final = () => !!(Y1().champion || Y1().lostRound === 12);
const y1Did = k => (Y1().used || []).includes(k);
const y2Phase = s => (s && s.ext && s.ext.year2 && s.ext.year2.phase) || 'season';
LABELS.bryce = 'Bryce';
function y2Remember(id, key, pairs) {
  const base = P[id];
  if (typeof base !== 'function') return;
  P[id] = a => {
    const pg = base(a);
    if (!pg || !Array.isArray(pg.choices) || (S.year || 1) !== 1) return pg;
    pg.choices = pg.choices.map(c => {
      const hit = c && c.do && pairs.find(([re]) => re.test(plain(c.label || '')));
      if (!hit) return c;
      const d = c.do;
      return Object.assign({}, c, { do() { S.flags[key] = hit[1]; return d.call(c); } });
    });
    return pg;
  };
}
y2Remember('w8_thanks', 'y2thanks', [[/Tiny's family/i, 'tiny'], [/^Skip it/i, 'skip'], [/./, 'family']]);
y2Remember('w9_leo', 'y2leo', [[/^Promise/i, 'promise'], [/gloves/i, 'gloves'], [/passed over/i, 'talk']]);

// The league desk's results (mods/league), read-only. Null when the league module isn't there.
function y1Last(id) {
  try {
    const sea = S.ext && S.ext.league && S.ext.league.seasons && S.ext.league.seasons[1];
    const t = sea && sea.teams && sea.teams[id];
    if (!t || t.w + t.l < 10) return false;
    const ws = Object.keys(sea.teams).map(k => sea.teams[k].w).concat(Y1().record.w);
    return t.w <= Math.min(...ws);
  } catch (e) { return false; }
}
function leagueLast(id, n) {
  try {
    if (typeof League === 'undefined' || !League.sync) return null;
    const sea = League.sync();
    const r = sea && (sea.res[n] || []).find(x => x.a === id || x.b === id);
    if (!r) return null;
    const mine = r.a === id, opp = mine ? r.b : r.a, team = (League.TEAMS || []).find(t => t.id === opp);
    const us = mine ? r.as : r.bs, them = mine ? r.bs : r.as;
    return { us, them, won: us > them, opp: team ? team.nick : shortName(String(opp).replace(/^X:/, '')) };
  } catch (e) { return null; }
}

// ---------- Trophies ----------
TROPHIES.push(
  ['y2_surge', 'Sophomore Surge', 'Win 7 or more regular-season games in Year Two.'],
  ['y2_mentor', 'Mentor', 'Reach 85 with Bryce Calloway, the rookie who wants your job.'],
  ['y2_dynasty', 'Dynasty', 'Win back-to-back Championships.'],
  ['y2_eyes', 'Eyes Up', 'Pass Marcus Vane\'s advice on to the next rookie.'],
);

// ---------- The year-two schedule ----------
SCHEDULE_Y[2] = [
  { team: 'Lakeshore Gulls', r: 57, venue: 'home', get blurb() {
    return `${S && y1Last('LAK') ? 'Last year\'s opener, and last year\'s doormat.' : 'Last year\'s opener.'} They spent the offseason buying a new quarterback and a new logo. The logo is a gull wearing sunglasses.`;
  } },
  { team: 'Bayou Gators', r: 61, venue: 'away', trait: { name: 'Swamp heat', note: 'Ninety-five degrees and soaking wet. This one costs extra energy.', energy: 4 }, blurb: `New on the schedule. They practice in 95-degree humidity, play in a stadium with no shade, and smile about it the whole time.` },
  { team: 'Desert Vipers', r: 62, venue: 'away', trait: { name: 'The Microwave', note: 'Their pass rusher gets home fast. Every play happens a little quicker.', diff: 0.25 }, blurb: `Still fast, still mean, still no roof. They added a pass rusher this year whose nickname is "The Microwave." Nobody will tell you why.` },
  { team: 'Steel Valley Smelters', r: 60, venue: 'home', trait: { name: 'Your page', note: 'Their secondary studied only you. Expect extra hard counts.', fakes: 1 }, blurb: `The yellow towels are back. So is their secondary, which spent the summer watching film of you. Only you.` },
  { team: 'Capital Monarchs', r: 74, rival: true, venue: 'away', trait: { name: 'Legacy game', note: 'Kingsley is playing for his legacy. Every snap is harder.', diff: 0.2 }, blurb: `Dante Kingsley is in his eleventh season, still wears the crown chain, and still runs his mouth on a podcast every Monday. Rumor says this is his last season. He hasn't said so. Yet.` },
  { team: 'Twin Rivers Otters', r: 56, venue: 'home', trait: { name: 'Trap game', note: 'Nobody takes the Otters seriously. That is exactly the trap.' }, blurb: `The league's newest team. Their mascot is an otter named Gary, and Gary has more followers than their quarterback. A trap game, if you've ever seen one.` },
  { team: 'Gulf Coast Hurricanes', r: 65, venue: 'away', get blurb() {
    if (!S) return `The high-flying passing attack is still flying, and still apologizing to nobody.`;
    const g = leagueLast('GCH', 5);
    let t = !g ? `The high-flying passing attack is still flying, and still apologizing to nobody.`
      : g.won && g.us >= 30 ? `The high-flying passing attack is still flying. They put up ${g.us} on the ${g.opp} last week and apologized to nobody.`
      : g.won ? `The high-flying passing attack is still flying, even on a slow day: they beat the ${g.opp} ${g.us}-${g.them} last week, and their coach called it "boring."`
      : `The high-flying passing attack got grounded last week, ${g.them}-${g.us} by the ${g.opp}. They spent all week throwing deep at practice, angrily.`;
    if (tinyFate() === 'market') t += S.pos === 'LB' ? ` And they have Tiny now. He'll be the one trying to block you, and he has already texted you a photo of his cleats.` : ` And they have Tiny now. He'll be on the other sideline all afternoon, and he has already texted you a photo of his cleats.`;
    return t;
  } },
  { team: 'Frontier Mustangs', r: 63, venue: 'away', trait: { name: 'Thin air', note: 'A mile above sea level. This one costs extra energy.', energy: 3 }, get blurb() {
    return S && S.y1 && vstat() === 'signed'
      ? `A mile above sea level. Bring your lungs, and bring your manners: Marcus Vane plays here now. Number {vnum}, same as always.`
      : `A mile above sea level. Bring your lungs. Their fans throw stuffed horseshoes onto the field after touchdowns, and they have excellent aim.`;
  } },
  { team: 'Prairie Bison', r: 59, venue: 'home', blurb: `The Thanksgiving game, again. Half the country will be watching with a plate in their lap. This year, one of those plates is at your house.` },
  { team: 'Capital Monarchs', r: 76, rival: true, venue: 'home', trait: { name: 'Last dance', note: 'Kingsley\'s final regular-season game. He will not go quietly.', diff: 0.2 }, blurb: `Kingsley's last regular-season game. The rematch, on your field. It's been sold out since August.` },
];
PLAYOFFS_Y[2] = [
  { team: 'Northfork Lumberjacks', r: 66, round: 'Wild Card', blurb: `They still run the ball forty times a game. This year they also dare you to tackle a fullback named Moose, who is listed at 260 pounds and is clearly heavier.` },
  { team: 'Capital Monarchs', r: 77, rival: true, trait: { name: 'Last stand', note: 'Lose, and Kingsley retires. He knows it.', diff: 0.3 }, round: 'Conference Championship', blurb: `Dante Kingsley's last stand. Win, and his career is over. Lose, and he gets one more game.` },
  { team: 'Empire Sentinels', r: 80, trait: { name: 'The machine', note: 'They have not lost since October. They do not make mistakes.', diff: 0.2 }, round: 'The Championship', get blurb() {
    const y = (S && S.y1) || {};
    return y.champion ? `The Sentinels lost to you in last year's Championship. They painted the final score on their weight-room wall, and they've been staring at it for a year.`
      : y.lostRound === 12 ? `The Sentinels beat you in last year's Championship. They still have the confetti. They will bring it.`
      : `The best team in the other conference, two years running. They haven't lost since October. Again.`;
  } },
];

if (typeof TEAM_STYLE === 'object') {
  TEAM_STYLE['Bayou Gators'] = { abbr: 'BAY', c1: '#3E6B2F', c2: '#E8C547' };
  TEAM_STYLE['Twin Rivers Otters'] = { abbr: 'TRO', c1: '#6B4226', c2: '#8FD3CC' };
}

// ---------- Contracts ----------
const DEALS = {
  team: { name: 'Hometown deal', term: 'Four years', bonus: 120000, weekly: 50000, catch: 'Leaves room to pay your teammates.' },
  max: { name: 'The big number', term: 'Four years', bonus: 250000, weekly: 68000, catch: 'Everyone will know what you make.' },
  bet: { name: 'Bet on yourself', term: 'One year', bonus: 40000, weekly: 44000, perWin: 25000, poWin: 60000, catch: 'Plus a bonus for every win.' },
  holdout: { name: 'Hold out', term: 'Whatever they cave to', bonus: 300000, weekly: 72000, catch: 'You skip camp. The rookie doesn\'t.' },
};
function dealTerms(k) {
  const d = Object.assign({}, DEALS[k]), ag = Y1().agent;
  if (ag === 'sly' && (k === 'max' || k === 'holdout')) d.bonus = Math.round(d.bonus * 1.2);
  if (ag === 'steady' && k === 'bet') d.perWin = 30000;
  if (ag === 'steady' && k === 'team') d.bonus += 40000;
  return d;
}
function offerHTML() {
  const cell = k => {
    const d = dealTerms(k);
    const extra = k === 'bet' ? `<dt>Per win</dt><dd>+${money(d.perWin)}</dd>` : '';
    return `<div class="y2-deal y2-deal-${k}"><b>${esc(d.name)}</b><span class="y2-term">${esc(d.term)}</span>
      <dl><dt>Signing bonus</dt><dd>${money(d.bonus)}</dd><dt>Weekly check</dt><dd>${money(d.weekly)}</dd>${extra}</dl>
      <span class="y2-catch">${esc(d.catch)}</span></div>`;
  };
  return `<div class="y2-offer" role="group" aria-label="Contract offers">
    <div class="y2-offer-h"><span>Harbor City Hammerheads</span><span>Offer sheet · ${fmt('{first} {last}')}</span></div>
    <div class="y2-offer-grid">${['team', 'max', 'bet', 'holdout'].map(cell).join('')}</div>
    <div class="y2-offer-f">Last year's game check: ${money(Y1().check || Math.round(mod('pay', 48000)))} a week.</div></div>`;
}
addMod('pay', v => {
  if (!isY2()) return v;
  const c = y2().contract;
  return c ? v * c.weekly / 48000 : v;
});

// ---------- Year summaries ----------
function poText(f) {
  if (!f) return 'Missed';
  return f.champion ? 'Champions' : f.lostRound != null ? { 10: 'Lost wild card', 11: 'Lost conf. final', 12: 'Lost the final' }[f.lostRound] : f.inPO ? 'Playoffs' : 'Missed';
}
function poShort(f) {
  if (!f) return 'Missed';
  return f.champion ? 'Won it all' : f.lostRound != null ? { 10: 'Lost WC', 11: 'Lost semi', 12: 'Lost final' }[f.lostRound] : f.inPO ? 'Playoffs' : 'Missed';
}
function addTotals(into, line) {
  for (const k in line) {
    if (k === 'long') into.long = Math.max(into.long || 0, line.long || 0);
    else into[k] = (into[k] || 0) + (line[k] || 0);
  }
}
function recapHTML() {
  const y = Y1(), E = ENDINGS[y.ending];
  const tiles = [[`${y.record.w}-${y.record.l}`, 'Record'], [poText(y), 'Playoffs'], [y.grade != null ? letter(y.grade) : '–', 'Avg grade']]
    .concat(POS[S.pos].stats.map(([k, l]) => [(y.line || {})[k] || 0, l]));
  const res = (y.hist || []).map(h => `<span class="res ${h.won ? 'w' : 'l'}">${h.won ? 'W' : 'L'} ${esc(h.opp)} ${h.us}-${h.them}</span>`).join('');
  return `<div class="y2-recap"><div class="y2-recap-h"><span>Year one</span>${E ? `<b>${fmt(E.title)}</b>` : ''}</div>
    <div class="sumgrid">${tiles.map(t => `<div><b>${esc(t[0])}</b><span>${esc(t[1])}</span></div>`).join('')}</div>
    ${res ? `<div class="results">${res}</div>` : ''}</div>`;
}
function compareHTML() {
  const y = Y1(), cur = { champion: S.flags.champion, lostRound: S.flags.lostRound, inPO: S.flags.inPO };
  const g2 = S.grades.length ? letter(avgGrade()) : '–';
  const rows = [
    ['Record', `${y.record.w}-${y.record.l}`, `${S.record.w}-${S.record.l}`, `${y.record.w + S.record.w}-${y.record.l + S.record.l}`],
    ['Playoffs', poShort(y), poShort(cur), [y.champion, S.flags.champion].filter(Boolean).length ? `${[y.champion, S.flags.champion].filter(Boolean).length} ring${y.champion && S.flags.champion ? 's' : ''}` : '–'],
    ['Avg grade', y.grade != null ? letter(y.grade) : '–', g2, ''],
  ];
  for (const [k, l] of POS[S.pos].stats) {
    const a = (y.line || {})[k] || 0, b = S.line[k] || 0;
    rows.push([l, a, b, k === 'long' ? Math.max(a, b) : a + b]);
  }
  return `<div class="ending-mark">Two seasons</div><div class="y2-compare-wrap"><table class="y2-compare">
    <thead><tr><th scope="col"><span class="y2-sr">Stat</span></th><th scope="col">Year 1</th><th scope="col" class="y2-now">Year 2</th><th scope="col">Career</th></tr></thead>
    <tbody>${rows.map(r => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td class="y2-now">${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table></div>
    <div class="y2-bryce-final"><span>Bryce Calloway</span><span class="bar"><i style="width:${bryce()}%"></i></span><b>${bryce()}</b><em>${esc(bryceWord())}</em></div>`;
}
function bryceWord() {
  const b = bryce();
  return b >= 80 ? 'Your rookie' : b >= 60 ? 'Friends' : b >= 40 ? 'Coworkers' : b >= 21 ? 'Rivals' : 'Cold war';
}

// ---------- Starting year two ----------
function startYearTwo() {
  if (!S || (S.year || 1) !== 1) return;
  const f = S.flags;
  S.y1 = {
    ending: f.ending || null, record: { w: S.record.w, l: S.record.l }, champion: !!f.champion,
    lostRound: f.lostRound == null ? null : f.lostRound, inPO: !!f.inPO, vane: S.rel.vane,
    leoKept: !!f.leoKept, leoPromise: !!f.leoPromise, leoVisit: !!f.leoVisit, agent: f.agent || null,
    trash: f.trash || null, famAtGame: !!f.famAtGame, wasSquad: !!f.wasSquad, vaneStart: !!f.vaneStart,
    keep: f.keep == null ? null : f.keep, grade: S.grades.length ? avgGrade() : null, line: Object.assign({}, S.line),
    hist: S.hist.slice(), used: (S.used || []).slice(), flags: Object.assign({}, f), money: S.st.money, fame: S.st.fame, chem: S.st.chem, role: S.role, num: S.num,
    check: Math.round(mod('pay', S.role === 'practice' ? 13000 : 48000)), // the regular-season game check you were actually getting (practice squad, difficulty and perks included)
  };
  const car = S.career || (S.career = { seasons: [], line: {} });
  if (!car.seasons.some(x => x.year === 1)) {
    car.seasons.push({ year: 1, record: S.y1.record, po: poText(S.y1), grade: S.y1.grade, ending: S.y1.ending, line: Object.assign({}, S.line) });
    addTotals(car.line, S.line);
  }
  const before = S.st.skill;
  S.st.skill = Math.min(before, Math.max(45, before - 15)); // rust never raises skill
  S.st.energy = 80;
  S.record = { w: 0, l: 0 };
  S.line = {}; S.grades = []; S.hist = []; S.queue = []; S.inject = []; S.injectNext = null;
  S.wk = null; S.game = null; S.runTrophies = []; S.recentMoments = []; S.camp = 0;
  S.flags = f.agent ? { agent: f.agent } : {};
  // Rookie traditions belong to rookies now; year two has its own versions (and its own Hands Greer and
  // Coach Delgado events, so the year-one ones with the same premise are retired too).
  S.used = (S.used || []).slice();
  ['dinner', 'song', 'legend', 'helmets'].forEach(k => { if (!S.used.includes(k)) S.used.push(k); });
  S.role = 'starter';
  S.year = 2;
  S.slate = 0;
  S.rel.bryce = 35;
  const nums = POS[S.pos].nums.filter(n => n !== S.num && n !== VANE_NUM[S.pos]);
  S.ext = S.ext || {};
  S.ext.year2 = { phase: 'prologue', bnum: nums[0] || 1, rust: [before, S.st.skill], tiny: {}, bonusPaid: 0 };
  emit('newYear', S);
  go('y2p_offseason');
}
ACTIONS.y2begin = () => { y2().phase = 'season'; S.slate = 0; beginWeek(); };

UI.startNextYear = startYearTwo;
UI.canStartNextYear = () => !!S && (S.year || 1) === 1;
UI.nextYearLabel = 'Play Year Two';
UI.nextYearSub = 'You\'re the starter now. The Hammerheads just drafted your replacement.';

// The status bar and the title screen's Continue button.
const _y2UpdateTopbar = updateTopbar;
updateTopbar = function () {
  _y2UpdateTopbar();
  if (screen !== 'play' || !S || S.year !== 2 || !S.at) return;
  const st = $('#status');
  if (!st) return;
  if (y2Phase(S) === 'prologue') st.textContent = 'Year 2 · Offseason';
  else if (S.at.id === 'ending') st.textContent = 'Year 2 · Season over';
  else if (S.slate >= 10) st.textContent = 'Year 2 · ' + st.textContent;
};
const _y2ContLabel = contLabel;
contLabel = function (s) {
  if (s && s.year === 2) {
    if (y2Phase(s) === 'prologue') return 'Year 2, Offseason';
    if (s.at && s.at.id === 'ending') return 'Year 2, Season over';
    if (s.slate >= 10) return 'Year 2, ' + _y2ContLabel(s);
  }
  return _y2ContLabel(s);
};

// ---------- Player card: Bryce replaces Vane on the relationship meters ----------
let lastBryceBar = null;
on('card', el => {
  if (!isY2()) return;
  const v = bryce();
  const from = lastBryceBar == null ? v : lastBryceBar;
  lastBryceBar = v;
  const cls = from === v ? '' : v > from ? ' rose' : ' fell';
  const color = v < 25 ? 'var(--m-neg)' : 'var(--m-chem)';
  const html = `<div class="meter-row y2-brow${cls}" title="Bryce Calloway: 0 to 100"><span class="ml">Bryce</span><span class="bar"><i style="width:${from}%;background:${color}" data-to="${v}"></i></span><span class="mv">${v}</span></div>`;
  const row = el.querySelector('.meter-row[title^="Marcus Vane"]');
  if (row) row.outerHTML = html;
  const role = el.querySelector('.pc-role');
  if (role) role.textContent += ' · Year 2';
});

// ---------- Weekly flow: roles, pressure, Bryce's games ----------
UI.roleLine = (prev => role => {
  if (isY2()) {
    const b = bryce();
    if (role === 'starter') return b >= 60 ? `You're the starting {pos}. Bryce Calloway watches every snap you take from three feet away, taking notes in a phone app he named after you.`
      : b <= 25 ? `You're the starting {pos}. Bryce Calloway watches every snap you take from three feet away. Waiting.`
      : `You're the starting {pos}, and everybody knows it. Bryce Calloway watches every snap you take from three feet away.`;
    if (role === 'rotation') return `You and Bryce Calloway are splitting snaps this week. It feels different from this side.`;
    if (role === 'backup') return `Bryce Calloway gets the start this week. You're the emergency plan, in a hoodie, with a heat pack on your ${BODY[S.pos]}.`;
  }
  return prev ? prev(role) : null;
})(UI.roleLine);

on('weekStart', n => {
  if (!isY2()) return;
  const y = y2();
  if (y.roleNext && y.roleNext.slate === n) { S.role = y.roleNext.role; y.roleUntil = n; y.roleNext = null; }
  else if (y.roleUntil != null && n > y.roleUntil) { S.role = 'starter'; y.roleUntil = null; }
});
addMod('diff', v => {
  if (!isY2()) return v;
  const y = y2(), c = y.contract;
  let d = 0;
  if (c && c.deal === 'max') d += 0.2;
  if (c && c.deal === 'holdout' && S.slate <= 1) d += 0.35;
  if (y.target === 'study') d -= 0.15;
  if (y.target === 'embrace') d += 0.15;
  return v + d;
});
addMod('teamRating', v => {
  if (!isY2()) return v;
  const y = y2(), b = bryce();
  let r = v;
  if (y.target === 'decoy') r += 2.5;
  if (b >= 70) r += 1.5;
  if (b <= 20) r -= 2;
  // When Bryce starts, his talent (and how much you've taught him) carries the offense.
  if (S.role === 'backup' && S.game && S.game.y2bryce) r += (55 + b / 5 - 50) * 0.25;
  return r;
});
on('gameStart', g => {
  if (!isY2()) return;
  const y = y2();
  if (S.role === 'backup' || S.role === 'rotation') g.y2bryce = true;
  if (g.n === 5 && y.scare === 'sit') { g.plan = []; g.y2sit = true; } // Emergency duty only: you play only if it comes down to the last drive.
});
// A sit-out game you never got into adds nothing to your stat line (the engine credits a backup's share otherwise).
const _y2FinishGame = finishGame;
finishGame = function () {
  const g = S && S.game;
  if (!isY2() || !g || g.done || !g.y2sit || (g.res && g.res.length)) return _y2FinishGame.apply(this, arguments);
  const realAddLine = addLine;
  addLine = () => {};
  try { return _y2FinishGame.apply(this, arguments); } finally { addLine = realAddLine; }
};
on('play', p => {
  if (!isY2()) return;
  if (y2().target === 'embrace' && p.r === 'great') fx({ fame: 1 }, true);
});
on('fx', () => { if (isY2() && bryce() >= 85) award('y2_mentor'); });
// Bryce warms up slowly, and how you first treated him sets the pace for everything after.
addMod('fx.bryce', v => {
  if (!isY2() || v <= 0) return v;
  const k = { mentor: 0.75, friend: 0.7, rival: 0.55, cold: 0.45 }[y2().tone] || 0.8;
  return Math.max(1, Math.round(v * k));
});

function bryceLine(q, half) {
  const s = half ? 0.55 : 1, R = v => Math.max(0, Math.round(v * s));
  switch (S.pos) {
    case 'QB': { const att = R(ri(24, 34)), comp = Math.round(att * (0.5 + q * 0.25)); return `${comp} of ${att}, ${R(150 + q * 190)} yards, ${q > 0.66 ? (half ? 1 : 2) : q > 0.35 ? 1 : 0} TD, ${q < 0.3 ? (half ? 1 : 2) : q < 0.5 ? 1 : 0} INT`; }
    case 'RB': return `${R(ri(14, 22))} carries, ${R(40 + q * 110)} yards, ${q > 0.6 ? 1 : 0} TD`;
    case 'WR': return `${R(ri(4, 8))} catches, ${R(35 + q * 95)} yards, ${q > 0.62 ? 1 : 0} TD`;
    default: return `${R(ri(5, 10))} tackles, ${q > 0.7 ? 1 : 0} sacks, ${q > 0.82 ? 1 : 0} takeaways`;
  }
}
on('gameEnd', g => {
  if (!isY2()) return;
  const y = y2(), lines = [], b = bryce();
  const c = y.contract;
  if (c && c.deal === 'bet' && g.won) {
    const pay = g.n >= 10 ? c.poWin : c.perWin;
    y.bonusPaid = (y.bonusPaid || 0) + pay;
    fx({ money: pay });
    lines.push({ note: `Win bonus: +${money(pay)}. Betting on yourself has paid ${money(y.bonusPaid)} so far.` });
  }
  if (g.y2bryce) {
    const q = clamp(0.42 + (b - 50) / 220 + rand(-0.25, 0.25), 0, 1);
    const half = S.role === 'rotation';
    lines.push({ note: `Bryce Calloway${half ? ', in his series' : ''}: ${bryceLine(q, half)}.` });
    lines.push(q >= 0.6
      ? (b >= 55 ? `Bryce finds you in the locker room before he finds his phone. "Did you see the third-quarter read? That was your read." It was. You both know it.` : `Bryce does The Calloway on the sideline after his best play. The cameras love it. He looks over to see if you saw. You saw.`)
      : q <= 0.35
        ? (b >= 55 ? `It's a rough day for the rookie. He sits at his locker with his helmet still on. You sit down next to him and don't say anything for a while. Then you say, "Film at eight." He almost laughs.` : `It's a rough day for the rookie. He walks past you in the locker room without looking up. You remember that walk.`)
        : `Not bad for a rookie. Not great either. He asks {coachLast} for the tape before he's even out of his pads.`);
  }
  if (g.n === 0 && y.leo === 'promise' && y.leoKept2 == null) {
    const kept = S.pos === 'LB' ? !!(g.line.take || g.line.sacks || g.line.td) : !!g.line.td;
    y.leoKept2 = kept;
    if (kept) { fx({ fame: 4, conf: 3 }); lines.push(`After the final whistle, Leo runs onto the field with the coin still in his fist. You hand him the ball. He's ten. He can't hold both. He tries anyway.`); }
    else lines.push(`No {big} for Leo today. He doesn't care. "You played," he says. "Last year I couldn't even come." It's the best review you've gotten all year.`);
  }
  if (g.n === 6 && tinyFate() === 'market') lines.push(`After the final whistle, Tiny finds you at midfield in the wrong colors, picks you up off the ground, and puts you back down facing the right way. "${g.won ? 'Good game, bro. I hate it.' : 'Sorry, bro. Not sorry. Love you.'}"`);
  if (g.n === 9) lines.push(`Dante Kingsley's last regular-season game is over. He jogs across the field, finds you first, and taps your chest twice. "${g.won ? 'One more time, in January. Maybe.' : 'Still got it. Barely. See you in January. Maybe.'}"`);
  if (g.n === 11) lines.push(g.won
    ? `Dante Kingsley's career ends at midfield. He finds you in the scrum, takes off the crown chain, and hangs it around Bryce's neck instead of yours. "You already got yours," he tells you. "The kid needs something to grow into."`
    : `Kingsley gets one more game. At midfield he grabs your helmet with both hands. "Two years," he says. "Best rivalry I ever had. Don't tell the guys in Steel Valley."`);
  if (g.n === 12 && g.won && Y1().champion) { award('y2_dynasty'); lines.push(tinyGone() ? `**Back-to-back.** By the time you get off the field, your phone has forty-one texts from Tiny in ${tinyCity()}. Most of them just say BRO.` : `**Back-to-back.** Tiny says it out loud nine times, like he's trying to get used to the taste of it.`); }
  if (g.n < 10 && S.record.w >= 7) award('y2_surge');
  g.y2 = lines;
});
const _y2GFinal = P.g_final;
P.g_final = a => {
  const pg = _y2GFinal(a);
  if (isY2() && S.game && S.game.y2 && S.game.y2.length) pg.body = (pg.body || []).concat(S.game.y2);
  return pg;
};

// Game-day role lines and the slump beat still talk about Vane; in year two the other guy is Bryce.
const _y2GamePre = P.game_pre;
P.game_pre = a => {
  const pg = _y2GamePre(a);
  if (isY2() && pg && Array.isArray(pg.body) && pg.body.length) {
    const line = { rotation: `You and Bryce will trade series today. You can feel him counting yours.`, backup: `Bryce Calloway starts today. You're on the sideline in a hoodie with a heat pack, one emergency away from going in.` }[S.role];
    if (line) pg.body[pg.body.length - 1] = line;
    // Tiny plays somewhere else now: the engine's pregame flavor can't have him in your tunnel.
    if (tinyGone()) {
      const alt = [`Your new center bangs his helmet against yours three times, the way Tiny used to. He's been practicing. It's close.`,
        `The national anthem singer holds the last note for eleven seconds. Somewhere in ${tinyCity()}, Tiny is timing it on his fingers. You'd bet on it.`];
      pg.body = pg.body.map(x => (typeof x === 'string' && /\bTiny\b/.test(x) ? alt[/helmet/.test(x) ? 0 : 1] : x));
    }
  }
  return pg;
};
if (P.slump) {
  const _y2Slump = P.slump;
  P.slump = a => {
    const pg = _y2Slump(a);
    if (!isY2() || !pg || !Array.isArray(pg.choices)) return pg;
    pg.choices = pg.choices.filter(c => !/Marcus Vane/.test(plain(c.label || '')));
    pg.choices.unshift({ if: () => bryce() >= 45, label: 'Answer the door. It\'s Bryce, with a tablet.', do() {
      S.flags.slumpDone = true; S.flags.slumpWeek = S.slate; S.flags.slumpWay = 'bryce';
      fx({ conf: 7, skill: 2, bryce: 6 });
      return [`Bryce is standing in your doorway at 9 p.m. with a tablet and a bag of takeout.`, { s: 'Bryce Calloway', t: `My turn. Sit down. You're doing seven things wrong.` }, `It turns out to be four things. He's right about three of them. You don't tell him that. He can tell.`];
    } });
    return pg;
  };
}

// ---------- Weekly activity: coach up the rookie (replaces "Study with Vane" in year two) ----------
const Y2_ACT = {
  id: 'y2mentor', name: 'Coach up Bryce',
  desc: () => (bryce() >= 60 ? `Bryce brings the tablet now. He has questions. So many questions.` : `Film and footwork with the rookie who wants your job. Teaching it makes you better at it.`),
  chips: [['+Bryce', 'up'], ['+Skill', 'up'], ['−Energy', 'down']],
  req: () => bryce() >= 25, lock: 'Bryce won\'t sit with you yet',
  run: () => {
    fx({ bryce: 6, skill: 2, coach: 1, energy: -7 });
    return pick([
      `You show Bryce how to ${reads().act}. He'll never unsee it. Neither will you.`,
      `You rewind one play nine times. "See it yet?" On the ninth time, he does. You realize you just did a Marcus Vane impression, and you don't hate it.`,
      `Bryce asks why you always tap your helmet before third down. You didn't know you did that. He's been watching you closer than you thought.`,
      `You tell Bryce about your rookie year: the 257 names, the 11:52 phone call, the Turk. He had no idea. He thought you were always this.`,
    ]);
  },
};
let y2VaneAct = null;
function y2SyncActs() {
  const iY = ACTS.indexOf(Y2_ACT), iV = ACTS.findIndex(a => a.id === 'mentor');
  if (isY2()) {
    if (iV >= 0) { y2VaneAct = ACTS[iV]; if (iY >= 0) ACTS.splice(iV, 1); else ACTS[iV] = Y2_ACT; }
    else if (iY < 0) ACTS.push(Y2_ACT);
  } else if (iY >= 0) {
    if (y2VaneAct && iV < 0) ACTS[iY] = y2VaneAct; else ACTS.splice(iY, 1);
  }
}
const _y2Hub = P.week_hub;
P.week_hub = a => { y2SyncActs(); return _y2Hub(a); };

// Year-two random events come up most of the time in year two.
const _y2DrawEvent = drawEvent;
drawEvent = function () {
  if (isY2() && chance(0.75)) {
    const pool = Object.keys(EVENTS).filter(k => k.startsWith('y2e_') && !S.used.includes(k) && (!EVENTS[k].if || EVENTS[k].if()));
    if (pool.length) {
      const seen = trophyData().events, fresh = pool.filter(k => !seen[k]);
      const k = pick(fresh.length && chance(0.75) ? fresh : pool);
      remember('events', k);
      S.used.push(k);
      return k;
    }
  }
  return _y2DrawEvent();
};

// =========================================================
//   PROLOGUE (offseason → contract → draft night → locker room → scrimmage)
// =========================================================
P.y2p_offseason = () => {
  const y = Y1(), vs = vstat(), rust = y2().rust;
  const opener = y.champion ? `A month ago you were standing in orange-and-white confetti. Now people recognize you at the grocery store. One man follows you through three aisles to tell you about his fantasy team.`
    : y.lostRound === 12 ? `Last season ended one game short, under confetti in the wrong colors. You have watched the final drive eleven times. Okafor has watched it more${okaforLeft() ? ', from her new office at Ridgeline' : ''}. She sends you timestamps.`
    : y.inPO ? `Last season ended in the playoffs, which is more than anybody predicted for an undrafted rookie. Anybody except {fam}.`
    : `Last season ended before the playoffs. But it ended with you on the roster, and that was never supposed to happen either.`;
  const vaneLine = {
    retired: `Marcus Vane retired at the start of the month, the way he said he would. A TV network hired him a week later to talk about football on Sunday mornings. The suit they gave him doesn't fit his shoulders. His brass nameplate is still in your locker. *Your turn. Eyes up.*`,
    signed: `Marcus Vane signed a two-year deal with the Frontier Mustangs. The day it went through, he texted you: *Stop looking at your feet. Proud of you, rook.* You looked down. You were looking at your feet.`,
    quiet: `Marcus Vane was released at the start of the month. On his way out of the building he stopped at your locker, tapped the nameplate, and said, "Eyes up, rook." That was the whole goodbye. His old locker is still empty. Rocco, the equipment manager, won't give it to anybody.`,
    released: `Marcus Vane was released at the start of the month. You haven't heard from him since. His old locker is still empty. Rocco, the equipment manager, won't give it to anybody. He won't say why.`,
  }[vs];
  const body = [
    opener,
    `A year ago, your phone sat face-down on a couch cushion for four hours. Now it won't stop buzzing. Shoe companies. Podcasts. A man who wants you to endorse a mattress shaped like a football. (You pass.)`,
    vaneLine,
  ];
  if (okaforLeft()) body.push(`Ridgeline State introduced Nina Okafor as its head coach in a gym full of screaming students. She sent you the video with one line: *Don't you dare coast on the new guy.* The new guy is Lou Pettis, the Hammerheads' new {poscoach}: twenty-two years in the league, a whistle he never blows, and a reputation for never once raising his voice.`);
  if (rust && rust[1] < rust[0]) body.push({ note: `Offseason rust: Skill ${rust[0]} → ${rust[1]}. It comes back fast if you work.` });
  body.push(`The report date is March 30th. You have three weeks. How do you spend them?`);
  return {
    kicker: 'Year Two · The offseason',
    title: 'This Time, the Phone Rings',
    html: recapHTML(),
    body,
    choices: [
      { label: S.origin === 'city' ? 'Go back to the old neighborhood and train with Coach Delgado.' : 'Fly home to {home} and train with Coach Delgado.', do() { y2().off = 'delgado'; fx({ skill: 4, family: 6, energy: -4 }); return [`Coach Delgado still runs practice with the same whistle, the same clipboard, and the same windbreaker he had when you were fifteen. He runs you through the same drills, too.`, { s: 'Coach Delgado', t: `You got rich and you got slow.` }, `You did not get slow. You run it again anyway.`]; }, then: 'y2p_contract' },
      { label: 'Rest. Actually rest.', do() { y2().off = 'rest'; fx({ energy: 15, conf: 4 }); return [`You sleep. You let your body forget last season one bruise at a time. You learn to cook three things. One of them is good.`]; }, then: 'y2p_contract' },
      { label: 'Do the talk-show circuit.', do() { y2().off = 'shows'; fx({ fame: 8, money: 25000, energy: -6 }); return [`Nine shows in eleven days. You say "one game at a time" forty-one times. Somebody counts. It becomes a drinking game on a podcast you've never heard of.`]; }, then: 'y2p_contract' },
      { label: 'Spend all three weeks with {fam}.', do() {
          y2().off = 'family'; fx({ family: 10, conf: 3 });
          return [{ town: `You work the counter at the Bluebird Diner for three weeks. Grandma Bea pays you in pie and criticism. The pie is better.`, city: `You take Mom to breakfast after every night shift. She falls asleep in the booth twice. You let her.`, base: `Dad wakes you at 0530 every day for a run. On the last day, you wake him up instead. He pretends to be annoyed. He isn't.` }[S.origin]];
        }, then: 'y2p_contract' },
    ],
  };
};

P.y2p_contract = () => {
  const ag = Y1().agent;
  const intro = ag === 'sly'
    ? [`Sly Pemberton picks you up in the convertible. He's had your blazer tailored without asking.`, { s: 'Sly Pemberton', t: `Kid. Kid. You know what you are now? Leverage. Undrafted to starter is the best story in sports, and stories get paid. Let me do the talking. Okay, you can do some of the talking.` }]
    : ag === 'steady'
      ? [`Margaret meets you in the lobby with a folder that has color-coded tabs.`, { s: 'Margaret', t: `I've read their offer three times. It's fair. Fair isn't the only thing on the table, though. Here's everything, in order.` }]
      : [`You don't have an agent, so you represent yourself. You watched four videos about negotiation and bought a blazer. The blazer was a mistake. It's 84 degrees out.`];
  return {
    kicker: 'Year Two · March',
    title: 'The Second Contract',
    body: intro.concat([
      `The front office meets you in a glass conference room with a view of the practice field. Coach Bramble sits at the end of the table and says nothing. He's here, you realize, to watch how you handle this.`,
      `Your rookie deal is up. The general manager slides four sheets of paper across the table.`,
      { s: 'Coach Bramble', t: `Whatever you sign, the job's the same. Win.` },
    ]),
    after: offerHTML(),
    choices: ['team', 'max', 'bet', 'holdout'].map(k => {
      const d = dealTerms(k);
      const label = { team: 'Take the hometown deal.', max: 'Push for the big number.', bet: 'Bet on yourself: one year, paid by the win.', holdout: 'Hold out until they blink.' }[k];
      const sub = { team: `${money(d.bonus)} now, ${money(d.weekly)} a week. Leaves room under the cap.`, max: `${money(d.bonus)} now, ${money(d.weekly)} a week. Everyone will be watching.`, bet: `${money(d.bonus)} now, ${money(d.weekly)} a week, plus ${money(d.perWin)} every win.`, holdout: `The most money. The most risk. You skip camp, and the rookie doesn't.` }[k];
      return { label, sub, do() { return signDeal(k); }, then: 'y2p_draft' };
    }),
  };
};
function signDeal(k) {
  const d = dealTerms(k), y = y2(), ag = Y1().agent;
  y.contract = { deal: k, weekly: d.weekly, bonus: d.bonus, perWin: d.perWin || 0, poWin: d.poWin || 0 };
  const agentSays = (sly, steady, none) => (ag === 'sly' ? sly : ag === 'steady' ? steady : none);
  if (k === 'team') {
    fx({ money: d.bonus, chem: 8, coach: 6 });
    return [`You sign it right there. Bramble stands up, shakes your hand, and says one word: "Smart." Then he leaves, because that was the longest meeting on his calendar.`,
      agentSays(`Sly takes off his sunglasses to look at you, which you've never seen him do. "Hometown discount," he says, like it's a disease.`,
        tinyGone() || tinySigned() ? `Margaret nods. "That's a deal you can live with for four years. And it leaves them room to pay the people you'll need." She means the offensive line. She doesn't say the offensive line.` : `Margaret nods. "That's a deal you can live with for four years. And it leaves them room to pay the people you'll need." She means Tiny. She doesn't say Tiny.`,
        `On the way out, the general manager tells you you're a terrible negotiator. He says it like a compliment.`),
      { note: `Hometown deal: ${money(d.weekly)} a week. The front office has room to pay your teammates.` }];
  }
  if (k === 'max') {
    fx({ money: d.bonus, fame: 6, conf: 4, chem: -4 });
    return [`You ask for the big number. You don't blink. Neither does anybody else, for about forty seconds. Then the general manager writes something on a legal pad and slides it over. It has more zeroes than your high school's annual budget.`,
      agentSays(`Sly kisses the legal pad. On the mouth.`, `Margaret reads it three times, then nods at you, very slightly. You'd go to war for that nod.`, `You sign it with a pen you will frame later.`),
      `By dinner, the number is on every sports site in the country, under the headline WORTH IT?`,
      { note: `The big number: ${money(d.weekly)} a week. Everybody's watching, so game days are a little harder all year.` }];
  }
  if (k === 'bet') {
    fx({ money: d.bonus, conf: 6, coach: 4 });
    return [`One year. A smaller base salary, plus a bonus every time the Hammerheads win. The general manager raises an eyebrow. Bramble, for the first time all meeting, looks at you instead of through you.`,
      { s: 'Coach Bramble', t: `Paid by the win. That's how I'd do it.` },
      agentSays(`Sly makes a sound like a balloon losing air.`, `Margaret had already written the incentive clause. She slides it across the table before you finish your sentence.`, `You feel extremely smart for the rest of the day.`),
      { note: `Bet on yourself: ${money(d.weekly)} a week, plus ${money(d.perWin)} for every win and ${money(d.poWin)} for every playoff win.` }];
  }
  // Holdout
  S.role = 'rotation'; y.roleUntil = 0; y.holdout = true;
  fx({ money: d.bonus, conf: 3, coach: -12, chem: -10, skill: -3 });
  return [`You stand up and walk out of the meeting. It's very dramatic. You have to come back for your blazer.`,
    `Training camp opens without you. Every morning, Jules Park's camp report starts with the same sentence: *{LAST} is not here.* And every morning, the next sentence is about the rookie taking your reps.`,
    `On day 23, they blink. The general manager calls at 6 a.m. and agrees to everything.`,
    agentSays(`Sly sends you a voice memo that's just him laughing for nineteen seconds.`, `Margaret calls to say it's done. "Congratulations," she says. "I'd like it noted that I advised against this."`, `You pulled off a holdout by yourself. That's either very brave or very dumb. The locker room has opinions.`),
    { warn: `Holdout: ${money(d.weekly)} a week, but the coaches are cold, the locker room is colder, and you'll split snaps in the opener.` }];
}

P.y2p_draft = () => {
  const hold = !!y2().holdout;
  const ticker = `Analysts call Calloway "a day-one starter" · The Hammerheads already have {first} {last} at {pos} · "This feels like a message," says one former GM · Calloway trademarked his celebration in college · `;
  const meas = { QB: '6\'3" · 4.62 forty', RB: '5\'11" · 4.38 forty', WR: '6\'1" · 4.36 forty', LB: '6\'2" · 4.52 forty' }[S.pos];
  const html = `<div class="y2-draft" role="img" aria-label="${esc(plain('TV graphic: Round 1, pick 12. The Harbor City Hammerheads select Bryce Calloway, {pos}, Southern Pines.'))}">
    <div class="y2-draft-top"><span class="y2-live">Live</span><span>Round 1 · Pick 12</span></div>
    <div class="y2-draft-main"><div class="y2-pick">12</div><div class="y2-draft-who"><div class="y2-team">Harbor City Hammerheads select</div><div class="y2-name">Bryce Calloway</div><div class="y2-meta">${esc(S.pos)} · Southern Pines · ${esc(meas)}</div></div></div>
    <div class="y2-ticker" aria-hidden="true"><span>${fmt(ticker + ticker)}</span></div></div>`;
  return {
    kicker: 'Year Two · Draft night',
    title: 'Pick Twelve',
    html,
    body: [
      `Last April, you watched 257 names scroll across the bottom of a TV, and none of them were yours. This April, you only have to watch one.`,
      tinyGone() ? (hold ? `You're holding out, so you watch the draft alone on your couch, like a fan. Tiny texts you from ${tinyCity()}: a photo of a folding table, a slow cooker, and a TV in an apartment that still has moving boxes in it. *Draft party for one,* he writes. *Two if you count the slow cooker.*`
          : `You watch at home, with Tiny on a video call from his new place in ${tinyCity()}. He has set up a folding table and a slow cooker anyway, out of habit. "Draft party," he says. "Long-distance edition."`)
        : hold ? `You're holding out, so you watch the draft alone on your couch, like a fan. Tiny texts you a photo from his draft party: a folding table, a slow cooker, an empty chair. Then he stops texting.`
        : `You're at Tiny's draft party: a folding table, a TV the size of a garage door, and a slow cooker full of something Nana Fonoti refuses to name.`,
      `Pick twelve. The Hammerheads are on the clock. ${hold ? 'Your apartment' : 'The room'} goes quiet.`,
      `**Bryce Calloway. {POS}. Southern Pines.** Gold cleats, a celebration he trademarked before he played a college game, and a forty time that made a scout drop his stopwatch.`,
      `He plays your position. The Hammerheads already have a starting {pos}. You.`,
      `Your phone buzzes. Okafor${okaforLeft() ? ', from Ridgeline' : ''}: *Don't read into it.* Ten seconds later: *Okay, read into it a little. Then go to work.*`,
    ],
    choices: [
      { label: 'Text Bryce: "Welcome to Harbor City. The locker next to mine is open."', do() { y2().draft = 'text'; fx({ bryce: 12, coach: 2 }); return [`Three dots appear. Disappear. Appear again. Then: *who is this*`, `You send your name. A minute later: *oh. OH. ok. respect. see u there big dog*`, hold ? `You read it four times. Nobody's around to see you smile at your phone.` : tinyGone() ? `You hold your phone up to the camera so Tiny can read it. "Big dog," he says, and he doesn't stop texting it to you for a month.` : `Tiny reads it over your shoulder. "Big dog," he says, and he doesn't stop saying it for a month.`]; }, then: 'y2p_locker' },
      { label: 'Turn off the TV and go run sprints in the dark.', do() { y2().draft = 'sprints'; fx({ skill: 3, energy: -5, conf: 2 }); return [`You run forty-yard sprints under the streetlights, like last year. Last year, you said the name of everybody who got picked ahead of you.`, `Tonight there's only one name, and you don't say it. You just run until you can't hear it anymore.`]; }, then: 'y2p_locker' },
      { label: 'Post a welcome: "Welcome to the Shark Tank, rook."', do() { y2().draft = 'post'; fx({ bryce: 6, fame: 5 }); return [`Two million views by midnight. Bryce replies with eleven shark emojis and a video of himself doing The Calloway in his parents' kitchen. His mom is in the background, not impressed.`]; }, then: 'y2p_locker' },
      { if: () => !hold, label: 'Ask Tiny what he thinks.', do() { y2().draft = 'tiny'; fx({ chem: 5, bryce: 3 }); return [`Tiny thinks about it for a long time, which for Tiny means he finishes his plate${tinyGone() ? ', on camera, from ' + tinyCity() : ''}.`, { s: 'Tiny', t: `I think they drafted a guy who's gonna need somebody to show him how it works. Somebody did that for you, bro.` }, `He isn't talking about himself. He isn't talking about the coaches, either.`]; }, then: 'y2p_locker' },
    ],
  };
};

P.y2p_locker = () => {
  const hold = !!y2().holdout, vs = vstat();
  const intro = hold
    ? [`You report on day 23 of camp. Your locker has a brass nameplate now, {LAST} in block letters. Rocco installed it in March and has been dusting it for three weeks.`,
      `The locker next to yours has a strip of tape that says CALLOWAY in marker. There's a pair of gold cleats in it, and they have more turf on them than yours do.`]
    : [`Rookie report day. The facility still smells like cut grass, rubber mats, and money. Your locker has a brass nameplate now, {LAST} in block letters. Rocco installed it himself and stood there until you noticed.`,
      vaneGoneQuiet() ? `The locker next to yours has been empty since March. This morning there's a strip of tape on it that says CALLOWAY in marker.` : `The locker next to yours used to say VANE. This morning there's a strip of tape on it that says CALLOWAY in marker.`];
  return {
    kicker: hold ? 'Year Two · Training camp · Day 23' : 'Year Two · Training camp · Day 1',
    title: 'The Locker Next to Yours',
    body: intro.concat([
      `Bryce Calloway walks in wearing sunglasses indoors and carrying his gold cleats like a trophy. He sees the tape. Then he sees you.`,
      { s: 'Bryce Calloway', t: hold ? `Oh, NOW you show up. I've been running with the ones for three weeks, big dog. Just keeping it warm for you.` : `Yo. I watched every snap you played last year. Twice. You're a great story.` },
      hold ? `He grins. His knee is bouncing a hundred miles an hour.` : `He sits down and kicks his feet up on the bench.`,
      hold ? '' : { s: 'Bryce Calloway', t: `I'm gonna be a better one.` },
      `A year ago you sat in this exact spot, and somebody decided what kind of year you were going to have. Now it's your turn.`,
    ]),
    choices: [
      { label: '"Eyes up, rook. And stop looking at your feet."', do() { y2().tone = 'mentor'; fx({ bryce: 10, coach: 2 }); award('y2_eyes'); return [`He looks up, startled.`, { s: 'Bryce Calloway', t: `I don't look at my feet.` }, `He looks at his feet. Then he laughs, and so do you, and for one second he looks twenty-one instead of famous.`]; }, then: 'y2p_scrim' },
      { label: '"Advice? Don\'t take my job."', do() {
          y2().tone = 'rival'; fx({ bryce: -4, conf: 4 });
          // Only a callback if Vane really said it to you on your first day (story-arcs: S.flags.locker === 'advice').
          const heard = y1Flag('locker') === 'advice';
          return [{ s: 'Bryce Calloway', t: `No promises, big dog.` }, heard
            ? (tinyGone() ? `Over in the equipment cage, Rocco stops folding towels. He was here the first time somebody said that line to you. He looks at the spot where Vane's stool used to be and shakes his head slowly.` : `Across the room, Tiny drops his spoon. He was here the first time somebody said that line in this room. He looks at the spot where Vane's stool used to be and shakes his head slowly.`)
            : (tinyGone() ? `Somewhere across the room, a veteran laughs. Bryce doesn't.` : `Across the room, Tiny raises his eyebrows all the way up. "Cold, bro," he says. It's hard to tell if it's a compliment. With Tiny it usually is.`)];
        }, then: 'y2p_scrim' },
      { label: 'Say nothing. Sit down and lace up.', do() { y2().tone = 'cold'; fx({ bryce: -8, conf: 2 }); return [`You don't look up. Somewhere in your chest, you finally understand why Vane did this to you.`, `It doesn't feel as good as you thought it would.`]; }, then: 'y2p_scrim' },
      { if: () => tinyGone(), label: 'Hand him a bowl of cereal from the box Tiny left behind.', do() { y2().tone = 'friend'; fx({ bryce: 6, chem: 5 }); return [`Tiny left a box of cereal in his old locker when he signed in ${tinyCity()}. Nobody has touched it since. You pour Bryce a bowl.`, { s: 'Bryce Calloway', t: `Whose is this?` }, `You tell him about Tiny. Bryce eats three bowls. He tells you he hasn't eaten since the draft because he's been nervous. Then he makes you promise not to tell anybody, which is how you know he's going to be okay.`]; }, then: 'y2p_scrim' },
      { if: () => !tinyGone(), label: 'Hand him a bowl of Tiny\'s cereal.', do() { y2().tone = 'friend'; fx({ bryce: 6, chem: 5 }); return [{ s: 'Tiny', t: `Rookie! You want cereal? I got a whole box in my truck.` }, { s: 'Bryce Calloway', t: `Is that the same box from last year?` }, { s: 'Tiny', t: `Different box. Same truck.` }, `Bryce eats three bowls. He tells you he hasn't eaten since the draft because he's been nervous. Then he makes you promise not to tell anybody, which is how you know he's going to be okay.`]; }, then: 'y2p_scrim' },
    ],
  };
};

P.y2p_scrim = () => {
  const y = y2(), hold = !!y.holdout, lib = MOMENTS[S.pos];
  if (y.scrimM == null || !lib[y.scrimM]) { y.scrimM = ri(0, lib.length - 1); save(); }
  const m = lib[y.scrimM];
  return {
    kicker: 'Year Two · Training camp · Scrimmage',
    title: 'Live Bullets, Again',
    body: [
      `Same scrimmage. Same stands. Same clipboards. Only this time, the coaches aren't watching to see if you belong. They're watching to see if the rookie does.`,
      okaforLeft() ? `Coach Pettis runs a one-on-one period: you, then Bryce, same play, back to back. It's his first week. He hasn't raised his voice once, and somehow everybody is standing up straighter.${hold ? ' You have twenty-three days of rust on you, and everybody in the building knows it.' : ''}`
        : `Okafor runs a one-on-one period: you, then Bryce, same play, back to back.${hold ? ' You have twenty-three days of rust on you, and everybody in the building knows it.' : ''}`,
      { s: '{coach}', t: `{last}. Show him how it's done.` },
      m.setup,
    ],
    mini: Object.assign(miniCfg(m, 1.6 + (hold ? 0.4 : 0)), {
      label: 'You vs. the rookie',
      onDone(r, x) {
        const rank = { great: 3, good: 2, bad: 1 };
        const br = pick(['great', 'great', 'great', 'good', 'good', 'good', 'good', 'bad', 'bad']);
        const d = rank[r] - rank[br];
        fx(d > 0 ? { conf: 4, coach: 4, bryce: y2().tone === 'mentor' ? 2 : -2 } : d === 0 ? { conf: 1, coach: 2 } : { conf: -3, bryce: 3 });
        go('y2p_depth', { r, br, d, text: x && x.text ? x.text : textFor(m, r) });
      },
    }),
  };
};

P.y2p_depth = a => {
  const hold = !!y2().holdout;
  const bt = {
    great: `Then Bryce runs the same play. It's perfect. Not good. Perfect. The sideline makes a noise you've only ever heard it make for you.`,
    good: `Then Bryce runs the same play. Clean. Smooth. He celebrates like it was the Championship, then looks over to see if you saw.`,
    bad: `Then Bryce runs the same play, and it falls apart. He stands there with his hands on his helmet for a second too long. You know that feeling. You had it on this exact patch of grass a year ago.`,
  }[a.br || 'good'];
  const verdict = a.d > 0 ? `You win the period. Bramble writes one word on his clipboard. Bryce asks what it was. You honestly don't know.`
    : a.d === 0 ? `A push. {coachLast} writes something down for both of you. Bramble writes nothing at all, which is somehow worse.`
    : `He wins the period. He knows it. You know it. Rocco, who sees everything from the equipment cage, definitely knows it.`;
  const html = `<div class="y2-depth" role="img" aria-label="${esc(plain(hold ? 'Depth chart, {POS}: {LAST} or Calloway, co-starters.' : 'Depth chart, {POS}: 1, {LAST}. 2, Calloway.'))}">
    <div class="y2-depth-h">Hammerheads depth chart · ${esc(S.pos)}</div>
    ${hold
      ? `<ol><li><span>1</span><b>${fmt('{LAST}')} <em>or</em> CALLOWAY</b></li></ol>`
      : `<ol><li><span>1</span><b>${fmt('{LAST}')}</b></li><li><span>2</span><b>CALLOWAY</b></li></ol>`}
    <div class="y2-depth-f">Posted by R. Bramble</div></div>`;
  return {
    kicker: 'Year Two · Cut day',
    title: hold ? 'Or' : 'Still Yours',
    body: [
      a.text || '',
      bt,
      verdict,
      `Cut day comes and goes, and this time The Turk walks right past you. On Wednesday, Bramble tapes the depth chart to the locker room door, the way he has for twenty-three years.`,
      hold ? `On a depth chart, "or" means co-starters. It also means you have a problem.` : `Everybody pretends not to look at it. Bryce looks at it for a full minute.`,
      { s: 'Coach Bramble', t: hold ? `You weren't here. He was. You'll split it in the opener until I say otherwise.` : `It's your job. It's his job to take it. That's football.` },
    ],
    after: html,
    next: 'y2begin',
    nextLabel: 'Start Year Two',
  };
};

// =========================================================
//   THE SEASON: fixed beats
// =========================================================
FIXED_Y[2] = { 0: 'y2_opener', 1: 'y2_target', 2: 'y2_tiny', 3: 'y2_rival', 4: 'y2_monarchs', 5: 'y2_scare', 6: 'y2_cover', 7: 'y2_vane', 8: 'y2_family', 9: 'y2_finale', 10: 'y2_po1', 11: 'y2_po2', 12: 'y2_po3_media' };
BEATS.push({ slate: 0, year: 2, id: 'y2_leo', if: () => !!(S.y1 && (S.y1.leoKept || S.y1.leoPromise || S.y1.leoVisit)) });

P.y2_opener = () => {
  const y = Y1();
  const top = y.champion
    ? [`Before kickoff, they raise the banner. It's orange and white and the size of a basketball court, and it says CHAMPIONS, and you have to stop looking at it because your eyes are doing something embarrassing.`, tinyGone() ? `Then they hand out the rings. Yours is heavier than your first car. Tiny's gets shipped to ${tinyCity()}. He posts a photo of it on his pinky, the only finger it fits, captioned *still a Hammerhead in here.*` : `Then they hand out the rings. Yours is heavier than your first car. Tiny wears his on his pinky, because it's the only finger it fits.`]
    : y.lostRound === 12
      ? [`There's no banner this year. ${okaforLeft() ? 'Before she left for Ridgeline, Okafor taped' : 'Okafor has taped'} a photo of last year's confetti, the wrong-colored confetti, inside the tunnel at eye level. Everybody has to walk past it.`]
      : [`No banner. No rings. Just a new season, a sold-out stadium, and the same fireworks as last year. This year you don't even blink.`];
  return {
    kicker: 'Year Two · Week 1 · Opening night',
    title: y.champion ? 'Raise the Banner' : 'Unfinished Business',
    body: top.concat([
      `In the tunnel, Bryce is standing very still. He's pale. He's holding his helmet in both hands like it might fly away.`,
      { s: 'Bryce Calloway', t: `Is it always this loud?` },
      `A year ago, you were the one holding your helmet too tight. You remember exactly how heavy it felt.`,
    ]),
    choices: [
      { label: 'Teach him the breathing. In for four, hold for four, out for four.', do() { fx({ bryce: 8, family: 2 }); return [`You tell him {fam} taught you that. He does it with you, eyes closed, while sixty-eight thousand people scream. By the third breath, his hands stop shaking.`, { s: 'Bryce Calloway', t: `{fam} sounds cool.` }, `{fam} is cool. You'll tell {fobj} he said so.`]; } },
      { label: '"It\'s louder when you win. Stay close to me."', do() { fx({ bryce: 5, conf: 3 }); return [`He stays so close you can hear him breathing. When the smoke clears and the team starts running, he's half a step behind you the whole way. Exactly where you were behind Vane, once.`]; } },
      { label: 'Leave him alone. He has to find it himself.', do() { fx({ bryce: -4, conf: 2 }); return [`You run out first. You don't look back. When you finally do, during the anthem, he's standing right where you left him, staring at the ${y.champion ? 'banner' : 'flag'}.`]; } },
      { if: () => !!Y1().champion, label: 'Let him hold your ring. For luck.', do() { fx({ bryce: 8, chem: 3, coach: -2 }); return [`He holds it like it's radioactive. Bramble sees it from forty feet away.`, { s: 'Coach Bramble', t: `Don't get used to that, rookie.` }, `Bryce hands it back very, very gently.`]; } },
    ],
  };
};

P.y2_leo = () => {
  const y = Y1();
  const hello = y.leoKept ? { s: 'Leo', t: `You kept your promise last year. So I kept mine. I got picked FIRST for kickball. First! Before Tyler!` }
    : y.leoPromise ? { s: 'Leo', t: `You didn't get the {big} last year. That's okay. I didn't get picked for kickball either. Then I did. Second. It counts.` }
    : y1Flag('y2leo') === 'gloves' ? { s: 'Leo', t: `I still have your gloves. I sleep with them. Mom says that's weird. It's not weird.` }
    : y1Flag('y2leo') === 'talk' ? { s: 'Leo', t: `I told everybody at school you're a superhero origin story. Nobody believed me. Now they have to.` }
    : { s: 'Leo', t: `I watched every game you played last year. Even the ones past my bedtime. Mom doesn't know about those.` };
  return {
    kicker: 'Year Two · Week 1 · Coin toss',
    title: 'Honorary Captain',
    body: [
      `The honorary captain for the opener is ten years old, has a full head of hair, and is wearing your jersey, number {num}. It fits a little better this year.`,
      `It's Leo. From room 412. Healthy.`,
      hello,
      `Then Bryce walks by in gold cleats, and Leo's eyes go huge.`,
      { s: 'Leo', t: `No offense. But are those GOLD?` },
    ],
    choices: [
      { label: 'Let Leo call the coin toss, and promise him a {big}.', do() { y2().leo = 'promise'; fx({ conf: 3 }); return [`He calls heads. It's heads. He celebrates like he won the Championship, and the referee lets him keep the coin.`, y.leoPromise ? `Now you owe him a {big}. Again.` : `Now you owe him a {big}.`]; } },
      { label: 'Introduce Leo to Bryce.', do() { y2().leo = 'bryce'; fx({ bryce: 7, fame: 2 }); return [`Bryce kneels down to Leo's height, which nobody taught him to do. Two minutes later, Leo is wearing the gold cleats on his hands like mittens. Bryce lets him keep them.`, { s: 'Leo', t: `You're still my favorite. He's my second favorite. That's allowed.` }]; } },
      { label: 'Give Leo the game ball before the game even starts.', do() { y2().leo = 'ball'; fx({ family: 4, conf: 4 }); return [{ s: 'Leo', t: `You're supposed to give it AFTER.` }, `You tell him he already earned it. He holds it for all four quarters and doesn't let anybody touch it, including his mom.`]; } },
    ],
  };
};

P.y2_target = () => ({
  kicker: 'Year Two · Week 2 · Film room',
  title: 'A Target on Your Back',
  body: [
    `Tuesday film session. {coachLast} puts a page on the projector. It's from the Bayou Gators' ${S.pos === 'LB' ? 'offensive' : 'defensive'} game plan, which nobody is supposed to have.`,
    `In the top corner, in red marker, circled twice: **#{num}**. Underneath: *${S.pos === 'LB' ? 'Run away from him. Make anybody else make the play.' : 'Take him away. Make anybody else beat us.'}*`,
    { s: '{coach}', t: `This is what being good looks like. Every team we play this year has a page like this. Last year you were a surprise. This year you're the plan.` },
    `Bryce leans over. "Do they have a page about me?" {coachLast} doesn't answer. Bryce takes it personally.`,
  ],
  choices: [
    { label: 'Study their plan for you. Then beat it.', sub: 'Film edge this week. Your reads get easier all season.', do() { y2().target = 'study'; if (S.wk) S.wk.film = true; fx({ skill: 3, coach: 4, energy: -6 }); return [`You and {coachLast} watch every snap of yours the Gators studied. You find three things you do right before every big play. You stop doing two of them.`, { note: 'Film edge this week. Game days are a little easier all season.' }]; } },
    { label: S.pos === 'LB' ? 'Let them run away from you. Be the decoy, and let everybody else eat.' : 'Let them take you away. Be the decoy, and feed everybody else.', sub: 'The team plays better all season. Less spotlight for you.', do() {
        y2().target = 'decoy'; fx({ chem: 7, bryce: 5, fame: -2 });
        const how = S.pos === 'LB' ? `If they want to run away from you all day, fine. That means they're running at somebody else, and somebody else will be ready. You say it in the defensive huddle at practice, and for the first time, the whole defense looks at you like a captain.`
          : `If they want to double you, fine. That means somebody else is open. You say it in the huddle at practice, and for the first time, ${tinyGone() ? 'the whole offensive line looks' : 'Tiny looks'} at you like a captain.`;
        return [how, { note: 'Decoy: the Hammerheads play a little better as a team all season.' }];
      } },
    { label: '"Good. Let them come."', sub: 'Harder game days. Big plays make you more famous.', do() { y2().target = 'embrace'; fx({ conf: 6, fame: 4 }); return [`You ask {coachLast} for a copy of the page. You tape it inside your locker, next to the brass nameplate, and read it every morning.`, { note: 'Target embraced: game days are harder, and every big play adds Fame.' }]; } },
  ],
});

P.y2_tiny = () => (tinyGone() ? y2TinyAway() : tinySigned() ? y2TinySigned() : y2TinyContract());
// Tiny signed elsewhere last year (story-arcs fate 'market' or 'sly').
function y2TinyAway() {
  const hur = tinyFate() === 'market';
  return {
    kicker: 'Year Two · Week 3 · Wednesday',
    title: 'Long Distance',
    body: [
      `Wednesday morning, the cereal box in Tiny's old locker is still there. Nobody has moved it. Rocco dusts around it.`,
      `At 6:10 a.m. your phone rings. It's Tiny, on video, from ${tinyCity()}. He's eating cereal out of a mixing bowl in a kitchen that still has moving boxes in it.`,
      { s: 'Tiny', t: `Good team here, bro. Good guys. But nobody knows how I take my cereal. I had to tell a guy. Out loud.` },
      hur ? `You play the Hurricanes in Week 7. He has mentioned this four times already, and it's 6:11.` : `The Jackpots aren't on your schedule this year. He has checked twice.`,
    ],
    choices: [
      { label: 'Stay on the phone through his whole breakfast.', do() { y2().tiny.call = true; fx({ chem: 3, conf: 3 }); return [`Forty minutes. He tells you about the new playbook, the new city, and the new grocery store, which doesn't carry his cereal. You tell him about Bryce. He laughs at all the right parts.`]; } },
      { label: 'Send him a case of his cereal.', do() { y2().tiny.cereal = true; fx({ chem: 4, money: -200 }); return [`You order forty boxes to his new address. Two days later he sends a photo of himself sitting inside a fort made of them.`]; } },
      { label: 'Ask him what to do about the rookie.', do() { fx({ bryce: 4, chem: 2 }); return [{ s: 'Tiny', t: `Same thing somebody did for you. You know who. I'm not saying his name, it's too early in the morning.` }, `He means Vane. He might mean himself, too.`]; } },
      { label: 'Tell him you have to go. Film at seven.', do() { fx({ skill: 2, chem: -2 }); return [`"Go," he says. "Go be great. Call me after." You mean to.`]; } },
    ],
  };
}
// Tiny is under contract (story-arcs fate 'three', 'two' or 'gamble'): no contract year, a different worry.
function y2TinySigned() {
  const f = tinyFate();
  return {
    kicker: 'Year Two · Week 3 · Wednesday',
    title: 'Thirty-Two',
    body: [
      `Tiny eats breakfast in his truck now. You find him there Wednesday morning: engine off, cereal in a mixing bowl, staring at the practice field.`,
      f === 'three' ? `He signed his extension last year. Three more years. That isn't what's bothering him.` : f === 'two' ? `He signed for two more years at Thanksgiving. That isn't what's bothering him.` : `He re-signed in April, after the surgery, for less than the offer he turned down. That isn't what's bothering him.`,
      { s: 'Tiny', t: `I'm thirty-two, bro. My knee takes twenty minutes to wake up. Bramble wants to make me a captain, and all I can think is, what if I'm the guy who gets slow in the middle of it?` },
      { s: 'Tiny', t: `Don't tell anybody I said that. Especially the rookie. He thinks I'm a mountain.` },
    ],
    choices: [
      { label: 'Tell him to take the C. You\'ll do his stretches with him every morning.', do() { y2().tiny.capt = true; fx({ chem: 8, energy: -3 }); return [`Every morning at 6:40, you and Tiny do twenty minutes of stretching in the corner of the weight room, where nobody can see. Bramble sees. Bramble sees everything.`, `On Friday, Tiny has a C on his jersey. He keeps touching it to make sure it's still there.`]; } },
      { label: 'Make him famous. Credit Tiny first in every interview.', do() { y2().tiny.hype = true; fx({ fame: 3, chem: 5 }); return [`For a month, every answer you give starts with "First of all, Tiny." Jules Park starts a running count in the Ledger. By October, Tiny has his own bobblehead night. The bobblehead is eating cereal.`]; } },
      { label: 'Get Bryce to ask Tiny for help.', do() { y2().tiny.bryce = true; fx({ bryce: 5, chem: 4 }); return [`You tell Bryce the best person in the building to learn how a line thinks is Tiny. Bryce follows him around for a week with the tablet.`, `By Friday, Tiny has stopped talking about his knee. Nobody who's being asked forty questions a day has time to feel old.`]; } },
      { label: 'Just sit with him. Some mornings are like that.', do() { fx({ energy: 4, chem: 2 }); return [`You eat a bowl of cereal in the passenger seat. Neither of you says anything. When the practice whistle goes, he cracks his knuckles, opens the door, and says, "Okay. Mountain time."`]; } },
    ],
  };
}
// His contract year (story-arcs fate 'one', or no fate recorded).
function y2TinyContract() {
  const c = y2().contract || {};
  const capLine = c.deal === 'team' ? `You took the hometown deal. There's room under the cap for him. Somebody just has to get the front office to use it.`
    : c.deal === 'bet' ? `Your deal is one year, just like his. You're both playing for your next contract. It's nice to have company.`
    : `You signed for big money. Every dollar you make is a dollar the front office doesn't have for a thirty-two-year-old lineman. Tiny is too nice to say it. He doesn't have to.`;
  return {
    kicker: 'Year Two · Week 3 · Wednesday',
    title: 'Contract Year',
    body: [
      `Tiny eats breakfast in his truck now. You find him there Wednesday morning: engine off, cereal in a mixing bowl, staring at the practice field.${tinyFate() === 'one' ? ' He\'s back from knee surgery, playing on a one-year prove-it deal.' : ''}`,
      { s: 'Tiny', t: `Last year of my deal. My agent called the front office in March. They said they'd circle back.` },
      { s: 'Tiny', t: `Nobody ever circles back, bro. Circles don't go back. That's the whole thing about circles.` },
      capLine,
    ],
    choices: [
      { label: 'Walk into Bramble\'s office and lobby for Tiny.', do() { y2().tiny.lobby = true; fx({ chem: 6, coach: S.rel.coach >= 50 ? 2 : -2 }); return [`Bramble listens to the whole speech without moving. When you finish, he says, "Noted." Then, as you reach the door:`, { s: 'Coach Bramble', t: `He's the best teammate in this building. I know that. Close the door on your way out.` }]; } },
      { label: 'Make him famous. Credit Tiny first in every interview.', do() { y2().tiny.hype = true; fx({ fame: 3, chem: 5 }); return [`For a month, every answer you give starts with "First of all, Tiny." Jules Park starts a running count in the Ledger. By October, Tiny has his own bobblehead night. The bobblehead is eating cereal.`]; } },
      { if: () => { const k = (y2().contract || {}).deal; return k === 'max' || k === 'holdout'; }, label: 'Restructure your deal to free up cap room.', sub: 'Your game check drops by $15,000 a week.', do() {
          const y = y2(); y.tiny.restructure = true; y.contract.weekly -= 15000; fx({ chem: 12, coach: 4, fame: 2 });
          return [`The restructure takes forty minutes and a lot of initials. You don't tell Tiny. He finds out anyway, because the front office leaks everything.`, { s: 'Tiny', t: `You did WHAT? Bro. BRO.` }, `He hugs you so hard your back cracks in three places. Dr. Shaw says it's the best adjustment you've ever had.`, { note: 'Your weekly game check drops by $15,000.' }];
        } },
      { label: 'Stay out of it. It\'s business.', do() { y2().tiny.out = true; fx({ chem: -4, energy: 4 }); return [`You tell yourself it isn't your place. Tiny says he understands. He does understand. That's the worst part.`]; } },
    ],
  };
}

P.y2_rival = () => {
  const b = bryce();
  return {
    kicker: 'Year Two · Week 4',
    title: 'A Better Story',
    body: [
      `Bryce goes on Sunday Countdown, the big national pregame show, in a suit the color of a highlighter.`,
      b >= 50 ? { s: 'Bryce Calloway', t: `{first}'s my guy. Taught me everything. And I'm still taking his job.` } : { s: 'Bryce Calloway', t: `{first}'s a great story. I'm a better player. Both things can be true.` },
      b >= 50 ? `He winks at the camera. The clip runs all week. Even you have to admit the wink was good.` : `The clip runs all week. Every reporter in Harbor City asks you about it, including two who cover golf.`,
      `Thursday, Bramble announces a competition period. First-team reps, live, you and the rookie, the same plays.`,
      { s: '{coach}', t: `You don't have to do this. You're the starter. Nobody's taking anything from you this week.` },
    ],
    choices: [
      { label: 'Answer him on the field. Take the competition period.', primary: true, then: 'y2_rival_rep' },
      { label: 'Answer him over lunch. The expensive place.', do() { y2().lunch = true; fx({ bryce: 10, chem: 2, money: -400 }); return [`He orders the $400 steak${y1Did('dinner') ? ', the same one a veteran ordered at your rookie dinner' : ' without looking at the price'}. He eats all of it. Somewhere around the second side dish, he admits he only says that stuff because he's scared he's a bust.`, { s: 'Bryce Calloway', t: `Twelfth pick, man. If I'm not great, I'm a joke.` }, `You tell him about pick 257, and the kid who didn't get picked at all. He goes very quiet. Then he steals your fries.`]; } },
      { label: 'Answer him at the podium: "Tell him I said hi."', do() { fx({ fame: 5, conf: 3, bryce: -5 }); return [`Five words. It's the best-reviewed press conference of the week. Bryce watches it in the locker room with his jaw set. The rivalry is officially real.`]; } },
    ],
  };
};
P.y2_rival_rep = () => {
  const y = y2(), lib = MOMENTS[S.pos];
  if (y.rivalM == null || !lib[y.rivalM]) { y.rivalM = (y.scrimM == null ? 0 : y.scrimM + 1 + ri(0, lib.length - 2)) % lib.length; save(); }
  const m = lib[y.rivalM];
  return {
    kicker: 'Year Two · Week 4 · Thursday practice',
    title: 'Competition Period',
    body: [`Three reps each, live. The whole team lines up along the sideline to watch, which never happens on a Thursday. ${tinyGone() ? 'Rocco has brought a folding chair.' : 'Tiny has brought a folding chair.'}`, m.setup],
    mini: Object.assign(miniCfg(m, 2.1), {
      label: 'Competition period',
      onDone(r, x) {
        const b = bryce(), br = pick(['great', 'good', 'good', 'bad', 'great', 'good', 'bad']);
        const d = { great: 3, good: 2, bad: 1 }[r] - { great: 3, good: 2, bad: 1 }[br];
        const body = [x && x.text ? x.text : textFor(m, r)];
        if (d > 0) {
          fx({ conf: 5, coach: 4, bryce: b >= 50 ? 3 : -3 });
          body.push(`You win the period, three reps to one. Bryce rips his helmet off and stares at the turf.`, b >= 50 ? `Then he jogs over and asks how you read the safety. You tell him. That's the job, too.` : (tinyGone() ? `He doesn't talk to you in the cold tub. Nobody fills the silence. Tiny used to.` : `He doesn't talk to you in the cold tub. Tiny talks enough for all three of you.`));
        } else if (d === 0) {
          fx({ coach: 2, bryce: 2 });
          body.push(`Two reps each. {coachLast} calls it even. Bramble calls it "fine," which from him is a standing ovation.`);
        } else {
          fx({ conf: -4, bryce: 4 });
          body.push(`Bryce wins the period. He does The Calloway in the end zone of a practice field, for nobody. Then he catches your eye, stops, and comes over to tap helmets.`, `He's twenty-one. He's allowed one.`);
        }
        go('_result', { body, next: 'queue', kicker: 'Year Two · Week 4', title: 'Competition Period' });
      },
    }),
  };
};

P.y2_monarchs = () => {
  const t = Y1().trash, d = danteArc(), K = line => ({ s: 'Dante Kingsley', t: line });
  const call = t === 'fire' ? K(`Receipt guy! You still owe me a receipt. Come on the show. Last season, last rivalry. Let's make it fun.`)
    : t === 'cake' ? K(`Cake guy! I still think about that cake. Come on the show. Bring cake. That's not a joke. I need you to bring cake.`)
    : y1Flag('kingsleyMsg') ? K(`"The crown looked heavy today." Four million views, man. I've been lifting weights ever since. Come on the show and say it to my face.`)
    : d.post1 === 'jab' ? K(d.g4 ? `You pointed at the scoreboard. On my field. I did twenty-two minutes on it. Come on the show and point at me in person.` : `"Enjoy it, Week 10 is on our field." I still think about that. Come on the show and say it to my face this time.`)
    : d.post1 === 'snub' ? K(`You walked right past me at midfield last year. With my hand out. On camera. Come on the show and walk past me in person.`)
    : y1Flag('kingsleyCredit') ? K(`"The best player I've lined up against." You said that on camera. My mom framed it. Come on the show and say it again, slower.`)
    : d.post1 === 'shake' ? K(`Two years, and all you ever said to me was "good game." Come on the show and say some other words.`)
    : K(`You never said one word about me last year. Not one. Drove me crazy. Come on the show and say some words.`);
  return {
    kicker: 'Year Two · Week 5 · Rivalry week',
    title: 'The Farewell Tour',
    body: [
      `Monarchs week. On Monday morning, Dante Kingsley announces that this is his final season. He does it on his podcast, wearing the crown chain, crying a little, and then laughing about crying.`,
      `On Tuesday, he calls you.`,
      call,
    ],
    choices: [
      { label: 'Go on his podcast.', do() { y2().kingsley = 'pod'; fx({ fame: 8, conf: 2 }); return [`It's two hours long. Kingsley asks about draft night and goes completely silent while you tell it. Then he asks about Bryce.`, { s: 'Dante Kingsley', t: `Somebody's gonna come for your crown every single year. The trick is, make 'em earn it. Then help 'em wear it.` }, `It's the best advice anybody gives you all season, and it comes from a man in a crown chain.`]; } },
      { label: t === 'cake' ? 'Send the sequel cake.' : 'Send him a crown-shaped cake.', do() { y2().kingsley = 'cake'; fx({ fame: 5, chem: 4 }); return [`Two tiers. The frosting says HAPPY RETIREMENT, DON'T RUSH IT. ${tinyGone() ? 'Bryce' : 'Tiny'} eats the top tier during the photo shoot.`, `Kingsley posts it anyway, with the caption: *Respect. Still beating you Sunday.*`]; } },
      { label: 'Pin his announcement inside your locker. Lock in.', do() { y2().kingsley = 'quiet'; S.flags.focus = true; fx({ coach: 3, conf: 3 }); return [`It's the last season of a legend. You'd like to be the reason he remembers it. You don't say that out loud.`, { note: 'Locked in: you\'ll have film notes on your reads this week.' }]; } },
    ],
  };
};

P.y2_scare = () => ({
  kicker: 'Year Two · Week 6 · Training room',
  title: 'Something Pops',
  body: [
    `Wednesday practice. You plant on a routine rep and feel something in your ${BODY[S.pos]} go *pop*. Quietly. Like a knuckle.`,
    `Dr. Imani Shaw has you in the MRI tube by noon. By two, she's pointing at a gray smudge on a screen.`,
    { s: 'Dr. Imani Shaw', t: `Grade one strain. Rest it a week and it's nothing. Play on it and it might be nothing. Or it might be six weeks. I can't tell you which. I can only tell you the odds.` },
    `It's the Otters on Sunday. Bramble already knows. Across the training room, Bryce is pretending not to listen, very badly.`,
  ],
  choices: [
    { label: 'Sit. Let Bryce start.', sub: 'You rest. You only go in if it comes down to the last drive.', do() { const y = y2(); y.scare = 'sit'; S.role = 'backup'; y.roleUntil = S.slate; fx({ energy: 22, coach: 4, bryce: 6 }); return [`You tell Bramble yourself. He nods once. Then he calls Bryce into his office, and through the glass you watch the rookie's face do four different things in four seconds.`, { s: 'Bryce Calloway', t: `I won't mess it up. I mean, I might mess it up. I won't mess it up.` }]; } },
    { label: 'Ask to split snaps with Bryce.', sub: 'Half the snaps. Half the risk.', do() { const y = y2(); y.scare = 'split'; S.role = 'rotation'; y.roleUntil = S.slate; fx({ energy: 10, coach: 2, bryce: 3 }); return [`Dr. Shaw agrees to half the snaps, if you stop arguing with her. You stop arguing with her. Mostly.`]; } },
    { label: 'Tape it up. Tell nobody. Start.', sub: 'Risky.', do() {
        const y = y2(); y.scare = 'hide';
        if (chance(0.4)) { y.scareWorse = true; y.roleNext = { slate: S.slate + 1, role: 'rotation' }; fx({ energy: -22, conf: -4, coach: -3 }); return [`By Friday it's tight. By Saturday it's tighter. Dr. Shaw finds out on Sunday morning, because Dr. Shaw finds out everything.`, { s: 'Dr. Imani Shaw', t: `You'll start today because I can't stop you. Next week, you split snaps with the rookie. That's not a request.` }]; }
        fx({ conf: 4, coach: -2 }); return [`You get away with it. It holds. Dr. Shaw finds out anyway, on Monday, and doesn't speak to you for two days. That's her version of yelling.`];
      } },
  ],
});

P.y2_cover = () => ({
  kicker: 'Year Two · Week 7 · Wednesday',
  title: 'The Whiteboard',
  body: [
    `Tuesday night, Bryce posts a video from the film room: him, doing The Calloway, in slow motion, set to a song that is mostly bass.`,
    `It has 900,000 views by the time anybody notices what's on the whiteboard behind him. It's the Hurricanes game plan. All of it. In {coachLast}'s handwriting.`,
    `He takes it down after forty-one minutes. Forty-one minutes is a long time on the internet.`,
    `Wednesday morning, Bramble stands at the front of the meeting room holding a printed screenshot.`,
    { s: 'Coach Bramble', t: `Somebody in this room put our game plan on the internet. I'd like to know who. I'd like to know right now.` },
    `You were in the film room last night, too. Bryce's knee is bouncing so hard his chair is moving.`,
  ],
  choices: [
    { label: 'Stand up. "That was me. My phone, my fault."', do() { y2().cover = 'took'; fx({ coach: -8, bryce: 18, chem: 5, money: -10000 }); return [`Bramble looks at you for a long, long time. He knows. You know he knows. He fines you $10,000 anyway and makes you run until the field lights come on.`, `That night, Bryce shows up at your door with two bowls of cereal. He doesn't say thank you. Then he says it about six times.`]; } },
    { label: 'Look at Bryce. Wait for him to stand up.', do() {
        if (bryce() >= 45) { y2().cover = 'owned'; fx({ coach: 5, bryce: 10, chem: 4 }); return [`It takes four seconds. They're the longest four seconds of his life. Then he stands up.`, { s: 'Bryce Calloway', t: `It was me. It won't happen again.` }, `Bramble fines him, benches him for a series, and then, on the way out, tells him it took guts. Bryce looks at you like you handed him something. Maybe you did.`]; }
        y2().cover = 'froze'; fx({ coach: -2, bryce: -6, chem: -3 });
        return [`Bryce doesn't stand up. He looks at the floor. Bramble looks at the room, and the room looks at nothing, and it lasts forever.`, `Bramble cancels the team's day off. Everybody knows why. Nobody talks to the rookie for a week, and you didn't help.`];
      } },
    { label: 'Tell Bramble the truth after the meeting.', do() { y2().cover = 'told'; fx({ coach: 6, bryce: -16, chem: -4 }); return [`Bramble thanks you. Bramble fines Bryce. Bryce figures out how Bramble found out, because the front office leaks everything.`, `By Friday, he's moved his things to a locker on the other side of the room.`]; } },
    { label: 'Fix it quietly. Help {coachLast} rebuild the game plan overnight.', do() { y2().cover = 'fixed'; if (S.wk) S.wk.film = true; fx({ coach: 4, skill: 2, energy: -12, bryce: 4 }); return [`You and {coachLast} stay until 2 a.m. rebuilding the plan from scratch: new signals, new formations, new names for everything.`, `Bramble never finds out who posted the video. He also never asks again, which makes you think he already knows.`, { note: 'Film edge this week: you helped write the new game plan.' }]; } },
  ],
});

P.y2_vane = () => {
  const vs = vstat();
  if (vs === 'retired') return {
    kicker: 'Year Two · Week 8 · Thursday',
    title: 'Guest Coach',
    body: [
      `Thursday, there's a man in a network polo standing on the sideline with a clipboard he didn't need to bring. Marcus Vane. Retired eight months, and somehow bigger.`,
      { s: 'Marcus Vane', t: `The network sent me to do a feature. I told them I'd need to watch practice. Mostly I wanted to watch practice.` },
      `He watches you run the first-team period. Then he watches Bryce. Then he watches you watch Bryce.`,
      { s: 'Marcus Vane', t: `Look at you. You've got a rookie.` },
    ],
    choices: [
      { label: 'Ask Vane to talk to Bryce.', do() { y2().vaneWeek = 'talk'; fx({ bryce: 8, vane: 5 }); return [`Vane talks to Bryce for twenty minutes by the cold tubs. You can't hear what he says. At the end, Bryce looks at his feet, catches himself, and looks up. Vane points at you.`, { s: 'Marcus Vane', t: `I told him to ask you. You know more than I did at your age.` }]; } },
      { label: 'Ask him how you\'re doing. Honestly.', do() { y2().vaneWeek = 'honest'; fx({ skill: 3, conf: 3 }); return [{ s: 'Marcus Vane', t: `Honestly? You look at your feet less. You still do it on third down. And you're too nice to the kid on Tuesdays and too hard on him on Thursdays. Pick one.` }, `It's the best scouting report anybody has ever given you.`]; } },
      { label: tinyGone() ? 'Take him to lunch. Get Tiny on speaker.' : 'Take him to lunch with Tiny.', do() { y2().vaneWeek = 'lunch'; fx({ chem: 6, energy: 4, vane: 5 }); return [`Three hours. Tiny${tinyGone() ? ', on speaker from ' + tinyCity() + ',' : ''} tells the story of the rookie dinner check twice. Vane tells one about his first coach that you've never heard. Nobody mentions football until the waiter does.`]; } },
    ],
  };
  if (vs === 'signed') return {
    kicker: 'Year Two · Week 8 · Mustangs week',
    title: 'Feet',
    body: [
      `It's the Mustangs this week. Marcus Vane's team now.`,
      `He's been good for them. Not great. Good. He's thirty-four, and he plays like it on Tuesdays and like he's twenty-five on Sundays.`,
      `Tuesday night, a text: *Heard you have a rookie now.* Then: *How's that feel.* No question mark. Vane doesn't use question marks.`,
    ],
    choices: [
      { label: 'Text back: "Like I owe you an apology."', do() { y2().vaneWeek = 'sorry'; fx({ vane: 10, bryce: 3, conf: 2 }); return [`Three dots for a long time. Then: *You don't. But I'll take dinner Saturday.*`, `You have dinner Saturday. He picks up the check, which has never happened in the history of football.`]; } },
      { label: 'Text back a photo of your feet.', do() { y2().vaneWeek = 'feet'; fx({ conf: 4 }); return [`*Ha.* That's all he sends. It's the first time he's ever typed a laugh. You screenshot it.`]; } },
      { label: 'Talk trash. He\'d want you to.', do() { y2().vaneWeek = 'trash'; fx({ conf: 4, fame: 3 }); return [`"Bring your old knees Sunday." He replies in eleven seconds: *Bring your rookie. You'll need him.*`, `The whole exchange is on the Ledger's website by morning. Jules Park won't say how. Jules Park never says how.`]; } },
    ],
  };
  return {
    kicker: 'Year Two · Week 8 · Tuesday',
    title: 'The Dealership',
    body: [
      `Tuesday you do a paid appearance at a car dealership out by the highway. Forty footballs, a giant pair of scissors, the usual.`,
      `The man holding the scissors for you is Marcus Vane. ${vstat() === 'quiet' ? 'The last time you saw him, he was tapping your nameplate on his way out of the building.' : 'The last time you saw him, he was carrying a box of his things to the parking lot without saying goodbye.'}`,
      `He's in a polo with the dealership's logo on it. He sells trucks now. He's good at it, he says. He doesn't sound like he believes it.`,
      { s: 'Marcus Vane', t: `Don't look at me like that, rookie. Not rookie. Whatever you are now.` },
    ],
    choices: [
      { label: 'Ask Bramble to bring him in as a guest coach.', do() { y2().vaneWeek = 'guest'; fx({ vane: 15, bryce: 6, coach: 2 }); return [`Bramble says yes before you finish the sentence, which tells you he'd been thinking about it.`, `Vane shows up Wednesday in a Hammerheads hoodie from four seasons ago. By Thursday, he's yelling at Bryce about his feet. By Friday, Bryce's feet are better.`]; } },
      { label: 'Tell him you\'re sorry it ended the way it did.', do() { y2().vaneWeek = 'sorry'; fx({ vane: 10, conf: 2, money: -38000 }); return [`He's quiet for a while.`, { s: 'Marcus Vane', t: `It ended the way it ends. For everybody. Make sure yours ends better.` }, `Then he sells you a truck you don't need. You buy it anyway.`]; } },
      { label: 'Sign the footballs and go.', do() { y2().vaneWeek = 'go'; fx({ energy: 4 }); return [`You sign forty footballs. He holds the scissors. Neither of you says much.`, `On the way out, you see him in the rearview mirror, hands in his pockets, watching you go.`]; } },
    ],
  };
};

// What last Thanksgiving actually was (recorded from the year-one w8_thanks choice).
function y2ThanksMemory() {
  const k = y1Flag('y2thanks');
  if (k === 'tiny') return `Thanksgiving week again. Last year, Tiny's grandmother set you a plate before you even said yes. Twenty-two cousins. Three ovens.${tinyGone() ? ` This year Tiny is in ${tinyCity()}, and Nana Fonoti has already called to say your plate is still your plate.` : ''}`;
  if (k === 'skip') return `Thanksgiving week again. Last year you skipped it for a cold tub, and Tiny sent you a photo of your empty chair with a plate on it.`;
  if (k === 'family') return { town: `Thanksgiving week again. Last year it was room-service turkey in a hotel room, and Grandma Bea called the pie "fine."`, city: `Thanksgiving week again. Last year it was turkey in an ER break room, eleven minutes at a time.`, base: `Thanksgiving week again. Last year it was room-service turkey in a hotel room, and Dad made both beds.` }[S.origin];
  return `Thanksgiving week again. Half the country will be watching with a plate in their lap.`;
}
P.y2_family = () => {
  const arrive = { town: `Grandma Bea calls to say she's coming, and she's bringing pies, and how many people, and do you have a real oven or one of those city ovens.`, city: `Mom has the day off for the first time in nine years. She asked for it in January. She'll be there by noon with a cooler.`, base: `Dad says he'll drive up. It's a fourteen-hour drive. He plans to do it in eleven.` }[S.origin];
  return {
    kicker: 'Year Two · Week 9 · Thanksgiving',
    title: 'Your Table',
    body: [
      y2ThanksMemory(),
      `This year you have a house. It has furniture. It has a dining table that seats twelve, which you bought before realizing you don't know twelve people in Harbor City.`,
      arrive,
      `On Tuesday, you overhear Bryce on the phone in the hallway. His mom is working a double. He tells her it's fine. He says it twice, which is how you know it isn't.`,
    ],
    choices: [
      { label: tinyGone() ? 'Host everybody: {fam}, Bryce, and the whole offensive line.' : 'Host everybody: {fam}, the Fonotis, and Bryce.', do() { y2().family = 'all'; fx({ family: 10, chem: 6, bryce: 12, money: -4000, energy: -4 }); return [tinyGone() ? `{fam} takes over your kitchen in four minutes and puts the offensive line to work peeling potatoes. Tiny calls from ${tinyCity()} at halftime to make sure somebody made turkey tails. Somebody did.` : `Nana Fonoti takes over your kitchen in four minutes. {fam} and Nana Fonoti have a twenty-minute standoff over the stuffing that ends in a hug and a shared recipe.`, `Bryce washes the dishes. He has never washed a dish. He's bad at it. He asks if he can come back next year.`]; } },
      { label: 'Just you and {fam}. Quiet.', do() {
          y2().family = 'quiet'; fx({ family: 14, conf: 5, energy: 6 });
          return [{ town: `Grandma Bea brings four pies for two people. You eat a slice of each. She watches you eat the way she did when you were seven.`, city: `Mom falls asleep on your couch at 6:15 with a plate on her lap. You put a blanket on her and watch the rest of the parade alone. Best day of the year.`, base: `Dad makes his chili, because he doesn't believe in turkey. You don't argue. Nobody argues with Dad about chili.` }[S.origin]];
        } },
      { label: 'Invite Bryce over. Takeout and the late game.', do() { y2().family = 'bryce'; fx({ bryce: 14, family: -3, chem: 2 }); return [`Forty dollars of Thai food and the late game on TV. Bryce talks for three hours: his mom, the Southern Pines dorms, how he's scared every single day. You tell him you were too. You still are, a little.`, `{fam} calls at halftime and makes Bryce get on the phone. He says "yes, ${famSir()}" eleven times.`]; } },
    ],
  };
};

P.y2_finale = () => {
  const y = y2(), w = S.record.w;
  if (y.tinyStays == null && !tinyGone() && !tinySigned()) {
    const t = y.tiny || {}, c = y.contract || {};
    y.tinyStays = !!(t.restructure || (c.deal === 'team' && !t.out) || (t.lobby && S.rel.coach >= 65) || (t.hype && S.st.fame >= 70 && S.st.chem >= 60));
    save();
  }
  const tinyLine = tinyGone() ? (tinyFate() === 'market' ? `Tiny texts you Saturday night from ${tinyCity()}: *Beat the King for me. I'll be watching. Don't tell my new team.*` : `Tiny texts you Saturday night from ${tinyCity()}: *Beat the King for me. I'll be watching with a mixing bowl.*`)
    : tinySigned() ? ((y.tiny || {}).capt ? `Tiny wears the C to the Saturday walkthrough. His knee has held up all season. He says it's the stretches. He says it like it's a secret.` : `Tiny's knee is wrapped like a mummy again this week. He says it's fine. He has played every snap this year, and he's going to play this one too.`)
    : y.tinyStays
    ? `Monday morning, Tiny's agent finally gets a call back. Three more years. Tiny signs the contract in the cafeteria, on a lunch tray, next to a mixing bowl of cereal. Then he cries into the cereal. Nobody says a word about it. Nana Fonoti calls you that night to say thank you, and you aren't even sure for what.`
    : `Tiny's agent still hasn't heard back. Tiny says it's fine. He eats one bowl of cereal at breakfast. One. The whole offensive line notices.`;
  const stakes = w >= 6 ? `You've already clinched a playoff spot. Bramble doesn't care. "Every game counts. This one counts more because it's the next one."`
    : w === 5 ? `Win, and you're in. Lose, and it comes down to tiebreakers.`
    : w === 4 ? `Even a win might not be enough. At 5-5, you'd need the tiebreakers, and the tiebreakers favor teams that play together.`
    : `The playoffs are out of reach. But it's Kingsley's last game in your building, and that's enough.`;
  const captain = S.st.chem >= 55 || S.rel.coach >= 60;
  if (y.captain == null) { y.captain = captain; save(); }
  return {
    kicker: 'Year Two · Week 10 · Season finale',
    title: 'Last Dance',
    body: [
      tinyLine,
      `Sunday is the Monarchs. Dante Kingsley's last regular-season game, and his last game in your building.`,
      stakes,
      y.captain ? `Saturday night, Bramble asks the captains to speak. This year, that includes you. Rocco sewed the C on your jersey himself. It's slightly crooked. You'd never let him fix it.` : `Saturday night, at the team hotel, Bramble asks if anyone wants to say something.`,
    ],
    choices: [
      { label: 'Stand up and speak.', do() { if (S.st.conf >= 60) { fx({ chem: 8, conf: 3 }); return [`You talk about pick 257 and pick 12, and how nobody in this room was really picked to be here. They just stayed. When you sit down, ${tinyGone() ? 'the whole offensive line' : 'Tiny'} is already clapping. So is Bryce.`]; } fx({ chem: 4 }); return [`You lose your place twice. It doesn't matter. Halfway through, Bryce starts nodding, and the room follows him.`]; } },
      { if: () => bryce() >= 45, label: 'Give the floor to Bryce.', do() { fx({ bryce: 8, chem: 5 }); return [`Bryce stands up, opens his mouth, and nothing comes out. Then:`, { s: 'Bryce Calloway', t: `I got drafted to replace somebody in this room. And he's the reason I'm not scared anymore.` }, `He sits down. ${tinyGone() ? 'The offensive line loses it completely.' : 'Tiny loses it completely.'}`]; } },
      { label: 'Headphones on. Lock in.', do() { S.flags.focus = true; fx({ conf: 2 }); return [`You run through every play in your head twice.`, { note: 'Locked in: you\'ll have film notes on your reads this week.' }]; } },
    ],
  };
};

P.y2_po1 = () => ({
  kicker: 'Year Two · Playoffs · Wild Card week',
  title: 'Why Is Everybody Quiet?',
  body: [
    Y1().inPO ? `Playoff week. Last year, you didn't know it would feel different. This year, Bryce asks you about it on Monday, in a whisper, like it's a secret.`
      : `Your first playoff week. Bryce's, too. You both feel it on Monday: practice is quieter, and even ${tinyGone() ? 'the offensive line is eating one plate at a time' : 'Tiny is eating one bowl of cereal at a time'}. Bryce asks you about it in a whisper, like it's a secret.`,
    { s: 'Bryce Calloway', t: `Why is everybody so quiet? Is somebody mad?` },
    Y1().inPO ? '' : `You don't know either. You decide to act like you do.`,
  ],
  choices: [
    { label: 'Tell him the truth: everybody\'s scared, and that\'s fine.', do() { fx({ bryce: 6, conf: 3 }); return [`You tell him the quiet is just ninety people being scared in the same direction. He thinks about it.`, { s: 'Bryce Calloway', t: `That's the weirdest thing anybody's ever said to me. It helped.` }]; } },
    { label: 'Host film night. You have furniture now.', do() { fx({ chem: 6, skill: 2 }); return [`Twenty guys, four pizzas, one house with actual furniture. ${tinyGone() ? 'The linemen sit on the floor anyway, in Tiny\'s honor.' : 'Tiny sits on the floor anyway, out of respect for tradition.'}`]; } },
    { label: 'Extra session with {coachLast}.', do() { fx({ skill: 4, coach: 4, energy: -8 }); return [okaforLeft() ? `Pettis brings a whiteboard to the practice field and talks so quietly you have to stand close to hear him. You go until the security guard flickers the stadium lights. Bryce watches from the tunnel the whole time, taking notes.` : Y1().inPO ? `She brings the whiteboard again. The security guard flickers the stadium lights at the exact same time as last year, and you both laugh, which has never happened before.` : `She brings a whiteboard to the practice field. You go until the security guard flickers the stadium lights. Bryce watches from the tunnel the whole time, taking notes.`]; } },
  ],
});

P.y2_po2 = () => {
  const k = y2().kingsley;
  return {
    kicker: 'Year Two · Playoffs · Conference Championship week',
    title: 'Last Stand',
    body: [
      `The Monarchs. Again. Win, and Dante Kingsley's career is over. Lose, and he gets one more game.`,
      danteArc().post1 === 'cake' || k === 'pod' ? `Tuesday night, a text from Dante Kingsley.` : `Tuesday night, a text from Dante Kingsley. You never gave him your number. He doesn't explain.`,
      { s: 'Dante Kingsley', t: k === 'pod' ? `Best episode I ever did. Still gonna end you Sunday. Love you, man.` : k === 'cake' ? (Y1().trash === 'cake' ? `Two cakes. Two years. If you send a third one I'm calling the police. See you Sunday.` : `My kids ate the crown part of that cake. Still gonna end you Sunday.`) : `Last dance. Don't you dare take it easy on me.` },
    ],
    choices: [
      { label: 'Reply: "Wouldn\'t dream of it."', do() { fx({ conf: 4 }); return [`He reacts with a crown emoji. Some things never change.`]; } },
      { label: 'Send him your jersey with a note: "For the crown room."', do() { fx({ fame: 4, chem: 2 }); return [`He sends back a photo: your jersey, framed, hanging in his podcast studio next to a crown. The label underneath says THE UNDRAFTED ONE.`]; } },
      { label: 'Leave him on read. Again.', do() { S.flags.focus = true; fx({ conf: 2, coach: 2 }); return [`You put the phone in your locker and leave it there until Sunday.`, { note: 'Locked in: you\'ll have film notes on your reads this week.' }]; } },
    ],
  };
};

P.y2_po3_media = () => ({
  kicker: 'Year Two · The Championship · Media day',
  title: y1Final() ? 'Media Day, Again' : 'Media Day',
  body: [
    y1Final() ? `Championship media day, year two. Four thousand reporters, a stadium full of cameras, and a man dressed as a hammerhead shark who remembers you.`
      : `Championship media day. Four thousand reporters, a stadium full of cameras, and a man dressed as a hammerhead shark, who is somehow credentialed.`,
    { s: 'Shark Man', t: y1Final() ? `{first}! Last year I asked what kind of sandwich you'd be. This year: what kind of sandwich is BRYCE?` : `{first}! Quick one. If Bryce Calloway were a sandwich, what kind of sandwich would he be?` },
    `Bryce, two podiums over, is listening very hard.`,
  ],
  choices: [
    { label: '"One that\'s still in the oven. It\'s gonna be great."', do() { fx({ bryce: 6, fame: 3 }); return [`Bryce makes the clip his lock screen by dinner.`]; }, then: 'y2_po3_night' },
    { label: '"Gold bread. Gold cheese. Very loud."', do() { fx({ fame: 7, bryce: bryce() >= 50 ? 2 : -2 }); return [`The clip goes everywhere. A sandwich shop in Harbor City starts selling the Calloway. It comes on a gold plate and costs $31. Bryce eats one on camera and gives it four stars.`]; }, then: 'y2_po3_night' },
    { label: Y1().flags && Y1().flags.sandwich === 'shout' ? 'Shout out {fam} and {home}, like last year.' : 'Ignore the question. Shout out {fam} and {home}.', do() { fx({ family: 8, fame: 4 }); return [y1Final() ? `Back home, people scream at their TVs again. Some traditions you keep.` : `Back home, people scream at their TVs. {fam} watches it on repeat.`]; }, then: 'y2_po3_night' },
  ],
});

P.y2_po3_night = () => {
  const close = bryce() >= 50, band = !!S.items.band;
  if (!close && tinyGone()) return {
    kicker: 'Year Two · The Championship · The night before',
    title: y1Final() ? 'Knock Knock, Again' : 'Knock Knock',
    body: [
      `11:40 p.m. You're staring at the hotel ceiling. Your phone buzzes. It's Tiny, from ${tinyCity()}.`,
      { s: 'Tiny', t: `cant sleep either. go knock on the rookie's door. id bring cereal if i was there` },
    ],
    choices: [
      { label: 'Go get the rookie. Raid the minibar.', do() { fx({ bryce: 10, chem: 3 }); return [`Bryce opens the door on the third knock, red-eyed. You sit on the floor with a pile of minibar snacks and Tiny on speaker until one in the morning, and nobody mentions anything that happened this year.`]; } },
      { label: 'Call Tiny back. Talk about nothing.', do() { fx({ chem: 3, conf: 3 }); return [`You talk about nothing until one in the morning. He eats cereal the whole time, loudly, on purpose. It helps more than you'd think.`]; } },
      { label: 'Sleep. Actually sleep.', do() { fx({ energy: 20 }); return [`Eight hours. You don't dream about anything.`]; } },
    ],
  };
  if (!close) return {
    kicker: 'Year Two · The Championship · The night before',
    title: y1Final() ? 'Knock Knock, Again' : 'Knock Knock',
    body: [
      `11:40 p.m. You're staring at the hotel ceiling when someone knocks. It's Tiny, holding three bowls of cereal.`,
      { s: 'Tiny', t: `Couldn't sleep. Brought one for the rookie too, but he's not answering his door.` },
    ],
    choices: [
      { label: 'Go get the rookie. Bring the third bowl.', do() { fx({ bryce: 10, chem: 3 }); return [`Bryce opens the door on the third knock, red-eyed. He sits on the floor with you and Tiny and eats cereal until one in the morning, and nobody mentions anything that happened this year.`]; } },
      { label: 'Eat cereal with Tiny. Talk about nothing.', do() { fx({ chem: 4, conf: 3 }); return [`You talk about nothing until one in the morning. Tiny eats the rookie's bowl too. It helps more than you'd think.`]; } },
      { label: 'Sleep. Actually sleep.', do() { fx({ energy: 20 }); return [`Eight hours. You don't dream about anything.`]; } },
    ],
  };
  return {
    kicker: 'Year Two · The Championship · The night before',
    title: y1Final() ? 'Knock Knock, Your Turn' : 'Your Turn',
    body: [
      y1Final() ? `11:40 p.m. You're staring at the hotel ceiling, the way you did a year ago. Then you get up, walk down the hall, and knock on room 1214.` : `11:40 p.m. You're staring at the hotel ceiling. You can't sleep, and you'd bet money the rookie can't either. You get up, walk down the hall, and knock on room 1214.`,
      `Bryce opens the door in a hotel robe, wide awake, holding a playbook he already knows by heart.`,
      band ? `You're holding something: a wristband, sweat-stained and a little frayed. Marcus Vane wore it in his first playoff game and his last. Then he gave it to you.` : `You're holding something: a strip of athletic tape with {LAST} on it in marker. Rocco saved it from your first locker. You've carried it in your wallet all year.`,
    ],
    choices: [
      { if: () => !!S.items.band, label: 'Give Bryce Vane\'s wristband.', sub: 'You lose its clutch bonus tomorrow.', do() {
          delete S.items.band; const y = y2(); y.gaveBand = true; award('y2_eyes'); fx({ bryce: 15, chem: 4 });
          return [{ s: 'You', t: `Somebody gave me this the night before my first one. Maybe it needs somebody new.` }, `He holds it like it might break. Then he puts it on, looks at it, and looks up at you.`, { s: 'Bryce Calloway', t: `Eyes up?` }, { s: 'You', t: `Eyes up.` }, { note: 'You gave away Vane\'s wristband. Bryce will wear it tomorrow.' }];
        } },
      { if: () => !S.items.band, label: 'Give him the tape from your first locker.', do() { y2().gaveTape = true; award('y2_eyes'); fx({ bryce: 12, conf: 2 }); return [{ s: 'You', t: `That's where I started. You started at pick twelve. Doesn't matter. Everybody ends up in the same room.` }, `He sticks it inside his helmet.`, { s: 'You', t: `And eyes up. Somebody told me that once.` }]; } },
      { label: 'Just sit with him. Talk about nothing.', do() { fx({ bryce: 6, energy: -4, conf: 3 }); return [`You talk about nothing until one in the morning: his mom, {fam}, Tiny's cereal, the time Bramble almost laughed. It helps him more than you'd think. It helps you, too.`]; } },
    ],
  };
};

// =========================================================
//   YEAR-TWO RANDOM EVENTS
// =========================================================
const y2If = () => isY2();
Object.assign(EVENTS, {
  y2e_dinner: { if: y2If, title: 'The Rookie Dinner, Part Two', get body() { return [
      (y1Did('dinner') ? `The rookie dinner. Same steakhouse. Same tradition. Only this year you're on the other side of the table, and Bryce is sitting where you sat, holding a menu with no prices on it.`
        : `The rookie dinner. Last year it somehow skipped you, which the veterans consider a clerical error. This year you're on the safe side of the table, and Bryce is holding a menu with no prices on it.`),
      (y1Did('dinner') ? `A veteran orders the $400 steak again. Different veteran. Same steak.` : `A veteran orders a $400 steak. He eats half of it and asks for a box.`)]; },
    choices: [
      { label: 'Order the most expensive thing on the menu. Tradition is tradition.', do() { fx({ chem: 6, bryce: -6, fame: 1 }); return [`You order the seafood tower. It arrives on a stand, with a lobster on top. Bryce's share of the check is $31,000. He smiles the whole time he signs it, which is how you know it hurt.`]; } },
      { label: 'Quietly pay the rookies\' share yourself.', do() { fx({ money: -28450, bryce: 12, chem: 4 }); return [`You hand the waiter your card on the way back from the bathroom. Bryce finds out when the check never comes.`, `At midnight he texts you one word: *why.* You text back: *Somebody should've done it for me.*`]; } },
      { label: 'Order a salad. Make the rookies split it evenly.', do() { fx({ chem: 2, bryce: 3 }); return [`Fair is fair. Bryce does the math on a napkin and gets it wrong twice. The other rookies love him for it.`]; } },
    ] },
  y2e_number: { if: y2If, title: 'The Number', body: [
      `Bryce corners you at your locker with a check already written out.`,
      { s: 'Bryce Calloway', t: `I've worn {num} since Pop Warner. Name your price.` },
      `It's a league tradition: veterans sell their numbers to rookies who want them. It's also your number. {fam} has it on a sign.`],
    choices: [
      { label: 'Sell it. Swap numbers.', do() { const y = y2(), old = S.num, nb = bnum(); S.num = nb; y.bnum = old; y.swapped = 'sold'; fx({ money: 50000, bryce: 12, fame: 3, family: -3 }); return [`$50,000 and his old number, ${nb}. Rocco sews new numbers on everything overnight and grumbles the whole time.`, `{fam} has to make a new sign. The new sign is bigger.`, { note: `You wear number ${nb} now.` }]; } },
      { label: 'Swap, but make him pay the children\'s hospital instead.', do() { const y = y2(), nb = bnum(); y.bnum = S.num; S.num = nb; y.swapped = 'hospital'; fx({ bryce: 8, fame: 8, family: 4 }); return [`He writes the check to Harbor City Children's Hospital. The hospital names a playroom after both of you.${Y1().leoVisit ? ' Leo is the first kid through the door.' : ''}`, { note: `You wear number ${nb} now.` }]; } },
      { label: '"No chance. Make your own number famous."', do() { fx({ conf: 3, bryce: -5 }); return [`He tears up the check. Then he goes out and makes his own number famous. Honestly, that was the right answer.`]; } },
    ] },
  y2e_rocco: { if: y2If, title: 'Rocco\'s Box', body: [
      `Rocco, the equipment manager, calls you into the cage and pulls out a shoebox. Inside are dozens of strips of athletic tape, each with a name in marker.`,
      { s: 'Rocco', t: `Every guy who came in on a tape strip and made it, I keep the strip. Thirty-two years. You're in here.` },
      `He hands you yours. {LAST}, in somebody's bad handwriting, from the first day of camp.`],
    choices: [
      { label: 'Put it back. It belongs in the box.', do() { fx({ conf: 5, chem: 3 }); return [`Rocco nods like you passed a test. Maybe you did.`]; } },
      { label: 'Ask if Bryce\'s name can go in the box someday.', do() { fx({ bryce: 6, coach: 2 }); return [{ s: 'Rocco', t: `He's a first-rounder. He got a nameplate on day one.` }, `He squints at you for a while.`, { s: 'Rocco', t: `But if he sticks, sure. I'll make an exception.` }]; } },
      { label: 'Ask whose strip is on top.', do() { fx({ conf: 4, skill: 1 }); return [{ s: 'Rocco', t: `Marcus Vane. Thirteen camps ago. Undrafted, same as you.` }, `You didn't know that. Nobody ever told you that. You sit down on an equipment trunk for a while.`]; } },
    ] },
  y2e_hands: { if: y2If, title: 'Show Me Two', body: [
      `Hands Greer, the retired Hammerheads legend with the bronze statue, hosts a radio show on Tuesdays. This Tuesday he spends twenty minutes on you.`,
      { s: 'Hands Greer', t: `Kid's good. Kid's real good. But I've seen a hundred guys have one good year. Show me two.` }],
    choices: [
      { label: 'Call in to the show.', do() { fx({ fame: 6, conf: 2 }); return [`You call in live. He's so surprised he spills his coffee on air. By the end, he's telling a story about his own second season that he swears he's never told before. He has definitely told it before.`]; } },
      { label: 'Bring Bryce to his Tuesday clinic.', do() { fx({ bryce: 6, skill: 2, energy: -6 }); return [`Forty kids, one legend, and two players at the same position. Greer makes you and Bryce race each other with eggs on spoons. Bryce wins.`, { s: 'Hands Greer', t: `Don't tell the defense.` }, `He winks at both of you.`]; } },
      { label: 'Let the tape answer him.', do() { fx({ coach: 3, conf: 2 }); return [`You don't say a word. That Sunday, the stadium camera finds Greer in a suite after your best play. He's standing up.`]; } },
    ] },
  y2e_delgado: { if: y2If, title: 'Coach Delgado\'s Kids', body: [
      `Coach Delgado calls from back home. His team made the state semifinal: a roster full of kids nobody recruited.`,
      { s: 'Coach Delgado', t: `They want to hear from you. Not a video. They want to know if it's real.` }],
    choices: [
      { label: 'Fly home on your day off and talk to them.', do() { fx({ energy: -12, family: 8, conf: 6, fame: 3 }); return [`You stand in the locker room where you used to sit and tell them about 11:52 p.m. Delgado cries again. He says it's allergies. It's November.`]; } },
      { label: 'Video-call the team before their game.', do() { fx({ family: 3, conf: 3, chem: 2 }); return [`Tiny insists on being in the call${tinyGone() ? ', from ' + tinyCity() : ''}. The kids want Tiny more than you. You're used to it by now.`]; } },
      { label: 'Send the whole team new cleats.', do() { fx({ money: -18000, family: 5, fame: 4, bryce: 3 }); return [`Gold cleats, at Bryce's suggestion, and he pays for half. The kids win the semifinal. The cleats are blinding in the photos.`]; } },
    ] },
  y2e_nana: { if: () => y2If() && !tinyGone(), title: 'Nana Fonoti', body: [
      `Nana Fonoti, Tiny's grandmother, shows up at the facility with a tray of food the size of a door. She finds you in the parking lot.`,
      { s: 'Nana Fonoti', t: `You look after my boy. He looks after everybody, and nobody looks after him. That's your job now. Eat this first.` }],
    choices: [
      { label: 'Promise her.', do() { fx({ chem: 6, conf: 2 }); return [`She makes you shake on it, then makes you eat in front of her. She watches until you finish. Tiny watches from a window and pretends he isn't.`]; } },
      { label: 'Invite her to sit with {fam} on Sunday.', do() { fx({ chem: 5, family: 4 }); return [`By halftime, Nana Fonoti and {fam} have traded phone numbers and several opinions about your posture.`]; } },
      { label: 'Ask her to teach you the turkey tails recipe.', do() { fx({ chem: 4, energy: 4 }); return [`She says no. Then she teaches you anyway, but leaves out one ingredient on purpose.`, { s: 'Nana Fonoti', t: `When you're family, you get the last one.` }]; } },
    ] },
  y2e_sly: { if: y2If, title: 'Reality Check', body: [
      `Sly Pemberton corners you at a charity golf event in a suit the color of money.`,
      { s: 'Sly Pemberton', t: `Picture it. "Undrafted: Year Two." Cameras in your house. Cameras in your car. The rookie, the veteran, the drama. Eight episodes, kid. I already have a guy.` }],
    choices: [
      { label: 'Do the show.', do() { fx({ fame: 12, money: 60000, chem: -6, bryce: -4 }); return [tinyGone() ? `The cameras follow you for a month. The episode where Bryce tries to make breakfast for the entire film crew becomes the most-watched thing on the platform.` : `The cameras follow you for a month. The episode where Tiny makes cereal for the entire film crew becomes the most-watched thing on the platform.`, `The episode about you and Bryce is edited to make you look like enemies. Bryce watches it twice.`]; } },
      { if: () => !tinyGone(), label: 'Do it, but only if it\'s about Tiny.', do() { fx({ chem: 8, fame: 5 }); return [`Sly tries to argue. Then he meets Tiny. The show becomes *Big Man, Big Heart*. It wins an award you've never heard of.`]; } },
      { label: 'Hard pass.', do() { fx({ coach: 3 }); return [`Sly hands you another metal business card. You use it as an ice scraper, like the first one.`]; } },
    ] },
  y2e_jules: { if: y2If, title: 'The Profile', body: [
      `Jules Park is writing a long profile for the Ledger's Sunday magazine. The working title is "The Undrafted Veteran." The interview is at a diner, over pie.`,
      { s: 'Jules Park', t: `When the Hammerheads drafted Bryce Calloway, did you think they were replacing you?` }],
    choices: [
      { label: '"Yes. And that\'s fine. That\'s how this works."', do() { fx({ coach: 3, bryce: 4, conf: 1 }); return [`The headline is THE UNDRAFTED VETERAN KNOWS HOW THIS ENDS. Bramble cuts it out and pins it to the board. Bryce reads it twice and gets quiet.`]; } },
      { label: '"No. They drafted a guy to learn from me."', do() { fx({ conf: 4, fame: 4, bryce: -3 }); return [`The headline is CLASS IS IN SESSION. It's everywhere by noon. Bryce posts a photo of himself in a dunce cap. It's funnier than it should be, and a little bit hurt.`]; } },
      { label: '"I think they drafted somebody to make me better. It\'s working."', do() { fx({ bryce: 6, chem: 3, fame: 2 }); return [`The headline is IRON SHARPENS IRON. Bryce has it framed. He hangs it in his locker, at eye level, where you'll see it every day.`]; } },
    ] },
  y2e_turk: { if: y2If, title: 'The Tap', body: [
      `Tuesday morning, you're eating eggs in the cafeteria when The Turk walks in. Every head in the room goes down.`,
      `He walks past you. He walks past Bryce. He stops behind Dez, a practice-squad receiver who plays harder than anybody in the building and eats lunch alone.`,
      { s: 'The Turk', t: `Dez. Coach wants to see you. Bring your playbook.` }],
    choices: [
      { label: 'Walk Dez out to the parking lot.', do() { fx({ chem: 5, conf: -1 }); return [`You carry his bag. He doesn't say anything until you reach his car. "Thanks for noticing me," he says. You give him your number and make sure he uses it.`]; } },
      { label: 'Ask {coachLast} to make some calls for him.', do() { fx({ coach: 2, chem: 3 }); return [`By Friday, Dez is on the Gulls' practice squad. {coachLast} never tells you {cp} made the call. Dez does.`]; } },
      { label: 'Keep eating. That\'s the business.', do() { fx({ conf: 2, chem: -3 }); return [`You keep eating. The eggs taste like nothing. Bryce watches you keep eating, and you can see him learning something you didn't mean to teach.`]; } },
    ] },
  y2e_superfan: { if: y2If, title: 'Ink', get body() { return [
      (y1Did('rabbit') ? `The Superfan in the foam shark hat is back. Last year she pressed a rabbit's foot into your hand. This year she has a request.` : `A woman in a foam shark hat has been to every home game for nineteen years. She has never asked a player for anything. This year she has a request.`),
      { s: 'Superfan', t: `Sign my arm. I'm getting it tattooed tomorrow. My appointment's at nine.` }]; },
    choices: [
      { label: 'Sign it. Big.', do() { fx({ fame: 5, conf: 2 }); return [`You sign from her wrist to her elbow. On Wednesday she sends a photo of the tattoo. It's the most permanent thing anyone has ever done for you.`]; } },
      { label: 'Sign it, and get Bryce to sign underneath.', do() { fx({ fame: 4, bryce: 5 }); return [`Bryce signs underneath, smaller, on purpose. "Rookie spot," he says. She gets both tattooed. She's thrilled. Her mother is not.`]; } },
      { label: 'Talk her into a temporary one.', do() { fx({ conf: 1, coach: 1 }); return [`She agrees to a temporary tattoo. She gets the real one anyway, the next week, and sends a photo captioned: *you tried.*`]; } },
    ] },
  y2e_shaw: { if: y2If, title: 'Sleep Study', get body() { return [
      `Dr. Imani Shaw puts a sensor ring on everybody's finger for a week. Then she calls you into her office with a printout.`,
      { s: 'Dr. Imani Shaw', t: `You slept five hours and eleven minutes a night. Bryce slept four. ${tinyGone() ? 'Your center' : 'Tiny'} slept eleven. Only one of you is doing this right, and it isn't either of you.` }]; },
    choices: [
      { label: 'Lights out at ten, for you and Bryce. Make it a competition.', do() { fx({ energy: 14, bryce: 4 }); return [`It's the first competition with Bryce that you both win.`]; } },
      { get label() { return tinyGone() ? 'Text Tiny for his secret.' : 'Ask Tiny for his secret.'; }, do() { fx({ energy: 10, chem: 3 }); return [{ s: 'Tiny', t: `Cereal. And a sound machine that plays whales.` }, `You buy the sound machine. The whales help.`]; } },
      { label: 'Ignore the printout.', do() { fx({ energy: -4, coach: -2 }); return [`Dr. Shaw tapes the printout to your locker. Bramble initials it.`]; } },
    ] },
});

// =========================================================
//   ENDINGS
// =========================================================
const vaneEnd = () => ({
  retired: `That night, Marcus Vane texts you a clip from his TV show: Bryce, reading a blitz the exact way you read it. Under it, two words: *Look at you.*`,
  signed: `That night, Marcus Vane texts you from the Mustangs' team plane: *Heard about the kid. Good.* No question mark. No exclamation point. From Vane, that's a parade.`,
  quiet: `That night, a text from a number you saved in a car dealership parking lot: *Heard about the kid. Eyes up. Told you.*`,
  released: `That night, a text from a number you saved in a car dealership parking lot: *Heard about the kid. You did it right. Better than I did.*`,
}[vstat()]);
Object.assign(ENDINGS, {
  y2_dynasty: { title: 'Dynasty', body: () => [
    tinyGone() ? `Confetti again. Orange and white again. It gets in your helmet again, and in Bryce's hair, where it will stay until March. Somewhere in ${tinyCity()}, Tiny is screaming at a TV.` : `Confetti again. Orange and white again. It gets in your helmet again, and in Tiny's beard again, where it will stay until March. Again.`,
    `Two years ago, nobody called your name. Now you have two rings and a jeweler who knows you by your first name.`,
    bryce() >= 60 ? `Bryce finds you on the stage, grabs both of your shoulder pads, and screams something you can't hear. You think it was "BIG DOG." You're almost sure.` : `Across the stage, Bryce holds the trophy over his head like he won it alone. Let him. He'll learn.`,
    { s: 'Coach Bramble', t: `Two.` },
    `He holds up two fingers. That's the whole speech. It's perfect.`,
  ] },
  y2_champ: { title: 'Unfinished Business', body: () => [
    Y1().lostRound === 12 ? `Last year you sat on the bench under the wrong-colored confetti. This year it's the right colors, and you don't sit down for an hour.`
      : tinyGone() ? `Last year ended early. This year it ends the only way you wanted: under orange-and-white confetti, with Bryce and the whole offensive line lifting you off the ground, and Tiny screaming on a video call from somebody's phone.`
      : `Last year ended early. This year it ends the only way you wanted: under orange-and-white confetti, with Tiny lifting you off the ground like you weigh nothing, which, to Tiny, you still do.`,
    `The parade route runs eleven miles. The man in the shark costume rides on your float this time. He cries the whole way. So does Bryce.`,
    okaforLeft() ? `That night, a text from Ridgeline State: *You were undrafted, {last}. You're a champion now. Write that second part down somewhere you'll see it.* It's signed *Coach Okafor*, which is how you know she means it.`
      : { s: 'Coach Okafor', t: `You were undrafted, {last}. You're a champion now. Write that second part down somewhere you'll see it.` },
  ] },
  y2_torch: { title: 'Passing the Torch', body: () => [
    `The season ends without a ring. You clean out your locker into a trash bag, the way everyone does.`,
    `On the last day, Bryce leaves a sticky note on your locker. Three bullet points in small handwriting: things he noticed you doing wrong on third down. All three are right.`,
    `You recognize the move. Somebody did it to you once.`,
    { s: 'Bryce Calloway', t: `Same time next year? I'm still taking your job.` },
    { s: 'You', t: `I know. Eyes up.` },
    vaneEnd(),
  ] },
  y2_holdout: { title: 'Holdout', body: () => [
    `The money cleared in August. Everything else never quite did.`,
    `The locker room remembers the twenty-three days you weren't there. The coaches remember. By December, the fans chant the rookie's name when you jog off the field. Not to be mean. Just to be heard.`,
    { s: 'Coach Bramble', t: `You got paid. Good. Now earn it. Report date is March 30th. If you're not there, he starts.` },
    Y1().agent === 'sly' ? `Sly sends you a fruit basket and an invoice.` : Y1().agent === 'steady' ? `Margaret sends you one email. The subject line is "As discussed." The body is empty. It's the most devastating thing you've ever read.` : `You negotiated it yourself, so there's nobody else to blame. You check. Twice.`,
  ] },
  y2_feud: { title: 'Cold War', body: () => [
    `You and Bryce Calloway spend the whole season three feet apart and a thousand miles away.`,
    `He doesn't ask you anything. You don't offer. In the film room, you sit on opposite sides, and {coachLast} stands in the middle like a referee.`,
    `In March, his agent tells the Ledger that Bryce "expects to compete for the starting job." Jules Park calls for comment. You say "Good." You mean it, a little.`,
    tinyGone() ? `In April, a text from Tiny, all the way from ${tinyCity()}: *u know vane was like that with you right. and u turned out ok. maybe be the guy who breaks it*` : { s: 'Tiny', t: `You know Vane was like that with you, right? And you turned out okay. Maybe be the guy who breaks it.` },
  ] },
  y2_grind: { title: 'The Veteran\'s Grind', body: () => [
    S.flags.inPO ? `The season ends in the playoffs. It isn't a ring. It's a lot more than nothing.` : `The season ends before the playoffs. It hurts in a different way than last year. Last year you were happy just to be here. This year you expected more.`,
    `You're not a story anymore. You're not the undrafted kid. You're the starter, the guy with the brass nameplate, the one the rookie is chasing. That's harder than being a story. It's also better.`,
    okaforLeft() ? `On the drive home, Okafor calls from Ridgeline. She watched every snap.` : '',
    { s: 'Coach Okafor', t: `Year one, you had to prove you belonged. Year two, you had to prove it wasn't a fluke. Year three, you get to just play. That's the good part.` },
  ] },
});
if (typeof ENDING_HINTS === 'object') Object.assign(ENDING_HINTS, {
  y2_dynasty: 'Year Two: win the Championship two years in a row.', y2_champ: 'Year Two: finish what you started.',
  y2_torch: 'Year Two: become what Vane became for you.', y2_holdout: 'Year Two: get paid, and pay for it.',
  y2_feud: 'Year Two: never let the rookie in.', y2_grind: 'Year Two: keep the job.',
});
// Checked first, ahead of any year-one rules.
ENDING_RULES.unshift(
  { id: 'y2_dynasty', when: () => isY2() && !!Y1().champion && !!S.flags.champion },
  { id: 'y2_holdout', when: () => isY2() && !!y2().holdout && !S.flags.champion && (S.record.w <= 5 || S.rel.coach < 35 || S.st.chem < 35) },
  { id: 'y2_champ', when: () => isY2() && !!S.flags.champion },
  { id: 'y2_torch', when: () => isY2() && bryce() >= 75 },
  { id: 'y2_feud', when: () => isY2() && bryce() <= 25 },
  { id: 'y2_grind', when: () => isY2() },
);

// Year-two epilogue lines (each returns null outside year two).
CODAS.push(
  () => {
    if (!isY2()) return null;
    const b = bryce(), y = y2();
    if (b >= 70) return y.gaveBand ? `Bryce wears Vane's wristband to every game the next season. When reporters ask about it, he says, "It's on loan." It is not on loan.`
      : Y1().leoVisit ? `In April, Bryce shows up at the children's hospital without telling anybody, carrying forty pairs of gold cleats. Leo tells you about it before the team does.`
      : `In April, Bryce texts you at 2 a.m.: *${reads().text}.* You answer in a paragraph. He sends back: *ok big dog.*`;
    if (b <= 20) return tinyGone() ? `Bryce changes lockers. Then his number. Then his podcast name, to "The Successor." Tiny, from ${tinyCity()}, calls it "The Sucks-essor" on his new team's podcast.` : `Bryce changes lockers. Then his number. Then his podcast name, to "The Successor." Tiny calls it "The Sucks-essor" until Bramble makes him stop.`;
    return `Bryce Calloway finishes his rookie year with a highlight reel and a lot of questions. Some of them he asked you. Most of them he didn't. Next year, maybe.`;
  },
  () => {
    if (!isY2()) return null;
    const y = y2();
    if (y.tinyStays == null) return null;
    return y.tinyStays ? `Tiny signs a poster of his contract extension for you. Across the bottom, he writes: *Ask {first} why.* Nobody asks. Everybody knows.`
      : `Tiny signs with the Lakeshore Gulls in March. He sends you a photo of himself in teal. "Doesn't fit," he writes. "Nothing fits." You put the photo on your fridge anyway.`;
  },
  () => {
    if (!isY2()) return null;
    const vs = vstat(), w = y2().vaneWeek;
    if (vs === 'retired') return `Marcus Vane gets a bigger show on the network. On air, he calls you "my rookie," every single time. You're not his rookie anymore. You'd never correct him.`;
    if (vs === 'signed') return `Marcus Vane retires after the season. He mails you his Mustangs helmet with a note tucked in the facemask: *Feet.*`;
    return w === 'guest' ? `In March, the Hammerheads hire Marcus Vane as an assistant {poscoach}. On his first day, he moves his stool six inches closer to Bryce's.`
      : `Marcus Vane still sells trucks. He keeps a photo of you behind the register and tells customers he taught you everything. It's about half true.`;
  },
  () => (isY2() ? `Dante Kingsley's retirement party has a cake shaped like a crown.${y2().kingsley === 'cake' ? ' He makes sure everyone knows you started it.' : ''} His last podcast episode is called "The Undrafted One."` : null),
  () => {
    if (!isY2()) return null;
    const f = y2().family;
    if (f === 'all') return tinyGone() ? `{fam} starts a group chat with the whole offensive line called "Our Boys." Tiny begs to be added from ${tinyCity()}. He gets added.` : `{fam} and Nana Fonoti start a group chat called "Our Boys." They text each other more than you and Tiny do.`;
    if (f === 'bryce') return `Bryce sends {fam} a card at Christmas, addressed to "{fam} (Big Dog's)." It goes on the fridge, next to your rookie card.`;
    return S.st.money >= 900000 ? { town: `With your second-year money, you buy the building next to the Bluebird Diner so Grandma Bea can finally have a bigger kitchen. She uses it to make more pie. Obviously.`, city: `With your second-year money, you fund a new break room for the night-shift nurses at Mom's hospital. There's a plaque. Mom made them take your name off it and put hers on.`, base: `With your second-year money, you buy Dad a second boat. He names it *Undrafted II* and still makes you swab the deck.` }[S.origin] : null;
  },
  () => {
    if (!isY2()) return null;
    const y = y2();
    if (y.leoKept2) return `Leo's kickball team goes undefeated. He credits your {big} in the opener. He's not wrong.`;
    if (Y1().leoVisit || Y1().leoKept || Y1().leoPromise) return `Leo turns eleven. He asks for a cake shaped like a football with your number on it${y.leo === 'bryce' ? ', and Bryce\'s number on the back' : ''}. He gets it.`;
    return null;
  },
);

// Jules Park's year-two column, built from what happened.
function y2LedgerHTML() {
  const y = y2(), b = bryce(), c = y.contract || {}, L = esc(S.last), champ = S.flags.champion, lost = S.flags.lostRound;
  const lines = [`A year ago, ${esc(S.first)} ${L} was the 258th pick of a draft that only had 257. This year, the Hammerheads used their first pick on ${L}'s replacement.`];
  lines.push({
    team: `In March, ${L} signed a hometown deal and left money on the table so the team could pay its linemen.`,
    max: `In March, ${L} signed for the big number, and spent the fall answering for it.`,
    bet: `In March, ${L} turned down long-term money for a one-year deal paid by the win. ${y.bonusPaid ? `It paid ${money(y.bonusPaid)} in win bonuses.` : S.record.w ? '' : 'The wins never came, so neither did the bonuses.'}`,
    holdout: `In March, ${L} walked out of a contract meeting and held out for 23 days of camp. The rookie took every one of those reps.`,
  }[c.deal] || '');
  lines.push(b >= 70 ? `By December, Bryce Calloway was asking ${L} about ${reads().what} at two in the morning.` : b <= 20 ? `${L} and Bryce Calloway spent the season three feet apart and a thousand miles away.` : `${L} and Bryce Calloway spent the season figuring each other out. It was complicated. It was supposed to be.`);
  if (y.scare === 'sit') lines.push(`In Week 6, ${L} sat out with a strain and handed the rookie his first start.`);
  if (y.cover === 'took') lines.push(`Sources say ${L} took a $10,000 fine for something the rookie did. ${L} declined to comment.`);
  lines.push(`The Hammerheads finished ${S.record.w}-${S.record.l}${champ ? (Y1().champion ? ' and won the Championship again' : ' and won the Championship') : lost === 12 ? ' and came one game short of a title' : lost != null ? ' and made the playoffs' : S.flags.inPO ? '' : ' and missed the playoffs'}.`);
  lines.push(`${L}'s season line: ${esc(lineText(S.line))}.`);
  const head = champ ? (Y1().champion ? 'Two for Two' : 'The Second Act') : b >= 70 ? 'The Mentor' : b <= 20 ? 'Cold War' : y.holdout ? 'Paid in Full' : 'Year Two';
  return `<div class="ledger"><div class="ledger-mast">The Harbor City Ledger</div><div class="ledger-head">${esc(head)}</div><div class="ledger-by">By Jules Park</div><p>${lines.filter(Boolean).join(' ')}</p></div>`;
}
const _y2Ending = P.ending;
P.ending = a => {
  if (!isY2()) return _y2Ending(a);
  if (!S.flags.ending) {
    S.flags.ending = pickEnding();
    if (S.flags.champion) award('champ');
    if (S.st.money >= 750000) award('rich');
    if (S.record.w >= 7) award('y2_surge');
    if (bryce() >= 85) award('y2_mentor');
    const car = S.career || (S.career = { seasons: [], line: {} });
    if (!car.seasons.some(x => x.year === 2)) {
      car.seasons.push({ year: 2, record: { w: S.record.w, l: S.record.l }, po: poText({ champion: S.flags.champion, lostRound: S.flags.lostRound, inPO: S.flags.inPO }), grade: S.grades.length ? avgGrade() : null, ending: S.flags.ending, line: Object.assign({}, S.line) });
      addTotals(car.line, S.line);
    }
    remember('endings', S.flags.ending);
    emit('ending', S.flags.ending);
    save();
  }
  const E = ENDINGS[S.flags.ending] || ENDINGS.y2_grind;
  const out = [];
  for (const c of CODAS) { try { const p = c(); if (p) out.push(p); } catch (e) { console.error(e); } }
  out.push(`Somewhere tonight, a kid who didn't get drafted is watching your highlights with a phone face-down on the couch cushion. You hope it rings. You hope it rings at 11:52.`);
  return {
    kicker: 'Year Two · Epilogue',
    title: E.title,
    body: E.body().concat(out),
    after: y2LedgerHTML() + summaryHTML() + compareHTML(),
    choices: [
      { label: 'Start a new career', sub: 'Try another position or hometown. Two seasons, a dozen endings.', primary: true, do() { newCareer(); return null; } },
      { label: 'Open the trophy case', do() { showTrophies('play'); return null; } },
    ],
  };
};
