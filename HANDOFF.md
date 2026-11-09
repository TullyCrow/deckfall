# Deckfall handover

Written 2026-11-09, mid-way through a change of art direction. Read this first.

## Where things stand

| | State |
| --- | --- |
| Live site | https://tullycrow.github.io/deckfall/ is still the **sci-fi** version (commit `939ee7a` on `main`) |
| Tag `sci-fi-v1` | The sci-fi game, kept so it can be restored in one step |
| Branch `gothic` | The **gothic (Diablo-like) rebuild**, work in progress, **not deployed** |

The owner asked to "change the art direction entirely, make it like Diablo, playable during a
work break, really lean into it", and said earlier "we can revert if it doesn't hit". The gothic
branch replaces the sci-fi setting completely. Nothing on it has been shown to the owner yet.

## What the gothic branch already has

- **Engine** (`src/engine`): all 27 tests pass. Renamed throughout: sanctum (was safe pod), anvil
  recipes temper / reforge / transmute / potion, shards (was parts), trinket slot (was gadget).
  New: **Wrath** and the **Smite** action (`WRATH` in `data.ts`), regions by depth
  (`regionOf`: Cathedral, Catacombs from 5, Caves from 10, Hell from 15), a `drop` log cue for
  Legendary and Mythic finds. Save version is 5.
- **Content** (`src/engine/data.ts`): gothic bestiary, lords, talents, item bases, door text,
  whispers, sanctum lines. Tier labels are Normal, Magic, Rare, Legendary, Mythic.
- **Art**: 59 sprites from Dungeon Crawl Stone Soup (CC0) in `public/sprites`, fetched by
  `scripts/fetch-sprites.mjs`, which refuses any tile on that project's unclear-licence list.
  22 game-icons.net icons in `public/icons` (`scripts/build-icons.mjs`). The NASA photographs,
  static GIF and hull texture were deleted; the NASA **audio** is kept.
- **Interface** (`src/ui`): `Scene.tsx` draws the room from tiles (wall, floor, hero, monster,
  doors, loot beam, damage numbers, torchlight). `App.tsx` has the top bar, scene, log, panel and
  the "belt": red life orb, four slots (potion, Smite, pack, menu), blue wrath orb. `Stage.tsx`,
  `parts.tsx`, `tips.ts`, `styles.css` are rewritten. Fonts are Cinzel and EB Garamond.
- Sound is now **off by default** (work-break play); the title screen has the toggle.

## Known problems on the gothic branch (found by the last test run, not yet fixed)

1. **The scene collapses to zero height on a short phone** (375 x 667): `.scene` measured 0px in
   every phase. Its `min-height` is not holding inside the flex column.
2. **On 390 x 844 the belt sat at 550px in the first doors screen**, so the column is not filling
   the screen there (the first-run tip was showing). Later screens were correct at 835px.
3. **None of the screenshots have been looked at yet.** They are in the session scratchpad as
   `d-se-*.png` and `d-std-*.png`; regenerate them with the script below if that folder is gone.
4. The sanctum and peddler panels scroll inside themselves (as they did before).

## Still to do before the gothic version can go live

- Fix the two layout problems above and review every screen by eye.
- Rewrite `README.md` and `public/CREDITS.md` for the gothic game (both still describe the
  sci-fi one; the credits still list the deleted NASA photographs and the Plex fonts).
- Regenerate `public/og.jpg` (link preview) and `docs/demo.gif` (README).
- Decide the name: "Deckfall" and the word "deck" no longer fit a cathedral dungeon. The owner
  said "I'm not sure about renaming". The interface now says "depth".
- Balance: the test bot dies around depth 10. Not yet judged by a person.
- Then merge `gothic` into `main` and run `npm run deploy`.

## How to work on it

```sh
npm install
npm run dev        # play locally
npm test           # engine tests
npm run build      # typecheck and build to dist/
npm run deploy     # test, build, publish dist/ to GitHub Pages (only from main, when ready)
```

Pushing needs the GitHub CLI's login:
`git -c credential.helper= -c credential.helper='!gh auth git-credential' push`.

To restore the sci-fi game on the live site: check out `sci-fi-v1` (or `main` while it is still
at `939ee7a`) and run `npm run deploy`.

## Decisions the owner has made

- Build in public; a portfolio piece. Code is GPL-3.0-only and public.
- "UI/UX are king." Phone first, installable, offline.
- Wants crafting and a safe place between levels (built: sanctum and anvil).
- Not ready to market it: "I don't think we have a shippable product yet". No Play Store.
- Free assets only, each credited, each with a licence that allows redistribution.

## Ideas discussed but not decided

- A reason for the descent, and something that carries between runs. (For the sci-fi version this
  was a "you are being broadcast" premise with a Director's voice and ratings; it has not been
  rethought for the gothic setting.)
- Classes with ability scores and d20 checks (the owner's original "sci-fi DnD" idea).
- Finishers, and an ending.
