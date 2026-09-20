// The live boxscore API doesn't return each athlete's position, only their
// stat line. The season fantasy boards (generate-fantasy.js) already know
// every fantasy-relevant player's position from ESPN's season stats API,
// so this reads those already-generated files to answer "what position is
// this player?" for the live and weekly views, instead of a second network
// fetch just to look up a position.
const fs = require('fs');
const path = require('path');

const FANTASY_DIR = path.join(__dirname, '..', 'docs', 'data', 'fantasy');

// Returns a map keyed by "name|team" (exact match) and, as a fallback, by
// bare "name" (in case a boxscore's team abbreviation ever drifts slightly
// from the season pool's). Fallback lookups are best-effort only - a
// wrong-position badge is a cosmetic risk, never something scoring depends
// on. Reads position-lookup.json (written by generate-fantasy.js) rather
// than the season boards themselves, since those are trimmed to the top 50
// per category and would miss plenty of players who still show up in a
// single game's boxscore.
function buildPositionLookup(league) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(FANTASY_DIR, league, 'position-lookup.json'), 'utf8'));
  } catch {
    return {};
  }
  const lookup = { ...raw };
  for (const key of Object.keys(raw)) {
    const name = key.slice(0, key.lastIndexOf('|'));
    if (!(name in lookup)) lookup[name] = raw[key];
  }
  return lookup;
}

module.exports = { buildPositionLookup };
