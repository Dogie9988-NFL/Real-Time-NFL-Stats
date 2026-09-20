// Fetches the full game list for a SPECIFIC week (any status - finished,
// in progress, or not yet kicked off), as opposed to fetch-live.js which
// only fetches "today's" games. Used to build week-by-week fantasy leaders
// and, as a byproduct, per-team points-allowed history for strength of
// schedule (see generate-week-fantasy.js).
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const CFB_TEAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'reference', 'cfb-power4-teams.json'), 'utf8'));

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

function mapGameBasic(event) {
  const comp = event.competitions[0];
  const status = comp.status;
  return {
    id: event.id,
    name: event.shortName,
    state: status.type.state, // 'pre' | 'in' | 'post'
    statusDetail: status.type.shortDetail,
    competitors: comp.competitors.map((c) => ({ team: c.team.abbreviation, homeAway: c.homeAway, score: c.score })),
  };
}

async function fetchNflWeekGames(year, week) {
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?year=${year}&seasontype=2&week=${week}`);
  return (data.events || []).map(mapGameBasic);
}

async function fetchCfbWeekGames(year, week) {
  const data = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?year=${year}&seasontype=2&week=${week}&groups=80&limit=300`
  );
  return (data.events || [])
    .filter((event) => event.competitions[0].competitors.some((c) => CFB_TEAMS[c.team.id]))
    .map(mapGameBasic);
}

async function fetchNflCurrentWeek() {
  const data = await getJson('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
  return (data.week && data.week.number) || 1;
}

async function fetchCfbCurrentWeek() {
  const data = await getJson('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80');
  return (data.week && data.week.number) || 1;
}

module.exports = { fetchNflWeekGames, fetchCfbWeekGames, fetchNflCurrentWeek, fetchCfbCurrentWeek };
