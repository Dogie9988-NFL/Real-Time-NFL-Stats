// Forward-looking predictions: who's likely to lead each fantasy category
// THIS coming week, and who wins each upcoming game. Both are simple,
// transparent heuristics built entirely from data this site already
// computes (season PPG, and each team's points scored/allowed so far via
// points-scored.json / points-allowed.json, byproducts of
// generate-week-fantasy.js) - not a real statistical model, and labeled as
// such in the UI. A player only gets a prediction if their team's game
// THIS week hasn't started yet ('pre'); once a game goes final, the actual
// Week Leaders board is the real answer, not a forecast.
const fs = require('fs');
const path = require('path');
const { fetchNflWeekGames, fetchCfbWeekGames, fetchNflCurrentWeek, fetchCfbCurrentWeek } = require('./fetch-week-games');
const { pointsAllowedTier } = require('./fantasy-scoring');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');
const FANTASY_DIR = path.join(DATA_DIR, 'fantasy');
const PRED_DIR = path.join(DATA_DIR, 'predictions');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function average(arr) {
  return arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

// Early in the season, a team's points-allowed/scored average is just 1-2
// games, so a single blowout can make its "average" 2-3x the league norm.
// Feeding that straight into the matchup multiplier produced absurd
// projections (a RB "projected" for 70+ points off one shootout the
// opponent was in). Clamp how much any single matchup can move a player's
// season pace either way - still enough range to make a bold call on a
// great or terrible matchup, just not enough to reach fantasy-impossible
// point totals.
const MIN_MULTIPLIER = 0.75;
const MAX_MULTIPLIER = 1.35;

function clampMultiplier(m) {
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, m));
}

// team abbr -> { opponent, isHome, gameName }, for teams whose game THIS
// week hasn't started yet.
function buildNextOpponentMap(games) {
  const map = {};
  for (const g of games) {
    if (g.state !== 'pre') continue;
    const away = g.competitors.find((c) => c.homeAway === 'away');
    const home = g.competitors.find((c) => c.homeAway === 'home');
    if (!away || !home) continue;
    map[away.team] = { opponent: home.team, isHome: false, gameName: g.name };
    map[home.team] = { opponent: away.team, isHome: true, gameName: g.name };
  }
  return map;
}

function loadSeasonBoard(league, id) {
  const board = readJson(path.join(FANTASY_DIR, league, `${id}.json`), null);
  return board && board.players ? board.players : [];
}

function rank(list) {
  return list
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 50)
    .map((p, i) => ({ rank: i + 1, ...p }));
}

// boardsSpec: { boardId: { type: 'offense' | 'idpDef' | 'nflDef' } }
// 'offense'/'idpDef' project from season PPG x a matchup multiplier;
// 'nflDef' (team defense) projects a points-allowed-tier score directly
// from the upcoming opponent's own scoring average.
function buildStatPredictions(league, games, boardsSpec, pointsAllowed, pointsScored) {
  const nextOpp = buildNextOpponentMap(games);
  const teamAvgAllowed = {};
  for (const [t, s] of Object.entries(pointsAllowed)) teamAvgAllowed[t] = average(s);
  const teamAvgScored = {};
  for (const [t, s] of Object.entries(pointsScored)) teamAvgScored[t] = average(s);
  const leagueAvgAllowed = average(Object.values(teamAvgAllowed).filter((v) => v != null));
  const leagueAvgScored = average(Object.values(teamAvgScored).filter((v) => v != null));

  const boards = {};
  for (const [boardId, opts] of Object.entries(boardsSpec)) {
    const players = loadSeasonBoard(league, boardId);
    const predicted = [];
    for (const p of players) {
      const opp = nextOpp[p.team];
      if (!opp) continue; // bye, or this week's game already started/finished

      if (opts.type === 'nflDef') {
        const oppAvgScored = teamAvgScored[opp.opponent];
        if (oppAvgScored == null) continue;
        predicted.push({
          name: p.name,
          team: p.team,
          position: p.position,
          points: Math.round(pointsAllowedTier(oppAvgScored) * 100) / 100,
          opponent: opp.opponent,
          isHome: opp.isHome,
        });
        continue;
      }

      if (!p.gamesPlayed || p.gamesPlayed <= 0) continue;
      const ppg = p.points / p.gamesPlayed;
      let multiplier = 1;
      if (opts.type === 'offense') {
        const oppAvgAllowed = teamAvgAllowed[opp.opponent];
        if (oppAvgAllowed != null && leagueAvgAllowed) multiplier = clampMultiplier(oppAvgAllowed / leagueAvgAllowed);
      } else if (opts.type === 'idpDef') {
        // A stronger opposing offense means more plays/possessions to rack up tackles against - a loose proxy, not a precise model.
        const oppAvgScored = teamAvgScored[opp.opponent];
        if (oppAvgScored != null && leagueAvgScored) multiplier = clampMultiplier(oppAvgScored / leagueAvgScored);
      }
      predicted.push({
        name: p.name,
        team: p.team,
        position: p.position,
        points: Math.round(ppg * multiplier * 100) / 100,
        opponent: opp.opponent,
        isHome: opp.isHome,
      });
    }
    boards[boardId] = rank(predicted);
  }
  return boards;
}

const HOME_ADVANTAGE = 1.5; // a small, commonly-cited home-field bonus in points

function buildGamePredictions(games, pointsAllowed, pointsScored) {
  const teamAvgAllowed = {};
  for (const [t, s] of Object.entries(pointsAllowed)) teamAvgAllowed[t] = average(s);
  const teamAvgScored = {};
  for (const [t, s] of Object.entries(pointsScored)) teamAvgScored[t] = average(s);

  const picks = [];
  for (const g of games) {
    if (g.state !== 'pre') continue;
    const away = g.competitors.find((c) => c.homeAway === 'away');
    const home = g.competitors.find((c) => c.homeAway === 'home');
    if (!away || !home) continue;
    const hasData = teamAvgScored[away.team] != null && teamAvgScored[home.team] != null;
    const awayNet = (teamAvgScored[away.team] || 0) - (teamAvgAllowed[away.team] || 0);
    const homeNet = (teamAvgScored[home.team] || 0) - (teamAvgAllowed[home.team] || 0) + HOME_ADVANTAGE;
    picks.push({
      name: g.name,
      away: away.team,
      home: home.team,
      awayNetRating: hasData ? Math.round(awayNet * 10) / 10 : null,
      homeNetRating: hasData ? Math.round(homeNet * 10) / 10 : null,
      predictedWinner: hasData ? (homeNet >= awayNet ? home.team : away.team) : null,
      margin: hasData ? Math.round(Math.abs(homeNet - awayNet) * 10) / 10 : null,
    });
  }
  return picks;
}

const NFL_BOARDS = {
  all: { type: 'offense' },
  qb: { type: 'offense' },
  rb: { type: 'offense' },
  wr: { type: 'offense' },
  te: { type: 'offense' },
  k: { type: 'offense' },
  def: { type: 'nflDef' },
};
const CFB_BOARDS = {
  off: { type: 'offense' },
  qb: { type: 'offense' },
  rb: { type: 'offense' },
  wr: { type: 'offense' },
  te: { type: 'offense' },
  def: { type: 'idpDef' },
};

async function main() {
  const year = new Date().getFullYear();
  fs.mkdirSync(path.join(PRED_DIR, 'nfl'), { recursive: true });
  fs.mkdirSync(path.join(PRED_DIR, 'cfb'), { recursive: true });

  console.log('=== NFL predictions ===');
  const nflWeek = await fetchNflCurrentWeek();
  const nflGames = await fetchNflWeekGames(year, nflWeek);
  const nflPointsAllowed = readJson(path.join(FANTASY_DIR, 'nfl', 'points-allowed.json'), {});
  const nflPointsScored = readJson(path.join(FANTASY_DIR, 'nfl', 'points-scored.json'), {});
  const nflStatBoards = buildStatPredictions('nfl', nflGames, NFL_BOARDS, nflPointsAllowed, nflPointsScored);
  const nflGamePicks = buildGamePredictions(nflGames, nflPointsAllowed, nflPointsScored);
  fs.writeFileSync(path.join(PRED_DIR, 'nfl', 'stat-leaders.json'), JSON.stringify({ week: nflWeek, boards: nflStatBoards }));
  fs.writeFileSync(path.join(PRED_DIR, 'nfl', 'games.json'), JSON.stringify({ week: nflWeek, games: nflGamePicks }));
  console.log(`  wrote predictions for week ${nflWeek}, ${nflGamePicks.length} upcoming games`);

  console.log('=== CFB predictions ===');
  const cfbWeek = await fetchCfbCurrentWeek();
  const cfbGames = await fetchCfbWeekGames(year, cfbWeek);
  const cfbPointsAllowed = readJson(path.join(FANTASY_DIR, 'cfb', 'points-allowed.json'), {});
  const cfbPointsScored = readJson(path.join(FANTASY_DIR, 'cfb', 'points-scored.json'), {});
  const cfbStatBoards = buildStatPredictions('cfb', cfbGames, CFB_BOARDS, cfbPointsAllowed, cfbPointsScored);
  const cfbGamePicks = buildGamePredictions(cfbGames, cfbPointsAllowed, cfbPointsScored);
  fs.writeFileSync(path.join(PRED_DIR, 'cfb', 'stat-leaders.json'), JSON.stringify({ week: cfbWeek, boards: cfbStatBoards }));
  fs.writeFileSync(path.join(PRED_DIR, 'cfb', 'games.json'), JSON.stringify({ week: cfbWeek, games: cfbGamePicks }));
  console.log(`  wrote predictions for week ${cfbWeek}, ${cfbGamePicks.length} upcoming games`);

  console.log('Done. Predictions written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
