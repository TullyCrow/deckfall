// Downloads the creature sprites the game uses from Dungeon Crawl Stone Soup's tile set
// (https://github.com/crawl/crawl, tiles released under CC0) into public/sprites, and
// writes the credits file. Each name is checked against the project's list of tiles
// with unclear licensing (https://github.com/crawl/tiles), and any match stops the run.
//
//   node scripts/fetch-sprites.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TILES = 'https://raw.githubusercontent.com/crawl/crawl/master/crawl-ref/source/rltiles/mon';
const UNCLEAR = 'https://raw.githubusercontent.com/crawl/tiles/master/TILES_UNDER_UNKNOWN_LICENSE.md';
const headers = { 'user-agent': 'DeckfallBuild/0.1 (https://github.com/TullyCrow/deckfall)' };

/** Folder and file name in the tile set. The file name is also the name used in the game. */
const SPRITES = [
  // Hostiles
  'animals/radroach', 'aberrations/chonchon0', 'nonliving/clockwork_bee', 'amorphous/aspiring_flesh',
  'humanoids/ironbound_mechanist', 'undead/bloated_husk', 'nonliving/iron_golem', 'undead/phantom',
  'undead/revenant', 'animals/emperor_scorpion', 'undead/cognitogaunt', 'aberrations/crawling_flesh_cage0',
  // Deck guardians
  'nonliving/electric_golem', 'animals/broodmother', 'undead/ancient_champion', 'abyss/wretched_star',
  // Things the camera shows for an instant on the deeper decks
  'abyss/lurking_horror', 'aberrations/nameless_horror', 'aberrations/unseen_horror',
];

const out = join(import.meta.dirname, '..', 'public', 'sprites');
mkdirSync(out, { recursive: true });

const unclear = await (await fetch(UNCLEAR, { headers })).text();
for (const path of SPRITES) {
  const name = path.split('/')[1];
  if (unclear.includes(`- ${name}.png`)) throw new Error(`${name}.png is on the unclear-licence list; choose another`);
  const response = await fetch(`${TILES}/${path}.png`, { headers });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  writeFileSync(join(out, `${name}.png`), Buffer.from(await response.arrayBuffer()));
}

writeFileSync(
  join(out, 'CREDITS.md'),
  [
    '# Sprite credits',
    '',
    'The creature sprites in this folder are tiles from [Dungeon Crawl Stone Soup](https://github.com/crawl/crawl),',
    'drawn by its contributors and released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).',
    'They are used unmodified. None is on the project\'s',
    '[list of tiles with unclear licensing](https://github.com/crawl/tiles/blob/master/TILES_UNDER_UNKNOWN_LICENSE.md).',
    '',
    ...SPRITES.map((path) => `- \`${path.split('/')[1]}.png\` from \`rltiles/mon/${path}.png\``),
    '',
  ].join('\n'),
);
console.log(`${SPRITES.length} sprites written to public/sprites/`);
