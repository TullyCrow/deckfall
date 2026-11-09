import type { Boon, Rarity, RoomKind, Slot, StatKey, Stats } from './types';

export const SAVE_VERSION = 2;

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
  normal: { hp: 1, atk: 1, xp: 1, gold: 1 },
  elite: { hp: 1.8, atk: 1.2, xp: 2, gold: 2 },
  boss: { hp: 2.6, atk: 1.15, xp: 4, gold: 5 },
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
  fight: { icon: 'claw-slashes', title: 'Scratched hatch', hint: 'Something moves behind it. A fight.' },
  elite: { icon: 'dread-skull', title: 'Buckled bulkhead', hint: 'Bent outward from inside. A dangerous foe, better salvage.' },
  treasure: { icon: 'cargo-crate', title: 'Cargo lock', hint: 'The manifest light is still green. Salvage, probably.' },
  shrine: { icon: 'medical-pack', title: 'Med bay', hint: 'An auto-surgeon on standby power. Patch up, or upgrade.' },
  merchant: { icon: 'trade', title: 'Lit compartment', hint: 'A trade beacon pings. A scavenger with stock to sell.' },
  boss: { icon: 'crowned-skull', title: 'Blast door', hint: 'Whatever holds this deck is behind it. There is no way round.' },
  stairs: { icon: 'elevator', title: 'Lift shaft', hint: 'The way down to the next deck.' },
};

export const HIDDEN_DOOR = { icon: 'secret-door', title: 'Dead panel', hint: 'No power, no readout. It could be anything.' };
