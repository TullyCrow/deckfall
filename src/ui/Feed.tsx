import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine';
import { Icon, useDelta } from './parts';

/**
 * The salvager's suit camera: a photograph of wherever they are, treated to look like
 * a failing video feed, with whatever is in the room drawn over it.
 *
 * The photographs are real spacecraft interiors from NASA (see CREDITS.md). Nothing
 * here affects play; it is all decoration, and it is hidden from screen readers.
 */

/** Frames that flash up for an instant on the deeper decks. */
const INTRUSIONS = ['helmet', 'guardian', 'lift'] as const;

/** Which photograph fits the moment, or null to keep showing the last one. */
function sceneFor(game: GameState): string | null {
  const { phase } = game;
  switch (phase.type) {
    case 'doors':
      if (phase.doors[0]?.kind === 'boss') return 'guardian';
      if (phase.doors[0]?.kind === 'stairs') return 'lift';
      return game.floor >= 4 ? 'dark' : 'corridor';
    case 'combat':
      if (phase.room === 'boss') return 'guardian';
      if (phase.room === 'elite') return 'elite';
      if (phase.room === 'treasure') return 'cargo';
      return 'fight';
    case 'shrine':
      return 'medbay';
    case 'merchant':
      return 'trader';
    case 'pod':
      return 'glow';
    case 'dead':
      return 'helmet';
    case 'loot':
    case 'boon':
      return null;
  }
}

/** Now and then, for about a tenth of a second, the feed shows something else. */
function useIntrusion(active: boolean): string | null {
  const [frame, setFrame] = useState<string | null>(null);
  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: number;
    const arm = () => {
      timer = window.setTimeout(
        () => {
          setFrame(INTRUSIONS[Math.floor(Math.random() * INTRUSIONS.length)] as string);
          timer = window.setTimeout(
            () => {
              setFrame(null);
              arm();
            },
            90 + Math.random() * 70,
          );
        },
        20000 + Math.random() * 45000,
      );
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [active]);
  return frame;
}

const image = (name: string) => ({ backgroundImage: `url("./scenes/${name}.jpg")` });

export function Feed({ game }: { game: GameState }) {
  const { phase, player } = game;

  const lastScene = useRef('corridor');
  const scene = sceneFor(game) ?? lastScene.current;
  useEffect(() => {
    lastScene.current = scene;
  }, [scene]);

  const enemy = phase.type === 'combat' ? phase.enemy : null;
  const found = phase.type === 'loot' ? phase.items[0] : undefined;
  const dead = phase.type === 'dead';
  const playerDelta = useDelta(player.hp);
  const safe = phase.type === 'pod';
  // The pod is the one place the feed never shows you anything else. Until deck 8.
  const intrusion = useIntrusion(game.floor >= 4 && !dead && (!safe || game.floor >= 8));

  // A clock that only moves when the game does, so the same seed shows the same timestamps.
  const seconds = game.tally.turns * 7 + game.floor * 131;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <section className={`feed feed-${phase.type}`} aria-hidden="true">
      <div key={scene} className="feed-scene" style={image(scene)} />
      {intrusion && <div className="feed-intrusion" style={image(intrusion)} />}

      {enemy && (
        <div className={`sprite sprite-${enemy.kind}`}>
          <Icon name={enemy.icon} size="sprite" className="sprite-ghost" />
          {/* Re-keyed on every exchange so the lunge or flinch animation restarts. */}
          <Icon
            key={`${enemy.hp}:${player.hp}`}
            name={enemy.icon}
            size="sprite"
            className={playerDelta < 0 ? 'sprite-lunge' : 'sprite-struck'}
          />
        </div>
      )}
      {found && (
        <div className={`sprite sprite-found rarity-${found.rarity}`}>
          <Icon name={found.icon} size="sprite" />
        </div>
      )}

      {/* Re-keyed whenever the picture or the situation changes, which replays a burst of static. */}
      <div key={`${scene}:${phase.type}`} className="feed-static" />

      <span className="feed-hud feed-hud-tl">
        <i className="rec" /> {dead ? 'NO SIGNAL' : safe ? 'SAFE' : 'REC'} · CAM {String((game.floor % 4) + 1).padStart(2, '0')}
      </span>
      <span className="feed-hud feed-hud-br">
        DECK {String(game.floor).padStart(2, '0')} · {clock}
      </span>
    </section>
  );
}
