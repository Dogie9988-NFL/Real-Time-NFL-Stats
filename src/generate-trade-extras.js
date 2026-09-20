// Builds the extra data the trade calculator uses beyond raw season
// points: each team's remaining schedule / strength of schedule, and
// recent news headlines tagged to specific players. Run this AFTER
// generate-fantasy.js (needs the season boards for player ids) and
// generate-week-fantasy.js (needs points-allowed.json, a byproduct of that
// script's week-by-week game fetching) in the same workflow run.
//
// Note: CFB player ids come from CollegeFootballData.com (see
// fetch-cfbd.js / generate-fantasy.js), not ESPN, so they never match the
// ESPN athlete ids news is tagged with below - CFB news is still fetched
// (harmless, and ready for if CFB ids ever get an ESPN mapping), it just
// won't attach to any player today. NFL still uses ESPN ids, so NFL news
// matching works as intended.
const fs = require('fs');
const path = require('path');
const { fetchRemainingSchedule, buildTeamInfo, getJson } = require('./fetch-team-info');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data', 'fantasy');
const CFB_TEAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'reference', 'cfb-power4-teams.json'), 'utf8'));

const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WSH',
];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function buildNflTeamInfo() {
  const pointsAllowed = readJson(path.join(DATA_DIR, 'nfl', 'points-allowed.json'), {});
  const remainingByTeam = {};
  await Promise.all(
    NFL_TEAMS.map(async (team) => {
      const isOpponent = (c) => c.team.abbreviation.toUpperCase() !== team;
      remainingByTeam[team] = await fetchRemainingSchedule('nfl', team.toLowerCase(), isOpponent).catch(() => []);
    })
  );
  return buildTeamInfo(remainingByTeam, pointsAllowed);
}

async function buildCfbTeamInfo() {
  const pointsAllowed = readJson(path.join(DATA_DIR, 'cfb', 'points-allowed.json'), {});
  const remainingByTeam = {};
  await Promise.all(
    Object.entries(CFB_TEAMS).map(async ([teamId, info]) => {
      const isOpponent = (c) => c.team.id !== teamId;
      remainingByTeam[info.abbr] = await fetchRemainingSchedule('college-football', teamId, isOpponent).catch(() => []);
    })
  );
  return buildTeamInfo(remainingByTeam, pointsAllowed);
}

// Recent news headlines matched to specific players via ESPN's own
// "athlete" category tags on each article (not a name-guessing heuristic).
async function buildNews(league, sportPath) {
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/news?limit=50`).catch(() => ({ articles: [] }));
  const news = {};
  for (const article of data.articles || []) {
    const link = (article.links && article.links.web && article.links.web.href) || null;
    if (!article.headline || !link) continue;
    const athleteCats = (article.categories || []).filter((c) => c.type === 'athlete' && c.athleteId);
    for (const cat of athleteCats) {
      const key = `${league}-${cat.athleteId}`;
      if (!news[key]) news[key] = [];
      if (news[key].length < 3) news[key].push({ headline: article.headline, link, published: article.published || null });
    }
  }
  return news;
}

async function main() {
  console.log('Fetching NFL remaining schedules / SOS...');
  const nflTeamInfo = await buildNflTeamInfo();
  fs.mkdirSync(path.join(DATA_DIR, 'nfl'), { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'nfl', 'team-info.json'), JSON.stringify(nflTeamInfo));
  console.log(`  wrote team-info for ${Object.keys(nflTeamInfo).length} NFL teams`);

  console.log('Fetching CFB remaining schedules / SOS...');
  const cfbTeamInfo = await buildCfbTeamInfo();
  fs.mkdirSync(path.join(DATA_DIR, 'cfb'), { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'cfb', 'team-info.json'), JSON.stringify(cfbTeamInfo));
  console.log(`  wrote team-info for ${Object.keys(cfbTeamInfo).length} CFB teams`);

  console.log('Fetching news...');
  const [nflNews, cfbNews] = await Promise.all([buildNews('nfl', 'nfl'), buildNews('cfb', 'college-football')]);
  const news = { ...nflNews, ...cfbNews };
  fs.writeFileSync(path.join(DATA_DIR, 'news.json'), JSON.stringify(news));
  console.log(`  wrote news for ${Object.keys(news).length} players`);

  console.log('Done. Trade-calculator extras written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
