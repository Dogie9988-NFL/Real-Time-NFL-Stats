# Undrafted: game source

This folder holds the source code for **Undrafted**, the football story game in
`docs/game/index.html`. You don't need anything in this folder to *play* the game.
Just open `docs/game/index.html` in a browser.

You only need this folder if you want to **change** the game.

## How it is built

The game ships as one HTML file, but it is written as many smaller files so it is
easier to work on. `build.js` glues them together in file-name order:

| Files | What they are |
|---|---|
| `src/00-top.html`, `src/19-mid.html` | The page skeleton |
| `src/1x-*.css` | Colors, layout and fonts |
| `src/20-core.js` | Shared helpers, saving, sound effects |
| `src/50-engine.js` | The core game: weeks, games, stats and endings |
| `src/60-minigames.js`, `src/61-field.js` | The game-day mini-games |
| `src/70-screens.js` | Title screen, new-career setup, trophy case |
| `mods/<name>/` | Feature packs layered on top (see below) |

Feature packs (listed in `MODS.txt`):

- `content`: game-day plays and clutch drives for every position
- `story-arcs`: the main storylines (your coach, Tiny, Marcus Vane) and weekly activities
- `story-events`: random weekly events and epilogue lines
- `art`: character portraits, team helmets and scene art (all drawn in code)
- `juice`: screen effects, sounds and result stamps
- `progress`: levels, perks, difficulty settings, Pro Shop, weekly challenges, Hall of Fame
- `league`: standings, league news and the Rookie of the Year race
- `year2`: the second season (contracts, a rookie rival, new storylines)
- `arcade-pass`, `arcade-ground`: the arcade plays (QB throws, WR catches, RB runs, LB tackles)

## Make a change

1. Edit a file in `src/` or `mods/`.
2. Rebuild the game (you need [Node.js](https://nodejs.org/)). Run this from the repository folder:

   ```
   node game-src/build.js
   ```

   This writes a fresh `docs/game/index.html`. If you made a typing mistake in the
   JavaScript, it stops and tells you which file and line to look at.
3. Open `docs/game/index.html` in your browser and play to check your change.
