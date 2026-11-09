import type { Boon, Rarity, RoomKind, Slot, StatKey, Stats } from './types';

export const SAVE_VERSION = 4;

/**
 * The ship a brand-new player boards. Chosen because its first hatch is a plain fight
 * against a slow enemy that drops a weapon. A test checks this stays true.
 */
export const FIRST_RUN_SEED = 'first-218';
/** Below this share of max HP the interface warns the player. */
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

export interface Archetype {
  name: string;
  icon: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  minFloor: number;
}

/** Multipliers applied to the floor's baseline enemy. Ordered by first appearance. */
export const ARCHETYPES: readonly Archetype[] = [
  { name: 'Vent Crawler', icon: 'rat', hp: 0.7, atk: 0.8, def: 0, spd: 1.3, minFloor: 1 },
  { name: 'Spore Drifter', icon: 'floating-tentacles', hp: 0.6, atk: 0.7, def: 0, spd: 1.6, minFloor: 1 },
  { name: 'Maintenance Drone', icon: 'mono-wheel-robot', hp: 1, atk: 1, def: 1, spd: 1, minFloor: 1 },
  { name: 'Bio-Sludge', icon: 'slime', hp: 1.5, atk: 0.7, def: 0.5, spd: 0.7, minFloor: 1 },
  { name: 'Scav Raider', icon: 'bandit', hp: 0.9, atk: 1.1, def: 0.5, spd: 1.15, minFloor: 2 },
  { name: 'Husk Crewman', icon: 'shambling-zombie', hp: 1.2, atk: 1.15, def: 0.8, spd: 0.9, minFloor: 3 },
  { name: 'Loader Mech', icon: 'battle-mech', hp: 1.9, atk: 1, def: 2.5, spd: 0.6, minFloor: 4 },
  { name: 'Phase Stalker', icon: 'spectre', hp: 0.8, atk: 1.4, def: 0.3, spd: 1.25, minFloor: 5 },
  { name: 'Void Marauder', icon: 'pirate-skull', hp: 1.4, atk: 1.3, def: 1.2, spd: 0.95, minFloor: 6 },
  { name: 'Hive Warrior', icon: 'alien-bug', hp: 1.6, atk: 1.35, def: 1.8, spd: 0.85, minFloor: 8 },
  { name: 'Rogue Synth', icon: 'cyborg-face', hp: 1.1, atk: 1.7, def: 1, spd: 1.1, minFloor: 10 },
];

export const ELITE_PREFIXES = ['Overclocked', 'Armoured', 'Mutated', 'Prototype'] as const;
export const BOSS_NAMES = ['The Deck Warden', 'The Brood Queen', "The Captain's Husk", 'The Core Intelligence'] as const;

/** One per entry in BOSS_NAMES. */
export const BOSS_ICONS = ['robot-golem', 'alien-stare', 'captain-hat-profile', 'artificial-intelligence'] as const;
export const AMBUSH = { name: 'Crate Lurker', icon: 'mimic-chest' } as const;

export const KIND_SCALE = {
  normal: { hp: 1, atk: 1, xp: 1, gold: 1, parts: 1 },
  elite: { hp: 1.8, atk: 1.2, xp: 2, gold: 2, parts: 2 },
  boss: { hp: 2.6, atk: 1.15, xp: 4, gold: 5, parts: 5 },
} as const;

export const BOONS: readonly Boon[] = [
  { id: 'frame', icon: 'muscle-up', name: 'Reinforced Frame', desc: '+18 max HP', mods: { maxHp: 18 } },
  { id: 'servo', icon: 'targeting', name: 'Targeting Servo', desc: '+3 attack', mods: { atk: 3 } },
  { id: 'plating', icon: 'layered-armor', name: 'Subdermal Plating', desc: '+3 defence', mods: { def: 3 } },
  { id: 'reflex', icon: 'sprint', name: 'Reflex Booster', desc: '+8 speed', mods: { spd: 8 } },
  { id: 'optics', icon: 'cyber-eye', name: 'Optic Implant', desc: '+5% crit chance', mods: { crit: 5 } },
  { id: 'coil', icon: 'lightning-frequency', name: 'Overcharge Coil', desc: '+25% crit damage', mods: { critDmg: 25 } },
  { id: 'siphon', icon: 'nano-bot', name: 'Nanite Siphon', desc: '+3% life leech', mods: { leech: 3 } },
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
  { id: 'common', label: 'Salvaged', weight: 60, mult: 1, affixes: 0 },
  { id: 'uncommon', label: 'Refit', weight: 25, mult: 1.15, affixes: 1 },
  { id: 'rare', label: 'Military', weight: 10, mult: 1.3, affixes: 2 },
  { id: 'epic', label: 'Prototype', weight: 4, mult: 1.5, affixes: 3 },
  { id: 'legendary', label: 'Xenotech', weight: 1, mult: 1.8, affixes: 4 },
];

export const ITEM_BASES: Record<Slot, readonly string[]> = {
  weapon: ['Shock Baton', 'Rivet Gun', 'Pulse Pistol', 'Arc Cutter', 'Plasma Carbine', 'Rail Lance', 'Singularity Edge'],
  armour: ['Flight Suit', 'Scav Vest', 'Mesh Armour', 'Composite Plate', 'Powered Rig', 'Aegis Exo-Frame'],
  gadget: ['Cracked Chip', 'Signal Booster', 'Neural Link', 'Field Emitter', 'Quantum Core'],
};

/** Icon file names, one per entry in ITEM_BASES. See public/icons/CREDITS.md. */
export const ITEM_ICONS: Record<Slot, readonly string[]> = {
  weapon: ['telescopic-baton', 'pistol-gun', 'ray-gun', 'lightning-saber', 'laser-gun', 'rifle', 'energy-sword'],
  armour: ['hazmat-suit', 'leather-vest', 'kevlar-vest', 'armor-vest', 'chest-armor', 'space-suit'],
  gadget: ['microchip', 'radar-dish', 'circuitry', 'shield-reflect', 'atom-core'],
};

export const AFFIX_PREFIX: Record<StatKey, string> = {
  maxHp: 'Reinforced',
  atk: 'Overcharged',
  def: 'Shielded',
  spd: 'Lightweight',
  crit: 'Calibrated',
  critDmg: 'Volatile',
  leech: 'Siphoning',
};

export const STAT_LABEL: Record<StatKey, string> = {
  maxHp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  crit: '% crit',
  critDmg: '% crit dmg',
  leech: '% leech',
};

/** Weights for the doors offered mid-floor. Elites and the trader only appear from floor 2. */
export const DOOR_WEIGHTS: readonly (readonly [RoomKind, number])[] = [
  ['fight', 50],
  ['elite', 14],
  ['treasure', 9],
  ['shrine', 13],
  ['merchant', 12],
];

export const DOOR_TEXT: Record<RoomKind, { icon: string; title: string; hint: string }> = {
  fight: { icon: 'claw-slashes', title: 'Scratched hatch', hint: 'Something is moving on the other side. It stops when you stop. A fight.' },
  elite: { icon: 'dread-skull', title: 'Buckled bulkhead', hint: 'Bent outward, from the inside. Whatever did it is still in there. Dangerous, better salvage.' },
  treasure: { icon: 'cargo-crate', title: 'Cargo lock', hint: 'The manifest light is green. Someone sealed this in a hurry. Salvage, probably.' },
  shrine: { icon: 'medical-pack', title: 'Med bay', hint: 'An auto-surgeon on standby. Heal, or let it change you.' },
  merchant: { icon: 'trade', title: 'Lit compartment', hint: 'A light is on. Someone alive is in there, selling.' },
  boss: { icon: 'crowned-skull', title: 'Blast door', hint: 'Whatever holds this deck is behind it. There is no way round.' },
  stairs: { icon: 'elevator', title: 'Lift shaft', hint: 'The way down. The lift was called before you got here.' },
};

export const HIDDEN_DOOR = { icon: 'secret-door', title: 'Dead panel', hint: 'No power, no readout. You can hear breathing. It may be yours.' };

/** What you find when you open the med bay. One is chosen by where you are, so repeat visits read differently. */
export const SURGEON_LINES = [
  'An auto-surgeon unfolds from the ceiling. Its last patient is still on the table.',
  'The auto-surgeon is already running when you come in. It turns each of its arms toward you.',
  'An auto-surgeon waits over an empty table. The restraints are done up.',
] as const;

export const TRADER_LINES = [
  'A scavenger sits among the crates and does not look up. "You made more noise than the last one. Buy something."',
  'The scavenger has laid the stock out neatly. "I heard you two decks up," they say. "Buy something."',
  'A scavenger counts credits by lamplight. "Do not tell me what you saw down there. Buy something."',
] as const;

export interface Whisper {
  text: string;
  /** First deck this can appear on. */
  minFloor: number;
  /** Only when the salvager is badly hurt. */
  hurt?: boolean;
}

/**
 * Things the salvager notices between rooms. They change nothing in the game;
 * they are there to make the player doubt the ship, and then themselves.
 * `{kills}`, `{seed}`, `{floor}` and `{next}` are filled in from the run.
 */
export const WHISPERS: readonly Whisper[] = [
  { minFloor: 2, text: 'Somewhere below, something is knocking. Three, then a pause. Three, then a pause.' },
  { minFloor: 2, text: 'Your suit radio clicks twice. No carrier. No voice.' },
  { minFloor: 2, text: 'The air recyclers are off. You can still hear breathing.' },
  { minFloor: 2, text: 'The emergency lights dim as you pass, and come back up behind you.' },
  { minFloor: 2, text: 'Every chair in this compartment has been turned to face the hatch.' },
  { minFloor: 3, text: 'The deck plan on the wall shows this room twice.' },
  { minFloor: 3, text: 'Bootprints in the dust, your size. They lead the other way.' },
  { minFloor: 3, text: "A child's drawing is taped to the bulkhead. The figure in it is wearing your suit." },
  { minFloor: 4, text: 'Someone has scratched a tally into the wall. {kills} marks. It matches.' },
  { minFloor: 4, text: 'You count the hatches again. There is one more than there was.' },
  { minFloor: 4, text: 'The lift panel reads deck {next}. Then {floor}. Then it goes dark.' },
  { minFloor: 5, text: 'A crew locker with your name on it. It is not empty. You do not open it.' },
  { minFloor: 5, text: 'For a moment the hatch labels are in your handwriting.' },
  { minFloor: 6, text: 'The radio whispers a string of characters. It takes you a moment to recognise it: {seed}.' },
  { minFloor: 6, text: 'You pass a viewport. The reflection is a step behind you.' },
  { minFloor: 2, hurt: true, text: 'Your heartbeat is very loud. It takes a while to notice it is not in time with your pulse.' },
  { minFloor: 2, hurt: true, text: 'Something is keeping pace with you on the other side of the wall.' },
  { minFloor: 2, hurt: true, text: 'You are leaving a trail. You hope nothing is following it.' },
];

// ---------- Safe pod and workbench ----------

/** Share of max HP recovered by resting in a pod. Once per pod. */
export const POD_REST_HEAL = 0.15;

/** Parts gained by scrapping an item, on top of its credits. */
export const PARTS_BY_RARITY: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 4, epic: 7, legendary: 12 };

export const CRAFT = {
  /** Parts for one stim. */
  stim: 6,
  /** Parts to re-roll a worn item's stats, keeping its tier. */
  recalibrate: 4,
  /** Parts to fuse, on top of the items themselves. */
  fuse: 2,
  /** Items of one tier that fuse into one of the next. */
  fuseCount: 3,
  /** Parts for the first overclock of an item; each further one costs this much more. */
  overclock: 3,
  /** How many times one item can be overclocked. */
  overclockMax: 5,
  /** How much each overclock raises every stat on the item. */
  overclockGain: 1.15,
} as const;

/** What you find when the lift stops. Later ones suggest the pod is not as private as its label says. */
export const POD_LINES = [
  'The lift stops between decks. A maintenance pod opens off the shaft. The label on its hatch says SAFE.',
  'The pod seals behind you. For the first time since the airlock, nothing is moving.',
  'A safe pod. The workbench light is already on.',
  'The pod is warm. Someone has folded a blanket on the bench. You did not bring a blanket.',
  'A safe pod. There are scratches round the inside of the lock, low down, where a hand would reach from the floor.',
  'The pod seals. The camera in the corner turns to follow you, then looks away.',
] as const;
