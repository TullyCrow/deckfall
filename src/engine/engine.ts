import {
  AMBUSH,
  ARCHETYPES,
  BAG_SIZE,
  BASE_STATS,
  BOONS,
  BOSS_EVERY,
  BOSS_ICONS,
  BOSS_NAMES,
  DOOR_WEIGHTS,
  ELITE_PREFIXES,
  HIDDEN_DOOR_CHANCE,
  KIND_SCALE,
  LEVEL_UP_HEAL,
  LOG_CAP,
  MIMIC_CHANCE,
  POTION_HEAL,
  ROOMS_PER_FLOOR,
  SAVE_VERSION,
  SHRINE_REST_HEAL,
  SHRINE_SACRIFICE_COST,
  START_POTIONS,
  STAT_CAPS,
} from './data';
import { makeItem } from './items';
import { createRng, hashSeed, type Rng } from './rng';
import {
  SLOTS,
  STAT_KEYS,
  type Action,
  type Door,
  type Enemy,
  type EnemyKind,
  type GameState,
  type Item,
  type LogTone,
  type Phase,
  type Player,
  type RoomKind,
  type Stats,
} from './types';

type CombatPhase = Extract<Phase, { type: 'combat' }>;

// ---------- Derived values ----------

export function playerStats(player: Player): Stats {
  const stats: Stats = { ...player.base };
  for (const slot of SLOTS) {
    const item = player.equipment[slot];
    if (!item) continue;
    for (const key of STAT_KEYS) stats[key] += item.mods[key] ?? 0;
  }
  for (const key of STAT_KEYS) {
    const cap = STAT_CAPS[key];
    if (cap !== undefined) stats[key] = Math.min(stats[key], cap);
  }
  stats.spd = Math.max(20, stats.spd);
  return stats;
}

export function xpToNext(level: number): number {
  return Math.round(16 * level ** 1.4);
}

export function sacrificeCost(player: Player): number {
  return Math.round(playerStats(player).maxHp * SHRINE_SACRIFICE_COST);
}

export function isBossFloor(floor: number): boolean {
  return floor % BOSS_EVERY === 0;
}

// ---------- Public API ----------

export function newGame(seed: string): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: hashSeed(seed),
    nextId: 1,
    logSeq: 0,
    floor: 1,
    room: 0,
    pendingBoons: 0,
    player: {
      level: 1,
      xp: 0,
      hp: BASE_STATS.maxHp,
      base: { ...BASE_STATS },
      equipment: { weapon: null, armour: null, gadget: null },
      bag: [],
      gold: 0,
      potions: START_POTIONS,
    },
    phase: { type: 'doors', doors: [] },
    log: [],
    tally: { kills: 0, gold: 0, damage: 0, turns: 0 },
  };
  const rng = createRng(state.rng);
  say(state, 'The airlock seals behind you. Helmet lamp on. The derelict is silent.', 'info');
  state.phase = { type: 'doors', doors: makeDoors(state, rng) };
  state.rng = rng.state;
  return state;
}

/**
 * The only way the game changes. Pure: the same state and action always give
 * the same result. An action that is not allowed right now returns the very
 * same state object, so callers can detect a no-op by identity.
 */
export function reduce(state: GameState, action: Action): GameState {
  const draft = structuredClone(state);
  const rng = createRng(draft.rng);
  if (!apply(draft, action, rng)) return state;
  draft.rng = rng.state;
  if (draft.log.length > LOG_CAP) draft.log.splice(0, draft.log.length - LOG_CAP);
  return draft;
}

// ---------- Action handling ----------

function apply(d: GameState, action: Action, rng: Rng): boolean {
  const phase = d.phase;
  const player = d.player;
  const busy = phase.type === 'combat' || phase.type === 'dead';

  switch (action.type) {
    case 'chooseDoor': {
      if (phase.type !== 'doors') return false;
      const door = phase.doors[action.index];
      if (!door) return false;
      enterRoom(d, door.kind, rng);
      return true;
    }

    case 'advance': {
      if (phase.type !== 'combat') return false;
      combatStep(d, phase, rng);
      return true;
    }

    case 'drinkPotion': {
      if (phase.type === 'dead') return false;
      const { maxHp } = playerStats(player);
      if (player.potions <= 0 || player.hp >= maxHp) return false;
      const before = player.hp;
      player.potions--;
      player.hp = Math.min(maxHp, player.hp + Math.round(maxHp * POTION_HEAL));
      say(d, `You inject a stim and recover ${player.hp - before} HP.`, 'good');
      // Injecting mid-fight costs your place in the turn order.
      if (phase.type === 'combat') phase.gauge = 0;
      return true;
    }

    case 'flee': {
      if (phase.type !== 'combat' || phase.enemy.kind === 'boss') return false;
      const enemy = phase.enemy;
      const odds = clamp(0.45 + (playerStats(player).spd - enemy.spd) / 300, 0.15, 0.9);
      if (rng.chance(odds)) {
        say(d, `You slip away from the ${enemy.name}.`, 'info');
        settle(d, rng);
      } else {
        say(d, `The ${enemy.name} cuts off your escape.`, 'bad');
        enemy.gauge = 0;
        enemyAttack(d, phase, rng);
      }
      return true;
    }

    case 'takeLoot': {
      if (phase.type !== 'loot') return false;
      const item = phase.items[action.index];
      if (!item || player.bag.length >= BAG_SIZE) return false;
      phase.items.splice(action.index, 1);
      player.bag.push(item);
      if (phase.items.length === 0) settle(d, rng);
      return true;
    }

    case 'equipLoot': {
      if (phase.type !== 'loot') return false;
      const item = phase.items[action.index];
      if (!item) return false;
      const previous = player.equipment[item.slot];
      // With a full pack the old piece stays on the floor in place of the new one.
      if (previous && player.bag.length >= BAG_SIZE) phase.items[action.index] = previous;
      else {
        phase.items.splice(action.index, 1);
        if (previous) player.bag.push(previous);
      }
      player.equipment[item.slot] = item;
      player.hp = Math.min(player.hp, playerStats(player).maxHp);
      say(d, `You equip the ${item.name}.`, 'info');
      if (phase.items.length === 0) settle(d, rng);
      return true;
    }

    case 'continue': {
      if (phase.type !== 'loot' && phase.type !== 'shrine' && phase.type !== 'merchant') return false;
      settle(d, rng);
      return true;
    }

    case 'equip': {
      if (busy) return false;
      const index = player.bag.findIndex((item) => item.id === action.itemId);
      const item = player.bag[index];
      if (!item) return false;
      const previous = player.equipment[item.slot];
      player.equipment[item.slot] = item;
      if (previous) player.bag[index] = previous;
      else player.bag.splice(index, 1);
      player.hp = Math.min(player.hp, playerStats(player).maxHp);
      say(d, `You equip the ${item.name}.`, 'info');
      return true;
    }

    case 'sell': {
      if (busy) return false;
      const index = player.bag.findIndex((item) => item.id === action.itemId);
      const item = player.bag[index];
      if (!item) return false;
      player.bag.splice(index, 1);
      gainGold(d, item.value);
      say(d, `You scrap the ${item.name} for ${item.value} credits.`, 'loot');
      return true;
    }

    case 'chooseBoon': {
      if (phase.type !== 'boon') return false;
      const boon = BOONS.find((b) => b.id === phase.choices[action.index]);
      if (!boon) return false;
      for (const key of STAT_KEYS) player.base[key] += boon.mods[key] ?? 0;
      // New max HP arrives filled, so Reinforced Frame is never a dead pick at low health.
      player.hp += boon.mods.maxHp ?? 0;
      d.pendingBoons--;
      say(d, `Augment installed: ${boon.name} (${boon.desc}).`, 'good');
      settle(d, rng);
      return true;
    }

    case 'shrine': {
      if (phase.type !== 'shrine') return false;
      const { maxHp } = playerStats(player);
      if (action.choice === 'rest') {
        const before = player.hp;
        player.hp = Math.min(maxHp, player.hp + Math.round(maxHp * SHRINE_REST_HEAL));
        say(d, `The auto-surgeon patches you up: +${player.hp - before} HP.`, 'good');
      } else {
        const cost = sacrificeCost(player);
        if (player.hp <= cost) return false;
        player.hp -= cost;
        d.pendingBoons++;
        say(d, `The auto-surgeon cuts deep (-${cost} HP) and fits something new.`, 'bad');
      }
      settle(d, rng);
      return true;
    }

    case 'buy': {
      if (phase.type !== 'merchant') return false;
      const entry = phase.stock[action.index];
      if (!entry || player.gold < entry.price || player.bag.length >= BAG_SIZE) return false;
      player.gold -= entry.price;
      phase.stock.splice(action.index, 1);
      player.bag.push(entry.item);
      say(d, `You buy the ${entry.item.name} for ${entry.price} credits.`, 'loot');
      return true;
    }

    case 'buyPotion': {
      if (phase.type !== 'merchant' || player.gold < phase.potionPrice) return false;
      player.gold -= phase.potionPrice;
      player.potions++;
      say(d, `You buy a stim for ${phase.potionPrice} credits.`, 'loot');
      return true;
    }
  }
}

// ---------- Rooms and floors ----------

/** Moves on once a room is finished: owed boon picks first, then the next doors. */
function settle(d: GameState, rng: Rng): void {
  if (d.pendingBoons > 0) {
    const pool = BOONS.map((b) => b.id);
    const choices: string[] = [];
    while (choices.length < 3) choices.push(...pool.splice(rng.int(0, pool.length - 1), 1));
    d.phase = { type: 'boon', choices };
    return;
  }
  d.phase = { type: 'doors', doors: makeDoors(d, rng) };
}

function makeDoors(d: GameState, rng: Rng): Door[] {
  if (d.room >= ROOMS_PER_FLOOR) {
    return [{ kind: isBossFloor(d.floor) ? 'boss' : 'stairs', hidden: false }];
  }
  // Deck 1 has no elites, and no trader either: you have nothing to spend yet.
  const pool = DOOR_WEIGHTS.filter(([kind]) => (kind !== 'elite' && kind !== 'merchant') || d.floor >= 2).map(
    ([kind, weight]) => [kind, weight] as [RoomKind, number],
  );
  const count = rng.chance(0.3) ? 2 : 3;
  const doors: Door[] = [];
  while (doors.length < count) {
    const kind = rng.weighted(pool);
    pool.splice(
      pool.findIndex(([k]) => k === kind),
      1,
    );
    doors.push({ kind, hidden: rng.chance(HIDDEN_DOOR_CHANCE) });
  }
  return doors;
}

function enterRoom(d: GameState, kind: RoomKind, rng: Rng): void {
  if (kind === 'stairs') {
    descend(d);
    settle(d, rng);
    return;
  }
  d.room++;
  switch (kind) {
    case 'fight':
      startCombat(d, makeEnemy(rng, d.floor, 'normal'), kind);
      break;
    case 'elite':
      startCombat(d, makeEnemy(rng, d.floor, 'elite'), kind);
      break;
    case 'boss':
      startCombat(d, makeEnemy(rng, d.floor, 'boss'), kind);
      break;
    case 'treasure': {
      if (rng.chance(MIMIC_CHANCE)) {
        say(d, 'The crate unfolds. It was never a crate.', 'bad');
        startCombat(d, makeEnemy(rng, d.floor, 'normal', AMBUSH), kind);
        break;
      }
      const gold = rng.int(8, 14) + 4 * d.floor;
      gainGold(d, gold);
      say(d, `You crack a cargo crate: ${gold} credits and something more.`, 'loot');
      const items = [newItem(d, rng, 0.6)];
      if (rng.chance(0.25)) items.push(newItem(d, rng, 0.6));
      d.phase = { type: 'loot', items };
      break;
    }
    case 'shrine':
      say(d, 'An auto-surgeon unfolds from the ceiling, arms twitching.', 'info');
      d.phase = { type: 'shrine' };
      break;
    case 'merchant': {
      say(d, 'A scavenger looks up from a crate. "Still breathing? Buy something."', 'info');
      const stock = [0, 1, 2].map(() => {
        const item = newItem(d, rng, 1);
        return { item, price: item.value * 4 };
      });
      d.phase = { type: 'merchant', stock, potionPrice: 18 + 4 * d.floor };
      break;
    }
  }
}

function descend(d: GameState): void {
  d.floor++;
  d.room = 0;
  say(d, `You ride the lift down to deck ${d.floor}.`, 'info');
}

function newItem(d: GameState, rng: Rng, luck: number): Item {
  return makeItem(rng, d.nextId++, d.floor, luck);
}

// ---------- Combat ----------

export function makeEnemy(rng: Rng, floor: number, kind: EnemyKind, override?: { name: string; icon: string }): Enemy {
  const scale = KIND_SCALE[kind];
  const eligible = ARCHETYPES.filter((a) => a.minFloor <= floor);
  // Only the five most recent archetypes, so early enemies retire as you go deeper.
  const base = rng.pick(eligible.slice(-5));
  const shape = kind === 'boss' ? { hp: 1, atk: 1, def: 1, spd: 1 } : base;

  let name: string = base.name;
  let icon: string = base.icon;
  if (override) ({ name, icon } = override);
  else if (kind === 'elite') name = `${rng.pick(ELITE_PREFIXES)} ${base.name}`;
  else if (kind === 'boss') {
    const index = Math.floor(floor / BOSS_EVERY) - 1;
    const bossName = BOSS_NAMES[index % BOSS_NAMES.length] as string;
    name = index >= BOSS_NAMES.length ? `${bossName}, Risen` : bossName;
    icon = BOSS_ICONS[index % BOSS_ICONS.length] as string;
  }

  const maxHp = Math.round((22 + 9 * floor) * 1.06 ** floor * shape.hp * scale.hp);
  return {
    name,
    icon,
    kind,
    level: floor,
    hp: maxHp,
    maxHp,
    atk: Math.max(1, Math.round((4 + 1.5 * floor) * 1.045 ** floor * shape.atk * scale.atk)),
    def: Math.round(0.8 * floor * shape.def),
    spd: Math.round(90 * shape.spd),
    gauge: 0,
  };
}

function startCombat(d: GameState, enemy: Enemy, room: RoomKind): void {
  say(d, `${article(enemy)} ${enemy.name} blocks the way.`, enemy.kind === 'normal' ? 'info' : 'bad');
  d.phase = { type: 'combat', enemy, room, gauge: 0 };
}

function article(enemy: Enemy): string {
  if (enemy.name.startsWith('The ')) return '';
  return /^[AEIOU]/.test(enemy.name) ? 'An' : 'A';
}

function strike(rng: Rng, atk: number, crit: number, critDmg: number, def: number) {
  let raw = atk * rng.range(0.85, 1.15);
  const isCrit = rng.chance(crit / 100);
  if (isCrit) raw *= critDmg / 100;
  const damage = Math.max(1, Math.round((raw * 50) / (50 + Math.max(0, def))));
  return { damage, isCrit };
}

/**
 * Runs the fight forward to whoever acts next and resolves that one action.
 * Both gauges fill at their owner's speed; the first to reach 100 acts.
 */
function combatStep(d: GameState, phase: CombatPhase, rng: Rng): void {
  const stats = playerStats(d.player);
  const enemy = phase.enemy;
  const playerWait = (100 - phase.gauge) / stats.spd;
  const enemyWait = (100 - enemy.gauge) / enemy.spd;
  d.tally.turns++;

  if (playerWait <= enemyWait) {
    enemy.gauge += playerWait * enemy.spd;
    phase.gauge = 0;
    const { damage, isCrit } = strike(rng, stats.atk, stats.crit, stats.critDmg, enemy.def);
    enemy.hp = Math.max(0, enemy.hp - damage);
    d.tally.damage += damage;
    let line = isCrit ? `Critical hit! ${damage} damage` : `You hit for ${damage}`;
    if (stats.leech > 0 && d.player.hp < stats.maxHp) {
      const healed = Math.min(stats.maxHp - d.player.hp, Math.max(1, Math.round((damage * stats.leech) / 100)));
      d.player.hp += healed;
      line += `, siphoning ${healed}`;
    }
    say(d, `${line}.`, 'hit');
    if (enemy.hp === 0) win(d, phase, rng);
  } else {
    phase.gauge += enemyWait * stats.spd;
    enemy.gauge = 0;
    enemyAttack(d, phase, rng);
  }
}

function enemyAttack(d: GameState, phase: CombatPhase, rng: Rng): void {
  const enemy = phase.enemy;
  const { damage, isCrit } = strike(rng, enemy.atk, 5, 150, playerStats(d.player).def);
  d.player.hp = Math.max(0, d.player.hp - damage);
  say(d, `The ${bare(enemy)} ${isCrit ? 'lands a brutal blow' : 'hits you'} for ${damage}.`, 'hurt');
  if (d.player.hp === 0) {
    say(d, `You go down on deck ${d.floor}. Your lamp flickers out.`, 'bad');
    d.phase = { type: 'dead', killedBy: enemy.name };
  }
}

function bare(enemy: Enemy): string {
  return enemy.name.replace(/^The /, '');
}

function win(d: GameState, phase: CombatPhase, rng: Rng): void {
  const enemy = phase.enemy;
  const scale = KIND_SCALE[enemy.kind];
  const player = d.player;
  d.tally.kills++;

  const xp = Math.round((8 + 4 * enemy.level) * scale.xp);
  const gold = Math.round((rng.int(3, 6) + 2 * enemy.level) * scale.gold);
  gainGold(d, gold);
  say(d, `The ${bare(enemy)} goes down. +${xp} XP, +${gold} credits.`, 'good');

  player.xp += xp;
  while (player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level++;
    d.pendingBoons++;
    const { maxHp } = playerStats(player);
    player.hp = Math.min(maxHp, player.hp + Math.round(maxHp * LEVEL_UP_HEAL));
    say(d, `Level ${player.level}. An augment slot opens.`, 'good');
  }

  const items: Item[] = [];
  if (enemy.kind === 'boss') items.push(newItem(d, rng, 1.2), newItem(d, rng, 1.2));
  else if (enemy.kind === 'elite') items.push(newItem(d, rng, 0.8));
  // A lurker was sitting on the crate's contents, so it always drops them.
  else if (phase.room === 'treasure') items.push(newItem(d, rng, 0.6));
  else if (rng.chance(0.35)) items.push(newItem(d, rng, 0));

  if (enemy.kind === 'boss') descend(d);

  if (items.length > 0) d.phase = { type: 'loot', items };
  else settle(d, rng);
}

// ---------- Helpers ----------

function gainGold(d: GameState, amount: number): void {
  d.player.gold += amount;
  d.tally.gold += amount;
}

function say(d: GameState, text: string, tone: LogTone): void {
  d.log.push({ id: d.logSeq++, text: text.trimStart(), tone });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
