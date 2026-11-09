import { useEffect, useState } from 'react';
import { regionOf, type Door, type GameState } from '../engine';
import { Sprite, spriteUrl, useDelta } from './parts';

/**
 * The room the hero is standing in, drawn from 32-pixel tiles: a wall along the top,
 * a floor, the hero by torchlight on the left and whatever they face on the right.
 *
 * Nothing here affects play. It is the picture; the choices are made in the panel below,
 * and screen readers skip this entirely.
 */

/** Things that stand in the far dark for an instant, on the deeper levels, and are not in the room. */
const APPARITIONS = ['reaper', 'hellion', 'revenant'] as const;

function useApparition(active: boolean): string | null {
  const [seen, setSeen] = useState<string | null>(null);
  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: number;
    const arm = () => {
      timer = window.setTimeout(
        () => {
          setSeen(APPARITIONS[Math.floor(Math.random() * APPARITIONS.length)] as string);
          timer = window.setTimeout(
            () => {
              setSeen(null);
              arm();
            },
            110 + Math.random() * 90,
          );
        },
        20000 + Math.random() * 45000,
      );
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [active]);
  return seen;
}

function doorSprite(door: Door): string {
  if (door.kind === 'boss') return 'gate';
  if (door.kind === 'stairs') return 'stairs';
  if (door.kind === 'elite' && !door.hidden) return 'door_barred';
  return 'door';
}

export function Scene({ game }: { game: GameState }) {
  const { phase, player } = game;
  const region = regionOf(game.floor);
  const enemy = phase.type === 'combat' ? phase.enemy : null;
  const found = phase.type === 'loot' ? phase.items[0] : undefined;
  const dead = phase.type === 'dead';
  const safe = phase.type === 'sanctum';

  // Blows show as numbers that rise and fade, and as a lunge from whoever struck.
  const foeDelta = useDelta(enemy?.hp ?? 0);
  const heroDelta = useDelta(player.hp);
  const lastCue = game.log.at(-1)?.cue;
  const heavy = lastCue === 'crit' || lastCue === 'smite';
  const apparition = useApparition(game.floor >= 4 && !dead && !safe);

  const tile = (name: string) => ({ backgroundImage: `url("${spriteUrl(name)}")` });

  return (
    <section className={`scene scene-${phase.type} region-${region.id}`} aria-hidden="true">
      <div className="scene-floor px" style={tile(`floor_${region.id}`)} />
      <div className="scene-wall px" style={tile(`wall_${region.id}`)} />

      {phase.type === 'doors' && (
        <div className="scene-doors">
          {phase.doors.map((door, index) => (
            <Sprite key={index} name={doorSprite(door)} className={door.hidden ? 'door-unlit' : ''} />
          ))}
        </div>
      )}
      {phase.type === 'shrine' && <Sprite name={game.floor >= 5 ? 'fountain_blood' : 'altar'} className="prop" />}
      {phase.type === 'merchant' && <Sprite name="shop" className="prop" />}
      {safe && (
        <>
          <Sprite name="statue_angel" className="prop prop-left" />
          <Sprite name="fountain" className="prop" />
        </>
      )}
      {phase.type === 'boon' && <div className="scene-glow" />}

      {dead && <Sprite name="blood" className="actor hero-blood" />}
      <div className={`actor hero ${dead ? 'hero-dead' : ''}`}>
        {/* Re-keyed on each exchange so the lunge or flinch restarts. */}
        <Sprite
          key={`${enemy?.hp ?? 'idle'}:${player.hp}`}
          name="hero"
          className={enemy && foeDelta < 0 ? 'strike-right' : heroDelta < 0 ? 'flinch' : ''}
        />
        {heroDelta < 0 && !dead && (
          <span key={`hurt-${player.hp}`} className="dmg dmg-hero">
            {-heroDelta}
          </span>
        )}
        {heroDelta > 0 && (
          <span key={`heal-${player.hp}`} className="dmg dmg-heal">
            +{heroDelta}
          </span>
        )}
      </div>

      {enemy && (
        <div className={`actor foe foe-${enemy.kind}`}>
          <Sprite
            key={`${enemy.hp}:${player.hp}`}
            name={enemy.icon}
            className={heroDelta < 0 ? 'strike-left' : foeDelta < 0 ? 'flinch' : 'arrive'}
          />
          {foeDelta < 0 && (
            <span key={`hit-${enemy.hp}`} className={`dmg dmg-foe ${heavy ? 'dmg-heavy' : ''}`}>
              {-foeDelta}
            </span>
          )}
        </div>
      )}

      {found && (
        <div className={`actor drop rarity-${found.rarity}`}>
          {found.rarity !== 'common' && <span className="beam" />}
          <Sprite name={found.icon} />
        </div>
      )}

      {apparition && <Sprite name={apparition} className="apparition" />}

      {/* Torchlight: a pool of light round the hero, darkness everywhere else. */}
      <div className="scene-dark" />
      <span className="scene-label">
        {region.name} · depth {game.floor}
      </span>
      {dead && <span className="scene-slain">You are slain</span>}
    </section>
  );
}
