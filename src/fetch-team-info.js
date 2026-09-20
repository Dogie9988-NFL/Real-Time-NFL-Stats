// Remaining-schedule and strength-of-schedule data for the trade
// calculator: for each team, how many games are left this season, who the
// remaining opponents are, and whether those opponents' defenses have
// mostly been stingy ("Tough" schedule) or generous ("Easy" schedule) so
// far - a simple, transparent proxy for schedule strength, not an
// official rating.
const { execFile } = require('child_process');

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

// teamPathId: the id/abbr to put in the URL path. isOpponent: a predicate
// that returns true for the competitor entry that is NOT this team.
async function fetchRemainingSchedule(sportPath, teamPathId, isOpponent) {
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/teams/${teamPathId}/schedule`);
  const remaining = [];
  for (const event of data.events || []) {
    const comp = event.competitions[0];
    if (!comp || comp.status.type.completed) continue;
    const opp = comp.competitors.find(isOpponent);
    if (opp) remaining.push(opp.team.abbreviation);
  }
  return remaining;
}

function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

// pointsAllowed: {TEAM: [scoreAllowed, ...]} for games played so far.
// Builds {TEAM: {gamesRemaining, remainingOpponents, sosScore, sosTier}}.
function buildTeamInfo(remainingByTeam, pointsAllowed) {
  const teamAvgPA = {};
  for (const [team, scores] of Object.entries(pointsAllowed)) teamAvgPA[team] = average(scores);
  const leagueAvgPA = average(Object.values(teamAvgPA).filter((v) => v != null));

  const info = {};
  for (const [team, remainingOpponents] of Object.entries(remainingByTeam)) {
    const oppAverages = remainingOpponents.map((o) => teamAvgPA[o]).filter((v) => v != null);
    const sosScore = average(oppAverages);
    let sosTier = 'Unknown';
    if (sosScore != null && leagueAvgPA != null) {
      const diff = sosScore - leagueAvgPA;
      // Opponents allowing MORE points than average = an easier stretch for this team's offense.
      if (diff > 2) sosTier = 'Easy';
      else if (diff < -2) sosTier = 'Tough';
      else sosTier = 'Neutral';
    }
    info[team] = {
      gamesRemaining: remainingOpponents.length,
      remainingOpponents,
      sosScore: sosScore != null ? Math.round(sosScore * 10) / 10 : null,
      sosTier,
    };
  }
  return info;
}

module.exports = { fetchRemainingSchedule, buildTeamInfo, getJson };
