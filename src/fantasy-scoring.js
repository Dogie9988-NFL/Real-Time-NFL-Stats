// Pure fantasy-point scoring functions. No I/O here - these just take a
// stat line (from whatever source: season totals or a single live game)
// and return points, so the exact same math powers both the season
// leaderboards and the live in-game scoreboard.
//
// Scoring choices (documented since fantasy formulas vary by platform):
// - NFL offense: standard full-PPR (1pt/25 pass yds, 4pt pass TD, 1pt/10
//   rush or rec yds, 6pt rush/rec/return TD, 1pt/reception, -2pt INT
//   thrown or fumble lost).
// - CFB offense: same shape but HALF PPR (0.5pt/reception) per the request.
//   CFB per-player data doesn't expose offensive fumbles-lost (see
//   README/site footer), so that penalty is simply not applied for CFB -
//   scores are very slightly optimistic versus a platform that tracks it.
// - NFL kicker: distance-tiered field goals (3/3/3/4/5 for <20/20-29/30-39/
//   40-49/50+) + 1pt extra points. Missed kicks aren't penalized (ESPN's
//   category data gives makes, not a clean miss count broken out by kind).
// - NFL team defense/special teams (DST): points-allowed tiers (computed
//   per game, not off a season average - see generate-fantasy.js) + sacks,
//   defensive INTs, defensive/return TDs, and forced fumbles by that team's
//   defensive players. Fumbles recovered aren't credited: ESPN's data
//   doesn't distinguish "recovered our own fumble" from "recovered the
//   opponent's fumble", and crediting the former would be wrong, so it's
//   left out entirely rather than guessed. Safeties and blocked kicks
//   aren't tracked in our data and are also omitted (both are rare enough
//   that this is a minor gap, not a major scoring miss).
// - CFB IDP (individual defensive player): a common tackle-based format
//   (1pt solo, 0.5pt assist, +2pt sack bonus, 1pt pass defended, 4pt INT,
//   +6pt on a defensive/INT return TD, 3pt forced fumble). CFB data has no
//   fumbles-recovered field at all (a documented site-wide gap), so that's
//   omitted here too.

function nflOffensePoints(v) {
  return (
    (v.passingYards || 0) * 0.04 +
    (v.passingTouchdowns || 0) * 4 +
    (v.interceptions || 0) * -2 + // passing.interceptions = INTs thrown
    (v.rushingYards || 0) * 0.1 +
    (v.rushingTouchdowns || 0) * 6 +
    (v.rushingFumblesLost || 0) * -2 +
    (v.receivingYards || 0) * 0.1 +
    (v.receivingTouchdowns || 0) * 6 +
    (v.receptions || 0) * 1 +
    (v.receivingFumblesLost || 0) * -2 +
    (v.kickReturnTouchdowns || 0) * 6 +
    (v.puntReturnTouchdowns || 0) * 6
  );
}

function cfbOffensePoints(v) {
  return (
    (v.passingYards || 0) * 0.04 +
    (v.passingTouchdowns || 0) * 4 +
    (v.interceptions || 0) * -2 +
    (v.rushingYards || 0) * 0.1 +
    (v.rushingTouchdowns || 0) * 6 +
    (v.receivingYards || 0) * 0.1 +
    (v.receivingTouchdowns || 0) * 6 +
    (v.receptions || 0) * 0.5 + // half PPR
    (v.returnTouchdowns || 0) * 6
  );
}

function nflKickerPoints(v) {
  return (
    (v.fieldGoalsMade1_19 || 0) * 3 +
    (v.fieldGoalsMade20_29 || 0) * 3 +
    (v.fieldGoalsMade30_39 || 0) * 3 +
    (v.fieldGoalsMade40_49 || 0) * 4 +
    (v.fieldGoalsMade50 || 0) * 5 +
    (v.extraPointsMade || 0) * 1
  );
}

// Standard points-allowed tier table, applied PER GAME (see caller).
function pointsAllowedTier(pointsAllowed) {
  if (pointsAllowed <= 0) return 10;
  if (pointsAllowed <= 6) return 7;
  if (pointsAllowed <= 13) return 4;
  if (pointsAllowed <= 20) return 1;
  if (pointsAllowed <= 27) return 0;
  if (pointsAllowed <= 34) return -1;
  return -4;
}

// agg: {sacks, defInterceptions, fumblesForced, defTds, gamesPointsAllowed: number[]}
function nflDstPoints(agg) {
  const paPoints = (agg.gamesPointsAllowed || []).reduce((sum, pa) => sum + pointsAllowedTier(pa), 0);
  return (
    (agg.sacks || 0) * 1 +
    (agg.defInterceptions || 0) * 2 +
    (agg.fumblesForced || 0) * 1 +
    (agg.defTds || 0) * 6 +
    paPoints
  );
}

function cfbIdpPoints(v) {
  return (
    (v.soloTackles || 0) * 1 +
    (v.assistTackles || 0) * 0.5 +
    (v.sacks || 0) * 2 +
    (v.passesDefended || 0) * 1 +
    (v.interceptions || 0) * 4 +
    (v.interceptionTouchdowns || 0) * 6 +
    (v.fumblesForced || 0) * 3
  );
}

// --- Live (in-game boxscore) scoring ---
// The live boxscore endpoint (site.api.espn.com/.../summary) uses a
// different, simpler field set than the season byathlete API (no fumble
// split by rush/catch, no FG distance buckets), so these are deliberately
// slightly simpler than the season formulas above - close enough for a
// "who's balling out right now" live view, not meant to be the final
// scoring record (the season leaderboards use the precise formulas).
function liveOffensePoints(v, pprValue) {
  return (
    (v.passingYards || 0) * 0.04 +
    (v.passingTouchdowns || 0) * 4 +
    (v.passingInterceptions || 0) * -2 +
    (v.rushingYards || 0) * 0.1 +
    (v.rushingTouchdowns || 0) * 6 +
    (v.receivingYards || 0) * 0.1 +
    (v.receivingTouchdowns || 0) * 6 +
    (v.receptions || 0) * pprValue +
    (v.kickReturnTouchdowns || 0) * 6 +
    (v.puntReturnTouchdowns || 0) * 6 +
    (v.fumblesLost || 0) * -2
  );
}

function liveKickerPoints(v) {
  return (v.fieldGoalsMade || 0) * 3 + (v.extraPointsMade || 0) * 1;
}

function liveIdpPoints(v) {
  return (
    (v.soloTackles || 0) * 1 +
    (v.assistTackles || 0) * 0.5 +
    (v.sacks || 0) * 2 +
    (v.passesDefended || 0) * 1 +
    (v.interceptions || 0) * 4 +
    (v.interceptionTouchdowns || 0) * 6 +
    (v.defensiveTouchdowns || 0) * 6
  );
}

module.exports = {
  nflOffensePoints,
  cfbOffensePoints,
  nflKickerPoints,
  nflDstPoints,
  cfbIdpPoints,
  pointsAllowedTier,
  liveOffensePoints,
  liveKickerPoints,
  liveIdpPoints,
};
