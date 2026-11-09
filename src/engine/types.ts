export const STAT_KEYS = ['maxHp', 'atk', 'def', 'spd', 'crit', 'critDmg', 'leech'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;
export type Mods = Partial<Stats>;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const SLOTS = ['weapon', 'armour', 'gadget'] as const;
export type Slot = (typeof SLOTS)[number];

export interface Item {
  id: number;
  name: string;
  /** File name (without extension) of the picture in public/icons. */
  icon: string;
  slot: Slot;
  rarity: Rarity;
  level: number;
  mods: Mods;
  /** Gold received when sold. */
  value: number;
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
}

export type LogTone = 'info' | 'good' | 'bad' | 'loot' | 'hit' | 'hurt';

export interface LogEntry {
  id: number;
  text: string;
  tone: LogTone;
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
  | { type: 'takeLoot'; index: number }
  | { type: 'equipLoot'; index: number }
  | { type: 'continue' }
  | { type: 'equip'; itemId: number }
  | { type: 'sell'; itemId: number }
  | { type: 'chooseBoon'; index: number }
  | { type: 'shrine'; choice: ShrineChoice }
  | { type: 'buy'; index: number }
  | { type: 'buyPotion' };
