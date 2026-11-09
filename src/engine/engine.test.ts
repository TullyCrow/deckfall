import { describe, expect, it } from 'vitest';
import { botAction, playOut } from './bot';
import { BAG_SIZE, FIRST_RUN_SEED, RARITIES } from './data';
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
    const a = createRng(hashSeed('derelict'));
    const b = createRng(hashSeed('derelict'));
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
