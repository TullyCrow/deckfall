import { BAG_SIZE, BOONS, CRAFT } from './data';
import { overclockCost, playerStats, reduce, sacrificeCost } from './engine';
import { itemScore } from './items';
import type { Action, GameState, RoomKind } from './types';

const BOON_PRIORITY = ['servo', 'frame', 'plating', 'siphon', 'reflex', 'optics', 'coil'];
const HEALTHY_ORDER: RoomKind[] = ['treasure', 'fight', 'elite', 'merchant', 'shrine'];
const HURT_ORDER: RoomKind[] = ['shrine', 'merchant', 'treasure', 'fight', 'elite'];

/**
 * A plain, sensible player. It exists so tests can play thousands of runs and
 * catch balance changes that make the game trivially easy or impossible.
 * It always returns an action the engine will accept.
 */
export function botAction(state: GameState): Action {
  const { player, phase } = state;
  const stats = playerStats(player);

  if (phase.type === 'combat') {
    if (player.potions > 0 && player.hp < stats.maxHp * 0.35) return { type: 'drinkPotion' };
    return { type: 'advance' };
  }
  if (phase.type === 'dead') throw new Error('The run is over');

  // Keep the bag empty: wear upgrades, sell the rest.
  const bagItem = player.bag[0];
  if (bagItem) {
    const better = itemScore(bagItem) > itemScore(player.equipment[bagItem.slot]);
    return { type: better ? 'equip' : 'sell', itemId: bagItem.id };
  }

  switch (phase.type) {
    case 'doors': {
      const order = player.hp < stats.maxHp * 0.5 ? HURT_ORDER : HEALTHY_ORDER;
      let best = 0;
      let bestRank = Infinity;
      phase.doors.forEach((door, index) => {
        const rank = door.hidden ? 2.5 : order.indexOf(door.kind);
        if (rank < bestRank) {
          best = index;
          bestRank = rank;
        }
      });
      return { type: 'chooseDoor', index: best };
    }
    case 'loot':
      return player.bag.length < BAG_SIZE ? { type: 'takeLoot', index: 0 } : { type: 'continue' };
    case 'boon': {
      const ranked = phase.choices.map((id) => {
        const rank = BOON_PRIORITY.indexOf(id);
        return rank === -1 ? BOONS.length : rank;
      });
      return { type: 'chooseBoon', index: ranked.indexOf(Math.min(...ranked)) };
    }
    case 'shrine':
      if (player.hp < stats.maxHp * 0.7) return { type: 'shrine', choice: 'rest' };
      if (player.hp > sacrificeCost(player)) return { type: 'shrine', choice: 'sacrifice' };
      return { type: 'continue' };
    case 'merchant': {
      if (player.potions < 3 && player.gold >= phase.potionPrice) return { type: 'buyPotion' };
      const index = phase.stock.findIndex(
        (entry) => entry.price <= player.gold && itemScore(entry.item) > itemScore(player.equipment[entry.item.slot]),
      );
      return index >= 0 ? { type: 'buy', index } : { type: 'continue' };
    }
    case 'pod': {
      if (!phase.rested && player.hp < stats.maxHp) return { type: 'rest' };
      if (player.potions < 3 && player.parts >= CRAFT.stim) return { type: 'craft', recipe: 'stim' };
      const weapon = player.equipment.weapon;
      if (weapon && (weapon.plus ?? 0) < CRAFT.overclockMax && player.parts >= overclockCost(weapon)) {
        return { type: 'craft', recipe: 'overclock', slot: 'weapon' };
      }
      return { type: 'continue' };
    }
  }
}

/** Plays a whole run with the bot. `maxSteps` guards against a run that never ends. */
export function playOut(start: GameState, maxSteps = 200_000): GameState {
  let state = start;
  for (let step = 0; step < maxSteps && state.phase.type !== 'dead'; step++) {
    const next = reduce(state, botAction(state));
    if (next === state) throw new Error(`Bot chose a rejected action in phase ${state.phase.type}`);
    state = next;
  }
  return state;
}
