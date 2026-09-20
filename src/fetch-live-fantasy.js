// Live, in-game fantasy scoring: for every game currently in progress,
// pulls the real-time boxscore and computes each player's fantasy points
// so far in that specific game. Same Akamai-protected host as the
// scoreboard (see fetch-live.js) - curl with no UA override.
const { execFile } = require('child_process');
const { fetchNflGames, fetchCfbGames } = require('./fetch-live');
const { liveOffensePoints, liveKickerPoints, liveIdpPoints, pointsAllowedTier } = require('./fantasy-scoring');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function curlOnce(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sL', '--max-time', '12', url], { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

async function getJson(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    const body = await curlOnce(url).catch(() => '');
    try {
      return JSON.parse(body);
    } catch {
      if (i < attempts) await sleep(500 * i);
    }
  }
  throw new Error(`Failed to fetch valid JSON from ${url}`);
}

// Turns one team's boxscore `statistics` groups into a per-athlete map of
// {name, values: {fieldName: number}}.
function parseTeamBoxscore(teamBox) {
  const byAthlete = {};
  for (const group of teamBox.statistics || []) {
    const keys = group.keys || [];
    for (const row of group.athletes || []) {
      const id = row.athlete.id;
      if (!byAthlete[id]) byAthlete[id] = { name: row.athlete.displayName, values: {} };
      keys.forEach((key, i) => {
        const raw = row.stats[i];
        if (key.includes('/')) {
          // combined "made/attempted" fields (completions/passingAttempts, fieldGoalsMade/fieldGoalAttempts, ...)
          const [madeKey, attKey] = key.split('/');
          const [made, att] = String(raw).split('/');
          byAthlete[id].values[madeKey] = parseFloat(made) || 0;
          byAthlete[id].values[attKey] = parseFloat(att) || 0;
        } else {
          byAthlete[id].values[key] = raw === '--' ? 0 : parseFloat(raw) || 0;
        }
      });
    }
  }
  return byAthlete;
}

async function fetchGameFantasy(sportPath, game, pprValue) {
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/summary?event=${game.id}`);
  const teams = (data.boxscore && data.boxscore.players) || [];
  const performers = [];

  for (const teamBox of teams) {
    const teamAbbr = teamBox.team.abbreviation;
    const byAthlete = parseTeamBoxscore(teamBox);
    for (const [, p] of Object.entries(byAthlete)) {
      const v = p.values;
      const offensePts = liveOffensePoints(v, pprValue);
      const kickerPts = liveKickerPoints(v);
      const idpPts = liveIdpPoints({
        ...v,
        assistTackles: (v.totalTackles || 0) - (v.soloTackles || 0),
      });
      const points = offensePts + kickerPts + idpPts;
      if (points > 0) {
        performers.push({
          name: p.name,
          team: teamAbbr,
          game: game.name,
          gameStatus: game.statusDetail,
          points: Math.round(points * 100) / 100,
        });
      }
    }
  }
  return performers;
}

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

  const nflPerformers = [];
  for (const game of liveNfl) {
    const perf = await fetchGameFantasy('nfl', game, 1); // full PPR
    nflPerformers.push(...perf);
  }
  const cfbPerformers = [];
  for (const game of liveCfb) {
    const perf = await fetchGameFantasy('college-football', game, 0.5); // half PPR
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
