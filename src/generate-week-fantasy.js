// Week-by-week fantasy leaderboards: same shape as the season leaderboards
// (All/QB/RB/WR/TE/DEF/K for NFL, All Offense/QB/RB/WR/TE/Defense for CFB),
// but scored from ONE week's games only, using the same boxscore-based
// scoring as the live view (see fetch-boxscore-fantasy.js) applied to a
// whole week's games instead of just the ones currently in progress.
//
// A finished week's score never changes, so once a week is fully final
// (every game 'post') this script never re-fetches it again - only the
// current (still in-progress or upcoming) week gets refetched on every
// run. Each week's file also carries its raw game scores, which
// generate-trade-extras.js reads back to build strength-of-schedule data
// without a second round of scoreboard fetches.
const fs = require('fs');
const path = require('path');
const { fetchNflWeekGames, fetchCfbWeekGames, fetchNflCurrentWeek, fetchCfbCurrentWeek } = require('./fetch-week-games');
const { fetchGameFantasy } = require('./fetch-boxscore-fantasy');
const { pointsAllowedTier } = require('./fantasy-scoring');
const { buildPositionLookup } = require('./fantasy-position-lookup');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data', 'fantasy');

const NFL_OFFENSE_POS = new Set(['QB', 'RB', 'WR', 'TE']);
const CFB_OFFENSE_POS = new Set(['QB', 'RB', 'WR', 'TE']);
const CFB_DEF_POS = new Set(['DT', 'DE', 'LB', 'CB', 'S', 'DB']);

function rank(list) {
  return list
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 50)
    .map((p, i) => ({ rank: i + 1, name: p.name, team: p.team, position: p.position, points: p.points }));
}

function gameScoresOf(games) {
  return games.map((g) => {
    const away = g.competitors.find((c) => c.homeAway === 'away');
    const home = g.competitors.find((c) => c.homeAway === 'home');
    return {
      away: away && away.team,
      home: home && home.team,
      awayScore: away ? Number(away.score) || 0 : 0,
      homeScore: home ? Number(home.score) || 0 : 0,
      state: g.state,
    };
  });
}

async function generateNflWeek(year, week) {
  const games = await fetchNflWeekGames(year, week);
  const posLookup = buildPositionLookup('nfl');
  const performers = [];
  for (const game of games) {
    if (game.state === 'pre') continue;
    performers.push(...(await fetchGameFantasy('nfl', game, 1, posLookup)));
  }

  const boards = { all: [], qb: [], rb: [], wr: [], te: [], k: [] };
  for (const p of performers) {
    if (p.position === 'K') {
      boards.k.push(p);
    } else if (NFL_OFFENSE_POS.has(p.position)) {
      boards.all.push(p);
      boards[p.position.toLowerCase()].push(p);
    }
  }

  const defRows = [];
  for (const game of games) {
    if (game.state === 'pre') continue;
    const away = game.competitors.find((c) => c.homeAway === 'away');
    const home = game.competitors.find((c) => c.homeAway === 'home');
    if (!away || !home) continue;
    defRows.push({ name: away.team, team: away.team, position: 'DEF', points: pointsAllowedTier(Number(home.score) || 0) });
    defRows.push({ name: home.team, team: home.team, position: 'DEF', points: pointsAllowedTier(Number(away.score) || 0) });
  }

  return {
    week,
    allFinal: games.length > 0 && games.every((g) => g.state === 'post'),
    gameScores: gameScoresOf(games),
    boards: {
      all: rank(boards.all),
      qb: rank(boards.qb),
      rb: rank(boards.rb),
      wr: rank(boards.wr),
      te: rank(boards.te),
      def: rank(defRows),
      k: rank(boards.k),
    },
  };
}

async function generateCfbWeek(year, week) {
  const games = await fetchCfbWeekGames(year, week);
  const posLookup = buildPositionLookup('cfb');
  const performers = [];
  for (const game of games) {
    if (game.state === 'pre') continue;
    performers.push(...(await fetchGameFantasy('college-football', game, 0.5, posLookup)));
  }

  const boards = { off: [], qb: [], rb: [], wr: [], te: [], def: [] };
  for (const p of performers) {
    if (CFB_OFFENSE_POS.has(p.position)) {
      boards.off.push(p);
      boards[p.position.toLowerCase()].push(p);
    } else if (CFB_DEF_POS.has(p.position)) {
      boards.def.push(p);
    }
  }

  return {
    week,
    allFinal: games.length > 0 && games.every((g) => g.state === 'post'),
    gameScores: gameScoresOf(games),
    boards: {
      off: rank(boards.off),
      qb: rank(boards.qb),
      rb: rank(boards.rb),
      wr: rank(boards.wr),
      te: rank(boards.te),
      def: rank(boards.def),
    },
  };
}

function weekFilePath(league, week) {
  return path.join(DATA_DIR, league, 'weeks', `week-${week}.json`);
}

function loadCachedWeek(league, week) {
  try {
    const data = JSON.parse(fs.readFileSync(weekFilePath(league, week), 'utf8'));
    return data.allFinal ? data : null;
  } catch {
    return null;
  }
}

function writeWeek(league, week, data) {
  fs.mkdirSync(path.join(DATA_DIR, league, 'weeks'), { recursive: true });
  fs.writeFileSync(weekFilePath(league, week), JSON.stringify(data));
}

// Accumulates each team's points-allowed-per-game across every week
// processed this run (cached or fresh) - a byproduct of already having
// every week's game scores in hand, used by generate-trade-extras.js for
// strength-of-schedule without a second scoreboard sweep.
function accumulatePointsAllowed(weeks) {
  const byTeam = {};
  for (const w of weeks) {
    for (const g of w.gameScores || []) {
      if (g.state !== 'post') continue;
      if (g.away) (byTeam[g.away] = byTeam[g.away] || []).push(g.homeScore);
      if (g.home) (byTeam[g.home] = byTeam[g.home] || []).push(g.awayScore);
    }
  }
  return byTeam;
}

// Same idea, but each team's OWN points scored per game - used by
// generate-predictions.js for game-winner picks (net rating) and for the
// opponent-strength side of defensive fantasy predictions.
function accumulatePointsScored(weeks) {
  const byTeam = {};
  for (const w of weeks) {
    for (const g of w.gameScores || []) {
      if (g.state !== 'post') continue;
      if (g.away) (byTeam[g.away] = byTeam[g.away] || []).push(g.awayScore);
      if (g.home) (byTeam[g.home] = byTeam[g.home] || []).push(g.homeScore);
    }
  }
  return byTeam;
}

async function processLeague(league, currentWeek, year, generateFn) {
  const weeks = [];
  for (let w = 1; w <= currentWeek; w++) {
    const cached = loadCachedWeek(league, w);
    if (cached) {
      console.log(`  ${league} week ${w}: cached (final)`);
      weeks.push(cached);
      continue;
    }
    console.log(`  ${league} week ${w}: fetching...`);
    const data = await generateFn(year, w);
    writeWeek(league, w, data);
    weeks.push(data);
  }
  fs.mkdirSync(path.join(DATA_DIR, league, 'weeks'), { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, league, 'weeks', 'manifest.json'),
    JSON.stringify({ currentWeek, weeks: weeks.map((w) => w.week) })
  );
  fs.writeFileSync(path.join(DATA_DIR, league, 'points-allowed.json'), JSON.stringify(accumulatePointsAllowed(weeks)));
  fs.writeFileSync(path.join(DATA_DIR, league, 'points-scored.json'), JSON.stringify(accumulatePointsScored(weeks)));
  return weeks;
}

async function main() {
  const year = new Date().getFullYear();

  console.log('=== NFL week leaders ===');
  const nflCurrentWeek = await fetchNflCurrentWeek();
  await processLeague('nfl', nflCurrentWeek, year, generateNflWeek);

  console.log('=== CFB week leaders ===');
  const cfbCurrentWeek = await fetchCfbCurrentWeek();
  await processLeague('cfb', cfbCurrentWeek, year, generateCfbWeek);

  console.log('Done. Week fantasy data written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
