import {
  BAG_SIZE,
  BOONS,
  CRAFT,
  DOOR_TEXT,
  HIDDEN_DOOR,
  RARITIES,
  SANCTUM_REST_HEAL,
  SHRINE_REST_HEAL,
  SLOTS,
  itemScore,
  nextRarity,
  playerStats,
  sacrificeCost,
  temperCost,
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

/** The decision panel: whatever the current moment needs from the player. */
export function Stage({ game, dispatch, speed, newBest, onToggleSpeed, onResolve, onNewRun, onRetry }: StageProps) {
  const { phase, player } = game;
  const stats = playerStats(player);
  const bagFull = player.bag.length >= BAG_SIZE;

  switch (phase.type) {
    case 'doors':
      return (
        <>
          <h2>{phase.doors.length === 1 ? 'One way forward' : 'Choose a door'}</h2>
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
          <h2 className={`foe-name foe-name-${enemy.kind}`}>
            {enemy.name}
            {enemy.kind !== 'normal' && (
              <span className={`tag tag-${enemy.kind}`}>{enemy.kind === 'boss' ? 'lord' : 'champion'}</span>
            )}
          </h2>
          <Meter label={`Level ${enemy.level}`} value={enemy.hp} max={enemy.maxHp} tone="foe" />
          <div className="turns">
            <Meter label="You strike" value={phase.gauge} max={100} tone="turn" showNumbers={false} />
            <Meter label="It strikes" value={enemy.gauge} max={100} tone="turn" showNumbers={false} />
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
          <h2>Loot</h2>
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
          {bagFull && <p className="note warn">Your pack is full. Salvage something to take more.</p>}
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
          <h2>Learn a talent</h2>
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
          <h2>Shrine</h2>
          <p className="note">It will answer once.</p>
          <div className="choices">
            <button className="choice door-shrine" onClick={() => dispatch({ type: 'shrine', choice: 'rest' })}>
              <Icon name="holy-symbol" size="lg" />
              <span className="choice-title">Pray</span>
              <span className="choice-hint">{heal > 0 ? `Recover ${heal} life.` : 'You are already whole.'}</span>
            </button>
            <button
              className="choice door-elite"
              disabled={player.hp <= cost}
              onClick={() => dispatch({ type: 'shrine', choice: 'sacrifice' })}
            >
              <Icon name="heart-drop" size="lg" />
              <span className="choice-title">Blood offering</span>
              <span className="choice-hint">
                {player.hp <= cost ? 'You would not survive it.' : `Lose ${cost} life. Learn a talent.`}
              </span>
            </button>
          </div>
          <div className="actions">
            <button className="btn btn-quiet" onClick={() => dispatch({ type: 'continue' })}>
              Walk away
            </button>
          </div>
        </>
      );
    }

    case 'merchant':
      return (
        <>
          <h2>Peddler's wares</h2>
          <div className="stack">
            {phase.stock.map((entry, index) => (
              <ItemCard key={entry.item.id} item={entry.item} worn={player.equipment[entry.item.slot]} inline>
                <button
                  className="btn"
                  disabled={player.gold < entry.price || bagFull}
                  onClick={() => dispatch({ type: 'buy', index })}
                >
                  {entry.price} gold
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
              Potion · {phase.potionPrice} gold
            </button>
            <button className="btn btn-quiet" onClick={() => dispatch({ type: 'continue' })}>
              Move on
            </button>
          </div>
        </>
      );

    case 'sanctum': {
      const restHeal = Math.min(stats.maxHp - player.hp, Math.round(stats.maxHp * SANCTUM_REST_HEAL));
      const worn = SLOTS.map((slot) => player.equipment[slot]).filter((item) => item !== null);
      // Tiers you hold enough of to transmute into the tier above.
      const transmutable = RARITIES.filter(
        (tier) =>
          nextRarity(tier.id) !== null &&
          player.bag.filter((item) => item.rarity === tier.id).length >= CRAFT.transmuteCount,
      );
      const label = (id: string) => RARITIES.find((tier) => tier.id === id)?.label ?? id;
      const restLabel = restHeal > 0 ? `Rest · +${restHeal} life` : 'Rest';
      return (
        <>
          <h2>
            Sanctum <span className="tag tag-safe">{player.shards} shards</span>
          </h2>
          <div className="actions actions-2">
            <button className="btn" disabled={phase.rested || restHeal <= 0} onClick={() => dispatch({ type: 'rest' })}>
              {phase.rested ? 'Rested' : restLabel}
            </button>
            <button
              className="btn"
              disabled={player.shards < CRAFT.potion}
              onClick={() => dispatch({ type: 'craft', recipe: 'potion' })}
            >
              Brew potion · {CRAFT.potion}
            </button>
          </div>

          <h3>The anvil</h3>
          {worn.length === 0 && transmutable.length === 0 && (
            <p className="note">Nothing to work on yet. The anvil improves gear you are wearing.</p>
          )}
          <div className="stack">
            {worn.map((item) => {
              const maxed = (item.plus ?? 0) >= CRAFT.temperMax;
              const cost = temperCost(item);
              return (
                <ItemCard key={item.id} item={item}>
                  <button
                    className="btn"
                    disabled={maxed || player.shards < cost}
                    onClick={() => dispatch({ type: 'craft', recipe: 'temper', slot: item.slot })}
                  >
                    {maxed ? 'At its limit' : `Temper · ${cost}`}
                  </button>
                  <button
                    className="btn btn-quiet"
                    disabled={player.shards < CRAFT.reforge}
                    onClick={() => dispatch({ type: 'craft', recipe: 'reforge', slot: item.slot })}
                  >
                    Reforge · {CRAFT.reforge}
                  </button>
                </ItemCard>
              );
            })}
            {transmutable.map((tier) => (
              <button
                key={tier.id}
                className="choice door-boon"
                disabled={player.shards < CRAFT.transmute}
                onClick={() => dispatch({ type: 'craft', recipe: 'transmute', rarity: tier.id })}
              >
                <Icon name="crystalize" size="lg" />
                <span className="choice-title">
                  Transmute {CRAFT.transmuteCount} {label(tier.id)} into 1 {label(nextRarity(tier.id) ?? '')}
                </span>
                <span className="choice-hint">
                  Uses three from your pack and {CRAFT.transmute} shards. You cannot choose what comes out.
                </span>
              </button>
            ))}
          </div>
          <p className="note">
            Temper raises every stat on a piece. Reforge remakes it with new stats at this depth's level. Salvage gear
            in your pack for shards.
          </p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'continue' })}>
              Descend to depth {game.floor}
            </button>
          </div>
        </>
      );
    }

    case 'dead':
      return (
        <>
          <h2>Your tale ends here</h2>
          <p className="note">
            Slain by {phase.killedBy} on depth {game.floor}.
          </p>
          {newBest && <p className="best">A new record: depth {game.floor}</p>}
          <dl className="summary">
            <div>
              <dt>Depth</dt>
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
              <dt>Gold</dt>
              <dd>{game.tally.gold}</dd>
            </div>
          </dl>
          <div className="actions actions-2">
            <button className="btn btn-primary" onClick={onNewRun}>
              New dungeon
            </button>
            <button className="btn" onClick={onRetry}>
              Try this one again
            </button>
          </div>
        </>
      );
  }
}
