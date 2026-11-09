// Copies the icons the game uses out of a local clone of https://github.com/game-icons/icons
// into public/icons, with the black background square removed so they can be tinted with CSS.
// Also writes the credits file the CC BY 3.0 licence requires.
//
//   node scripts/build-icons.mjs /path/to/game-icons/icons
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const AUTHORS = {
  lorc: 'Lorc',
  delapouite: 'Delapouite',
  skoll: 'Skoll',
  sbed: 'Sbed',
  'john-colburn': 'John Colburn',
  'lord-berandas': 'Lord Berandas',
};

const ICONS = [
  // Doors
  'lorc/claw-slashes', 'lorc/dread-skull', 'lorc/locked-chest', 'lorc/holy-symbol', 'delapouite/two-coins',
  'lorc/crowned-skull', 'delapouite/stairs', 'delapouite/secret-door',
  // Talents
  'delapouite/heart-beats', 'lorc/muscle-up', 'lorc/layered-armor', 'lorc/sprint', 'lorc/targeting',
  'lorc/bloody-sword', 'lorc/heart-drop',
  // Actions and screens
  'lorc/sword-clash', 'lorc/knapsack', 'lorc/anvil', 'lorc/crystalize', 'lorc/fountain',
  'lorc/static-waves', 'lorc/silence',
];

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-icons.mjs /path/to/game-icons/icons');
const out = join(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const credits = {};
const seen = new Set();
for (const entry of ICONS) {
  const [folder, name] = entry.split('/');
  const author = AUTHORS[folder];
  if (!author) throw new Error(`No author name for folder "${folder}"`);
  if (seen.has(name)) throw new Error(`Two icons share the name "${name}"`);
  seen.add(name);

  const svg = readFileSync(join(source, `${entry}.svg`), 'utf8');
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]).filter((d) => d !== 'M0 0h512v512H0z');
  if (paths.length === 0) throw new Error(`No drawable path in ${entry}`);
  const body = paths.map((d) => `<path d="${d}"/>`).join('');
  writeFileSync(join(out, `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>\n`);
  (credits[author] ??= []).push(name);
}

const lines = [
  '# Icon credits',
  '',
  'The icons in this folder come from https://game-icons.net and are used under the',
  'Creative Commons Attribution 3.0 licence (https://creativecommons.org/licenses/by/3.0/).',
  'Each was modified by removing its background square.',
  '',
  ...Object.entries(credits).flatMap(([author, names]) => [`## ${author}`, '', names.sort().join(', '), '']),
];
writeFileSync(join(out, 'CREDITS.md'), lines.join('\n'));
console.log(`${seen.size} icons written to ${basename(out)}/`);
