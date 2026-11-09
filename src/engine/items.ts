import { AFFIX_PREFIX, ITEM_BASES, ITEM_ICONS, RARITIES, type RarityDef } from './data';
import type { Rng } from './rng';
import { SLOTS, STAT_KEYS, type Item, type Mods, type Slot, type StatKey } from './types';

/** Size of one stat line at a given item level, before rarity and roll variance. */
const AFFIX_VALUE: Record<StatKey, (level: number) => number> = {
  maxHp: (l) => 5 + 2.5 * l,
  atk: (l) => 1 + 0.5 * l,
  def: (l) => 0.5 + 0.3 * l,
  spd: (l) => Math.min(3 + 0.25 * l, 12),
  crit: (l) => Math.min(2 + 0.15 * l, 8),
  critDmg: (l) => 8 + 0.8 * l,
  leech: (l) => Math.min(1 + 0.08 * l, 4),
};

const GADGET_STATS: readonly StatKey[] = ['spd', 'crit', 'critDmg', 'leech', 'maxHp', 'atk'];

/** `luck` shifts weight toward the higher tiers: each tier gains (1 + luck)^tier. */
export function rollRarity(rng: Rng, luck = 0): RarityDef {
  return rng.weighted(RARITIES.map((r, tier) => [r, r.weight * (1 + luck) ** tier] as const));
}

function addMod(mods: Mods, key: StatKey, amount: number): void {
  mods[key] = (mods[key] ?? 0) + Math.max(1, Math.round(amount));
}

export function makeItem(rng: Rng, id: number, floor: number, luck = 0): Item {
  const slot: Slot = rng.pick(SLOTS);
  const rarity = rollRarity(rng, luck);
  const level = Math.max(1, floor + rng.int(-1, 1));
  const roll = () => rng.range(0.85, 1.15) * rarity.mult;
  const mods: Mods = {};

  if (slot === 'weapon') {
    addMod(mods, 'atk', (3 + 1.4 * level) * roll());
  } else if (slot === 'armour') {
    addMod(mods, 'maxHp', (12 + 6 * level) * roll());
    addMod(mods, 'def', (1 + 0.7 * level) * roll());
  } else {
    const key = rng.pick(GADGET_STATS);
    addMod(mods, key, AFFIX_VALUE[key](level) * 1.6 * roll());
  }

  const pool: StatKey[] = [...STAT_KEYS];
  let prefix = '';
  for (let i = 0; i < rarity.affixes && pool.length > 0; i++) {
    const [key] = pool.splice(rng.int(0, pool.length - 1), 1) as [StatKey];
    addMod(mods, key, AFFIX_VALUE[key](level) * roll());
    if (i === 0) prefix = `${AFFIX_PREFIX[key]} `;
  }

  const bases = ITEM_BASES[slot];
  const tier = Math.min(bases.length - 1, Math.floor(level / 3));
  const base = bases[tier] as string;

  return {
    id,
    name: prefix + base,
    icon: ITEM_ICONS[slot][tier] as string,
    slot,
    rarity: rarity.id,
    level,
    mods,
    value: Math.round((4 + 2.5 * level) * rarity.mult * rarity.mult),
  };
}

const SCORE_WEIGHT: Record<StatKey, number> = {
  maxHp: 0.5,
  atk: 4,
  def: 3,
  spd: 0.6,
  crit: 2,
  critDmg: 0.3,
  leech: 4,
};

/** Rough single-number worth of an item. Used by the bot and to flag upgrades in the UI. */
export function itemScore(item: Item | null): number {
  if (!item) return 0;
  return STAT_KEYS.reduce((sum, key) => sum + (item.mods[key] ?? 0) * SCORE_WEIGHT[key], 0);
}
