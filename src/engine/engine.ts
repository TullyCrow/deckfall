import {
  AMBUSH,
  ARCHETYPES,
  BAG_SIZE,
  BASE_STATS,
  BOONS,
  BOSS_EVERY,
  BOSS_ICONS,
  BOSS_NAMES,
  CRAFT,
  DOOR_WEIGHTS,
  ELITE_PREFIXES,
  HIDDEN_DOOR_CHANCE,
  KIND_SCALE,
  LEVEL_UP_HEAL,
  LOG_CAP,
  LOW_HP,
  MIMIC_CHANCE,
  SHARDS_BY_RARITY,
  SANCTUM_LINES,
  SANCTUM_REST_HEAL,
  POTION_HEAL,
  ROOMS_PER_FLOOR,
  SAVE_VERSION,
  SHRINE_REST_HEAL,
  SHRINE_SACRIFICE_COST,
  START_POTIONS,
  STAT_CAPS,
  SHRINE_LINES,
  PEDDLER_LINES,
  WHISPERS,
  WRATH,
} from './data';
import { itemName, makeItem, nextRarity, temper } from './items';
import { createRng, hashSeed, type Rng } from './rng';
import {
  SLOTS,
  STAT_KEYS,
  type Action,
  type Cue,
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

/** Parts needed for this item's next temper. */
export function temperCost(item: Item): number {
  return CRAFT.temper * ((item.plus ?? 0) + 1);
}

export function isBossFloor(floor: number): boolean {
  return floor % BOSS_EVERY === 0;
}

// ---------- Public API ----------

/**
 * `returning` marks a retry of a dungeon the player has already died in. It changes
 * only the opening line, never the dungeon.
 */
export function newGame(seed: string, returning = false): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: hashSeed(seed),
    nextId: 1,
    logSeq: 0,
    floor: 1,
    room: 0,
    heard: [],
    sanctumPending: false,
    pendingBoons: 0,
    player: {
      level: 1,
      xp: 0,
      hp: BASE_STATS.maxHp,
      base: { ...BASE_STATS },
      equipment: { weapon: null, armour: null, trinket: null },
      bag: [],
      gold: 0,
      potions: START_POTIONS,
      shards: 0,
      wrath: 0,
    },
    phase: { type: 'doors', doors: [] },
    log: [],
    tally: { kills: 0, gold: 0, damage: 0, turns: 0 },
  };
  const rng = createRng(state.rng);
  say(
    state,
    returning
      ? 'The cathedral doors close behind you. You know these stones. They know you.'
      : 'The cathedral doors close behind you. Your torch finds the nave. Nothing answers.',
    'info',
  );
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
      say(d, `You drink. +${player.hp - before} life. The taste is copper.`, 'good', 'potion');
      // Injecting mid-fight costs your place in the turn order.
      if (phase.type === 'combat') phase.gauge = 0;
      return true;
    }

    case 'smite': {
      if (phase.type !== 'combat' || player.wrath < WRATH.max) return false;
      const stats = playerStats(player);
      const enemy = phase.enemy;
      player.wrath = 0;
      const { damage } = strike(rng, stats.atk * WRATH.smite, 0, 100, enemy.def);
      enemy.hp = Math.max(0, enemy.hp - damage);
      d.tally.damage += damage;
      say(d, `You smite the ${bare(enemy)} for ${damage}.`, 'hit', 'smite');
      if (enemy.hp === 0) win(d, phase, rng);
      return true;
    }

    case 'flee': {
      if (phase.type !== 'combat' || phase.enemy.kind === 'boss') return false;
      const enemy = phase.enemy;
      const odds = clamp(0.45 + (playerStats(player).spd - enemy.spd) / 300, 0.15, 0.9);
      if (rng.chance(odds)) {
        say(d, `You run. The ${enemy.name} does not follow. You do not look back to be sure.`, 'info');
        settle(d, rng);
      } else {
        say(d, `The ${enemy.name} is already between you and the door.`, 'bad');
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
      say(d, `You equip the ${itemName(item)}.`, 'info');
      if (phase.items.length === 0) settle(d, rng);
      return true;
    }

    case 'continue': {
      if (phase.type !== 'loot' && phase.type !== 'shrine' && phase.type !== 'merchant' && phase.type !== 'sanctum') return false;
      if (phase.type === 'sanctum') say(d, `You open the sanctum door. Depth ${d.floor} is waiting.`, 'info', 'door');
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
      const shards = SHARDS_BY_RARITY[item.rarity];
      gainGold(d, item.value);
      player.shards += shards;
      say(d, `You salvage the ${itemName(item)}: ${item.value} gold, ${shards} ${shards === 1 ? 'shard' : 'shards'}.`, 'loot');
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
      say(d, `Talent learned: ${boon.name} (${boon.desc}).`, 'good', 'talent');
      settle(d, rng);
      return true;
    }

    case 'shrine': {
      if (phase.type !== 'shrine') return false;
      const { maxHp } = playerStats(player);
      if (action.choice === 'rest') {
        const before = player.hp;
        player.hp = Math.min(maxHp, player.hp + Math.round(maxHp * SHRINE_REST_HEAL));
        say(d, `You kneel. Your wounds close. +${player.hp - before} life.`, 'good');
      } else {
        const cost = sacrificeCost(player);
        if (player.hp <= cost) return false;
        player.hp -= cost;
        d.pendingBoons++;
        say(d, `You cut your palm over the altar. -${cost} life. Something answers.`, 'bad');
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
      say(d, `You buy the ${entry.item.name} for ${entry.price} gold.`, 'loot');
      return true;
    }

    case 'rest': {
      if (phase.type !== 'sanctum' || phase.rested) return false;
      const { maxHp } = playerStats(player);
      if (player.hp >= maxHp) return false;
      const before = player.hp;
      player.hp = Math.min(maxHp, player.hp + Math.round(maxHp * SANCTUM_REST_HEAL));
      phase.rested = true;
      say(d, `You drink from the fountain and sit a while with your back to the door. +${player.hp - before} life.`, 'good');
      return true;
    }

    case 'craft': {
      if (phase.type !== 'sanctum') return false;
      switch (action.recipe) {
        case 'potion': {
          if (player.shards < CRAFT.potion) return false;
          player.shards -= CRAFT.potion;
          player.potions++;
          say(d, 'You brew a potion over the forge.', 'good', 'craft');
          return true;
        }
        case 'temper': {
          const item = player.equipment[action.slot];
          if (!item || (item.plus ?? 0) >= CRAFT.temperMax) return false;
          const cost = temperCost(item);
          if (player.shards < cost) return false;
          player.shards -= cost;
          temper(item, CRAFT.temperGain);
          say(d, `You temper it on the anvil: ${itemName(item)}.`, 'good', 'craft');
          return true;
        }
        case 'reforge': {
          const item = player.equipment[action.slot];
          if (!item || player.shards < CRAFT.reforge) return false;
          player.shards -= CRAFT.reforge;
          const fresh = makeItem(rng, d.nextId++, Math.max(item.level - (item.plus ?? 0), d.floor), 0, {
            slot: item.slot,
            rarity: item.rarity,
          });
          // Tempers are work already paid for, so they carry over to the new roll.
          for (let i = 0; i < (item.plus ?? 0); i++) temper(fresh, CRAFT.temperGain);
          player.equipment[action.slot] = fresh;
          player.hp = Math.min(player.hp, playerStats(player).maxHp);
          say(d, `You melt the ${item.name} down and forge it anew: ${itemName(fresh)}.`, 'good', 'craft');
          return true;
        }
        case 'transmute': {
          const better = nextRarity(action.rarity);
          const used = player.bag.filter((item) => item.rarity === action.rarity).slice(0, CRAFT.transmuteCount);
          if (!better || used.length < CRAFT.transmuteCount || player.shards < CRAFT.transmute) return false;
          player.shards -= CRAFT.transmute;
          player.bag = player.bag.filter((item) => !used.includes(item));
          const made = makeItem(rng, d.nextId++, d.floor, 0, { rarity: better });
          player.bag.push(made);
          say(d, `Three become one. You lift a ${made.name} from the coals.`, 'loot', 'craft');
          return true;
        }
      }
    }

    case 'buyPotion': {
      if (phase.type !== 'merchant' || player.gold < phase.potionPrice) return false;
      player.gold -= phase.potionPrice;
      player.potions++;
      say(d, `You buy a potion for ${phase.potionPrice} gold.`, 'loot');
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
  // The stair always passes a sanctum before it reaches the next depth.
  if (d.sanctumPending) {
    d.sanctumPending = false;
    say(d, SANCTUM_LINES[Math.min(SANCTUM_LINES.length - 1, Math.floor((d.floor - 2) / 2))] as string, 'info', 'door');
    d.phase = { type: 'sanctum', rested: false };
    return;
  }
  whisper(d);
  d.phase = { type: 'doors', doors: makeDoors(d, rng) };
}

/**
 * Sometimes adds an unsettling line before the next set of doors, more often the deeper you are.
 * It draws from its own generator, keyed to where you are in the run, so atmosphere can be
 * rewritten freely without changing how any seed plays.
 */
function whisper(d: GameState): void {
  if (d.floor < 2) return;
  const mood = createRng(hashSeed(`${d.seed}|whisper|${d.floor}|${d.room}|${d.tally.turns}`));
  if (!mood.chance(Math.min(0.55, 0.15 + 0.06 * d.floor))) return;
  const hurt = d.player.hp < playerStats(d.player).maxHp * LOW_HP;
  const options = WHISPERS.map((entry, index) => ({ entry, index })).filter(
    ({ entry, index }) => entry.minFloor <= d.floor && (!entry.hurt || hurt) && !d.heard.includes(index),
  );
  if (options.length === 0) return;
  // When hurt, the lines about being hurt come first.
  const urgent = options.filter(({ entry }) => entry.hurt);
  const { entry, index } = mood.pick(urgent.length > 0 ? urgent : options);
  d.heard.push(index);
  say(
    d,
    entry.text
      .replace('{kills}', String(d.tally.kills))
      .replace('{seed}', d.seed)
      .replace('{floor}', String(d.floor))
      .replace('{next}', String(d.floor + 1)),
    'eerie',
  );
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
        say(d, 'The chest opens its eyes.', 'bad');
        startCombat(d, makeEnemy(rng, d.floor, 'normal', AMBUSH), kind);
        break;
      }
      const gold = rng.int(8, 14) + 4 * d.floor;
      gainGold(d, gold);
      say(d, `A chest, its lock already broken. ${gold} gold, and something left behind.`, 'loot');
      const items = [newItem(d, rng, 0.6)];
      if (rng.chance(0.25)) items.push(newItem(d, rng, 0.6));
      announce(d, items);
      d.phase = { type: 'loot', items };
      break;
    }
    case 'shrine':
      say(d, SHRINE_LINES[(d.floor + d.room) % SHRINE_LINES.length] as string, 'info', 'door');
      d.phase = { type: 'shrine' };
      break;
    case 'merchant': {
      say(d, PEDDLER_LINES[(d.floor + d.room) % PEDDLER_LINES.length] as string, 'info', 'door');
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
  d.sanctumPending = true;
  say(d, `You take the stair down toward depth ${d.floor}.`, 'info');
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

  const maxHp = Math.round((22 + 9 * floor) * 1.075 ** floor * shape.hp * scale.hp);
  return {
    name,
    icon,
    kind,
    level: floor,
    hp: maxHp,
    maxHp,
    atk: Math.max(1, Math.round((4 + 1.5 * floor) * 1.055 ** floor * shape.atk * scale.atk)),
    def: Math.round(0.8 * floor * shape.def),
    spd: Math.round(90 * shape.spd),
    gauge: 0,
  };
}

function startCombat(d: GameState, enemy: Enemy, room: RoomKind): void {
  if (enemy.kind === 'boss') say(d, `${enemy.name} has been waiting for you.`, 'bad', 'door');
  else say(d, `${article(enemy)} ${enemy.name} turns to face you.`, enemy.kind === 'normal' ? 'info' : 'bad', 'door');
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
    d.player.wrath = Math.min(WRATH.max, d.player.wrath + WRATH.perHit);
    let line = isCrit ? `Critical hit! ${damage} damage` : `You hit for ${damage}`;
    if (stats.leech > 0 && d.player.hp < stats.maxHp) {
      const healed = Math.min(stats.maxHp - d.player.hp, Math.max(1, Math.round((damage * stats.leech) / 100)));
      d.player.hp += healed;
      line += `, stealing ${healed} life`;
    }
    say(d, `${line}.`, 'hit', isCrit ? 'crit' : undefined);
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
  d.player.wrath = Math.min(WRATH.max, d.player.wrath + WRATH.perWound);
  say(d, `The ${bare(enemy)} ${isCrit ? 'lands a brutal blow' : 'hits you'} for ${damage}.`, 'hurt');
  if (d.player.hp === 0) {
    say(d, `You fall on depth ${d.floor}. Your torch burns a while longer. Then it does not.`, 'bad', 'death');
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
  player.shards += scale.shards;
  say(
    d,
    `The ${bare(enemy)} dies. +${xp} XP, +${gold} gold, +${scale.shards} ${scale.shards === 1 ? 'shard' : 'shards'}.`,
    'good',
  );

  player.xp += xp;
  while (player.xp >= xpToNext(player.level)) {
    player.xp -= xpToNext(player.level);
    player.level++;
    d.pendingBoons++;
    const { maxHp } = playerStats(player);
    player.hp = Math.min(maxHp, player.hp + Math.round(maxHp * LEVEL_UP_HEAL));
    say(d, `Level ${player.level}. You may learn a talent.`, 'good');
  }

  const items: Item[] = [];
  if (enemy.kind === 'boss') items.push(newItem(d, rng, 1.2), newItem(d, rng, 1.2));
  else if (enemy.kind === 'elite') items.push(newItem(d, rng, 0.8));
  // A lurker was sitting on the crate's contents, so it always drops them.
  else if (phase.room === 'treasure') items.push(newItem(d, rng, 0.6));
  else if (rng.chance(0.35)) items.push(newItem(d, rng, 0));

  if (enemy.kind === 'boss') descend(d);
  announce(d, items);

  if (items.length > 0) d.phase = { type: 'loot', items };
  else settle(d, rng);
}

/** A Legendary or Mythic find gets its own line in the log, and its own sound. */
function announce(d: GameState, items: Item[]): void {
  const best = items.find((item) => item.rarity === 'legendary') ?? items.find((item) => item.rarity === 'epic');
  if (best) say(d, `A pillar of light. ${best.name}.`, 'loot', 'drop');
}

// ---------- Helpers ----------

function gainGold(d: GameState, amount: number): void {
  d.player.gold += amount;
  d.tally.gold += amount;
}

function say(d: GameState, text: string, tone: LogTone, cue?: Cue): void {
  d.log.push({ id: d.logSeq++, text: text.trimStart(), tone, ...(cue ? { cue } : {}) });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
