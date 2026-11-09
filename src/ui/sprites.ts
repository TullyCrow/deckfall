/**
 * What each hostile really looks like, when the camera catches it.
 *
 * Keyed by the hostile's icon, which is its silhouette. The files are in public/sprites
 * and come from Dungeon Crawl Stone Soup's CC0 tile set (see scripts/fetch-sprites.mjs).
 */
export const TRUE_FORM: Record<string, string> = {
  rat: 'radroach',
  'floating-tentacles': 'chonchon0',
  'mono-wheel-robot': 'clockwork_bee',
  slime: 'aspiring_flesh',
  bandit: 'ironbound_mechanist',
  'shambling-zombie': 'bloated_husk',
  'battle-mech': 'iron_golem',
  spectre: 'phantom',
  'pirate-skull': 'revenant',
  'alien-bug': 'emperor_scorpion',
  'cyborg-face': 'cognitogaunt',
  'mimic-chest': 'crawling_flesh_cage0',
  'robot-golem': 'electric_golem',
  'alien-stare': 'broodmother',
  'captain-hat-profile': 'ancient_champion',
  'artificial-intelligence': 'wretched_star',
};

/** Things that are in the picture for a tenth of a second, on the deeper decks, and are not in the room. */
export const APPARITIONS = ['lurking_horror', 'nameless_horror', 'unseen_horror'] as const;

export const spriteUrl = (name: string) => `./sprites/${name}.png`;
