// Shared boxscore -> fantasy-points logic. Given any single game (live,
// final, or upcoming) this turns its ESPN boxscore into a list of
// performers and their fantasy points for THAT GAME ONLY. Used by both
// fetch-live-fantasy.js (today's in-progress games) and
// generate-week-fantasy.js (an arbitrary past/current week's games) - a
// "week" is just a generalization of "games right now" to any set of
// games, so the two share this one code path rather than duplicating it.
//
// Same Akamai-protected host as the scoreboard (see fetch-live.js) - curl
// with no UA override.
const { execFile } = require('child_process');
const { liveOffensePoints, liveKickerPoints, liveIdpPoints } = require('./fantasy-scoring');

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

// positionLookup (optional): a map of "name|team" (and bare "name" as a
// fallback) -> position abbreviation, built from the season fantasy boards
// (see fantasy-position-lookup.js). The boxscore endpoint itself doesn't
// return each athlete's position, so this is the only way to know it here.
async function fetchGameFantasy(sportPath, game, pprValue, positionLookup) {
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/summary?event=${game.id}`);
  const teams = (data.boxscore && data.boxscore.players) || [];
  const performers = [];

  for (const teamBox of teams) {
    const teamAbbr = teamBox.team.abbreviation;
    const byAthlete = parseTeamBoxscore(teamBox);
    for (const [athleteId, p] of Object.entries(byAthlete)) {
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
          athleteId,
          name: p.name,
          team: teamAbbr,
          position: positionLookup ? positionLookup[`${p.name}|${teamAbbr}`] || positionLookup[p.name] || '-' : undefined,
          game: game.name,
          gameStatus: game.statusDetail,
          points: Math.round(points * 100) / 100,
        });
      }
    }
  }
  return performers;
}

module.exports = { fetchGameFantasy, getJson, curlOnce };
