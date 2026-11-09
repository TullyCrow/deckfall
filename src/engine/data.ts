import type { Boon, Rarity, RoomKind, Slot, StatKey, Stats } from './types';

export const SAVE_VERSION = 5;

/**
 * The dungeon a brand-new player enters. Chosen because its first door is a plain fight
 * against a slow monster that drops a weapon. A test checks this stays true.
 */
export const FIRST_RUN_SEED = 'first-218';
/** Below this share of max life the interface warns the player. */
export const LOW_HP = 0.35;
export const ROOMS_PER_FLOOR = 3;
export const BOSS_EVERY = 5;
export const BAG_SIZE = 10;
export const LOG_CAP = 80;

export const POTION_HEAL = 0.4;
export const START_POTIONS = 2;
export const LEVEL_UP_HEAL = 0.25;
export const SHRINE_REST_HEAL = 0.5;
export const SHRINE_SACRIFICE_COST = 0.2;
export const MIMIC_CHANCE = 0.15;
export const HIDDEN_DOOR_CHANCE = 0.25;

export const BASE_STATS: Stats = {
  maxHp: 60,
  atk: 8,
  def: 2,
  spd: 100,
  crit: 5,
  critDmg: 150,
  leech: 0,
};

export const STAT_CAPS: Partial<Record<StatKey, number>> = { crit: 75, leech: 40 };

/**
 * Wrath: the hero's second resource. It builds as blows are traded and is spent,
 * all at once, on a Smite. This is the one thing in a fight the player must time.
 */
export const WRATH = {
  max: 100,
  /** Gained each time the hero lands a blow. */
  perHit: 9,
  /** Gained each time the hero is struck. */
  perWound: 6,
  /** A Smite hits for this many times a normal blow. */
  smite: 2.5,
} as const;

/** The dungeon changes as you go down. Each region has its own stone and its own name. */
export const REGIONS = [
  { id: 'cathedral', name: 'Cathedral', from: 1 },
  { id: 'catacombs', name: 'Catacombs', from: 5 },
  { id: 'caves', name: 'Caves', from: 10 },
  { id: 'hell', name: 'Hell', from: 15 },
] as const;

export function regionOf(floor: number): (typeof REGIONS)[number] {
  return [...REGIONS].reverse().find((region) => floor >= region.from) ?? REGIONS[0];
}

export interface Archetype {
  name: string;
  /** Sprite file name in public/sprites, without extension. */
  icon: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  minFloor: number;
}

/** Multipliers applied to the floor's baseline monster. Ordered by first appearance. */
export const ARCHETYPES: readonly Archetype[] = [
  { name: 'Carrion Rat', icon: 'rat', hp: 0.7, atk: 0.8, def: 0, spd: 1.3, minFloor: 1 },
  { name: 'Grave Bat', icon: 'bat', hp: 0.6, atk: 0.7, def: 0, spd: 1.6, minFloor: 1 },
  { name: 'Skeleton', icon: 'skeleton', hp: 1, atk: 1, def: 1, spd: 1, minFloor: 1 },
  { name: 'Blood Ooze', icon: 'ooze', hp: 1.5, atk: 0.7, def: 0.5, spd: 0.7, minFloor: 1 },
  { name: 'Ember Imp', icon: 'imp', hp: 0.9, atk: 1.1, def: 0.5, spd: 1.15, minFloor: 2 },
  { name: 'Ghoul', icon: 'ghoul', hp: 1.2, atk: 1.15, def: 0.8, spd: 0.9, minFloor: 3 },
  { name: 'Gargoyle', icon: 'gargoyle', hp: 1.9, atk: 1, def: 2.5, spd: 0.6, minFloor: 4 },
  { name: 'Wraith', icon: 'wraith', hp: 0.8, atk: 1.4, def: 0.3, spd: 1.25, minFloor: 5 },
  { name: 'Hell Hound', icon: 'hound', hp: 1.4, atk: 1.3, def: 1.2, spd: 0.95, minFloor: 6 },
  { name: 'Death Knight', icon: 'death_knight', hp: 1.6, atk: 1.35, def: 1.8, spd: 0.85, minFloor: 8 },
  { name: 'Lich', icon: 'lich', hp: 1.1, atk: 1.7, def: 1, spd: 1.1, minFloor: 10 },
];

export const ELITE_PREFIXES = ['Frenzied', 'Ironhide', 'Plagued', 'Ancient'] as const;
export const BOSS_NAMES = ['The Flayer', 'The Mother of Webs', 'The Hollow King', 'The Ashen Lord'] as const;

/** One per entry in BOSS_NAMES. */
export const BOSS_ICONS = ['flayer', 'broodmother', 'hollow_king', 'ashen_lord'] as const;
export const AMBUSH = { name: 'Mimic', icon: 'mimic' } as const;

export const KIND_SCALE = {
  normal: { hp: 1, atk: 1, xp: 1, gold: 1, shards: 1 },
  elite: { hp: 1.8, atk: 1.2, xp: 2, gold: 2, shards: 2 },
  boss: { hp: 2.6, atk: 1.15, xp: 4, gold: 5, shards: 5 },
} as const;

/** Talents: one is chosen at every level, and at a shrine for a price in blood. */
export const BOONS: readonly Boon[] = [
  { id: 'vitality', icon: 'heart-beats', name: 'Vitality', desc: '+18 life', mods: { maxHp: 18 } },
  { id: 'might', icon: 'muscle-up', name: 'Might', desc: '+3 attack', mods: { atk: 3 } },
  { id: 'iron-skin', icon: 'layered-armor', name: 'Iron Skin', desc: '+3 defence', mods: { def: 3 } },
  { id: 'haste', icon: 'sprint', name: 'Haste', desc: '+8 speed', mods: { spd: 8 } },
  { id: 'precision', icon: 'targeting', name: 'Precision', desc: '+5% critical chance', mods: { crit: 5 } },
  { id: 'savagery', icon: 'bloody-sword', name: 'Savagery', desc: '+25% critical damage', mods: { critDmg: 25 } },
  { id: 'bloodthirst', icon: 'heart-drop', name: 'Bloodthirst', desc: '+3% life steal', mods: { leech: 3 } },
];

export interface RarityDef {
  id: Rarity;
  label: string;
  weight: number;
  /** Multiplier on every stat the item rolls. */
  mult: number;
  /** Extra stat lines on top of the slot's own. */
  affixes: number;
}

export const RARITIES: readonly RarityDef[] = [
  { id: 'common', label: 'Normal', weight: 60, mult: 1, affixes: 0 },
  { id: 'uncommon', label: 'Magic', weight: 25, mult: 1.15, affixes: 1 },
  { id: 'rare', label: 'Rare', weight: 10, mult: 1.3, affixes: 2 },
  { id: 'epic', label: 'Legendary', weight: 4, mult: 1.5, affixes: 3 },
  { id: 'legendary', label: 'Mythic', weight: 1, mult: 1.8, affixes: 4 },
];

export const ITEM_BASES: Record<Slot, readonly string[]> = {
  weapon: ['Dagger', 'Falchion', 'Hand Axe', 'Mace', 'Long Sword', 'Broad Axe', 'Demon Blade'],
  armour: ['Robe', 'Leather Armour', 'Ring Mail', 'Scale Mail', 'Chain Mail', 'Plate Mail'],
  trinket: ['Copper Ring', 'Bone Amulet', 'Gold Ring', 'Amethyst Amulet', 'Diamond Ring'],
};

/** Sprite file names, one per entry in ITEM_BASES. See public/sprites/CREDITS.md. */
export const ITEM_ICONS: Record<Slot, readonly string[]> = {
  weapon: ['dagger', 'falchion', 'hand_axe', 'mace', 'long_sword', 'broad_axe', 'demon_blade'],
  armour: ['robe', 'leather_armour', 'ring_mail', 'scale_mail', 'chain_mail', 'plate'],
  trinket: ['copper_ring', 'bone_amulet', 'gold_ring', 'amethyst_amulet', 'diamond_ring'],
};

export const AFFIX_PREFIX: Record<StatKey, string> = {
  maxHp: 'Stalwart',
  atk: 'Cruel',
  def: 'Sturdy',
  spd: 'Swift',
  crit: 'Deadly',
  critDmg: 'Savage',
  leech: 'Vampiric',
};

export const STAT_LABEL: Record<StatKey, string> = {
  maxHp: 'life',
  atk: 'attack',
  def: 'defence',
  spd: 'speed',
  crit: '% critical chance',
  critDmg: '% critical damage',
  leech: '% life steal',
};

/** Weights for the doors offered mid-floor. Elites and the peddler only appear from floor 2. */
export const DOOR_WEIGHTS: readonly (readonly [RoomKind, number])[] = [
  ['fight', 50],
  ['elite', 14],
  ['treasure', 9],
  ['shrine', 13],
  ['merchant', 12],
];

export const DOOR_TEXT: Record<RoomKind, { icon: string; title: string; hint: string }> = {
  fight: { icon: 'claw-slashes', title: 'Scratched door', hint: 'Something moves behind it. A fight.' },
  elite: { icon: 'dread-skull', title: 'Barred door', hint: 'Barred from this side, and for good reason. A champion. Better loot.' },
  treasure: { icon: 'locked-chest', title: 'Gilded door', hint: 'Gold glints under the frame. Treasure, most likely.' },
  shrine: { icon: 'holy-symbol', title: 'Chapel door', hint: 'Candlelight. A shrine: be healed, or bargain in blood.' },
  merchant: { icon: 'two-coins', title: 'Lamplit door', hint: 'Someone is humming. A peddler, alive, with wares.' },
  boss: { icon: 'crowned-skull', title: 'The great gate', hint: 'The lord of this depth waits behind it. There is no way round.' },
  stairs: { icon: 'stairs', title: 'Stairs down', hint: 'The way down. The dark below is warmer than it should be.' },
};

export const HIDDEN_DOOR = { icon: 'secret-door', title: 'Unmarked door', hint: 'No light, no sound. Anything could be behind it.' };

/** What you find in the chapel. One is chosen by where you are, so repeat visits read differently. */
export const SHRINE_LINES = [
  'A shrine, its candles still burning. No one has been here to light them.',
  'The shrine is wet. It is not water.',
  'A saint whose face has been chiselled away holds out both hands.',
] as const;

export const PEDDLER_LINES = [
  'A peddler sits among the bones and does not look up. "Coin first. Then we talk."',
  'The peddler has laid the wares out on a tomb lid. "I heard you two levels up. Buy something."',
  'A peddler counts gold by candlelight. "Do not tell me what you saw below. Buy something."',
] as const;

export interface Whisper {
  text: string;
  /** First depth this can appear on. */
  minFloor: number;
  /** Only when the hero is badly hurt. */
  hurt?: boolean;
}

/**
 * Things the hero notices between rooms. They change nothing in the game;
 * they are there to make the player uneasy about the place, and then about themselves.
 * `{kills}`, `{seed}`, `{floor}` and `{next}` are filled in from the run.
 */
export const WHISPERS: readonly Whisper[] = [
  { minFloor: 2, text: 'Somewhere below, a bell tolls. Three, then a pause. Three, then a pause.' },
  { minFloor: 2, text: 'Your torch gutters, though the air is still.' },
  { minFloor: 2, text: 'The dead in the wall niches all lie facing the stair you came down.' },
  { minFloor: 2, text: 'Wax has pooled under an empty sconce. It is still warm.' },
  { minFloor: 2, text: 'Something is praying on the other side of the wall. You do not know the language.' },
  { minFloor: 3, text: 'You pass the same cracked flagstone a second time.' },
  { minFloor: 3, text: 'Footprints in the dust, your size. They lead the other way.' },
  { minFloor: 3, text: 'A fresco shows a figure descending a stair with a torch. The paint is wet.' },
  { minFloor: 4, text: 'Someone has scratched a tally into the stone. {kills} marks. It matches.' },
  { minFloor: 4, text: 'You count the doors again. There is one more than there was.' },
  { minFloor: 4, text: 'A voice counts under its breath as you walk: {floor}. {next}.' },
  { minFloor: 5, text: 'A tomb with your name cut into the lid. The date has not been filled in.' },
  { minFloor: 5, text: 'For a moment the inscriptions are in your own hand.' },
  { minFloor: 6, text: 'A whisper spells something out, letter by letter. It takes you a moment to know it: {seed}.' },
  { minFloor: 6, text: 'Your shadow reaches the far wall before you do.' },
  { minFloor: 2, hurt: true, text: 'Your heartbeat is very loud. After a while you notice it is not keeping time with your pulse.' },
  { minFloor: 2, hurt: true, text: 'Something keeps pace with you on the other side of the wall.' },
  { minFloor: 2, hurt: true, text: 'You are leaving a trail of blood. You hope nothing is following it.' },
];

// ---------- Sanctum and anvil ----------

/** Share of max life recovered by resting in a sanctum. Once per sanctum. */
export const SANCTUM_REST_HEAL = 0.15;

/** Shards gained by salvaging an item, on top of its gold. */
export const SHARDS_BY_RARITY: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 4, epic: 7, legendary: 12 };

export const CRAFT = {
  /** Shards to brew one potion. */
  potion: 6,
  /** Shards to re-roll a worn item's stats, keeping its tier. */
  reforge: 4,
  /** Shards to transmute, on top of the items themselves. */
  transmute: 2,
  /** Items of one tier that transmute into one of the next. */
  transmuteCount: 3,
  /** Shards for the first tempering of an item; each further one costs this much more. */
  temper: 3,
  /** How many times one item can be tempered. */
  temperMax: 5,
  /** How much each tempering raises every stat on the item. */
  temperGain: 1.15,
} as const;

/** What you find where the stair turns. Later ones suggest the sanctum is not as untouched as it looks. */
export const SANCTUM_LINES = [
  'Where the stair turns there is a side chapel no one has defiled. A fountain still runs clear, and there is an anvil.',
  'The sanctum door closes behind you. For the first time since the cathedral, nothing is moving.',
  'A sanctum. The forge beside the anvil is already lit.',
  'The sanctum is warm. Someone has left a folded cloak on the bench. It is not yours.',
  'A sanctum. There are scratches round the inside of the door, low down, where a hand would reach from the floor.',
  'The sanctum door closes. The saint above the fountain has turned its head to watch you.',
] as const;
