// =========================================================
//   PROGRESS — difficulty, XP & levels, perks, the Pro Shop,
//   weekly challenges, and the Hall of Fame.
//   Career state: ext('progress'). Cross-career: store 'undrafted.hof.v1'.
// =========================================================
const HOF_KEY = 'undrafted.hof.v1';

// ---------- Difficulty ----------
const DIFFS = {
  rookie: { name: 'Rookie', tag: 'Easier · +10% pay', desc: 'Wider windows, slower clocks, a sharper team around you, and the coaches slip you film notes most weeks. Good for a first career.', diff: -0.9, pay: 1.1, film: 0.65, team: 4 },
  pro: { name: 'Pro', tag: 'Standard', desc: 'The season as it was drawn up. Nobody hands you anything.', diff: 0, pay: 1, film: 0, team: 0 },
  allpro: { name: 'All-Pro', tag: 'Harder · −10% pay', desc: 'Faster needles, tighter windows, short play clocks on reads, a thinner team around you, and no film notes from the coaches: you earn those in the film room. Smaller checks, too. Your Hall of Fame plaque gets a gold border.', diff: 1.0, pay: 0.9, film: 0, team: -6 },
};

// ---------- Levels ----------
// Total XP needed to reach level L (level 1 = 0). Steps grow by 70 each level: 120, 190, 260, 330...
// A typical Year One lands around level 7-10 (L10 = 3600 XP), so play quality moves the needle more than time served.
function xpFor(L) { let t = 0; for (let i = 2; i <= L; i++) t += 120 + 70 * (i - 2); return t; }
const LEVEL_TITLES = ['Camp Body', 'Camp Body', 'Practice Squad Hopeful', 'Special Teamer', 'Depth Chart Climber', 'Rotation Guy', 'Starter Material', 'Fan Favorite', 'Pro Bowl Snub', 'Pro Bowler', 'All-Pro', 'Franchise Player', 'Living Legend'];
const levelTitle = L => L < LEVEL_TITLES.length ? LEVEL_TITLES[L] : 'Hall of Famer';

function prog() {
  const p = ext('progress', () => ({ v: 2, id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), diff: 'pro', xp: 0, lvl: 1, pending: 0, perks: [], offer: null, tro: [], ch: null, chLast: null, chWon: 0, chTried: 0, gm: null, boosts: 0 }));
  // v1 saves used a gentler XP curve. Keep the level they earned and start them at its floor on the new one.
  if (!(p.v >= 2)) { if (!(p.xp >= xpFor(p.lvl))) p.xp = xpFor(p.lvl); p.v = 2; }
  return p;
}
const hasPerk = id => !!(S && S.ext && S.ext.progress && S.ext.progress.perks.includes(id));
const hasGear = id => !!(S && S.items && S.items[id]);
const diffOf = () => (S && S.ext && S.ext.progress && DIFFS[S.ext.progress.diff]) ? S.ext.progress.diff : 'pro';

// ---------- Perks ----------
// pos: only offered to that position. min: earliest level it can show up.
const PERKS = [
  // Position perks
  { id: 'quick_release', pos: 'QB', icon: 'bolt', name: 'Quick Release', desc: 'Timing windows 18% bigger on your throws.' },
  { id: 'pocket', pos: 'QB', icon: 'shield', name: 'Pocket Presence', desc: 'Pass plays are more forgiving, and you get +0.4 s to scramble on move plays.' },
  { id: 'vision', pos: 'RB', icon: 'eye', name: 'Vision', desc: 'Open-field runs are more forgiving, and +2 s on every read.' },
  { id: 'stiff_arm', pos: 'RB', icon: 'weight', name: 'Stiff Arm', desc: '+0.5 s on move combos. Defenders bounce off a little more.' },
  { id: 'soft_hands', pos: 'WR', icon: 'hand', name: 'Soft Hands', desc: 'Catches are more forgiving, and timing windows are 10% bigger.' },
  { id: 'route_runner', pos: 'WR', icon: 'bolt', name: 'Route Technician', desc: '+0.5 s on release combos, and routes create a little more separation.' },
  { id: 'sideline', pos: 'LB', icon: 'eye', name: 'Sideline to Sideline', desc: 'Pursuit plays are more forgiving, and +0.3 s on block-shedding combos.' },
  { id: 'ball_hawk', pos: 'LB', icon: 'target', name: 'Ball Hawk', desc: 'Takeaway plays get easier: 15% bigger windows and +2 s on reads. Picks and punch-outs.' },
  // Mini-game perks
  { id: 'hard_count', icon: 'bolt', name: 'Hard Count', desc: '+60 ms on reaction plays. You hear the snap before it happens.' },
  { id: 'footwork', icon: 'shoe', name: 'Footwork', desc: '+0.5 s to finish every move combo.' },
  { id: 'quick_read', icon: 'eye', name: 'Quick Read', desc: '+3 s on the play clock for every read.' },
  { id: 'ice_water', icon: 'shield', name: 'Ice Water', desc: 'Clutch plays are much easier: bigger windows, more time.' },
  { id: 'film_junkie', icon: 'eye', name: 'Film Junkie', desc: 'Film notes on your reads every single week.' },
  // Body
  { id: 'iron_man', icon: 'heart', name: 'Iron Man', desc: 'Games cost 30% less Energy.' },
  { id: 'recovery', icon: 'heart', name: 'Recovery', desc: 'All Energy gains +30%.' },
  { id: 'gym_rat', icon: 'weight', name: 'Gym Rat', desc: 'All Skill gains +25%.' },
  { id: 'time_mgmt', icon: 'clock', name: 'Time Management', desc: '+1 activity pick every week.', min: 4 },
  // People
  { id: 'media', icon: 'star', name: 'Media Darling', desc: 'All Fame gains +30%.' },
  { id: 'leader', icon: 'people', name: 'Locker Room Leader', desc: 'All Chemistry gains +30%.' },
  { id: 'coach_pet', icon: 'people', name: 'Coach\'s Pet', desc: 'All Coaches gains +30%.' },
  { id: 'vet', icon: 'people', name: 'Respect the Vet', desc: 'All Vane gains +50%.', y1: true }, // y1: Vane is gone after Year One
  { id: 'sunday', icon: 'heart', name: 'Sunday Dinners', desc: 'All Family gains +30%.' },
  { id: 'thick_skin', icon: 'shield', name: 'Thick Skin', desc: 'Confidence losses are cut in half.' },
  // Money & meta
  { id: 'hustle', icon: 'cash', name: 'Rookie Scale Hustle', desc: 'Every game check is 8% bigger.' },
  { id: 'sneakers', icon: 'cash', name: 'Sneaker Deal', desc: 'Every week, earn $250 for each point of Fame.' },
  { id: 'student', icon: 'star', name: 'Student of the Game', desc: 'Earn 20% more XP.' },
];
// When the perk pool runs dry (long careers), level-ups offer one-shot boosts instead.
const BOOSTS = [
  { id: 'b_cash', icon: 'cash', name: 'Signing Bonus', desc: '+$30,000, right now.', fx: { money: 30000 } },
  { id: 'b_skill', icon: 'weight', name: 'Extra Work', desc: '+4 Skill, right now.', fx: { skill: 4 } },
  { id: 'b_energy', icon: 'heart', name: 'Fresh Legs', desc: '+25 Energy, right now.', fx: { energy: 25 } },
  { id: 'b_fame', icon: 'star', name: 'Fan Favorite', desc: '+6 Fame and +4 Confidence, right now.', fx: { fame: 6, conf: 4 } },
];
const perkById = id => PERKS.find(p => p.id === id) || BOOSTS.find(p => p.id === id);

const PG_ICONS = {
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2" fill="var(--pg-ic-bg)"/>',
  weight: '<rect x="1.5" y="9" width="3" height="6" rx="1"/><rect x="4.5" y="6.5" width="3.5" height="11" rx="1"/><rect x="8" y="10.8" width="8" height="2.4"/><rect x="16" y="6.5" width="3.5" height="11" rx="1"/><rect x="19.5" y="9" width="3" height="6" rx="1"/>',
  shoe: '<path d="M2.5 17.5V12c0-.8.7-1.5 1.5-1.5h3l2.2-4h3.6l1.2 3.6c.5 1.4 1.8 2.4 3.3 2.4h2.2a2.5 2.5 0 0 1 2.5 2.5v2.5z"/><rect x="2" y="18.5" width="20" height="2.2" rx="1.1"/>',
  target: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6.5" fill="var(--pg-ic-bg)"/><circle cx="12" cy="12" r="3.5"/>',
  hand: '<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10V4a1.5 1.5 0 0 1 3 0v6V5a1.5 1.5 0 0 1 3 0v8l1.4-2.2a1.6 1.6 0 0 1 2.7 1.7L17 19a5 5 0 0 1-4.2 2.3H11A5 5 0 0 1 6 16.3V12a1 1 0 0 1 1-1z"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2" stroke="var(--pg-ic-bg)" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  star: '<path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z"/>',
  people: '<circle cx="8.5" cy="8" r="3.2"/><circle cx="16" cy="8.5" r="2.7"/><path d="M2.5 19c0-3.6 2.7-6 6-6s6 2.4 6 6zM14 19c0-2.4-.8-4.2-2-5.3a5.4 5.4 0 0 1 9.5 3.5V19z"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3" fill="var(--pg-ic-bg)"/>',
};
const pgIcon = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${PG_ICONS[k] || PG_ICONS.star}</svg>`;

// ---------- Pro Shop ----------
// Owned gear lives in S.items under 'pg_*' keys, so it shows up on the player card like any other item.
const GEAR = [
  { id: 'pg_mouth', price: 8000, name: 'Gold Mouthguard', effect: '+4 Confidence and +3 Fame, right now. That is all it does.', blurb: 'Eighteen-karat. It does nothing for your game. It looks incredible.', now: { conf: 4, fame: 3 } },
  { id: 'pg_gloves', price: 14000, name: 'Grip Gloves', effect: 'Timing windows 10% bigger. Catches more forgiving.', blurb: 'Tacky enough to pick up a bowling ball by the side.' },
  { id: 'pg_phones', price: 18000, name: 'Noise-Canceling Headphones', effect: '+50 ms on reaction plays and +1 s on every read.', blurb: 'Road crowds become a faraway ocean.' },
  { id: 'pg_cleats', price: 28000, name: 'Custom Cleats', effect: '+0.4 s on move combos. Open-field games more forgiving.', blurb: 'Molded to your feet. Your number on the heel, in orange.' },
  { id: 'pg_tablet', price: 70000, name: 'Film Tablet', effect: 'Film room gives +2 more Skill and +2 more Coaches.', blurb: 'Every snap the opponent took this year, in your pocket.' },
  { id: 'pg_tickets', price: 80000, name: 'Season Tickets for {fam}', effect: '+12 Family now, and +2 Family every week.', blurb: 'Two seats on the forty. Row 9. Close enough to yell.', now: { family: 12 } },
  { id: 'pg_van', price: 95000, name: 'A Minivan for {coachLast}', item: 'The Coach\'s Minivan', effect: '+15 Coaches now. All Coaches gains +20%.', blurb: 'The one {cp} drives now has 240,000 miles and a door that only opens from the inside.', now: { coach: 15 } },
  { id: 'pg_chef', price: 150000, name: 'Personal Chef', effect: '+8 Energy every week.', blurb: 'His name is Anton. He has opinions about your sodium.' },
  { id: 'pg_speed', price: 200000, name: 'Speed Coach', effect: '+1 Skill every week.', blurb: 'She coached two Olympians and one very fast horse.' },
  { id: 'pg_chamber', price: 240000, name: 'Hyperbaric Chamber', effect: 'Games cost 25% less Energy. Recovery days restore +10 more.', blurb: 'It looks like a submarine. It hums. Tiny is scared of it.' },
];
// The player card prints item names as plain text (no story tokens), so token names get a fixed card name.
GEAR.forEach(g => { ITEMS[g.id] = [g.item || g.name.replace(' for {fam}', ''), g.effect]; });

const ROCCO_HELLO = [
  `Rocco has run the equipment cage for twenty-six years. He has a pencil behind each ear and a third one in his beard.`,
  `Rocco is labeling helmets with a label maker he calls "Doris." He waves you in without looking up.`,
  `The equipment cage smells like new leather and old socks. Rocco is eating a sandwich over a box of chinstraps.`,
  `Rocco is on the phone with a supplier, shouting about shoelaces. He holds up one finger, then hangs up.`,
];
const ROCCO_LINES = [
  `Everything's legal, everything's league-approved, and nothing's refundable. Especially the chamber.`,
  `Vane bought half this stuff his rookie year. Didn't use any of it. Don't be Vane.`,
  `Cash only. I'm kidding. I take cards. I'm not kidding about the refunds.`,
  `I don't do discounts. I do "you'll thank me in December."`,
];
const ROCCO_SOLD = {
  pg_mouth: `"It's gold," Rocco says, holding it up to the light. "Is it smart? No. Will the cameras find it? Every single time."`,
  pg_gloves: `Rocco tosses you the gloves. You catch them without trying. "See? Working already."`,
  pg_phones: `"Seventy thousand people screaming," Rocco says, "and you'll hear your own heartbeat. Weird feeling. You'll love it."`,
  pg_cleats: `Rocco traces your foot on a piece of cardboard with the seriousness of a surgeon. "Two days," he says. "Don't wear them in the rain the first week."`,
  pg_tablet: `Rocco hands it over with the film already loaded. "{coachLast} asked me to put this week's opponent on it before you even paid. {Cp} knew."`,
  pg_tickets: `{fam} calls you thirty seconds after the confirmation email. Mostly to ask where to park. Then, quietly, to say thank you.`,
  pg_van: `{coachLast} stares at the van for a long time. "I don't need this." {Cp} takes the keys. The next morning {cp}'s parked in it at 4:30.`,
  pg_chef: `Anton the chef inspects your refrigerator, sighs deeply, and throws away everything except one lemon.`,
  pg_speed: `Your new speed coach watches you run one forty, makes a note, and says, "We'll fix your arms." You didn't know your arms were broken.`,
  pg_chamber: `They install it in your living room, since you still have no furniture. Tiny refuses to be in the same room as it.`,
};

// ---------- Weekly challenges ----------
// Each challenge is fixed when it's picked: ch.role is the role it was picked for, so a mid-game promotion
// can't make it harder. snaps: needs you to actually take the field (not offered when you only play an
// emergency final drive). Starters get the stiffer version of bigplay/score; bench roles keep the easier one.
const PG_STAT_GOAL = { QB: ['passYds', 275, 'Throw for 275+ yards.'], RB: ['rushYds', 130, 'Rush for 130+ yards.'], WR: ['recYds', 130, 'Get 130+ receiving yards.'], LB: ['tkl', 10, 'Make 10+ tackles.'] };
const PG_ONFIELD = ['backup', 'rotation', 'starter'];
const pgRole = ch => (ch && ch.role) || S.role;
const pgStarter = ch => pgRole(ch) === 'starter';
const CHALLENGES = [
  { id: 'rival', name: 'Dethrone the Monarchs', desc: 'Beat the defending champs.', roles: PG_ONFIELD, xp: 80, cash: 20000, if: () => !!oppOf(S.slate).rival, check: g => g.won },
  { id: 'bigplay', name: 'Highlight Reel', desc: ch => (pgStarter(ch) ? 'Get a Perfect on at least two plays.' : 'Get a Perfect on at least one play.'), roles: PG_ONFIELD, snaps: true, xp: 50, cash: 8000, check: (g, gm, ch) => g.res.filter(r => r === 'great').length >= (pgStarter(ch) ? 2 : 1) },
  { id: 'clean', name: 'No Mistakes', desc: ch => (pgRole(ch) === 'backup' ? 'Make your snaps count: no Missed plays.' : 'Get through the game without a Missed play.'), roles: PG_ONFIELD, snaps: true, xp: 55, cash: 10000, check: g => g.res.length > 0 && !g.res.includes('bad') },
  { id: 'grade', name: 'Honor Roll', desc: 'Earn a B+ or better game grade.', roles: ['rotation', 'starter'], snaps: true, xp: 55, cash: 10000, check: g => g.grade != null && g.grade >= 2 },
  { id: 'win7', name: 'Statement Game', desc: 'Win by 7 or more.', roles: PG_ONFIELD, xp: 45, cash: 10000, check: g => g.won && g.us - g.them >= 7 },
  { id: 'hold14', name: 'Lock It Down', desc: 'Hold them under 14 points.', roles: PG_ONFIELD, xp: 45, cash: 8000, check: g => g.them < 14 },
  // Only counts if there is a final drive: no drive, no contest (see gameEnd).
  { id: 'closer', name: 'The Closer', desc: 'If it comes down to the last drive, win it. If it never gets that close, this one doesn\'t count.', roles: PG_ONFIELD, clutch: true, xp: 60, cash: 12000, check: (g, gm) => gm.clutch === true },
  { id: 'score', name: () => (S.pos === 'LB' ? 'Turnover Machine' : 'Find the End Zone'),
    desc: ch => (S.pos === 'LB' ? (pgStarter(ch) ? 'Make two big plays: sacks, takeaways or a defensive score.' : 'Get a sack or a takeaway.') : (pgStarter(ch) ? 'Score two touchdowns.' : 'Score a touchdown.')),
    roles: ['rotation', 'starter'], snaps: true, xp: 60, cash: 12000,
    check: (g, gm, ch) => {
      const L = g.line;
      if (S.pos === 'LB') return pgStarter(ch) ? (L.sacks || 0) + (L.take || 0) + (L.td || 0) >= 2 : !!(L.take || L.sacks || L.td);
      return (L.td || 0) >= (pgStarter(ch) ? 2 : 1);
    } },
  { id: 'stat', name: 'Big Day', desc: () => PG_STAT_GOAL[S.pos][2], roles: ['starter'], snaps: true, xp: 70, cash: 15000, check: g => (g.line[PG_STAT_GOAL[S.pos][0]] || 0) >= PG_STAT_GOAL[S.pos][1] },
  { id: 'fresh', name: 'Fresh Legs', desc: 'Kick off with 60+ Energy.', roles: PG_ONFIELD, xp: 40, cash: 6000, live: true, check: (g, gm) => gm.kick >= 60, now: () => S.st.energy >= 60 },
  // Off-field (practice squad weeks). These stay doable whatever happens to your role later in the week.
  { id: 'film', name: 'Film Rat', desc: 'Spend a session in the Film room this week.', roles: ['practice'], xp: 35, cash: 4000, live: true, check: () => S.wk.done.includes('film'), now: () => S.wk.done.includes('film') },
  { id: 'home', name: 'Call Home', desc: 'Call {fam} this week.', roles: ['practice'], xp: 35, cash: 4000, live: true, check: () => S.wk.done.includes('home'), now: () => S.wk.done.includes('home') },
  { id: 'chem', name: 'One of the Guys', desc: 'Get Chemistry to {target} by game day.', roles: ['practice'], xp: 40, cash: 5000, live: true, target: () => Math.min(100, S.st.chem + 6), check: (g, gm, c) => S.st.chem >= c.target, now: c => S.st.chem >= c.target },
  { id: 'grind', name: 'Grinder', desc: 'Get Skill to {target} by game day.', roles: ['practice'], xp: 40, cash: 5000, live: true, target: () => Math.min(100, S.st.skill + 4), check: (g, gm, c) => S.st.skill >= c.target, now: c => S.st.skill >= c.target },
];
const pgChDef = id => CHALLENGES.find(c => c.id === id);
const pgVal = (v, ...a) => (typeof v === 'function' ? v(...a) : v);

// noSnaps: you're only on the field if it comes down to the final drive, so only result-based goals fit.
function pickChallenge(noSnaps) {
  const p = prog();
  const pool = CHALLENGES.filter(c => c.roles.includes(S.role) && (!c.if || c.if()) && !(noSnaps && c.snaps));
  if (!pool.length) return null;
  let c = pool.find(x => x.id === 'rival');
  if (!c) { const rest = pool.filter(x => x.id !== p.chLast); c = pick(rest.length ? rest : pool); }
  const po = S.slate >= 10;
  const ch = { id: c.id, slate: S.slate, year: S.year || 1, role: S.role, xp: Math.round(c.xp * (po ? 1.5 : 1)), cash: Math.round(c.cash * (po ? 1.5 : 1)), st: 'open' };
  if (c.target) ch.target = c.target();
  return ch;
}
// The current week's open challenge, if it's still for this week.
function pgOpenCh() {
  const p = prog(), ch = p.ch;
  return ch && ch.st === 'open' && ch.slate === S.slate && ch.year === (S.year || 1) ? ch : null;
}
// Roles can change after the challenge was picked (a Year Two injury scare, a benching, a holdout).
// Before kickoff, swap an on-field challenge the new role can't complete for one it can.
function pgRefitChallenge(noSnaps) {
  const p = prog(), ch = pgOpenCh();
  if (!ch) return false;
  const c = pgChDef(ch.id);
  if (!c || c.roles.includes('practice')) return false; // off-field goals stay doable in any role
  if (S.role === 'practice' || (c.roles.includes(S.role) && !(noSnaps && c.snaps))) {
    if (ch.role !== S.role && c.roles.includes(S.role)) ch.role = S.role; // same goal, sized for the new role
    return false;
  }
  const n = pickChallenge(noSnaps);
  if (n) { p.ch = n; p.chLast = n.id; } else { p.ch = null; p.chTried = Math.max(0, p.chTried - 1); }
  return true;
}
// A Year Two sit-out week: you only go in if it comes down to the final drive.
const pgSitWeek = () => !!(S && S.year === 2 && S.slate === 5 && S.ext && S.ext.year2 && S.ext.year2.scare === 'sit');
function chText(ch) {
  const c = pgChDef(ch.id);
  return { name: plain(pgVal(c.name, ch)), desc: plain(pgVal(c.desc, ch).replace('{target}', ch.target)) };
}
function chHTML(ch, mode) {
  if (!ch) return '';
  const c = pgChDef(ch.id);
  if (!c) return '';
  const t = chText(ch);
  let st = '', cls = '';
  if (ch.st === 'done') { st = 'Complete'; cls = ' done'; }
  else if (ch.st === 'fail') { st = 'Missed'; cls = ' fail'; }
  else if (ch.st === 'void') { st = 'No contest'; cls = ' void'; }
  else if (c.live && c.now && c.now(ch)) { st = 'On track'; cls = ' track'; }
  else if (mode === 'final') st = '';
  const mark = ch.st === 'done' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : ch.st === 'fail' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg>';
  return `<div class="pg-ch${cls}${mode === 'mini' ? ' slim' : ''}" role="group" aria-label="Weekly challenge: ${esc(t.name)}. ${esc(t.desc)}${st ? ' ' + st : ''}">
    <span class="pg-ch-ic">${mark}</span>
    <span class="pg-ch-main"><span class="pg-ch-tag">Weekly challenge${st ? ` · <b>${st}</b>` : ''}</span><span class="pg-ch-name">${esc(t.name)}</span><span class="pg-ch-desc">${esc(t.desc)}</span></span>
    <span class="pg-ch-rw"><b>+${ch.xp} XP</b><span>${money(ch.cash)}</span></span></div>`;
}

// ---------- XP ----------
let xpFloat = null;   // { n, t0 } for the "+30 XP" float on the card
let lvlFlash = 0;     // time of the last level-up, for the card pulse
let lastXPPct = null, lastLvlShown = null;
function addXP(n, why) {
  if (!S || !(n > 0)) return;
  const p = prog();
  if (hasPerk('student')) n = Math.round(n * 1.2);
  p.xp += n;
  if (p.gm) p.gm.xp = (p.gm.xp || 0) + n;
  const now = performance.now();
  xpFloat = xpFloat && now - xpFloat.t0 < 1400 ? { n: xpFloat.n + n, t0: now } : { n, t0: now };
  let ups = 0;
  while (p.xp >= xpFor(p.lvl + 1)) { p.lvl++; p.pending++; ups++; }
  if (ups) {
    lvlFlash = now;
    toast(`Level ${p.lvl}! ${levelTitle(p.lvl)}`, 'pg-lvl');
    Sound.play('trophy');
    queueLevelUps();
  }
  renderCard();
}
// A game is in progress: kickoff happened and the final whistle hasn't.
const pgInGame = () => !!(S && S.game && !S.game.done);
// Make sure there is one 'lvl_up' page waiting for each unspent level (and none for perks already picked).
// Picks never interrupt a game: they wait for the final whistle (g_final), and at a season's end they wait for next season.
function queueLevelUps() {
  const p = prog();
  if (!S.inject) S.inject = [];
  if (S.flags && S.flags.ending && S.at && S.at.id === 'ending') return; // held until the next season starts
  if (pgInGame()) { dropLevelUps(0); return; }
  const owed = Math.max(0, p.pending - (S.at && S.at.id === 'lvl_up' ? 1 : 0));
  let have = S.inject.filter(x => x.id === 'lvl_up').length;
  while (have < owed) { interject('lvl_up'); have++; }
  dropLevelUps(owed);
}
// Keep at most n queued 'lvl_up' pages (drops the extras from the back of the queue).
function dropLevelUps(n) {
  if (!S || !S.inject) return;
  let have = S.inject.filter(x => x.id === 'lvl_up').length;
  for (let i = S.inject.length - 1; i >= 0 && have > n; i--) if (S.inject[i].id === 'lvl_up') { S.inject.splice(i, 1); have--; }
}
function scanTrophies() {
  if (!S || !S.runTrophies) return;
  const p = prog();
  for (const id of S.runTrophies) if (!p.tro.includes(id)) { p.tro.push(id); addXP(30, 'trophy'); }
}

// ---------- Hooks ----------
on('newCareer', (s, form) => {
  const p = prog();
  const sel = form && form.querySelector('input[name=pg-diff]:checked');
  p.diff = sel && DIFFS[sel.value] ? sel.value : 'pro';
  if (form) { const h = hofData(); h.diff = p.diff; hofSave(h); }
  lastXPPct = null; lastLvlShown = null; xpFloat = null;
  save();
});

on('weekStart', () => {
  const p = prog();
  addXP(10, 'week');
  const d = DIFFS[diffOf()];
  // Film notes: Rookie difficulty (most weeks) and the Film Junkie perk (always).
  if (S.wk && !S.wk.film && (hasPerk('film_junkie') || (d.film && chance(d.film)))) { S.wk.film = true; S.wk.pgFilm = true; }
  // Weekly perks and gear.
  const w = {};
  if (hasGear('pg_chef')) w.energy = 8;
  if (hasGear('pg_speed')) w.skill = 1;
  if (hasGear('pg_tickets')) w.family = 2;
  if (hasPerk('sneakers') && S.st.fame > 0) w.money = Math.round(S.st.fame * 250 / 100) * 100;
  if (Object.keys(w).length) fx(w, false, true); // gear promises a fixed weekly amount
  p.gm = null;
  queueLevelUps();
});
// Hooks registered after every module has loaded, so they run after the other modules' own
// weekStart/gameStart hooks (Year Two sets this week's role, or clears a sit-out game's plays, in those).
Promise.resolve().then(() => {
  on('weekStart', () => {
    const p = prog();
    p.ch = pickChallenge(pgSitWeek());
    if (p.ch) { p.chLast = p.ch.id; p.chTried++; }
  });
  on('gameStart', g => {
    // No snaps planned (sitting out): only goals you can reach on an emergency final drive.
    pgRefitChallenge(!!(g && g.plan && !g.plan.length && S.role !== 'practice'));
  });
});

on('gameStart', () => {
  const p = prog();
  p.gm = { xp: 0, kick: S.st.energy, clutch: null };
  dropLevelUps(0); // perk picks wait for the final whistle
});

on('play', e => {
  if (!S || !S.game) return;
  const p = prog();
  let n = { great: 30, good: 15, bad: 10 }[e.r] || 0;
  if (e.td) n += 20;
  // Clutch drives can take several snaps ('pending' events); only the last one decides it.
  if (e.clutch && !e.pending) { if (p.gm) p.gm.clutch = !!e.success; if (e.success) n += 40; }
  addXP(n, 'play');
});

on('miniEnd', r => {
  // Training camp and scout-team reps count too (games give XP through 'play').
  if (!S || !S.at || !(/^camp/.test(S.at.id) || S.at.id === 'scout_team')) return;
  addXP({ great: 20, good: 12, bad: 8 }[r] || 0, 'camp');
});

on('gameEnd', g => {
  const p = prog();
  if (!p.gm) p.gm = { xp: 0, kick: S.st.energy, clutch: null };
  if (g.won) addXP(g.n >= 10 ? 40 : 25, 'win');
  else if (S.role !== 'practice') addXP(15, 'loss'); // losses still teach you something, so a rough season still levels
  const ch = p.ch;
  if (ch && ch.st === 'open' && ch.slate === g.n && ch.year === (S.year || 1)) {
    const c = pgChDef(ch.id);
    let ok = false;
    try { ok = !!(c && c.check(g, p.gm, ch)); } catch (e) { console.error(e); }
    ch.st = ok ? 'done' : 'fail';
    // The Closer only counts when there was a final drive to close.
    if (!ok && c && c.clutch && p.gm.clutch == null) { ch.st = 'void'; p.chTried = Math.max(0, p.chTried - 1); }
    if (ok) {
      p.chWon++;
      fx({ money: ch.cash }, true);
      addXP(ch.xp, 'challenge');
      toast(`Challenge complete: ${chText(ch).name} · +${ch.xp} XP · +${money(ch.cash)}`, 'pg-chdone');
      Sound.play('cash');
    }
  }
  queueLevelUps(); // anything earned during the game is picked after the final whistle
});

on('award', () => scanTrophies());

on('ending', id => {
  scanTrophies();
  try { recordHoF(id); } catch (e) { console.error(e); }
});

// ---------- Mods: difficulty ----------
addMod('diff', v => v + DIFFS[diffOf()].diff);
// The team around you: a little sharper on Rookie, thinner on All-Pro.
addMod('teamRating', v => v + (DIFFS[diffOf()].team || 0));
// All-Pro: the coaches don't hand out film notes for a good relationship (the card hides that bonus line),
// and reads run on a real play clock.
addMod('edge.coach', v => (diffOf() === 'allpro' ? 999 : v));
addMod('pay', v => {
  let m = DIFFS[diffOf()].pay;
  if (hasPerk('hustle')) m += 0.08;
  return v * m;
});
// Camp mini-games use fixed difficulty, so Rookie/All-Pro tune them directly.
const pgCampAdj = () => (S && S.role === 'camp' ? { rookie: 1, pro: 0, allpro: -0.6 }[diffOf()] : 0);
const pgIsClutch = c => !!(c && c.clutch);

// ---------- Mods: perks and gear ----------
addMod('timing.window', (v, c) => {
  if (!S) return v;
  let m = 1 + pgCampAdj() * 0.12;
  if (hasPerk('quick_release') && S.pos === 'QB') m += 0.18;
  if (hasPerk('soft_hands') && S.pos === 'WR') m += 0.10;
  if (hasPerk('ball_hawk') && S.pos === 'LB' && c && c.moment && c.moment.tag === 'take') m += 0.15;
  if (hasPerk('ice_water') && pgIsClutch(c)) m += 0.22;
  if (hasGear('pg_gloves')) m += 0.10;
  return v * m;
});
addMod('reaction.great', (v, c) => {
  if (!S) return v;
  let a = pgCampAdj() * 40;
  if (hasPerk('hard_count')) a += 60;
  if (hasPerk('ice_water') && pgIsClutch(c)) a += 50;
  if (hasGear('pg_phones')) a += 50;
  return v + a;
});
addMod('combo.time', (v, c) => {
  if (!S) return v;
  let a = pgCampAdj() * 0.4;
  if (hasPerk('footwork')) a += 0.5;
  if (hasPerk('pocket') && S.pos === 'QB') a += 0.4;
  if (hasPerk('stiff_arm') && S.pos === 'RB') a += 0.5;
  if (hasPerk('route_runner') && S.pos === 'WR') a += 0.5;
  if (hasPerk('sideline') && S.pos === 'LB') a += 0.3;
  if (hasPerk('ice_water') && pgIsClutch(c)) a += 0.5;
  if (hasGear('pg_cleats')) a += 0.4;
  return v + a;
});
addMod('read.time', (v, c) => {
  if (!S) return v;
  let a = pgCampAdj() * 2;
  if (hasPerk('quick_read')) a += 3;
  if (hasPerk('vision') && S.pos === 'RB') a += 2;
  if (hasPerk('ball_hawk') && S.pos === 'LB' && c && c.moment && c.moment.tag === 'take') a += 2;
  if (hasPerk('ice_water') && pgIsClutch(c)) a += 2;
  if (hasGear('pg_phones')) a += 1;
  // All-Pro shortens the base clock (never below the 5 s floor); bonuses then count in full.
  return (diffOf() === 'allpro' ? Math.max(5, v - 3) : v) + a;
});
// Generic ease keys for the arcade games (1 = default, higher = more forgiving).
function pgEaseMod(key, extra) {
  addMod(key, (v, c) => {
    if (!S) return v;
    let a = pgCampAdj() * 0.1 + extra();
    if (hasPerk('ice_water') && pgIsClutch(c)) a += 0.2;
    return v + a;
  });
}
pgEaseMod('throw.ease', () => (hasPerk('pocket') ? 0.15 : 0) + (hasPerk('quick_release') ? 0.05 : 0) + (hasGear('pg_gloves') ? 0.05 : 0));
pgEaseMod('catch.ease', () => (hasPerk('soft_hands') ? 0.15 : 0) + (hasPerk('route_runner') ? 0.08 : 0) + (hasGear('pg_gloves') ? 0.1 : 0));
pgEaseMod('run.ease', () => (hasPerk('vision') ? 0.15 : 0) + (hasPerk('stiff_arm') ? 0.08 : 0) + (hasGear('pg_cleats') ? 0.08 : 0));
pgEaseMod('pursuit.ease', () => (hasPerk('sideline') ? 0.15 : 0) + (hasPerk('ball_hawk') ? 0.05 : 0) + (hasGear('pg_cleats') ? 0.08 : 0));

addMod('energyCost', v => {
  let m = 1;
  if (hasPerk('iron_man')) m *= 0.7;
  if (hasGear('pg_chamber')) m *= 0.75;
  return v * m;
});
addMod('picks', v => v + (hasPerk('time_mgmt') ? 1 : 0));
const pgGainMod = (stat, test) => addMod('fx.' + stat, v => (v > 0 ? v * test() : v));
pgGainMod('fame', () => (hasPerk('media') ? 1.3 : 1));
pgGainMod('chem', () => (hasPerk('leader') ? 1.3 : 1));
pgGainMod('coach', () => (hasPerk('coach_pet') ? 1.3 : 1) * (hasGear('pg_van') ? 1.2 : 1));
pgGainMod('vane', () => (hasPerk('vet') ? 1.5 : 1));
pgGainMod('family', () => (hasPerk('sunday') ? 1.3 : 1));
pgGainMod('energy', () => (hasPerk('recovery') ? 1.3 : 1));
pgGainMod('skill', () => (hasPerk('gym_rat') ? 1.25 : 1));
addMod('fx.conf', v => (v < 0 && hasPerk('thick_skin') ? v / 2 : v));

// Gear that boosts weekly activities: wrap the activity's run() and add a bonus afterwards.
function boostAct(id, fn) {
  const a = ACTS.find(x => x.id === id);
  if (!a || a.pgWrapped) return;
  const run = a.run;
  a.run = function () { const out = run.apply(this, arguments); try { fn(); } catch (e) { console.error(e); } return out; };
  a.pgWrapped = true;
}
boostAct('film', () => { if (hasGear('pg_tablet')) fx({ skill: 2, coach: 2 }, false, true); });
boostAct('rest', () => { if (hasGear('pg_chamber')) fx({ energy: 10 }); });
const ACT_GEAR = { film: 'pg_tablet', rest: 'pg_chamber' };

// ---------- Level-up page ----------
function makeOffer() {
  const p = prog(), lvl = p.lvl - p.pending + 1;
  const free = PERKS.filter(k => !p.perks.includes(k.id) && (!k.min || lvl >= k.min) && (!k.y1 || (S.year || 1) === 1));
  const posPool = shuffle(free.filter(k => k.pos === S.pos));
  const gen = shuffle(free.filter(k => !k.pos));
  const out = [];
  if (posPool.length) out.push(posPool[0].id);
  for (const k of gen) { if (out.length >= 3) break; out.push(k.id); }
  for (const k of posPool.slice(1)) { if (out.length >= 3) break; out.push(k.id); }
  for (const b of shuffle(BOOSTS)) { if (out.length >= 3) break; out.push(b.id); }
  // Position perk goes last so the general ones lead.
  return out.slice(1).concat(out.slice(0, 1));
}
// {coach} is Okafor, or her Year Two replacement. y1/y2: only that season. tiny: only while Tiny is still on the team.
const LVL_LINES = [
  [{ s: '{coach}', t: `Better. Not good. Better. Keep stacking days.` }, { s: 'Tiny', tiny: true, t: `Bro, you're getting GOOD. I can feel it from the line. Like a disturbance in the force.` }, { s: 'Rocco', t: `You're wearing out cleats faster. That's how I know.` }],
  [{ s: '{coach}', t: `The tape doesn't lie, {last}. You're a different player than you were in camp.` }, { s: 'Marcus Vane', y1: true, t: `...Not bad, rook.` }, { s: 'Bryce Calloway', y2: true, t: `How do you DO that? Sorry. Never mind. I'm writing it down.` }, { s: 'Jules Park', t: `Off the record? The press box has started saying your name without checking the roster first.` }],
  [{ s: 'Coach Bramble', t: `Hm.` }, { s: '{coach}', t: `Bramble said "hm" when he watched your film. You understand that's basically a parade.` }, { s: 'Hands Greer', t: `I've seen a lot of players come through this building, kid. You're starting to look like one who stays.` }],
];
function lvlLine(band, lvl) {
  const y = S.year || 1;
  const pool = LVL_LINES[band].filter(l => !(l.y1 && y > 1) && !(l.y2 && y < 2) && !(l.tiny && typeof tinyLeft === 'function' && tinyLeft()));
  const l = pool[lvl % pool.length];
  return { s: l.s, t: l.t };
}
const LVL_INTRO = [
  `All those reps are adding up. Pick one perk. It's yours for the rest of your career.`,
  `People in the building have started to notice. Pick one perk. It stays with you for good.`,
  `This is what separates the guys who stick around. Pick one perk. You keep it for the rest of your career.`,
];
// a.back: opened from the player card's "Pick a perk" button. Those picks chain straight into each other and
// then go straight back to that page (never through the interject queue, so a story page that was waiting
// to 'resume' keeps its place).
const pgBack = back => go(back.id, back.args);
P.lvl_up = (a = {}) => {
  const p = prog();
  if (!p.pending) {
    if (!a.back) return { kicker: 'Level up', title: 'All Caught Up', body: ['No perks waiting. Back to work.'], next: 'resume' };
    return { kicker: 'Level up', title: 'All Caught Up', body: ['No perks waiting. Back to work.'], choices: [{ label: 'Continue', primary: true, do() { pgBack(a.back); return null; } }] };
  }
  const lvl = p.lvl - p.pending + 1;
  if (!p.offer || p.offer.lvl !== lvl || p.offer.year !== (S.year || 1)) { p.offer = { lvl, year: S.year || 1, ids: makeOffer() }; save(); }
  const band = lvl <= 4 ? 0 : lvl <= 8 ? 1 : 2;
  const line = lvlLine(band, lvl);
  const ring = 2 * Math.PI * 52;
  return {
    kicker: `Level up · ${p.pending > 1 ? `${p.pending} perks to pick` : 'Pick a perk'}`,
    title: `Level ${lvl}: ${levelTitle(lvl)}`,
    html: `<div class="pg-lvlhero" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="pg-ring-bg"/><circle cx="60" cy="60" r="52" class="pg-ring" style="stroke-dasharray:${ring};stroke-dashoffset:${ring}"/></svg><span class="pg-lvlnum"><small>LV</small>${lvl}</span></div>`,
    body: [LVL_INTRO[band], line],
    choices: p.offer.ids.map(id => {
      const k = perkById(id);
      return {
        label: `**${k.name}**`, sub: k.desc,
        do() {
          const q = prog();
          if (!q.pending) return null;
          if (BOOSTS.some(b => b.id === id)) { q.boosts++; fx(k.fx, false, true); }
          else if (!q.perks.includes(id)) q.perks.push(id);
          q.pending--;
          q.offer = null;
          Sound.play('great');
          toast(`Perk: ${k.name}`, 'pg-lvl');
          if (a.back) {
            dropLevelUps(0);
            if (q.pending > 0) go('lvl_up', { back: a.back }); else pgBack(a.back);
            return null;
          }
          dropLevelUps(q.pending); // the queue never owes more pages than there are picks left
          return null;
        },
        then: a.back ? null : 'resume',
      };
    }),
  };
};

// ---------- Pro Shop page ----------
P.shop = a => {
  const body = [ROCCO_HELLO[(S.slate + (S.year || 1)) % ROCCO_HELLO.length], { s: 'Rocco', t: ROCCO_LINES[(S.slate * 3 + (S.year || 1)) % ROCCO_LINES.length] }];
  return {
    kicker: `${weekKicker()} · Pro Shop`,
    title: 'The Equipment Cage',
    body,
    custom: renderShop,
    choices: [{ label: 'Back to your week', primary: true, do() { go('week_hub'); return null; } }],
  };
};
function renderShop(el) {
  const sold = S.at && S.at.args && S.at.args.bought;
  const owned = GEAR.filter(g => S.items[g.id]).length;
  const wrap = document.createElement('div');
  wrap.className = 'pg-shop';
  wrap.innerHTML = `<div class="pg-shop-bar"><span class="pg-bank"><span>Bank</span><b>${money(S.st.money)}</b></span><span class="pg-shop-note">Buying doesn't use a pick. ${owned}/${GEAR.length} owned. What's left in the bank at season's end shapes your epilogue.</span><button type="button" class="pg-shop-done">Done</button></div>
    <div class="pg-gear">${GEAR.map(g => {
      const have = !!S.items[g.id], can = S.st.money >= g.price;
      return `<div class="pg-item${have ? ' owned' : ''}${!have && !can ? ' poor' : ''}">
        <div class="pg-item-top"><span class="pg-item-name">${fmt(g.name)}</span><span class="pg-price">${have ? 'Owned' : money(g.price)}</span></div>
        <div class="pg-item-fx">${fmt(g.effect)}</div>
        ${sold === g.id ? `<div class="pg-sold" role="status">${fmt(ROCCO_SOLD[g.id] || 'Rocco rings it up.')}</div>` : `<div class="pg-item-blurb">${fmt(g.blurb)}</div>`}
        <button type="button" class="pg-buy" data-gear="${g.id}"${have || !can ? ' disabled' : ''}>${have ? 'In your locker' : can ? `Buy · ${money(g.price)}` : `Need ${money(g.price - S.st.money)} more`}</button>
      </div>`;
    }).join('')}</div>`;
  el.querySelector('.story').after(wrap);
  // A second way out at the top, so phones don't have to scroll past every item to leave.
  wrap.querySelector('.pg-shop-done').addEventListener('click', e => { if (busy || (typeof tooSoon === 'function' && tooSoon(e))) return; Sound.play('click'); go('week_hub'); });
  let armed = null, timer = 0, armedAt = 0;
  const disarm = () => { if (armed) { armed.classList.remove('armed'); const g = GEAR.find(x => x.id === armed.dataset.gear); armed.textContent = `Buy · ${money(g.price)}`; armed = null; } };
  $$('.pg-buy', wrap).forEach(b => b.addEventListener('click', e => {
    const g = GEAR.find(x => x.id === b.dataset.gear);
    if (!g || S.items[g.id] || S.st.money < g.price || busy) return;
    // A double-click (or a tap that lands as the page appears) must never spend money by itself.
    if (e && (e.detail > 1 || (e.detail === 1 && typeof tooSoon === 'function' && tooSoon(e)))) return;
    if (armed === b && performance.now() - armedAt < 350) return;
    if (armed !== b) {
      disarm();
      armed = b;
      armedAt = performance.now();
      b.classList.add('armed');
      b.textContent = `Confirm · ${money(g.price)}`;
      Sound.play('tick');
      clearTimeout(timer);
      timer = setTimeout(disarm, 4000);
      return;
    }
    clearTimeout(timer);
    S.items[g.id] = true;
    fx(Object.assign({ money: -g.price }, g.now || {}), false, true);
    Sound.play('cash');
    const idx = GEAR.indexOf(g);
    go('shop', { bought: g.id }, true);
    // Keep keyboard focus near where it was: the next item you can still buy, else the way out.
    const open = $$('.pg-buy:not([disabled])');
    const nb = open.find(x => GEAR.findIndex(k => k.id === x.dataset.gear) > idx) || open[open.length - 1] || $('#choices .choice');
    if (nb) nb.focus({ preventScroll: true });
  }));
}

// ---------- Page decorations ----------
on('page', (pg, el, id) => {
  if (!S) return;
  scanTrophies();
  const p = prog();
  if (/^(week_hub|week_intro|game_pre)$/.test(id || '') && !pgInGame() && pgRefitChallenge(pgSitWeek())) save();
  pgPendRefresh();
  const ch = p.ch && p.ch.slate === S.slate && p.ch.year === (S.year || 1) ? p.ch : null;
  const story = el.querySelector('.story');
  const before = (html, ref) => { const d = document.createElement('div'); d.innerHTML = html; const n = d.firstElementChild; if (n && ref) ref.before(n); return n; };
  if ((id === 'week_hub' || id === 'week_intro') && story) {
    if (ch) before(chHTML(ch, 'live'), story);
    if (S.wk && S.wk.pgFilm) {
      const last = story.lastElementChild;
      const note = `<p class="note">${fmt(`${hasPerk('film_junkie') ? 'Film Junkie' : 'Rookie difficulty'}: {coachLast} already slipped you film notes for Sunday's reads.`)}</p>`;
      if (last) last.insertAdjacentHTML('beforebegin', note); else story.insertAdjacentHTML('beforeend', note);
    }
  }
  if (id === 'game_pre' && story && ch) before(chHTML(ch, 'mini'), story);
  if (id === 'g_final' && S.game) {
    const ref = el.querySelector('#mini');
    const gx = p.gm && p.gm.xp ? p.gm.xp : 0;
    const box = before(`<div class="pg-final">${ch ? chHTML(ch, 'final') : ''}<div class="pg-gxp"><span>Game XP</span><b>+${gx}</b><span class="pg-gxp-lv">Level ${p.lvl} · ${esc(levelTitle(p.lvl))}</span></div></div>`, ref);
    if (!box) return;
  }
  if (id === 'lvl_up') {
    const box = el.querySelector('#choices');
    if (box) {
      box.classList.add('pg-perks');
      const ids = p.offer ? p.offer.ids : [];
      $$('.choice', box).forEach((b, i) => {
        const k = perkById(ids[i]);
        if (!k) return;
        b.classList.add('pg-perk');
        const tag = k.pos ? `${k.pos} only` : BOOSTS.includes(k) ? 'One-time boost' : 'Perk';
        b.insertAdjacentHTML('afterbegin', `<span class="pg-perk-ic">${pgIcon(k.icon)}</span>`);
        b.querySelector('.t').insertAdjacentHTML('afterbegin', `<span class="pg-perk-tag${k.pos ? ' pos' : ''}">${tag}</span>`);
      });
    }
    const ring = el.querySelector('.pg-ring');
    if (ring) requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.strokeDashoffset = '0'; }));
  }
  if (id === 'ending') {
    const sum = el.querySelector('.results') || el.querySelector('.sumgrid');
    const perks = p.perks.map(perkById).filter(Boolean);
    const html = `<div class="ending-mark">Career progress</div>
      <div class="pg-endprog"><div class="pg-endlv"><span class="pg-lvbadge big"><small>LV</small>${p.lvl}</span><div><b>${esc(levelTitle(p.lvl))}</b><span>${DIFFS[diffOf()].name} difficulty · ${p.chWon} of ${p.chTried} weekly challenges</span></div></div>
      ${perks.length ? `<div class="pg-perkchips">${perks.map(k => `<span class="chip" title="${esc(k.desc)}">${esc(k.name)}</span>`).join('')}</div>` : ''}
      <p class="pg-hofnote">Your season is hanging in the Hall of Fame on the title screen.</p></div>`;
    if (sum) sum.insertAdjacentHTML('afterend', html);
  }
});

// Week hub: a Pro Shop counter that doesn't use a pick, plus gear tags on boosted activities.
on('hub', wrap => {
  if (!S) return;
  for (const act in ACT_GEAR) {
    if (!hasGear(ACT_GEAR[act])) continue;
    const fxRow = wrap.querySelector(`.act[data-act="${act}"] .act-fx`);
    if (fxRow) fxRow.insertAdjacentHTML('beforeend', `<span class="fxc up">${esc(ITEMS[ACT_GEAR[act]][0])}</span>`);
  }
  const afford = GEAR.filter(g => !S.items[g.id] && S.st.money >= g.price).length;
  const owned = GEAR.filter(g => S.items[g.id]).length;
  const acts = wrap.querySelector('.acts');
  const d = document.createElement('div');
  d.innerHTML = `<button type="button" class="pg-shopbtn" id="pgShop" aria-keyshortcuts="P">
    <span class="pg-shop-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 9h16l-1.4 11H5.4z" fill="currentColor"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
    <span class="pg-shop-t"><b>Pro Shop</b><span>Rocco's equipment cage. Doesn't use a pick. ${afford ? `${afford} item${afford > 1 ? 's' : ''} you can afford.` : owned === GEAR.length ? 'You own everything.' : 'Save up for the good stuff.'}</span></span>
    <span class="pg-shop-bank">${money(S.st.money)}</span><kbd aria-hidden="true">P</kbd></button>`;
  const btn = d.firstElementChild;
  if (acts) acts.after(btn); else wrap.appendChild(btn);
  btn.addEventListener('click', () => { if (busy) return; Sound.play('click'); go('shop'); });
});
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if ((e.key !== 'p' && e.key !== 'P') || screen !== 'play' || mini || $('#menu')) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const b = $('#pgShop');
  if (b) { e.preventDefault(); b.click(); }
});

// ---------- Player card ----------
// Unspent picks wait for the next navigation (or the final whistle, mid-game). The card's button picks one right now
// and comes back to this page. Once the season is over they wait for next season (if there is one).
function pgCanPickNow() {
  return !!(S && S.at && screen === 'play' && !pgInGame() && !mini && !(curPage && curPage.mini) && S.at.id !== 'lvl_up' && S.at.id !== 'ending' && P[S.at.id]);
}
function pendTag(p) {
  if (!p.pending) return '';
  const over = S.flags && S.flags.ending && S.at && S.at.id === 'ending';
  // Only promise a next season when the ending actually offers one (the same test as the ending's own button).
  if (over) return typeof UI.startNextYear === 'function' && (!UI.canStartNextYear || UI.canStartNextYear()) ? `<span class="pg-pend later">Perk next season</span>` : '';
  if (pgInGame()) return `<span class="pg-pend later">Perk after the game</span>`;
  if (!pgCanPickNow()) return `<span class="pg-pend later">Perk ready</span>`;
  return `<button type="button" class="pg-pend pg-pendbtn">${p.pending > 1 ? `Pick ${p.pending} perks` : 'Pick a perk'}</button>`;
}
// The card renders before the new page does, so the page hook refreshes this tag once the page is up.
function pgPendRefresh() {
  const top = $('#card .pg-lv-top');
  if (!top || !S) return;
  const old = top.querySelector('.pg-pend');
  const html = pendTag(prog());
  if (old) old.remove();
  if (!html) return;
  top.insertAdjacentHTML('beforeend', html);
  const pb = top.querySelector('.pg-pendbtn');
  if (pb) pb.addEventListener('click', openPerkPick);
}
function openPerkPick(e) {
  if (busy || (e && typeof tooSoon === 'function' && tooSoon(e)) || !pgCanPickNow() || !prog().pending) return;
  Sound.play('click');
  const back = { id: S.at.id, args: S.at.args || {} };
  dropLevelUps(0); // the picks happen here, one after another, instead of at the next navigation
  go('lvl_up', { back });
}
on('card', el => {
  if (!S) return;
  const p = prog();
  const lo = xpFor(p.lvl), hi = xpFor(p.lvl + 1);
  const pct = clamp(Math.round((p.xp - lo) / (hi - lo) * 100), 0, 100);
  const now = performance.now();
  const leveled = lastLvlShown != null && p.lvl > lastLvlShown;
  const from = leveled ? 0 : lastXPPct == null ? pct : lastXPPct;
  lastXPPct = pct; lastLvlShown = p.lvl;
  const fl = xpFloat && now - xpFloat.t0 < 1400 ? `<span class="pg-xpf" style="animation-delay:-${Math.round(now - xpFloat.t0)}ms">+${xpFloat.n} XP</span>` : '';
  const pulse = now - lvlFlash < 1600 ? ' pulse' : '';
  const dk = diffOf();
  const row = document.createElement('div');
  row.className = 'pg-lv' + pulse;
  row.innerHTML = `<div class="pg-lv-top"><span class="pg-lvbadge"><small>LV</small>${p.lvl}</span><span class="pg-lvtitle">${esc(levelTitle(p.lvl))}</span>${dk !== 'pro' ? `<span class="pg-dchip ${dk}">${DIFFS[dk].name}</span>` : ''}</div>
    <div class="pg-xprow"><span class="pg-xpbar" role="progressbar" aria-label="Experience to level ${p.lvl + 1}" aria-valuemin="0" aria-valuemax="${hi - lo}" aria-valuenow="${p.xp - lo}"><i style="width:${from}%"></i></span><span class="pg-xpt">${p.xp - lo}/${hi - lo} XP</span>${fl}</div>`;
  const head = el.querySelector('.pc-head');
  if (head) head.after(row); else el.prepend(row);
  pgPendRefresh();
  if (from !== pct) requestAnimationFrame(() => requestAnimationFrame(() => { const i = row.querySelector('.pg-xpbar > i'); if (i) i.style.width = pct + '%'; }));
  const perks = p.perks.map(perkById).filter(Boolean);
  if (perks.length) {
    const sec = document.createElement('div');
    sec.className = 'pc-sec';
    sec.innerHTML = `<div class="pc-h">Perks · ${perks.length}</div><div class="pc-items">${perks.map(k => `<span class="pc-item pg-pk" title="${esc(k.desc)}">${esc(k.name)}</span>`).join('')}</div>`;
    const ref = el.querySelector('.pc-money');
    if (ref) ref.before(sec);
  }
});

// ---------- Setup: difficulty ----------
on('setup', form => {
  const last = DIFFS[hofData().diff] ? hofData().diff : 'pro';
  const fs = document.createElement('fieldset');
  fs.className = 'pg-diffset';
  fs.innerHTML = `<legend class="lbl">Difficulty</legend><div class="pg-diffs">${Object.keys(DIFFS).map(k => `<label class="opt pg-dopt"><input type="radio" name="pg-diff" value="${k}"${k === last ? ' checked' : ''} /><span class="opt-body"><span class="opt-name">${DIFFS[k].name}</span><span class="opt-tag">${DIFFS[k].tag}</span></span></label>`).join('')}</div><p class="pg-ddesc" id="pgDiffDesc" aria-live="polite"></p>`;
  const numFs = $('#fNum', form) && $('#fNum', form).closest('fieldset');
  if (numFs) numFs.after(fs); else form.appendChild(fs);
  const upd = () => { const v = form.querySelector('input[name=pg-diff]:checked').value; $('#pgDiffDesc').textContent = DIFFS[v].desc; };
  $$('input[name=pg-diff]', fs).forEach(r => r.addEventListener('change', upd));
  upd();
});

// ---------- Hall of Fame ----------
// Loaded once and kept in memory (written through to storage), like the trophy case, so the Hall of Fame
// still works for this visit when the browser blocks storage.
let HOF_CACHE = null;
function hofData() {
  if (!HOF_CACHE) {
    const d = store.get(HOF_KEY, null);
    HOF_CACHE = d && typeof d === 'object' ? d : {};
  }
  const h = HOF_CACHE;
  if (!Array.isArray(h.list)) h.list = [];
  if (!h.best || typeof h.best !== 'object') h.best = {};
  return h;
}
function hofSave(h) { HOF_CACHE = h; store.set(HOF_KEY, h); }
function pgPoText() {
  return S.flags.champion ? 'Champions' : S.flags.lostRound != null ? ({ 10: 'Lost wild card', 11: 'Lost conf. final', 12: 'Lost the final' }[S.flags.lostRound] || 'Playoffs') : S.flags.inPO ? 'Playoffs' : 'Missed playoffs';
}
function recordHoF(endId) {
  const p = prog();
  const h = hofData();
  const key = p.id + '-y' + (S.year || 1);
  const g = S.grades.length ? avgGrade() : null;
  const E = ENDINGS[endId];
  const entry = {
    key, name: `${S.first} ${S.last}`, num: S.num, pos: S.pos, origin: S.origin, year: S.year || 1,
    w: S.record.w, l: S.record.l, po: pgPoText(), champ: !!S.flags.champion,
    ending: E ? plain(E.title) : String(endId), grade: g, letter: g != null ? letter(g) : '–',
    diff: diffOf(), lvl: p.lvl, date: Date.now(),
  };
  const i = h.list.findIndex(x => x.key === key);
  if (i >= 0) h.list.splice(i, 1);
  else {
    h.best.careers = (h.best.careers || 0) + 1;
    if (entry.champ) h.best.titles = (h.best.titles || 0) + 1;
    if (entry.diff === 'allpro' && entry.champ) h.best.apTitles = (h.best.apTitles || 0) + 1;
  }
  h.list.unshift(entry);
  h.list = h.list.slice(0, 20);
  if (entry.w > (h.best.wins || 0) || h.best.wins == null) { h.best.wins = entry.w; h.best.winsRec = `${entry.w}-${entry.l}`; }
  if (g != null && (h.best.grade == null || g > h.best.grade)) h.best.grade = g;
  if (entry.lvl > (h.best.lvl || 0)) h.best.lvl = entry.lvl;
  hofSave(h);
}
const PG_POS_LABEL = { QB: 'QB', RB: 'RB', WR: 'WR', LB: 'LB' };
function hofHTML() {
  const h = hofData(), list = h.list, b = h.best;
  if (!list.length) {
    return `<section class="pg-hof empty" aria-label="Hall of Fame"><div class="pg-hof-head"><span class="pg-hof-mark" aria-hidden="true">${pgIcon('star')}</span><div><h2 class="pg-hof-title">Hall of Fame</h2><p class="pg-hof-sub">Finish a season and your jersey hangs here. Every career, every ending, every title.</p></div></div></section>`;
  }
  const tiles = [
    [b.careers || list.length, 'Seasons played'],
    [b.winsRec || (b.wins || 0), 'Best record'],
    [b.grade != null ? letter(b.grade) : '–', 'Best grade'],
    [b.titles || 0, 'Titles won'],
    [b.lvl || 1, 'Highest level'],
  ];
  const rows = list.map((e, i) => `<li class="pg-hrow${e.champ ? ' champ' : ''}${e.diff === 'allpro' ? ' ap' : ''}${i >= 4 ? ' more' : ''}">
      <span class="pg-hnum" aria-hidden="true">${esc(e.num)}</span>
      <span class="pg-hwho"><b>${esc(e.name)}</b><span>${esc(PG_POS_LABEL[e.pos] || e.pos)} · ${esc((ORIGINS[e.origin] || {}).name || '')}${e.year > 1 ? ` · Year ${esc(e.year)}` : ''} · ${esc((DIFFS[e.diff] || DIFFS.pro).name)}</span></span>
      <span class="pg-hend"><b>${esc(e.ending)}</b><span>${esc(e.po)}</span></span>
      <span class="pg-hstat"><span class="pg-hrec">${esc(e.w)}-${esc(e.l)}</span><span class="pg-hgr" title="Average grade">${esc(e.letter)}</span><span class="pg-hlv" title="Level">LV ${esc(e.lvl)}</span></span>
    </li>`).join('');
  return `<section class="pg-hof" aria-label="Hall of Fame">
    <div class="pg-hof-head"><span class="pg-hof-mark" aria-hidden="true">${pgIcon('star')}</span><div><h2 class="pg-hof-title">Hall of Fame</h2><p class="pg-hof-sub">Your personal bests and the last ${list.length === 1 ? 'season' : `${list.length} seasons`} you played.</p></div></div>
    <div class="pg-best">${tiles.map(t => `<div><b>${esc(t[0])}</b><span>${esc(t[1])}</span></div>`).join('')}</div>
    <ol class="pg-hlist">${rows}</ol>
    ${list.length > 4 ? `<button type="button" class="pg-hmore" aria-expanded="false">Show all ${list.length}</button>` : ''}
  </section>`;
}
on('title', el => {
  const hero = el.querySelector('.hero');
  if (!hero) return;
  hero.insertAdjacentHTML('afterend', hofHTML());
  const more = el.querySelector('.pg-hmore');
  if (more) more.addEventListener('click', () => {
    const sec = more.closest('.pg-hof');
    const open = sec.classList.toggle('open');
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? 'Show fewer' : `Show all ${hofData().list.length}`;
    Sound.play('click');
  });
  // Show the saved career's level on the Continue button.
  const saved = (S && S.at) ? S : loadSave();
  const small = el.querySelector('#tContinue small');
  if (saved && small && saved.ext && saved.ext.progress) small.textContent += ` · LV ${saved.ext.progress.lvl}`;
});

// Test handle (window.__undrafted is created after this file loads).
Promise.resolve().then(() => {
  if (window.__undrafted) window.__undrafted.progress = { get state() { return S && S.ext && S.ext.progress; }, addXP: n => addXP(n), xpFor, PERKS, GEAR, CHALLENGES, hof: hofData, makeOffer, pickChallenge, DIFFS };
});
