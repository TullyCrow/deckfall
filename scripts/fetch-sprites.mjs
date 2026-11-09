// Downloads every sprite the game uses (hero, monsters, dungeon, gear) from Dungeon Crawl Stone Soup's tile set
// (https://github.com/crawl/crawl, tiles released under CC0) into public/sprites, and
// writes the credits file. Each name is checked against the project's list of tiles
// with unclear licensing (https://github.com/crawl/tiles), and any match stops the run.
//
//   node scripts/fetch-sprites.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TILES = 'https://raw.githubusercontent.com/crawl/crawl/master/crawl-ref/source/rltiles';
const UNCLEAR = 'https://raw.githubusercontent.com/crawl/tiles/master/TILES_UNDER_UNKNOWN_LICENSE.md';
const headers = { 'user-agent': 'DeckfallBuild/0.1 (https://github.com/TullyCrow/deckfall)' };

/** [path in the tile set, name used in the game]. The game refers to sprites only by the second. */
const SPRITES = [
  // The hero
  ['mon/humanoids/humans/imperial_myrmidon', 'hero'],
  // Monsters
  ['mon/animals/rat', 'rat'], ['mon/animals/bat', 'bat'], ['mon/undead/skeletal_warrior', 'skeleton'],
  ['mon/amorphous/jelly', 'ooze'], ['mon/demons/crimson_imp', 'imp'], ['mon/undead/ghoul', 'ghoul'],
  ['mon/nonliving/gargoyle', 'gargoyle'], ['mon/undead/shadow_wraith', 'wraith'], ['mon/animals/hell_hound', 'hound'],
  ['mon/humanoids/humans/death_knight', 'death_knight'], ['mon/undead/lich', 'lich'],
  ['mon/aberrations/crawling_flesh_cage0', 'mimic'],
  // Lords of each fifth depth
  ['mon/demons/executioner', 'flayer'], ['mon/animals/broodmother', 'broodmother'],
  ['mon/undead/ancient_champion', 'hollow_king'], ['mon/demons/brimstone_fiend', 'ashen_lord'],
  // Seen for an instant in the dark, further down
  ['mon/demons/reaper', 'reaper'], ['mon/demons/hellion', 'hellion'], ['mon/undead/revenant', 'revenant'],
  // The dungeon: one floor and one wall per region
  ['dngn/floor/crypt0', 'floor_cathedral'], ['dngn/wall/church0', 'wall_cathedral'],
  ['dngn/floor/cobble_blood1', 'floor_catacombs'], ['dngn/wall/catacombs0', 'wall_catacombs'],
  ['dngn/floor/grey_dirt0', 'floor_caves'], ['dngn/wall/lair0', 'wall_caves'],
  ['dngn/floor/demonic_red1', 'floor_hell'], ['dngn/wall/hell01', 'wall_hell'],
  // Things in rooms
  ['dngn/doors/closed_door', 'door'], ['dngn/doors/closed_door_crypt', 'door_barred'],
  ['dngn/gateways/metal_stairs_down', 'stairs'], ['dngn/gateways/enter_dis1', 'gate'],
  ['dngn/altars/ecumenical', 'altar'], ['dngn/decor/blood_fountain', 'fountain_blood'],
  ['dngn/decor/sparkling_fountain', 'fountain'], ['dngn/shops/shop_general', 'shop'],
  ['dngn/statues/statue_angel', 'statue_angel'], ['dngn/statues/statue_ancient_evil', 'statue_evil'],
  ['misc/blood/blood_puddle_red', 'blood'], ['item/gold/05', 'gold'], ['item/potion/ruby', 'potion'],
  // Weapons, weakest first
  ['item/weapon/dagger', 'dagger'], ['item/weapon/falchion1', 'falchion'], ['item/weapon/hand_axe1', 'hand_axe'],
  ['item/weapon/mace1', 'mace'], ['item/weapon/long_sword1', 'long_sword'], ['item/weapon/broad_axe1', 'broad_axe'],
  ['item/weapon/demon_blade', 'demon_blade'],
  // Armour, weakest first
  ['item/armour/robe1', 'robe'], ['item/armour/leather_armour1', 'leather_armour'], ['item/armour/ring_mail1', 'ring_mail'],
  ['item/armour/scale_mail1', 'scale_mail'], ['item/armour/chain_mail1', 'chain_mail'], ['item/armour/plate1', 'plate'],
  // Trinkets, weakest first
  ['item/ring/copper', 'copper_ring'], ['item/amulet/bone', 'bone_amulet'], ['item/ring/gold', 'gold_ring'],
  ['item/amulet/amethyst', 'amethyst_amulet'], ['item/ring/diamond', 'diamond_ring'],
];

const out = join(import.meta.dirname, '..', 'public', 'sprites');
mkdirSync(out, { recursive: true });

const unclear = await (await fetch(UNCLEAR, { headers })).text();
for (const [path, name] of SPRITES) {
  const file = path.split('/').pop();
  if (unclear.includes(`- ${file}.png`)) throw new Error(`${file}.png is on the unclear-licence list; choose another`);
  const response = await fetch(`${TILES}/${path}.png`, { headers });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  writeFileSync(join(out, `${name}.png`), Buffer.from(await response.arrayBuffer()));
}

writeFileSync(
  join(out, 'CREDITS.md'),
  [
    '# Sprite credits',
    '',
    'Every sprite in this folder (the hero, monsters, dungeon, and gear) is a tile from',
    '[Dungeon Crawl Stone Soup](https://github.com/crawl/crawl), drawn by its contributors and released under',
    '[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). They are used unmodified, under new file names.',
    'None is on the project\'s',
    '[list of tiles with unclear licensing](https://github.com/crawl/tiles/blob/master/TILES_UNDER_UNKNOWN_LICENSE.md).',
    '',
    ...SPRITES.map(([path, name]) => `- \`${name}.png\` from \`rltiles/${path}.png\``),
    '',
  ].join('\n'),
);
console.log(`${SPRITES.length} sprites written to public/sprites/`);
