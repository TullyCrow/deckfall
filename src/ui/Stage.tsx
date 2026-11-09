import {
  BAG_SIZE,
  BOONS,
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
                  onClick={() => dispatch({ type: 'chooseDoor', index })}
                >
                  <Icon name={text.icon} size="lg" />
                  <span className="choice-title">{text.title}</span>
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
            {/* Re-keyed on every hit so the flash animation restarts. */}
            <Icon key={enemy.hp} name={enemy.icon} size="xl" className="struck" />
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

    case 'dead':
      return (
        <>
          <h2>Signal lost</h2>
          <p className="note">
            Killed by {phase.killedBy} on deck {game.floor}.
          </p>
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
