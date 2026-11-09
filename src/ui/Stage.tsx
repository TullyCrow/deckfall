import { useEffect, useState } from 'react';
import {
  BAG_SIZE,
  BOONS,
  CRAFT,
  POD_REST_HEAL,
  RARITIES,
  SLOTS,
  nextRarity,
  overclockCost,
  DOOR_TEXT,
  HIDDEN_DOOR,
  SHRINE_REST_HEAL,
  itemScore,
  playerStats,
  sacrificeCost,
  type Action,
  type GameState,
} from '../engine';
import { Icon, ItemCard, Meter } from './parts';

/** Words that briefly replace a hatch label on the deeper decks. The player is not meant to be sure they saw them. */
const INTRUSIONS = ['behind you', 'not this one', 'you again', 'it heard that', 'still here', 'turn around', 'do not sleep'];

/**
 * A label that, when `active`, is replaced for a fraction of a second every so often.
 * Purely for unease: it never changes what the hatch is. Off when the player prefers reduced motion.
 */
function Unsteady({ text, active }: { text: string; active: boolean }) {
  const [intrusion, setIntrusion] = useState<string | null>(null);
  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: number;
    const arm = () => {
      timer = window.setTimeout(() => {
        setIntrusion(INTRUSIONS[Math.floor(Math.random() * INTRUSIONS.length)] as string);
        timer = window.setTimeout(() => {
          setIntrusion(null);
          arm();
        }, 130 + Math.random() * 170);
      }, 7000 + Math.random() * 24000);
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [active]);
  return <span className={`choice-title ${intrusion ? 'intrusion' : ''}`}>{intrusion ?? text}</span>;
}

interface StageProps {
  game: GameState;
  dispatch: (action: Action) => void;
  speed: 1 | 2;
  newBest: boolean;
  onToggleSpeed: () => void;
  onResolve: () => void;
  onNewRun: () => void;
  onRetry: () => void;
}

/** The decision area at the bottom of the screen: whatever the current phase needs from the player. */
export function Stage({ game, dispatch, speed, newBest, onToggleSpeed, onResolve, onNewRun, onRetry }: StageProps) {
  const { phase, player } = game;
  const stats = playerStats(player);
  const bagFull = player.bag.length >= BAG_SIZE;

  switch (phase.type) {
    case 'doors':
      return (
        <>
          <h2>{phase.doors.length === 1 ? 'One way forward' : 'Choose a hatch'}</h2>
          <div className="choices">
            {phase.doors.map((door, index) => {
              const text = door.hidden ? HIDDEN_DOOR : DOOR_TEXT[door.kind];
              return (
                <button
                  key={index}
                  className={`choice ${door.hidden ? 'door-hidden' : `door-${door.kind}`}`}
                  aria-label={`${text.title}. ${text.hint}`}
                  onClick={() => dispatch({ type: 'chooseDoor', index })}
                >
                  <Icon name={text.icon} size="lg" />
                  <Unsteady text={text.title} active={game.floor >= 3} />
                  <span className="choice-hint">{text.hint}</span>
                </button>
              );
            })}
          </div>
        </>
      );

    case 'combat': {
      const { enemy } = phase;
      return (
        <>
          <div className={`foe foe-${enemy.kind}`}>
            <div className="foe-info">
              <h2>
                {enemy.name}
                {enemy.kind !== 'normal' && <span className={`tag tag-${enemy.kind}`}>{enemy.kind}</span>}
              </h2>
              <Meter label={`Level ${enemy.level}`} value={enemy.hp} max={enemy.maxHp} tone="foe" />
              <p className="note num">
                ATK {enemy.atk} · DEF {enemy.def} · SPD {enemy.spd}
              </p>
            </div>
          </div>
          <div className="turns">
            <Meter label="You act" value={phase.gauge} max={100} tone="turn" showNumbers={false} />
            <Meter label="It acts" value={enemy.gauge} max={100} tone="turn" showNumbers={false} />
          </div>
          <div className="actions actions-3">
            <button className="btn" disabled={enemy.kind === 'boss'} onClick={() => dispatch({ type: 'flee' })}>
              {enemy.kind === 'boss' ? 'No escape' : 'Flee'}
            </button>
            <button className="btn btn-quiet" onClick={onToggleSpeed} aria-label={`Combat speed ${speed} times. Tap to change.`}>
              Speed {speed}×
            </button>
            <button className="btn btn-quiet" onClick={onResolve}>
              Skip to end
            </button>
          </div>
        </>
      );
    }

    case 'loot':
      return (
        <>
          <h2>Salvage</h2>
          <div className="stack">
            {phase.items.map((item, index) => {
              const worn = player.equipment[item.slot];
              const better = itemScore(item) > itemScore(worn);
              return (
                <ItemCard key={item.id} item={item} worn={worn}>
                  <button
                    className={`btn ${better ? 'btn-primary' : ''}`}
                    onClick={() => dispatch({ type: 'equipLoot', index })}
                  >
                    Equip
                  </button>
                  <button className="btn" disabled={bagFull} onClick={() => dispatch({ type: 'takeLoot', index })}>
                    Take
                  </button>
                </ItemCard>
              );
            })}
          </div>
          {bagFull && <p className="note warn">Your pack is full. Scrap something to take more.</p>}
          <div className="actions">
            <button className="btn btn-quiet" onClick={() => dispatch({ type: 'continue' })}>
              Leave the rest
            </button>
          </div>
        </>
      );

    case 'boon':
      return (
        <>
          <h2>Choose an augment</h2>
          <div className="choices">
            {phase.choices.map((id, index) => {
              const boon = BOONS.find((b) => b.id === id);
              if (!boon) return null;
              return (
                <button key={id} className="choice door-boon" onClick={() => dispatch({ type: 'chooseBoon', index })}>
                  <Icon name={boon.icon} size="lg" />
                  <span className="choice-title">{boon.name}</span>
                  <span className="choice-hint">{boon.desc}</span>
                </button>
              );
            })}
          </div>
          {game.pendingBoons > 1 && <p className="note">{game.pendingBoons - 1} more to choose after this.</p>}
        </>
      );

    case 'shrine': {
      const cost = sacrificeCost(player);
      const heal = Math.min(stats.maxHp - player.hp, Math.round(stats.maxHp * SHRINE_REST_HEAL));
      return (
        <>
          <h2>Auto-surgeon</h2>
          <p className="note">It has power for one procedure.</p>
          <div className="choices">
            <button className="choice door-shrine" onClick={() => dispatch({ type: 'shrine', choice: 'rest' })}>
              <Icon name="medical-pack" size="lg" />
              <span className="choice-title">Patch me up</span>
              <span className="choice-hint">{heal > 0 ? `Recover ${heal} HP.` : 'You are already at full health.'}</span>
            </button>
            <button
              className="choice door-elite"
              disabled={player.hp <= cost}
              onClick={() => dispatch({ type: 'shrine', choice: 'sacrifice' })}
            >
              <Icon name="cyber-eye" size="lg" />
              <span className="choice-title">Upgrade me</span>
              <span className="choice-hint">
                {player.hp <= cost ? 'You would not survive it.' : `Lose ${cost} HP. Choose an augment.`}
              </span>
            </button>
          </div>
          <div className="actions">
            <button className="btn btn-quiet" onClick={() => dispatch({ type: 'continue' })}>
              Leave it alone
            </button>
          </div>
        </>
      );
    }

    case 'merchant':
      return (
        <>
          <h2>Scavenger's stock</h2>
          <div className="stack">
            {phase.stock.map((entry, index) => (
              <ItemCard key={entry.item.id} item={entry.item} worn={player.equipment[entry.item.slot]} inline>
                <button
                  className="btn"
                  disabled={player.gold < entry.price || bagFull}
                  onClick={() => dispatch({ type: 'buy', index })}
                >
                  Buy · {entry.price} cr
                </button>
              </ItemCard>
            ))}
            {phase.stock.length === 0 && <p className="note">Sold out.</p>}
          </div>
          <div className="actions actions-2">
            <button
              className="btn"
              disabled={player.gold < phase.potionPrice}
              onClick={() => dispatch({ type: 'buyPotion' })}
            >
              Stim · {phase.potionPrice} cr
            </button>
            <button className="btn btn-quiet" onClick={() => dispatch({ type: 'continue' })}>
              Move on
            </button>
          </div>
        </>
      );

    case 'pod': {
      const restHeal = Math.min(stats.maxHp - player.hp, Math.round(stats.maxHp * POD_REST_HEAL));
      const worn = SLOTS.map((slot) => player.equipment[slot]).filter((item) => item !== null);
      // Tiers you hold enough of to fuse into the tier above.
      const fusable = RARITIES.filter(
        (tier) =>
          nextRarity(tier.id) !== null &&
          player.bag.filter((item) => item.rarity === tier.id).length >= CRAFT.fuseCount,
      );
      const label = (id: string) => RARITIES.find((tier) => tier.id === id)?.label ?? id;
      return (
        <>
          <h2>
            Safe pod <span className="tag tag-safe">{player.parts} parts</span>
          </h2>
          <div className="actions actions-2">
            <button className="btn" disabled={phase.rested || restHeal <= 0} onClick={() => dispatch({ type: 'rest' })}>
              {phase.rested ? 'Rested' : restHeal > 0 ? `Rest · +${restHeal} HP` : 'Rest'}
            </button>
            <button
              className="btn"
              disabled={player.parts < CRAFT.stim}
              onClick={() => dispatch({ type: 'craft', recipe: 'stim' })}
            >
              Mix a stim · {CRAFT.stim} parts
            </button>
          </div>

          <h3>Workbench</h3>
          {worn.length === 0 && fusable.length === 0 && (
            <p className="note">Nothing to work on yet. The bench improves gear you are wearing.</p>
          )}
          <div className="stack">
            {worn.map((item) => {
              const maxed = (item.plus ?? 0) >= CRAFT.overclockMax;
              const cost = overclockCost(item);
              return (
                <ItemCard key={item.id} item={item}>
                  <button
                    className="btn"
                    disabled={maxed || player.parts < cost}
                    onClick={() => dispatch({ type: 'craft', recipe: 'overclock', slot: item.slot })}
                  >
                    {maxed ? 'At its limit' : `Overclock · ${cost}`}
                  </button>
                  <button
                    className="btn btn-quiet"
                    disabled={player.parts < CRAFT.recalibrate}
                    onClick={() => dispatch({ type: 'craft', recipe: 'recalibrate', slot: item.slot })}
                  >
                    Re-roll · {CRAFT.recalibrate}
                  </button>
                </ItemCard>
              );
            })}
            {fusable.map((tier) => (
              <button
                key={tier.id}
                className="choice door-boon"
                disabled={player.parts < CRAFT.fuse}
                onClick={() => dispatch({ type: 'craft', recipe: 'fuse', rarity: tier.id })}
              >
                <Icon name="atom-core" size="lg" />
                <span className="choice-title">
                  Fuse {CRAFT.fuseCount} {label(tier.id)} into 1 {label(nextRarity(tier.id) ?? '')}
                </span>
                <span className="choice-hint">
                  Uses three from your pack and {CRAFT.fuse} parts. You cannot choose what comes out.
                </span>
              </button>
            ))}
          </div>
          <p className="note">
            Overclock raises every stat on a piece. Re-roll rebuilds it with new stats at this deck's level. Scrap gear
            in your pack for parts.
          </p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'continue' })}>
              Open the hatch to deck {game.floor}
            </button>
          </div>
        </>
      );
    }

    case 'dead':
      return (
        <>
          <div className="foe foe-boss">
            <Icon name="terror" size="xl" />
            <div className="foe-info">
              <h2>Signal lost</h2>
              <p className="note">
                Killed by {phase.killedBy} on deck {game.floor}. Your suit recorder ran for another{' '}
                {11 + (game.tally.turns % 47)} minutes.
              </p>
            </div>
          </div>
          {newBest && <p className="best">New best: deck {game.floor}</p>}
          <dl className="summary">
            <div>
              <dt>Deck</dt>
              <dd>{game.floor}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{player.level}</dd>
            </div>
            <div>
              <dt>Kills</dt>
              <dd>{game.tally.kills}</dd>
            </div>
            <div>
              <dt>Credits</dt>
              <dd>{game.tally.gold}</dd>
            </div>
          </dl>
          <div className="actions actions-2">
            <button className="btn btn-primary" onClick={onNewRun}>
              New ship
            </button>
            <button className="btn" onClick={onRetry}>
              Retry this ship
            </button>
          </div>
        </>
      );
  }
}
