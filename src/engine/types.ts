export const STAT_KEYS = ['maxHp', 'atk', 'def', 'spd', 'crit', 'critDmg', 'leech'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;
export type Mods = Partial<Stats>;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const SLOTS = ['weapon', 'armour', 'trinket'] as const;
export type Slot = (typeof SLOTS)[number];

export interface Item {
  id: number;
  name: string;
  /** File name (without extension) of the sprite in public/sprites. */
  icon: string;
  slot: Slot;
  rarity: Rarity;
  level: number;
  mods: Mods;
  /** Gold received when sold. */
  value: number;
  /** Times this item has been tempered at an anvil. Shown as "+N" after its name. */
  plus?: number;
}

export type EnemyKind = 'normal' | 'elite' | 'boss';

export interface Enemy {
  name: string;
  icon: string;
  kind: EnemyKind;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** Fills at `spd` per unit of time; the enemy acts at 100. */
  gauge: number;
}

export type RoomKind = 'fight' | 'elite' | 'treasure' | 'shrine' | 'merchant' | 'boss' | 'stairs';

export interface Door {
  kind: RoomKind;
  /** Unmarked doors do not tell the player what is behind them. */
  hidden: boolean;
}

export interface Boon {
  id: string;
  name: string;
  icon: string;
  desc: string;
  mods: Mods;
}

export interface ShopEntry {
  item: Item;
  price: number;
}

export type Phase =
  | { type: 'doors'; doors: Door[] }
  | { type: 'combat'; enemy: Enemy; room: RoomKind; gauge: number }
  | { type: 'loot'; items: Item[] }
  | { type: 'boon'; choices: string[] }
  | { type: 'shrine' }
  | { type: 'merchant'; stock: ShopEntry[]; potionPrice: number }
  | { type: 'sanctum'; rested: boolean }
  | { type: 'dead'; killedBy: string };

export interface Player {
  level: number;
  xp: number;
  hp: number;
  /** Stats before equipment. Boons are added here. */
  base: Stats;
  equipment: Record<Slot, Item | null>;
  bag: Item[];
  gold: number;
  potions: number;
  /** Crafting material, from salvaging gear and from kills. Spent at a sanctum's anvil. */
  shards: number;
  /** Builds as blows are traded; spent all at once on a Smite. 0 to WRATH.max. */
  wrath: number;
}

/** `eerie` lines are atmosphere only: things the hero notices, or thinks they notice. */
export type LogTone = 'info' | 'good' | 'bad' | 'loot' | 'hit' | 'hurt' | 'eerie';

/** A hint to the interface about what a line should sound like, where its tone alone does not say. */
export type Cue = 'door' | 'crit' | 'potion' | 'talent' | 'death' | 'craft' | 'smite' | 'drop';

export interface LogEntry {
  id: number;
  text: string;
  tone: LogTone;
  cue?: Cue;
}

export interface Tally {
  kills: number;
  gold: number;
  damage: number;
  turns: number;
}

export interface GameState {
  version: number;
  seed: string;
  /** Current PRNG state. Saved with the game so a reload continues the same run. */
  rng: number;
  nextId: number;
  logSeq: number;
  floor: number;
  /** Rooms entered on the current floor. */
  room: number;
  /** Indexes into WHISPERS already used this run, so none repeats. */
  heard: number[];
  /** The hero has gone down a level and has not yet visited the sanctum on the way. */
  sanctumPending: boolean;
  /** Boon picks the player is still owed. */
  pendingBoons: number;
  player: Player;
  phase: Phase;
  log: LogEntry[];
  tally: Tally;
}

export type ShrineChoice = 'rest' | 'sacrifice';

export type Action =
  | { type: 'chooseDoor'; index: number }
  | { type: 'advance' }
  | { type: 'drinkPotion' }
  | { type: 'flee' }
  | { type: 'smite' }
  | { type: 'takeLoot'; index: number }
  | { type: 'equipLoot'; index: number }
  | { type: 'continue' }
  | { type: 'equip'; itemId: number }
  | { type: 'sell'; itemId: number }
  | { type: 'chooseBoon'; index: number }
  | { type: 'shrine'; choice: ShrineChoice }
  | { type: 'buy'; index: number }
  | { type: 'buyPotion' }
  | { type: 'rest' }
  | { type: 'craft'; recipe: 'potion' }
  | { type: 'craft'; recipe: 'temper' | 'reforge'; slot: Slot }
  | { type: 'craft'; recipe: 'transmute'; rarity: Rarity };
