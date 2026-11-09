import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BAG_SIZE,
  FIRST_RUN_SEED,
  LOW_HP,
  ROOMS_PER_FLOOR,
  SHARDS_BY_RARITY,
  SLOTS,
  WRATH,
  isBossFloor,
  itemScore,
  newGame,
  playerStats,
  reduce,
  regionOf,
  xpToNext,
  type Action,
  type GameState,
  type LogEntry,
} from '../engine';
import { sound, type Effect } from './audio';
import { Icon, ItemCard, Meter, Orb, Sheet, SLOT_LABEL, Sprite, useDelta } from './parts';
import { buzz, useInstall } from './pwa';
import { Scene } from './Scene';
import { Stage } from './Stage';
import {
  dailySeed,
  loadGame,
  loadRecords,
  loadSound,
  loadSpeed,
  loadTips,
  randomSeed,
  saveGame,
  saveRecords,
  saveSound,
  saveSpeed,
  saveTips,
  type Records,
} from './storage';
import { TIPS, tipFor, type TipId } from './tips';

const STEP_MS = { 1: 520, 2: 190 } as const;
const LOG_LINES = 4;

function effectFor(entry: LogEntry): Effect | null {
  if (entry.cue) return entry.cue;
  if (entry.tone === 'hit') return 'hit';
  if (entry.tone === 'hurt') return 'hurt';
  if (entry.tone === 'loot') return 'pickup';
  if (entry.tone === 'eerie') return 'whisper';
  return null;
}

function runSignature(game: GameState): string {
  return `${game.seed}:${game.tally.turns}:${game.floor}`;
}

export function App() {
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [records, setRecords] = useState<Records>(loadRecords);
  const [speed, setSpeed] = useState<1 | 2>(loadSpeed);
  const [seenTips, setSeenTips] = useState<string[]>(loadTips);
  const [sheet, setSheet] = useState<'pack' | 'menu' | null>(null);
  const [soundOn, setSoundOn] = useState(loadSound);

  const dispatch = useCallback((action: Action) => {
    setGame((current) => (current ? reduce(current, action) : current));
  }, []);

  const start = useCallback(
    (seed: string) => {
      const chosen = seed.trim() || randomSeed();
      setSheet(null);
      // Coming back to a dungeon you died in gets a different welcome.
      setGame(newGame(chosen, records.lastRun.startsWith(`${chosen}:`)));
      sound.start();
    },
    [records.lastRun],
  );

  useEffect(() => saveGame(game), [game]);
  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveSpeed(speed), [speed]);
  useEffect(() => saveTips(seenTips), [seenTips]);
  useEffect(() => {
    saveSound(soundOn);
    sound.setEnabled(soundOn);
  }, [soundOn]);

  // Browsers only allow sound after a tap, so a resumed run starts its sound on the first one.
  useEffect(() => {
    const wake = () => sound.start();
    window.addEventListener('pointerdown', wake, { once: true });
    return () => window.removeEventListener('pointerdown', wake);
  }, []);

  // Play the sound of whatever was just added to the log.
  const lastHeard = useRef(game?.log.at(-1)?.id ?? -1);
  useEffect(() => {
    const newest = game?.log.at(-1)?.id ?? -1;
    if (!game || newest < lastHeard.current) lastHeard.current = -1; // a new run restarts the numbering
    const fresh = game ? game.log.filter((entry) => entry.id > lastHeard.current) : [];
    lastHeard.current = newest;
    // A skipped fight arrives all at once; play only how it ended.
    for (const entry of fresh.length > 5 ? fresh.slice(-2) : fresh) {
      const effect = effectFor(entry);
      if (effect) sound.play(effect);
    }
  }, [game]);

  // Combat plays itself one blow at a time; the player steps in with a potion, a smite, or their heels.
  const phaseType = game?.phase.type;
  useEffect(() => {
    if (phaseType !== 'combat') return;
    const timer = window.setInterval(() => dispatch({ type: 'advance' }), STEP_MS[speed]);
    return () => window.clearInterval(timer);
  }, [phaseType, speed, dispatch]);

  useEffect(() => {
    if (!game || game.phase.type !== 'dead') return;
    const signature = runSignature(game);
    setRecords((r) =>
      r.lastRun === signature
        ? r
        : {
            bestDeck: Math.max(r.bestDeck, game.floor),
            runs: r.runs + 1,
            lastRun: signature,
            lastWasBest: r.runs > 0 && game.floor > r.bestDeck,
          },
    );
  }, [game]);

  // A hint counts as seen once the moment it belongs to has passed.
  const tip = game ? tipFor(game, seenTips) : null;
  const shownTip = useRef<TipId | null>(null);
  const markSeen = useCallback((id: TipId) => setSeenTips((seen) => (seen.includes(id) ? seen : [...seen, id])), []);
  useEffect(() => {
    const previous = shownTip.current;
    shownTip.current = tip;
    if (previous && previous !== tip) markSeen(previous);
  }, [tip, markSeen]);

  // Feel a blow, and feel the last one more.
  const hp = game?.player.hp ?? 0;
  const hpDelta = useDelta(hp);
  useEffect(() => {
    if (hpDelta < 0) buzz(hp === 0 ? [40, 60, 120] : 12);
  }, [hp, hpDelta]);

  // Keyboard: 1 to 3 pick a choice, Q drinks a potion, W smites.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'q') return dispatch({ type: 'drinkPotion' });
      if (key === 'w') return dispatch({ type: 'smite' });
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index > 2) return;
      setGame((current) => {
        if (!current) return current;
        if (current.phase.type === 'doors') return reduce(current, { type: 'chooseDoor', index });
        if (current.phase.type === 'boon') return reduce(current, { type: 'chooseBoon', index });
        return current;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const resolveFight = useCallback(() => {
    setGame((current) => {
      let state = current;
      while (state && state.phase.type === 'combat') state = reduce(state, { type: 'advance' });
      return state;
    });
  }, []);

  // The drone drops and the heartbeat starts as things get worse; a sanctum quiets everything.
  const depth = game?.floor ?? 1;
  const dead = game?.phase.type === 'dead';
  const safe = game?.phase.type === 'sanctum';
  const hurtBadly = game ? !dead && game.player.hp < playerStats(game.player).maxHp * LOW_HP : false;
  useEffect(() => sound.setMood({ deck: depth, low: hurtBadly, dead, safe }), [depth, hurtBadly, dead, safe]);

  const toggleSound = () => {
    // Applied here, inside the tap, because browsers only start audio from one.
    sound.setEnabled(!soundOn);
    sound.start();
    setSoundOn(!soundOn);
  };

  if (!game) return <Title records={records} soundOn={soundOn} onToggleSound={toggleSound} onStart={start} />;

  const { player, phase } = game;
  const stats = playerStats(player);
  const inFight = phase.type === 'combat';
  const canDrink = !dead && player.potions > 0 && player.hp < stats.maxHp;
  const canSmite = inFight && player.wrath >= WRATH.max;
  const upgrades = player.bag.filter((item) => itemScore(item) > itemScore(player.equipment[item.slot])).length;
  const region = regionOf(game.floor);

  // Progress through the depth: three rooms, then the stairs or the lord.
  const position = phase.type === 'doors' ? game.room : game.room - 1;
  const boss = isBossFloor(game.floor);
  const atEnd = position >= ROOMS_PER_FLOOR;
  const endLabel = boss ? 'The lord of this depth' : 'Stairs reached';
  const progressLabel = atEnd ? endLabel : `Room ${position + 1} of ${ROOMS_PER_FLOOR}`;

  return (
    <div className={`app play ${hurtBadly ? 'is-low' : ''} ${hpDelta < 0 ? 'is-struck' : ''}`}>
      <header className="bar">
        <div className="where">
          <span className="where-name">{region.name}</span>
          <span className="where-depth num">{game.floor}</span>
          <span className="pips" role="img" aria-label={progressLabel}>
            {Array.from({ length: ROOMS_PER_FLOOR }, (_, index) => (
              <i key={index} className={`pip ${index < position ? 'pip-done' : ''} ${index === position ? 'pip-now' : ''}`} />
            ))}
            <i className={`pip pip-end ${boss ? 'pip-boss' : ''} ${atEnd ? 'pip-now' : ''}`} />
          </span>
        </div>
        <span className="purse num">
          <span className="shards">{player.shards} shards</span>
          <span className="gold">
            <Sprite name="gold" /> {player.gold}
          </span>
        </span>
      </header>

      <Scene game={game} />

      <section className="log" role="log" aria-live="polite" aria-label="Event log">
        {game.log.slice(-LOG_LINES).map((entry) => (
          <p key={entry.id} className={`log-${entry.tone}`}>
            {entry.text}
          </p>
        ))}
      </section>

      <section key={phase.type} className={`panel stage stage-${phase.type}`} aria-label="Current situation">
        {tip && (
          <aside className="tip">
            <p>
              <strong>Tip</strong> {TIPS[tip]}
            </p>
            <button className="btn btn-small" onClick={() => markSeen(tip)}>
              Got it
            </button>
          </aside>
        )}
        <Stage
          game={game}
          dispatch={dispatch}
          speed={speed}
          newBest={records.lastRun === runSignature(game) && records.lastWasBest === true}
          onToggleSpeed={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          onResolve={resolveFight}
          onNewRun={() => start(randomSeed())}
          onRetry={() => start(game.seed)}
        />
      </section>

      {/* The belt: life on the left, wrath on the right, everything you can do in between. */}
      <footer className="belt">
        <Orb kind="life" label="Life" value={player.hp} max={stats.maxHp} urgent={hurtBadly} />
        <div className="belt-mid">
          <div className="belt-xp">
            <span className="num">Level {player.level}</span>
            <Meter label="Experience" value={player.xp} max={xpToNext(player.level)} tone="xp" />
          </div>
          <nav className="belt-slots" aria-label="Potion, smite, pack and menu">
            <button
              className={`slot-btn ${hurtBadly && canDrink ? 'slot-urgent' : ''}`}
              disabled={!canDrink}
              onClick={() => dispatch({ type: 'drinkPotion' })}
              aria-label={`Drink a potion. ${player.potions} left.`}
            >
              <Sprite name="potion" />
              <span className="slot-count num">{player.potions}</span>
            </button>
            <button
              className={`slot-btn ${canSmite ? 'slot-ready' : ''}`}
              disabled={!canSmite}
              onClick={() => dispatch({ type: 'smite' })}
              aria-label={canSmite ? 'Smite: spend all your wrath on one great blow' : 'Smite. Not ready.'}
            >
              <Icon name="sword-clash" size="lg" />
              <span className="slot-label">Smite</span>
            </button>
            <button className="slot-btn" onClick={() => setSheet('pack')} aria-label={`Pack. ${player.bag.length} of ${BAG_SIZE}.`}>
              <Icon name="knapsack" size="lg" />
              <span className="slot-count num">{player.bag.length}</span>
              {upgrades > 0 && <span className="badge">{upgrades}</span>}
            </button>
            <button className="slot-btn slot-menu" onClick={() => setSheet('menu')}>
              Menu
            </button>
          </nav>
        </div>
        <Orb kind="wrath" label="Wrath" value={player.wrath} max={WRATH.max} urgent={canSmite} />
      </footer>

      <Sheet open={sheet === 'pack'} title="Character and pack" onClose={() => setSheet(null)}>
        <ul className="sheet-stats">
          <li>
            <span>Attack</span> <b>{stats.atk}</b>
          </li>
          <li>
            <span>Defence</span> <b>{stats.def}</b>
          </li>
          <li>
            <span>Speed</span> <b>{stats.spd}</b>
          </li>
          <li>
            <span>Critical</span> <b>{stats.crit}%</b>
          </li>
          <li>
            <span>Crit damage</span> <b>{stats.critDmg}%</b>
          </li>
          <li>
            <span>Life steal</span> <b>{stats.leech}%</b>
          </li>
        </ul>
        <h3>Worn</h3>
        <div className="stack">
          {SLOTS.map((slot) => {
            const item = player.equipment[slot];
            return item ? (
              <ItemCard key={slot} item={item} />
            ) : (
              <div key={slot} className="item item-empty">
                {SLOT_LABEL[slot]}: empty
              </div>
            );
          })}
        </div>
        <h3>
          Pack ({player.bag.length}/{BAG_SIZE})
        </h3>
        {player.bag.length === 0 && <p className="note">Empty. Loot you take goes here until you equip or salvage it.</p>}
        {inFight && player.bag.length > 0 && <p className="note warn">You cannot change gear mid-fight.</p>}
        <div className="stack">
          {player.bag.map((item) => {
            const better = itemScore(item) > itemScore(player.equipment[item.slot]);
            return (
              <ItemCard key={item.id} item={item} worn={player.equipment[item.slot]}>
                <button
                  className={`btn ${better ? 'btn-primary' : ''}`}
                  disabled={inFight || dead}
                  onClick={() => dispatch({ type: 'equip', itemId: item.id })}
                >
                  Equip
                </button>
                <button
                  className="btn btn-quiet"
                  disabled={inFight || dead}
                  onClick={() => dispatch({ type: 'sell', itemId: item.id })}
                >
                  Salvage · {item.value}g + {SHARDS_BY_RARITY[item.rarity]}
                </button>
              </ItemCard>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={sheet === 'menu'} title="How to play" onClose={() => setSheet(null)}>
        <ol className="howto">
          <li>Pick a door. Its hint tells you what is behind it.</li>
          <li>Fights run on their own. Drink a potion when the red orb runs low, or flee.</li>
          <li>When the blue orb is full, Smite: one great blow.</li>
          <li>Equip better loot and salvage the rest for gold and shards.</li>
          <li>Each level you gain teaches you a talent that lasts the whole run.</li>
          <li>The stair passes a sanctum before every new depth: rest, and work at the anvil.</li>
          <li>Three rooms, then the stairs. Every fifth depth has a lord.</li>
          <li>Death is final. The game saves every step, so you can close it mid-fight and come back.</li>
        </ol>
        <p className="note">
          Dungeon seed <span className="num">{game.seed}</span> · deepest {records.bestDeck} · {records.runs} run
          {records.runs === 1 ? '' : 's'}
        </p>
        <p className="note">
          Art, sound and type <a href="./CREDITS.md">credits</a>.
        </p>
        <div className="actions actions-2">
          <button className="btn" onClick={toggleSound} aria-pressed={soundOn}>
            Sound: {soundOn ? 'on' : 'off'}
          </button>
          <button
            className="btn"
            onClick={() => {
              if (dead || window.confirm('Abandon this run? Your progress on it will be lost.')) {
                setSheet(null);
                setGame(null);
              }
            }}
          >
            {dead ? 'Back to title' : 'Abandon run'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

interface TitleProps {
  records: Records;
  soundOn: boolean;
  onToggleSound: () => void;
  onStart: (seed: string) => void;
}

function Title({ records, soundOn, onToggleSound, onStart }: TitleProps) {
  const [seed, setSeed] = useState('');
  const { mode, install } = useInstall();
  const firstTime = records.runs === 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(seed);
  };
  return (
    <div className="app title">
      {/* The cathedral door, drawn from the same tiles as the dungeon below it. */}
      <div className="title-art region-cathedral" aria-hidden="true">
        <div className="scene-floor px" style={{ backgroundImage: 'url("./sprites/floor_cathedral.png")' }} />
        <div className="scene-wall px" style={{ backgroundImage: 'url("./sprites/wall_cathedral.png")' }} />
        <div className="scene-doors">
          <Sprite name="statue_angel" />
          <Sprite name="gate" />
          <Sprite name="statue_evil" />
        </div>
        <div className="actor hero">
          <Sprite name="hero" />
        </div>
        <div className="scene-dark" />
      </div>

      <header className="hero-text">
        <h1>Deckfall</h1>
        <p className="tagline">
          {firstTime
            ? 'Something has woken beneath the cathedral. Go down and kill it.'
            : 'The dead do not rest here. Neither, it seems, do you.'}
        </p>
      </header>

      <div className="title-actions">
        <button className="btn btn-primary btn-big" onClick={() => onStart(firstTime ? FIRST_RUN_SEED : randomSeed())}>
          Enter the cathedral
        </button>
        {!firstTime && (
          <button className="btn" onClick={() => onStart(dailySeed())}>
            Today's dungeon
          </button>
        )}
      </div>

      <button className="sound-toggle" onClick={onToggleSound} aria-pressed={soundOn}>
        <Icon name={soundOn ? 'static-waves' : 'silence'} />
        <span>{soundOn ? 'Sound on. Best with headphones.' : 'Sound is off. Tap to turn it on.'}</span>
      </button>

      <p className="note centre">
        A run fits in a coffee break. It saves every step, so you can close it mid-fight and pick it up later.
      </p>

      {!firstTime && (
        <p className="note centre">
          Deepest: depth {records.bestDeck} · {records.runs} run{records.runs === 1 ? '' : 's'}
        </p>
      )}

      {mode === 'prompt' && (
        <button className="btn btn-quiet" onClick={install}>
          Install as an app
        </button>
      )}
      {mode === 'ios' && (
        <p className="note centre">To install: tap Share, then “Add to Home Screen”. It then plays offline.</p>
      )}

      {!firstTime && (
        <details className="seed">
          <summary>Play a specific dungeon</summary>
          <form onSubmit={submit}>
            <label htmlFor="seed">Dungeon seed</label>
            <div className="seed-row">
              <input
                id="seed"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                placeholder="Any word or code"
                maxLength={32}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button type="submit" className="btn">
                Enter
              </button>
            </div>
            <p className="note">The same seed always builds the same dungeon, so you can race a friend.</p>
          </form>
        </details>
      )}

      <p className="credit">
        Free software under GPL-3.0. Pixel art from Dungeon Crawl Stone Soup (CC0). Inspired by Dungeon Crawler on
        Demand by Red Pangilinan. Full <a href="./CREDITS.md">credits</a>.
      </p>
    </div>
  );
}
