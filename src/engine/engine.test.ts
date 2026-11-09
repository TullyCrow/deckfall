import { describe, expect, it } from 'vitest';
import { botAction, playOut } from './bot';
import { BAG_SIZE, CRAFT, FIRST_RUN_SEED, RARITIES } from './data';
import { newGame, playerStats, reduce } from './engine';
import { makeItem } from './items';
import { createRng, hashSeed } from './rng';
import type { GameState } from './types';

function playSteps(state: GameState, steps: number): GameState {
  for (let i = 0; i < steps && state.phase.type !== 'dead'; i++) state = reduce(state, botAction(state));
  return state;
}

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(hashSeed('cathedral'));
    const b = createRng(hashSeed('cathedral'));
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it('stays inside the requested integer range', () => {
    const rng = createRng(7);
    const rolls = Array.from({ length: 2000 }, () => rng.int(2, 5));
    expect(Math.min(...rolls)).toBe(2);
    expect(Math.max(...rolls)).toBe(5);
  });

  it('never picks a zero-weight entry', () => {
    const rng = createRng(11);
    for (let i = 0; i < 500; i++) expect(rng.weighted([['a', 0], ['b', 3]] as const)).toBe('b');
  });
});

describe('items', () => {
  it('rolls positive stats and the affix count its rarity promises', () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      const item = makeItem(rng, i, 1 + (i % 20), 1);
      const lines = Object.values(item.mods);
      const rarity = RARITIES.find((r) => r.id === item.rarity)!;
      expect(lines.every((value) => value >= 1)).toBe(true);
      // Affixes may land on a stat the slot already has, so this is an upper bound.
      expect(lines.length).toBeLessThanOrEqual(2 + rarity.affixes);
      expect(lines.length).toBeGreaterThanOrEqual(Math.max(1, rarity.affixes));
      expect(item.value).toBeGreaterThan(0);
    }
  });

  it('finds better tiers more often with luck', () => {
    const count = (luck: number) => {
      const rng = createRng(99);
      let rare = 0;
      for (let i = 0; i < 3000; i++) if (makeItem(rng, i, 5, luck).rarity !== 'common') rare++;
      return rare;
    };
    expect(count(1.5)).toBeGreaterThan(count(0));
  });
});

describe('engine', () => {
  it('replays a run exactly from the same seed', () => {
    expect(playSteps(newGame('replay'), 400)).toEqual(playSteps(newGame('replay'), 400));
  });

  it('gives different runs for different seeds', () => {
    expect(playSteps(newGame('one'), 200)).not.toEqual(playSteps(newGame('two'), 200));
  });

  it('continues identically after a save and load', () => {
    const midway = playSteps(newGame('save'), 150);
    const reloaded = JSON.parse(JSON.stringify(midway)) as GameState;
    expect(playSteps(reloaded, 150)).toEqual(playSteps(midway, 150));
  });

  it('returns the same object for an action that is not allowed', () => {
    const state = newGame('noop');
    expect(reduce(state, { type: 'advance' })).toBe(state);
    expect(reduce(state, { type: 'chooseDoor', index: 9 })).toBe(state);
    expect(reduce(state, { type: 'chooseBoon', index: 0 })).toBe(state);
  });

  it('does not mutate the state it is given', () => {
    const state = newGame('pure');
    const snapshot = JSON.stringify(state);
    reduce(state, { type: 'chooseDoor', index: 0 });
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('keeps health, gold and the bag within bounds for a whole run', () => {
    let state = newGame('bounds');
    for (let i = 0; i < 20_000 && state.phase.type !== 'dead'; i++) {
      state = reduce(state, botAction(state));
      expect(state.player.hp).toBeGreaterThanOrEqual(0);
      expect(state.player.hp).toBeLessThanOrEqual(playerStats(state.player).maxHp);
      expect(state.player.gold).toBeGreaterThanOrEqual(0);
      expect(state.player.bag.length).toBeLessThanOrEqual(BAG_SIZE);
    }
    expect(state.phase.type).toBe('dead');
  });

  it('swaps the worn item back into the bag when equipping', () => {
    let state = newGame('swap');
    const rng = createRng(1);
    const first = { ...makeItem(rng, 9001, 1), slot: 'weapon' as const };
    const second = { ...makeItem(rng, 9002, 1), slot: 'weapon' as const };
    state = { ...state, player: { ...state.player, bag: [first, second] } };
    state = reduce(state, { type: 'equip', itemId: 9001 });
    state = reduce(state, { type: 'equip', itemId: 9002 });
    expect(state.player.equipment.weapon?.id).toBe(9002);
    expect(state.player.bag.map((item) => item.id)).toEqual([9001]);
  });

  it('equips salvage straight from the floor and keeps the old piece', () => {
    let state = newGame('floor-equip');
    const rng = createRng(2);
    const worn = { ...makeItem(rng, 9001, 1), slot: 'weapon' as const };
    const found = { ...makeItem(rng, 9002, 1), slot: 'weapon' as const };
    const other = { ...makeItem(rng, 9003, 1), slot: 'armour' as const };
    state = {
      ...state,
      player: { ...state.player, equipment: { ...state.player.equipment, weapon: worn } },
      phase: { type: 'loot', items: [found, other] },
    };
    state = reduce(state, { type: 'equipLoot', index: 0 });
    expect(state.player.equipment.weapon?.id).toBe(9002);
    expect(state.player.bag.map((item) => item.id)).toEqual([9001]);
    expect(state.phase).toEqual({ type: 'loot', items: [other] });
    // Taking the last piece moves the run on.
    state = reduce(state, { type: 'equipLoot', index: 0 });
    expect(state.phase.type).not.toBe('loot');
  });

  it('offers no trader or elite on the first deck', () => {
    for (let i = 0; i < 200; i++) {
      const state = newGame(`deck-one-${i}`);
      if (state.phase.type !== 'doors') throw new Error('expected doors');
      expect(state.phase.doors.some((door) => door.kind === 'merchant' || door.kind === 'elite')).toBe(false);
    }
  });
});

describe('sanctum', () => {
  /** A fresh game dropped straight into a sanctum, with whatever the test needs in hand. */
  function inSanctum(change: (state: GameState) => void): GameState {
    const state = structuredClone(newGame('sanctum'));
    state.phase = { type: 'sanctum', rested: false };
    change(state);
    return state;
  }
  const weapon = (id: number, rarity: 'common' | 'uncommon' = 'common') =>
    makeItem(createRng(id), id, 3, 0, { slot: 'weapon', rarity });

  it('is passed on the stair before every new depth', () => {
    let state = newGame('pod-stop');
    while (state.floor === 1 && state.phase.type !== 'dead') state = reduce(state, botAction(state));
    if (state.phase.type === 'dead') return; // this seed's bot died on deck 1; nothing to check
    // The boon pick for any level gained comes first, then the sanctum, then the new depth's doors.
    while (state.phase.type === 'boon' || state.phase.type === 'loot') state = reduce(state, botAction(state));
    expect(state.phase.type).toBe('sanctum');
    state = reduce(state, { type: 'continue' });
    expect(state.phase.type).toBe('doors');
  });

  it('lets you rest once', () => {
    let state = inSanctum((s) => (s.player.hp = 10));
    state = reduce(state, { type: 'rest' });
    expect(state.player.hp).toBeGreaterThan(10);
    expect(reduce(state, { type: 'rest' })).toBe(state);
  });

  it('gives shards for salvage and turns them into potions', () => {
    let state = inSanctum((s) => s.player.bag.push(weapon(1), weapon(2), weapon(3), weapon(4), weapon(5)));
    expect(reduce(state, { type: 'craft', recipe: 'potion' })).toBe(state);
    for (const item of state.player.bag) state = reduce(state, { type: 'sell', itemId: item.id });
    expect(state.player.shards).toBe(5);
    state = { ...state, player: { ...state.player, shards: CRAFT.potion } };
    const potions = state.player.potions;
    state = reduce(state, { type: 'craft', recipe: 'potion' });
    expect(state.player.potions).toBe(potions + 1);
    expect(state.player.shards).toBe(0);
  });

  it('tempers worn gear, for more each time, up to a limit', () => {
    let state = inSanctum((s) => {
      s.player.equipment.weapon = weapon(1);
      s.player.shards = 999;
    });
    const before = playerStats(state.player).atk;
    let spent = 0;
    for (let i = 0; i < CRAFT.temperMax; i++) {
      const shards = state.player.shards;
      state = reduce(state, { type: 'craft', recipe: 'temper', slot: 'weapon' });
      const cost = shards - state.player.shards;
      expect(cost).toBeGreaterThan(spent);
      spent = cost;
    }
    expect(playerStats(state.player).atk).toBeGreaterThan(before);
    expect(state.player.equipment.weapon?.plus).toBe(CRAFT.temperMax);
    expect(reduce(state, { type: 'craft', recipe: 'temper', slot: 'weapon' })).toBe(state);
  });

  it('re-rolls worn gear but keeps its tier, slot and tempers', () => {
    let state = inSanctum((s) => {
      s.player.equipment.weapon = weapon(9001, 'uncommon');
      s.player.shards = 999;
    });
    state = reduce(state, { type: 'craft', recipe: 'temper', slot: 'weapon' });
    const old = state.player.equipment.weapon!;
    state = reduce(state, { type: 'craft', recipe: 'reforge', slot: 'weapon' });
    const fresh = state.player.equipment.weapon!;
    expect(fresh.id).not.toBe(old.id);
    expect([fresh.slot, fresh.rarity, fresh.plus]).toEqual(['weapon', 'uncommon', 1]);
  });

  it('transmutes three of a tier into one of the next', () => {
    let state = inSanctum((s) => {
      s.player.bag.push(weapon(1), weapon(2), weapon(3), weapon(4, 'uncommon'));
      s.player.shards = CRAFT.transmute;
    });
    state = reduce(state, { type: 'craft', recipe: 'transmute', rarity: 'common' });
    expect(state.player.bag.map((item) => item.rarity).sort()).toEqual(['uncommon', 'uncommon']);
    expect(state.player.shards).toBe(0);
    expect(reduce(state, { type: 'craft', recipe: 'transmute', rarity: 'uncommon' })).toBe(state);
  });

  it('has no anvil anywhere else', () => {
    const state = newGame('no-bench');
    expect(reduce(state, { type: 'craft', recipe: 'potion' })).toBe(state);
    expect(reduce(state, { type: 'rest' })).toBe(state);
  });
});

describe('atmosphere', () => {
  it('adds unsettling lines on deeper decks without ever repeating one', () => {
    let seen = 0;
    for (let i = 0; i < 20; i++) {
      const lines: string[] = [];
      let state = newGame(`whisper-${i}`);
      let last = -1;
      for (let step = 0; step < 20_000 && state.phase.type !== 'dead'; step++) {
        state = reduce(state, botAction(state));
        for (const entry of state.log) {
          if (entry.id > last && entry.tone === 'eerie') lines.push(entry.text);
        }
        last = state.log[state.log.length - 1]?.id ?? last;
      }
      expect(new Set(lines).size).toBe(lines.length);
      expect(lines.some((line) => line.includes('{'))).toBe(false);
      seen += lines.length;
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('greets a returning player differently without changing the ship', () => {
    const first = newGame('again');
    const second = newGame('again', true);
    expect(second.log[0]?.text).not.toBe(first.log[0]?.text);
    expect(second.phase).toEqual(first.phase);
    expect(second.rng).toBe(first.rng);
  });
});

describe('first run', () => {
  it('opens with a plain fight that the player wins and that drops a weapon', () => {
    let state = newGame(FIRST_RUN_SEED);
    if (state.phase.type !== 'doors') throw new Error('expected doors');
    expect(state.phase.doors[0]).toEqual({ kind: 'fight', hidden: false });
    state = reduce(state, { type: 'chooseDoor', index: 0 });
    while (state.phase.type === 'combat') state = reduce(state, { type: 'advance' });
    if (state.phase.type !== 'loot') throw new Error('expected salvage after the first fight');
    expect(state.phase.items[0]?.slot).toBe('weapon');
    expect(state.player.hp).toBeGreaterThan(playerStats(state.player).maxHp * 0.6);
  });
});

describe('balance', () => {
  it('lets a sensible player get past the first floors but not go on for ever', () => {
    const floors = Array.from({ length: 200 }, (_, i) => playOut(newGame(`balance-${i}`)).floor).sort((a, b) => a - b);
    const median = floors[Math.floor(floors.length / 2)]!;
    const summary = {
      min: floors[0],
      p10: floors[20],
      median,
      p90: floors[180],
      max: floors[floors.length - 1],
    };
    expect(median).toBeGreaterThanOrEqual(5);
    expect(median).toBeLessThanOrEqual(20);
    expect(summary.max).toBeLessThan(100);
    expect(summary.p10).toBeGreaterThanOrEqual(2);
  }, 30_000);
});

describe('wrath', () => {
  it('builds as blows are traded', () => {
    let state = reduce(newGame(FIRST_RUN_SEED), { type: 'chooseDoor', index: 0 });
    expect(state.player.wrath).toBe(0);
    for (let i = 0; i < 4; i++) state = reduce(state, { type: 'advance' });
    expect(state.player.wrath).toBeGreaterThan(0);
  });

  it('is spent, all of it, on a smite that hits far harder than a blow', () => {
    const fresh = newGame(FIRST_RUN_SEED);
    expect(reduce(fresh, { type: 'smite' })).toBe(fresh); // not in a fight
    let state = reduce(fresh, { type: 'chooseDoor', index: 0 });
    expect(reduce(state, { type: 'smite' })).toBe(state); // not charged
    state = { ...state, player: { ...state.player, wrath: 100 } };
    if (state.phase.type !== 'combat') throw new Error('expected a fight');
    const before = state.phase.enemy.hp;
    state = reduce(state, { type: 'smite' });
    const after = state.phase.type === 'combat' ? state.phase.enemy.hp : 0;
    expect(state.player.wrath).toBe(0);
    // Base attack is 8, so a plain blow is under 10; a smite must clear that comfortably.
    expect(before - after).toBeGreaterThan(14);
  });
});
