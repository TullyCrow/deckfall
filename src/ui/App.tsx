import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BAG_SIZE,
  FIRST_RUN_SEED,
  LOW_HP,
  ROOMS_PER_FLOOR,
  SLOTS,
  isBossFloor,
  itemScore,
  newGame,
  playerStats,
  reduce,
  xpToNext,
  type Action,
  type GameState,
} from '../engine';
import { Icon, ItemCard, Meter, Sheet, SLOT_LABEL, useDelta } from './parts';
import { buzz, useInstall } from './pwa';
import { Stage } from './Stage';
import {
  dailySeed,
  loadGame,
  loadRecords,
  loadSpeed,
  loadTips,
  randomSeed,
  saveGame,
  saveRecords,
  saveSpeed,
  saveTips,
  type Records,
} from './storage';
import { TIPS, tipFor, type TipId } from './tips';

const STEP_MS = { 1: 520, 2: 190 } as const;
const LOG_LINES = 8;

function runSignature(game: GameState): string {
  return `${game.seed}:${game.tally.turns}:${game.floor}`;
}

export function App() {
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [records, setRecords] = useState<Records>(loadRecords);
  const [speed, setSpeed] = useState<1 | 2>(loadSpeed);
  const [seenTips, setSeenTips] = useState<string[]>(loadTips);
  const [sheet, setSheet] = useState<'pack' | 'menu' | null>(null);

  const dispatch = useCallback((action: Action) => {
    setGame((current) => (current ? reduce(current, action) : current));
  }, []);

  const start = useCallback((seed: string) => {
    setSheet(null);
    setGame(newGame(seed.trim() || randomSeed()));
  }, []);

  useEffect(() => saveGame(game), [game]);
  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveSpeed(speed), [speed]);
  useEffect(() => saveTips(seenTips), [seenTips]);

  // Combat plays itself one action at a time; the player can step in with a stim or run.
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

  // Feel a hit, and feel the last one more.
  const hp = game?.player.hp ?? 0;
  const hpDelta = useDelta(hp);
  useEffect(() => {
    if (hpDelta < 0) buzz(hp === 0 ? [40, 60, 120] : 12);
  }, [hp, hpDelta]);

  // Keyboard: 1 to 3 pick a choice, S uses a stim.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === 's') return dispatch({ type: 'drinkPotion' });
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

  if (!game) return <Title records={records} onStart={start} />;

  const { player, phase } = game;
  const stats = playerStats(player);
  const inFight = phase.type === 'combat';
  const over = phase.type === 'dead';
  const low = !over && player.hp < stats.maxHp * LOW_HP;
  const canStim = !over && player.potions > 0 && player.hp < stats.maxHp;
  const upgrades = player.bag.filter((item) => itemScore(item) > itemScore(player.equipment[item.slot])).length;

  // Progress through the deck: three rooms, then the lift or the guardian.
  const position = phase.type === 'doors' ? game.room : game.room - 1;
  const boss = isBossFloor(game.floor);
  const atEnd = position >= ROOMS_PER_FLOOR;
  const endLabel = boss ? 'Guardian' : 'Lift reached';
  const progressLabel = atEnd ? endLabel : `Room ${position + 1} of ${ROOMS_PER_FLOOR}`;

  return (
    <div className="app play">
      <header className="bar">
        <div className="deck">
          <span className="deck-label">Deck</span>
          <span className="deck-num num">{game.floor}</span>
          <span className="pips" role="img" aria-label={progressLabel}>
            {Array.from({ length: ROOMS_PER_FLOOR }, (_, index) => (
              <i key={index} className={`pip ${index < position ? 'pip-done' : ''} ${index === position ? 'pip-now' : ''}`} />
            ))}
            <i className={`pip pip-end ${boss ? 'pip-boss' : ''} ${atEnd ? 'pip-now' : ''}`} />
          </span>
        </div>
        <span className="credits num">{player.gold} cr</span>
      </header>

      <section
        key={hpDelta < 0 ? `hurt-${player.hp}` : 'steady'}
        className={`vitals ${low ? 'vitals-low' : ''} ${hpDelta < 0 ? 'vitals-hurt' : ''}`}
        aria-label="Your status"
      >
        <Meter label={`Level ${player.level}`} value={player.hp} max={stats.maxHp} tone="hp" />
        <Meter label="XP" value={player.xp} max={xpToNext(player.level)} tone="xp" />
        <ul className="chips">
          <li>ATK {stats.atk}</li>
          <li>DEF {stats.def}</li>
          <li>SPD {stats.spd}</li>
          <li>Crit {stats.crit}%</li>
          {stats.leech > 0 && <li>Leech {stats.leech}%</li>}
        </ul>
      </section>

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

      <nav className="dock" aria-label="Pack, stims and menu">
        <button className="dock-btn" onClick={() => setSheet('pack')}>
          <Icon name="cargo-crate" />
          <span>
            Pack{' '}
            <span className="num">
              {player.bag.length}/{BAG_SIZE}
            </span>
          </span>
          {upgrades > 0 && <span className="badge">{upgrades} better</span>}
        </button>
        <button
          className={`dock-btn ${low && canStim ? 'dock-urgent' : ''}`}
          disabled={!canStim}
          onClick={() => dispatch({ type: 'drinkPotion' })}
        >
          <Icon name="syringe" />
          <span>
            Stim <span className="num">×{player.potions}</span>
          </span>
        </button>
        <button className="dock-btn dock-menu" onClick={() => setSheet('menu')}>
          Menu
        </button>
      </nav>

      <Sheet open={sheet === 'pack'} title="Gear and pack" onClose={() => setSheet(null)}>
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
        {player.bag.length === 0 && <p className="note">Empty. Salvage you take goes here until you equip or scrap it.</p>}
        {inFight && player.bag.length > 0 && <p className="note warn">You cannot change gear mid-fight.</p>}
        <div className="stack">
          {player.bag.map((item) => {
            const better = itemScore(item) > itemScore(player.equipment[item.slot]);
            return (
              <ItemCard key={item.id} item={item} worn={player.equipment[item.slot]}>
                <button
                  className={`btn ${better ? 'btn-primary' : ''}`}
                  disabled={inFight || over}
                  onClick={() => dispatch({ type: 'equip', itemId: item.id })}
                >
                  Equip
                </button>
                <button
                  className="btn btn-quiet"
                  disabled={inFight || over}
                  onClick={() => dispatch({ type: 'sell', itemId: item.id })}
                >
                  Scrap · {item.value} cr
                </button>
              </ItemCard>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={sheet === 'menu'} title="How to play" onClose={() => setSheet(null)}>
        <ol className="howto">
          <li>Pick a hatch. Its hint tells you what is behind it.</li>
          <li>Fights run on their own. Use a stim when your health is low, or flee.</li>
          <li>Equip better salvage and scrap the rest for credits.</li>
          <li>Each level gives you an augment that lasts the whole run.</li>
          <li>Three rooms, then the lift down. Every fifth deck has a guardian.</li>
          <li>Death is final. See how deep you can get.</li>
        </ol>
        <p className="note">
          Ship seed <span className="num">{game.seed}</span> · best deck {records.bestDeck} · {records.runs} run
          {records.runs === 1 ? '' : 's'}
        </p>
        <div className="actions">
          <button
            className="btn"
            onClick={() => {
              if (over || window.confirm('Abandon this run? Your progress on it will be lost.')) {
                setSheet(null);
                setGame(null);
              }
            }}
          >
            {over ? 'Back to title' : 'Abandon run'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function Title({ records, onStart }: { records: Records; onStart: (seed: string) => void }) {
  const [seed, setSeed] = useState('');
  const { mode, install } = useInstall();
  const firstTime = records.runs === 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(seed);
  };
  return (
    <div className="app title">
      <header className="hero">
        <Icon name="astronaut-helmet" size="hero" />
        <h1>Deckfall</h1>
        <p className="tagline">A dead ship, drifting. Every deck is worse than the last. See how deep you get.</p>
      </header>

      <div className="title-actions">
        <button className="btn btn-primary btn-big" onClick={() => onStart(firstTime ? FIRST_RUN_SEED : randomSeed())}>
          Board the ship
        </button>
        {!firstTime && (
          <button className="btn" onClick={() => onStart(dailySeed())}>
            Today's ship
          </button>
        )}
      </div>

      <ol className="steps">
        <li>
          <Icon name="secret-door" size="lg" />
          <span>Pick a hatch</span>
        </li>
        <li>
          <Icon name="claw-slashes" size="lg" />
          <span>Fight and salvage</span>
        </li>
        <li>
          <Icon name="elevator" size="lg" />
          <span>Ride the lift deeper</span>
        </li>
      </ol>

      {!firstTime && (
        <p className="note centre">
          Best deck {records.bestDeck} · {records.runs} run{records.runs === 1 ? '' : 's'}
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
          <summary>Play a specific ship</summary>
          <form onSubmit={submit}>
            <label htmlFor="seed">Ship seed</label>
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
                Board
              </button>
            </div>
            <p className="note">The same seed always builds the same ship, so you can race a friend.</p>
          </form>
        </details>
      )}

      <p className="credit">
        Free software under GPL-3.0. Inspired by Dungeon Crawler on Demand by Red Pangilinan. Icons by Lorc, Delapouite,
        Skoll, Sbed, John Colburn and Lord Berandas from <a href="https://game-icons.net">game-icons.net</a>, CC BY 3.0 (
        <a href="./icons/CREDITS.md">full credits</a>).
      </p>
    </div>
  );
}
