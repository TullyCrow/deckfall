import { LOW_HP, playerStats, type GameState } from '../engine';

/** One-time hints. Each is shown the first time its situation comes up, then never again. */
export const TIPS = {
  doors: 'Each hatch leads to a different room, and its hint tells you what to expect. Clear three rooms to reach the lift down.',
  hidden: 'A dead panel hides what is behind it. It could be salvage, or a fight.',
  hurt: 'You are hurt. Use a stim from the bar below, or look for a med bay.',
  guardian: 'Every fifth deck is held by a guardian. You cannot flee this fight, so heal first if you can.',
  combat: 'Fights play out on their own. Watch your health: you can use a stim or flee at any time.',
  stim: 'Your health is low. Use a stim now. It heals you, but you lose your next attack.',
  loot: 'Salvage is how you get stronger. Equip it now, or take it to your pack for later. Green numbers mean an upgrade.',
  boon: 'Augments last for the whole run. You choose one every time you level up.',
  shrine: 'The auto-surgeon does one job: heal you now, or hurt you now in exchange for a permanent augment.',
  merchant: 'Short of credits? Open your pack and scrap gear you do not need. Stims are usually the safest buy.',
  pod: 'This pod is safe. Rest once, build what you need at the workbench, then open the hatch. Scrapping gear from your pack gives you parts.',
  dead: 'Death ends the run, but you now know this ship. Retry the same seed to take a different route.',
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
      if (low && player.potions > 0) candidates.push('stim');
      candidates.push('combat');
      break;
    case 'loot':
    case 'boon':
    case 'shrine':
    case 'merchant':
    case 'pod':
    case 'dead':
      candidates.push(phase.type);
      break;
  }
  return candidates.find((id) => !seen.includes(id)) ?? null;
}
