
// =========================================================
//   CORE BEATS — story beats triggered by how the season is going
// =========================================================
// The slump: once per career, after two straight losses or an F-range game, the low point you climb out of.
function inSlump() {
  if (S.flags.slumpDone || S.role === 'practice') return false;
  const h = S.hist, g = S.grades;
  const twoLosses = h.length >= 2 && !h[h.length - 1].won && !h[h.length - 2].won;
  const lastGame = h[h.length - 1];
  // A single awful game only counts as rock bottom when it was a loss and the team isn't winning.
  const awful = g.length && g[g.length - 1].v < 1.25 && g[g.length - 1].n === S.slate - 1 && lastGame && !lastGame.won && S.record.w <= S.record.l;
  return twoLosses || awful;
}
BEATS.push({ slate: [2, 3, 4, 5, 6, 7, 8, 9], id: 'slump', if: inSlump });
BEATS.push({ slate: [1, 2, 3, 4, 5, 6, 7, 8, 9], id: 'slump', if: inSlump, year: 2 });
P.slump = () => {
  const last = S.hist[S.hist.length - 1];
  const done = (key, fxd, out) => () => { S.flags.slumpDone = true; S.flags.slumpWeek = S.slate; S.flags.slumpWay = key; fx(fxd); return out; };
  return {
    kicker: `${weekKicker()} · Monday`,
    title: 'Rock Bottom',
    body: [
      last ? `The film of the ${last.opp} game is worse than you remembered. {coachLast} stops it on your mistakes so often that the projector fan starts to whine.` : `The film is worse than you remembered.`,
      `On Tuesday a sports radio host asks if the "undrafted feel-good story" has run out of pages. Your phone lights up with the clip four times before lunch.`,
      `Nobody says it out loud. Everybody is thinking it.`,
    ],
    choices: [
      { if: () => S.rel.vane >= 20, label: 'Find Marcus Vane.', do: done('vane', { conf: 8, skill: 2, vane: 6 }, [`He doesn't make a speech. He pulls up his own rookie film, the worst game of his career, and watches it with you.`, { s: 'Marcus Vane', t: `Twelve years. Everybody has this tape. The ones who last are the ones who watch it twice.` }]) },
      { label: 'Call {fam}.', do: done('family', { conf: 7, family: 6 }, [{ s: '{fam}', t: `I didn't raise you to be perfect. I raised you to get up. So get up.` }, `You stay on the phone until {fp} has to go. You feel about ten pounds lighter.`]) },
      { label: 'Go back to the facility at midnight and run it alone.', do: done('grind', { skill: 4, energy: -10, coach: 4 }, [`The stadium lights are off, so you work under the ones in the parking lot. At 1:30 a.m. a car pulls in. It's {coachLast}. Nobody asks what anybody is doing. {Cp} just grabs a ball.`]) },
      { if: () => !tinyLeft(), label: 'Let Tiny take you to his auntie\'s for dinner.', do: done('tiny', { chem: 6, conf: 5, energy: 6 }, [`Tiny's auntie feeds you until you can't move and tells you a story about Tiny crying at a peewee game when he was eight. Tiny denies all of it. You laugh for the first time in a week.`]) },
    ],
  };
};
on('gameEnd', g => {
  if (S.flags.slumpWeek === g.n && g.won) { S.flags.bounceBack = true; toast('Bounce-back win!', 'cash'); }
});
CODAS.push(() => (S.flags.bounceBack ? `People still ask about the week everyone said you were done. You always tell them about the game after it.` : null));
