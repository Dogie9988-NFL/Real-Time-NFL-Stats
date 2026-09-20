// Live scoreboard data: today's games, scores, status, and each game's
// current passing/rushing/receiving leader. This host (site.api.espn.com)
// sits behind Akamai bot-protection, but the quirk here is the opposite of
// what ESPN's HTML stats pages do elsewhere in this repo's history: curl's
// own default User-Agent ("curl/...") gets through fine, while ANY
// browser-looking UA string (even a generic one) gets blocked. So this one
// is curl with NO -A override at all - don't "fix" that by adding one.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const CFB_TEAMS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'reference', 'cfb-power4-teams.json'), 'utf8')
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function curlOnce(url) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['-sL', '--max-time', '10', url],
      { maxBuffer: 20 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
      }
    );
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

function mapLeaders(leaders) {
  if (!Array.isArray(leaders)) return [];
  const wanted = { passingYards: 'Passing', rushingYards: 'Rushing', receivingYards: 'Receiving' };
  const out = [];
  for (const cat of leaders) {
    if (!wanted[cat.name]) continue;
    const l = cat.leaders && cat.leaders[0];
    if (!l) continue;
    out.push({
      category: wanted[cat.name],
      name: l.athlete.displayName,
      position: (l.athlete.position && l.athlete.position.abbreviation) || '',
      team: (l.team && l.team.id) || null,
      displayValue: l.displayValue,
    });
  }
  return out;
}

function mapEvent(event) {
  const comp = event.competitions[0];
  const status = comp.status;
  const competitors = comp.competitors.map((c) => ({
    team: c.team.abbreviation,
    name: c.team.shortDisplayName,
    score: c.score,
    homeAway: c.homeAway,
    winner: !!c.winner,
    logo: (c.team.logos && c.team.logos[0] && c.team.logos[0].href) || null,
  }));
  // Resolve leader team ids to abbreviations for display.
  const teamById = {};
  for (const c of comp.competitors) teamById[c.team.id] = c.team.abbreviation;
  const leaders = status.type.state === 'pre' ? [] : mapLeaders(comp.leaders).map((l) => ({ ...l, team: teamById[l.team] || l.team }));

  return {
    id: event.id,
    name: event.shortName,
    state: status.type.state, // 'pre' | 'in' | 'post'
    statusDetail: status.type.shortDetail,
    period: status.period,
    displayClock: status.displayClock,
    competitors,
    leaders,
  };
}

async function fetchNflGames() {
  const data = await getJson('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
  return (data.events || []).map(mapEvent);
}

async function fetchCfbGames() {
  const data = await getJson('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=200');
  return (data.events || [])
    .filter((event) => {
      const comp = event.competitions[0];
      return comp.competitors.some((c) => CFB_TEAMS[c.team.id]);
    })
    .map(mapEvent);
}

module.exports = { fetchNflGames, fetchCfbGames };
