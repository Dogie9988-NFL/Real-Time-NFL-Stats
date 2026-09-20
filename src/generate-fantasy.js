const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { fetchCategoryPool } = require('./fetch-espn-category');
const { fetchAllCfbPools } = require('./fetch-cfbd');
const { nflOffensePoints, cfbOffensePoints, nflKickerPoints, nflDstPoints, cfbIdpPoints } = require('./fantasy-scoring');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data', 'fantasy');
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = PROXY ? new HttpsProxyAgent(PROXY) : undefined;

// site.web.api.espn.com (byathlete season stats) works fine with plain https.
function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { agent, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

// site.api.espn.com (scoreboard) sits behind the same Akamai bot-protection
// as fetch-live.js's scoreboard calls - curl with no UA override, not https.
function getScoreboardJson(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sL', '--max-time', '10', url], { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`Bad JSON from ${url}: ${e.message}`));
      }
    });
  });
}

async function detectNflSeason() {
  const url =
    'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=1&sort=general.gamesPlayed';
  const data = await getJson(url);
  return { year: data.currentSeason.year, seasontype: data.currentSeason.type.type, label: data.currentSeason.type.name };
}

// Per-team, per-game points allowed for the season so far, via ESPN's
// scoreboard (NFL only - this is what makes DST points-allowed scoring
// correct instead of a season-average approximation).
async function fetchNflWeeklyPointsAllowed(year) {
  const currentScoreboard = await getScoreboardJson('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
  const currentWeek = (currentScoreboard.week && currentScoreboard.week.number) || 1;

  const pointsAllowed = {}; // team abbr -> number[]
  for (let week = 1; week <= currentWeek; week++) {
    const data = await getScoreboardJson(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?year=${year}&seasontype=2&week=${week}`
    );
    for (const event of data.events || []) {
      const comp = event.competitions[0];
      if (comp.status.type.state !== 'post') continue;
      const [a, b] = comp.competitors;
      if (!a || !b) continue;
      pointsAllowed[a.team.abbreviation] = pointsAllowed[a.team.abbreviation] || [];
      pointsAllowed[b.team.abbreviation] = pointsAllowed[b.team.abbreviation] || [];
      pointsAllowed[a.team.abbreviation].push(Number(b.score) || 0);
      pointsAllowed[b.team.abbreviation].push(Number(a.score) || 0);
    }
  }
  return pointsAllowed;
}

const DEF_POSITIONS = new Set(['DT', 'DE', 'LB', 'CB', 'S']);

function mergePool(target, rows, categoryKey) {
  for (const row of rows) {
    if (!target[row.id]) {
      target[row.id] = { id: row.id, name: row.name, position: row.position, team: row.team };
    } else if (target[row.id].position === '-' && row.position !== '-') {
      target[row.id].position = row.position;
    }
    target[row.id][categoryKey] = row.values;
  }
}

function writeBoard(outDir, id, label, players, meta) {
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify({ id, label, players, ...meta }));
  return { id, label, count: players.length };
}

function rankAndTrim(list) {
  list.sort((a, b) => b.points - a.points);
  return list.slice(0, 50).map((p, i) => ({ rank: i + 1, ...p, points: Math.round(p.points * 100) / 100 }));
}

// The season boards are trimmed to the top 50 per category, but the live
// and week-by-week views need to look up ANY player's position (the
// boxscore API doesn't return one) - including plenty of players who never
// crack a top-50 season board. So this writes every non-zero player seen
// this run, untrimmed, keyed by "name|team".
function writePositionLookup(outDir, ...playerLists) {
  const lookup = {};
  for (const list of playerLists) {
    for (const p of list) lookup[`${p.name}|${p.team}`] = p.position;
  }
  fs.writeFileSync(path.join(outDir, 'position-lookup.json'), JSON.stringify(lookup));
}

async function generateNflFantasy(season) {
  console.log('\n=== NFL Fantasy (Full PPR) ===');
  const [passing, rushing, receiving, returning, kicking, defensive, defInt, general, pointsAllowed] = await Promise.all([
    fetchCategoryPool('nfl', 'passing', 'passingYards', season.year, season.seasontype),
    fetchCategoryPool('nfl', 'rushing', 'rushingYards', season.year, season.seasontype),
    fetchCategoryPool('nfl', 'receiving', 'receivingYards', season.year, season.seasontype),
    fetchCategoryPool('nfl', 'returning', 'kickReturnYards', season.year, season.seasontype),
    fetchCategoryPool('nfl', 'kicking', 'fieldGoalsMade', season.year, season.seasontype),
    fetchCategoryPool('nfl', 'defensive', 'totalTackles', season.year, season.seasontype),
    fetchCategoryPool('nfl', 'defensiveinterceptions', 'interceptions', season.year, season.seasontype, 'defensiveInterceptions'),
    fetchCategoryPool('nfl', 'general', 'fumblesForced', season.year, season.seasontype),
    fetchNflWeeklyPointsAllowed(season.year),
  ]);
  console.log(
    `  pools: passing=${passing.length} rushing=${rushing.length} receiving=${receiving.length} returning=${returning.length} kicking=${kicking.length} defensive=${defensive.length} defInt=${defInt.length} general=${general.length}`
  );
  console.log(`  points-allowed tracked for ${Object.keys(pointsAllowed).length} teams`);

  const players = {};
  mergePool(players, passing, 'passing');
  mergePool(players, rushing, 'rushing');
  mergePool(players, receiving, 'receiving');
  mergePool(players, returning, 'returning');
  mergePool(players, kicking, 'kicking');
  mergePool(players, defensive, 'defensive');
  mergePool(players, defInt, 'defensiveinterceptions');
  mergePool(players, general, 'general');

  const offenseBoards = { all: [], qb: [], rb: [], wr: [], te: [] };
  const kickerBoard = [];
  const teamDef = {}; // team abbr -> {sacks, defInterceptions, fumblesForced, defTds}

  for (const p of Object.values(players)) {
    const offenseStats = { ...(p.passing || {}), ...(p.rushing || {}), ...(p.receiving || {}), ...(p.returning || {}) };
    const hasOffense = p.passing || p.rushing || p.receiving;
    const gamesPlayed = (p.general && p.general.gamesPlayed) || null;
    if (hasOffense && ['QB', 'RB', 'WR', 'TE'].includes(p.position)) {
      const points = nflOffensePoints(offenseStats);
      if (points > 0) {
        const entry = { id: p.id, name: p.name, team: p.team, position: p.position, points, gamesPlayed };
        offenseBoards.all.push(entry);
        offenseBoards[p.position.toLowerCase()].push({ ...entry });
      }
    }
    if (p.position === 'PK' && p.kicking) {
      const points = nflKickerPoints(p.kicking);
      if (points > 0) kickerBoard.push({ id: p.id, name: p.name, team: p.team, position: 'K', points, gamesPlayed });
    }
    if (DEF_POSITIONS.has(p.position) && p.team) {
      const t = (teamDef[p.team] = teamDef[p.team] || { sacks: 0, defInterceptions: 0, fumblesForced: 0, defTds: 0 });
      t.sacks += (p.defensive && p.defensive.sacks) || 0;
      t.defInterceptions += (p.defensiveinterceptions && p.defensiveinterceptions.interceptions) || 0;
      t.fumblesForced += (p.general && p.general.fumblesForced) || 0;
      t.defTds += ((p.defensiveinterceptions && p.defensiveinterceptions.interceptionTouchdowns) || 0) + ((p.general && p.general.fumblesTouchdowns) || 0);
    }
  }

  const defBoard = Object.entries(teamDef).map(([team, agg]) => ({
    name: team,
    team,
    position: 'DEF',
    points: nflDstPoints({ ...agg, gamesPointsAllowed: pointsAllowed[team] || [] }),
  }));

  const outDir = path.join(DATA_DIR, 'nfl');
  fs.mkdirSync(outDir, { recursive: true });
  writePositionLookup(outDir, offenseBoards.all, kickerBoard);
  const meta = { league: 'nfl', season: season.year, seasonLabel: season.label, format: 'Full PPR' };
  const categoriesMeta = [
    writeBoard(outDir, 'all', 'All Players', rankAndTrim(offenseBoards.all), meta),
    writeBoard(outDir, 'qb', 'All QB', rankAndTrim(offenseBoards.qb), meta),
    writeBoard(outDir, 'rb', 'All RB', rankAndTrim(offenseBoards.rb), meta),
    writeBoard(outDir, 'wr', 'All WR', rankAndTrim(offenseBoards.wr), meta),
    writeBoard(outDir, 'te', 'All TE', rankAndTrim(offenseBoards.te), meta),
    writeBoard(outDir, 'def', 'All DEF', rankAndTrim(defBoard), meta),
    writeBoard(outDir, 'k', 'All Kicker', rankAndTrim(kickerBoard), meta),
  ];
  console.log(`  wrote ${categoriesMeta.length} NFL fantasy boards`);
  return { season: season.year, seasonLabel: season.label, format: 'Full PPR', categories: categoriesMeta };
}

function loadPreviousFantasyManifest() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function generateCfbFantasy(previousManifest) {
  console.log('\n=== CFB Fantasy (Half PPR / IDP) ===');
  const previousCfb = previousManifest && previousManifest.leagues && previousManifest.leagues.cfb;

  let pools;
  try {
    pools = await fetchAllCfbPools(new Date().getFullYear());
  } catch (err) {
    // Same failure mode fixed in generate.js: don't let a CFBD outage/rate
    // limit/bad key wipe good boards - keep whatever was already there.
    console.error(`  [ERROR] CFBD fetch failed: ${err.message}`);
    if (previousCfb) {
      console.warn('  keeping previous CFB fantasy data for this run');
      return previousCfb;
    }
    pools = { passing: [], rushing: [], receiving: [], scoring: [], defensive: [] };
  }
  console.log(
    `  pools: passing=${pools.passing.length} rushing=${pools.rushing.length} receiving=${pools.receiving.length} scoring=${pools.scoring.length} defensive=${pools.defensive.length}`
  );
  if (pools.passing.length === 0 && pools.rushing.length === 0 && pools.receiving.length === 0 && pools.defensive.length === 0) {
    console.warn('  [WARN] every CFB pool came back empty - keeping previous data instead of overwriting');
    if (previousCfb) return previousCfb;
  }

  const players = {};
  const assign = (rows, key) => {
    for (const row of rows) {
      const id = row.id;
      if (!players[id]) players[id] = { id, name: row.name, position: row.position, team: row.team, conference: row.conference };
      players[id][key] = row.values;
    }
  };
  assign(pools.passing, 'passing');
  assign(pools.rushing, 'rushing');
  assign(pools.receiving, 'receiving');
  assign(pools.scoring, 'scoring');
  assign(pools.defensive, 'defensive');

  const offenseBoards = { off: [], qb: [], rb: [], wr: [], te: [] };
  const defBoard = [];

  for (const p of Object.values(players)) {
    // rushingTouchdowns/receivingTouchdowns live in the "scoring" pool (a
    // separate CFBD category from rushing/receiving yardage), so it has to
    // be spread in here too or every CFB skill player scores 0 TD points.
    const offenseStats = {
      ...(p.passing || {}),
      ...(p.rushing || {}),
      ...(p.receiving || {}),
      ...(p.scoring || {}),
    };
    const hasOffense = p.passing || p.rushing || p.receiving;
    // CFBD's per-player stats don't expose games played, unlike ESPN's NFL
    // feed - leave null rather than guess (the trade calculator's PPG/
    // rest-of-season estimate simply won't show for CFB players).
    const gamesPlayed = null;
    // CFBD player ids aren't ESPN athlete ids, so they can't be matched to
    // ESPN's news-by-athlete-id feed (see generate-trade-extras.js) - leave
    // id unset for CFB rather than pass through an id that will just silently
    // never match.
    if (hasOffense && ['QB', 'RB', 'WR', 'TE'].includes(p.position)) {
      const points = cfbOffensePoints(offenseStats);
      if (points > 0) {
        const entry = { id: null, name: p.name, team: p.team, conference: p.conference, position: p.position, points, gamesPlayed };
        offenseBoards.off.push(entry);
        offenseBoards[p.position.toLowerCase()].push({ ...entry });
      }
    }
    if (p.defensive && (p.position === 'DT' || p.position === 'DE' || p.position === 'LB' || p.position === 'CB' || p.position === 'S' || p.position === 'DB')) {
      const points = cfbIdpPoints(p.defensive);
      if (points > 0) defBoard.push({ id: null, name: p.name, team: p.team, conference: p.conference, position: p.position, points, gamesPlayed });
    }
  }

  const outDir = path.join(DATA_DIR, 'cfb');
  fs.mkdirSync(outDir, { recursive: true });
  writePositionLookup(outDir, offenseBoards.off, defBoard);
  const meta = { league: 'cfb', format: 'Half PPR (offense) / IDP (defense)' };
  const categoriesMeta = [
    writeBoard(outDir, 'off', 'All Offense', rankAndTrim(offenseBoards.off), meta),
    writeBoard(outDir, 'qb', 'All QB', rankAndTrim(offenseBoards.qb), meta),
    writeBoard(outDir, 'rb', 'All RB', rankAndTrim(offenseBoards.rb), meta),
    writeBoard(outDir, 'wr', 'All WR', rankAndTrim(offenseBoards.wr), meta),
    writeBoard(outDir, 'te', 'All TE', rankAndTrim(offenseBoards.te), meta),
    writeBoard(outDir, 'def', 'All Defense (IDP)', rankAndTrim(defBoard), meta),
  ];
  console.log(`  wrote ${categoriesMeta.length} CFB fantasy boards`);
  return { format: 'Half PPR (offense) / IDP (defense)', categories: categoriesMeta };
}

// Optional CLI arg restricts this run to one league ("nfl" or "cfb"), same
// reason as generate.js: NFL fantasy uses ESPN's free JSON API (fine every
// 5 min), CFB fantasy now shares CFBD's 1,000-calls/month quota with the
// main CFB leaderboard, so it runs on its own, less-frequent schedule.
const which = process.argv[2];

async function main() {
  const previousManifest = loadPreviousFantasyManifest();
  const manifest = previousManifest ? { ...previousManifest } : { leagues: {} };
  manifest.generatedAt = new Date().toISOString();

  if (!which || which === 'nfl') {
    const nflSeason = await detectNflSeason();
    manifest.leagues.nfl = await generateNflFantasy(nflSeason);
  }
  if (!which || which === 'cfb') {
    manifest.leagues.cfb = await generateCfbFantasy(previousManifest);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Fantasy manifest written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
