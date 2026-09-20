// Live, in-game fantasy scoring: for every game currently in progress,
// pulls the real-time boxscore and computes each player's fantasy points
// so far in that specific game. The actual boxscore-parsing and scoring
// logic lives in fetch-boxscore-fantasy.js, shared with
// generate-week-fantasy.js (a "week" is the same computation generalized
// to an arbitrary set of games instead of just "live right now").
const { fetchNflGames, fetchCfbGames } = require('./fetch-live');
const { fetchGameFantasy } = require('./fetch-boxscore-fantasy');
const { pointsAllowedTier } = require('./fantasy-scoring');
const { buildPositionLookup } = require('./fantasy-position-lookup');

async function fetchNflLiveDstPoints(liveGames) {
  const rows = [];
  for (const game of liveGames) {
    const away = game.competitors.find((c) => c.homeAway === 'away');
    const home = game.competitors.find((c) => c.homeAway === 'home');
    if (!away || !home) continue;
    rows.push({ name: away.team, team: away.team, game: game.name, gameStatus: game.statusDetail, points: pointsAllowedTier(Number(home.score) || 0) });
    rows.push({ name: home.team, team: home.team, game: game.name, gameStatus: game.statusDetail, points: pointsAllowedTier(Number(away.score) || 0) });
  }
  return rows;
}

async function buildLiveFantasy() {
  const [nflGames, cfbGames] = await Promise.all([fetchNflGames(), fetchCfbGames()]);
  const liveNfl = nflGames.filter((g) => g.state === 'in');
  const liveCfb = cfbGames.filter((g) => g.state === 'in');

  const nflPosLookup = buildPositionLookup('nfl');
  const cfbPosLookup = buildPositionLookup('cfb');

  const nflPerformers = [];
  for (const game of liveNfl) {
    const perf = await fetchGameFantasy('nfl', game, 1, nflPosLookup); // full PPR
    nflPerformers.push(...perf);
  }
  const cfbPerformers = [];
  for (const game of liveCfb) {
    const perf = await fetchGameFantasy('college-football', game, 0.5, cfbPosLookup); // half PPR
    cfbPerformers.push(...perf);
  }

  nflPerformers.sort((a, b) => b.points - a.points);
  cfbPerformers.sort((a, b) => b.points - a.points);

  const nflDst = (await fetchNflLiveDstPoints(liveNfl)).sort((a, b) => b.points - a.points);

  return {
    nfl: { topPerformers: nflPerformers.slice(0, 20), teamDefLive: nflDst },
    cfb: { topPerformers: cfbPerformers.slice(0, 20) },
    liveGameCount: { nfl: liveNfl.length, cfb: liveCfb.length },
  };
}

module.exports = { buildLiveFantasy };
