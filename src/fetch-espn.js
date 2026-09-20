const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = PROXY ? new HttpsProxyAgent(PROXY) : undefined;

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { agent, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(getJson(res.headers.location));
        }
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Bad JSON from ${url}: ${e.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 3; // up to 3000 players per stat, plenty for top-50-per-position

// sportSlug: 'nfl' | 'college-football'
async function fetchLeaders(sportSlug, category, field, season, seasontype = 2, sortCategory) {
  const out = [];
  const seen = new Set();
  const sortCat = sortCategory || category;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `https://site.web.api.espn.com/apis/common/v3/sports/football/${sportSlug}` +
      `/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false` +
      `&limit=${PAGE_SIZE}&page=${page}&sort=${sortCat}.${field}&season=${season}&seasontype=${seasontype}`;

    const data = await getJson(url);
    if (!data.athletes || data.athletes.length === 0) break;

    const catIndex = data.categories.findIndex((c) => c.name === category);
    const fieldIndex = data.categories[catIndex].names.indexOf(field);

    let lastValue = null;
    for (const a of data.athletes) {
      const ath = a.athlete;
      const raw = a.categories[catIndex].totals[fieldIndex];
      const value = raw === '-' ? 0 : parseFloat(String(raw).replace(/,/g, '')) || 0;
      lastValue = value;
      if (seen.has(ath.id)) continue;
      seen.add(ath.id);
      out.push({
        id: ath.id,
        name: ath.displayName,
        position: (ath.position && ath.position.abbreviation) || '-',
        teamId: ath.teamId != null ? String(ath.teamId) : null,
        team: ath.teamShortName || '',
        value,
      });
    }

    if (lastValue === 0) break; // rest of the sorted list is all zero, no point paging further
    if (data.athletes.length < PAGE_SIZE) break; // last page
  }

  out.sort((a, b) => b.value - a.value);
  return out;
}

module.exports = { fetchLeaders };
