import { LOW_HP, WRATH, playerStats, type GameState } from '../engine';

/** One-time hints. Each is shown the first time its situation comes up, then never again. */
export const TIPS = {
  doors: 'Each door leads to a different room, and its hint tells you what to expect. Clear three rooms to reach the stairs down.',
  hidden: 'An unmarked door hides what is behind it. It could be treasure, or a fight.',
  hurt: 'You are hurt. Drink a potion from the bar below, or look for a chapel.',
  guardian: 'Every fifth depth is held by its lord. You cannot flee this fight, so heal first if you can.',
  combat: 'Fights play out on their own. Watch the red orb: you can drink a potion or flee at any time.',
  smite: 'The blue orb is full. Tap Smite to spend your wrath on one great blow.',
  potion: 'Your life is low. Drink a potion now. It heals you, but you lose your next blow.',
  loot: 'Loot is how you grow stronger. Equip it now, or take it to your pack for later. Green numbers mean an upgrade.',
  boon: 'Talents last for the whole run. You learn one every time you level up.',
  shrine: 'A shrine grants one thing: healing, or a talent bought with your own blood.',
  merchant: 'Short of gold? Open your pack and salvage gear you do not need. Potions are usually the safest buy.',
  sanctum: 'This sanctum is safe. Rest once, work at the anvil, then open the door. Salvaging gear from your pack gives you shards.',
  dead: 'Death ends the run, but you now know this dungeon. Retry the same seed to take a different path.',
} as const;

export type TipId = keyof typeof TIPS;

/** The hint that fits the current moment, skipping any the player has already seen. */
export function tipFor(game: GameState, seen: readonly string[]): TipId | null {
  const { phase, player } = game;
  const low = player.hp < playerStats(player).maxHp * LOW_HP;
  const candidates: TipId[] = [];

  switch (phase.type) {
    case 'doors':
      if (phase.doors[0]?.kind === 'boss') candidates.push('guardian');
      candidates.push('doors');
      if (low && player.potions > 0) candidates.push('hurt');
      if (phase.doors.some((door) => door.hidden)) candidates.push('hidden');
      break;
    case 'combat':
      if (low && player.potions > 0) candidates.push('potion');
      if (player.wrath >= WRATH.max) candidates.push('smite');
      candidates.push('combat');
      break;
    case 'loot':
    case 'boon':
    case 'shrine':
    case 'merchant':
    case 'sanctum':
    case 'dead':
      candidates.push(phase.type);
      break;
  }
  return candidates.find((id) => !seen.includes(id)) ?? null;
}
