import { SAVE_VERSION, type GameState } from '../engine';

const SAVE_KEY = 'deckfall.save.v1';
const RECORDS_KEY = 'deckfall.records.v1';
const TIPS_KEY = 'deckfall.tips.v1';
const SPEED_KEY = 'deckfall.speed.v1';
const SOUND_KEY = 'deckfall.sound.v1';

export interface Records {
  bestDeck: number;
  runs: number;
  /** Signature of the last run counted, so a reload on the death screen is not counted twice. */
  lastRun: string;
  /** Whether that last run beat the previous best. */
  lastWasBest?: boolean;
}

// Storage can be missing or blocked (private windows, strict settings). The game still plays without it.
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* nothing useful to do */
  }
}

export function loadGame(): GameState | null {
  const saved = read<GameState>(SAVE_KEY);
  return saved && saved.version === SAVE_VERSION ? saved : null;
}

export function saveGame(game: GameState | null): void {
  write(SAVE_KEY, game);
}

export function loadRecords(): Records {
  return read<Records>(RECORDS_KEY) ?? { bestDeck: 0, runs: 0, lastRun: '' };
}

export function saveRecords(records: Records): void {
  write(RECORDS_KEY, records);
}

/** Ids of the one-time hints this player has already been shown. */
export function loadTips(): string[] {
  const tips = read<unknown>(TIPS_KEY);
  return Array.isArray(tips) ? tips.filter((tip): tip is string => typeof tip === 'string') : [];
}

export function saveTips(tips: string[]): void {
  write(TIPS_KEY, tips);
}

export function loadSpeed(): 1 | 2 {
  return read<number>(SPEED_KEY) === 2 ? 2 : 1;
}

export function saveSpeed(speed: 1 | 2): void {
  write(SPEED_KEY, speed);
}

export function loadSound(): boolean {
  return read<boolean>(SOUND_KEY) !== false;
}

export function saveSound(on: boolean): void {
  write(SOUND_KEY, on);
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

export function dailySeed(): string {
  return `daily-${new Date().toISOString().slice(0, 10)}`;
}
