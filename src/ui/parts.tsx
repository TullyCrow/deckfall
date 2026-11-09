import { useEffect, useRef, type ReactNode } from 'react';
import { RARITIES, STAT_KEYS, STAT_LABEL, itemName, type Item, type Mods, type Slot, type StatKey } from '../engine';

export const SLOT_LABEL: Record<Slot, string> = { weapon: 'Weapon', armour: 'Armour', trinket: 'Trinket' };

export function formatMod(key: StatKey, value: number): string {
  const label = STAT_LABEL[key];
  return `${value < 0 ? '−' : '+'}${Math.abs(value)}${label.startsWith('%') ? '' : ' '}${label}`;
}

export function modLines(mods: Mods): string[] {
  return STAT_KEYS.filter((key) => mods[key]).map((key) => formatMod(key, mods[key] as number));
}

/** What changes, stat by stat, if `item` replaces `worn`. */
function compare(item: Item, worn: Item | null): { text: string; better: boolean }[] {
  return STAT_KEYS.map((key) => ({ key, delta: (item.mods[key] ?? 0) - (worn?.mods[key] ?? 0) }))
    .filter(({ delta }) => delta !== 0)
    .map(({ key, delta }) => ({ text: formatMod(key, delta), better: delta > 0 }));
}

/** How much `value` changed since the previous render. Used for damage numbers and flinches. */
export function useDelta(value: number): number {
  const previous = useRef(value);
  const delta = value - previous.current;
  useEffect(() => {
    previous.current = value;
  });
  return delta;
}

export const spriteUrl = (name: string) => `./sprites/${name}.png`;

/** A 32-pixel sprite from public/sprites, drawn with hard pixel edges at whatever size CSS gives it. */
export function Sprite({ name, className = '' }: { name: string; className?: string }) {
  return <img className={`px ${className}`} src={spriteUrl(name)} alt="" draggable={false} />;
}

interface IconProps {
  name: string;
  size?: 'md' | 'lg';
  className?: string;
}

/** A single-colour picture from public/icons, drawn in the current text colour. */
export function Icon({ name, size = 'md', className = '' }: IconProps) {
  const image = `url("./icons/${name}.svg")`;
  return (
    <span
      className={`icon icon-${size} ${className}`}
      aria-hidden="true"
      style={{ maskImage: image, WebkitMaskImage: image }}
    />
  );
}

interface OrbProps {
  kind: 'life' | 'wrath';
  label: string;
  value: number;
  max: number;
  /** Draws attention: low life, or wrath ready to spend. */
  urgent?: boolean;
}

/** A glass globe that fills from the bottom: red for life on the left, blue for wrath on the right. */
export function Orb({ kind, label, value, max, urgent = false }: OrbProps) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={`orb orb-${kind} ${urgent ? 'orb-urgent' : ''}`}
      role="img"
      aria-label={`${label}: ${Math.round(value)} of ${Math.round(max)}`}
    >
      <div className="orb-fill" style={{ height: `${percent}%` }} />
      <span className="orb-num">{Math.round(value)}</span>
    </div>
  );
}

interface MeterProps {
  label: string;
  value: number;
  max: number;
  tone: 'foe' | 'turn' | 'xp';
  showNumbers?: boolean;
}

export function Meter({ label, value, max, tone, showNumbers = true }: MeterProps) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`meter meter-${tone}`}>
      {tone !== 'xp' && (
        <div className="meter-head">
          <span>{label}</span>
          {showNumbers && (
            <span className="num">
              {Math.round(value)} / {Math.round(max)}
            </span>
          )}
        </div>
      )}
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(value)}
      >
        <div className="meter-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

interface ItemCardProps {
  item: Item;
  /** Pass the item worn in the same slot (or null) to show a comparison. */
  worn?: Item | null;
  /** Put the buttons beside the text instead of on their own row. For cards with a single button. */
  inline?: boolean;
  children?: ReactNode;
}

export function ItemCard({ item, worn, inline = false, children }: ItemCardProps) {
  const rarity = RARITIES.find((r) => r.id === item.rarity);
  const changes = worn !== undefined ? compare(item, worn) : null;
  return (
    <div className={`item rarity-${item.rarity}`}>
      <span className="slot">
        <Sprite name={item.icon} />
      </span>
      <div className="item-body">
        <div className="item-name">{itemName(item)}</div>
        <div className="item-meta">
          {rarity?.label} {SLOT_LABEL[item.slot].toLowerCase()} · level {item.level}
        </div>
        <div className="item-mods">{modLines(item.mods).join(' · ')}</div>
        {changes && (
          <div className="item-compare">
            {worn === null ? (
              'Nothing worn in this slot'
            ) : changes.length === 0 ? (
              'Same as what you wear'
            ) : (
              <>
                vs worn:{' '}
                {changes.map((change, index) => (
                  <span key={change.text} className={change.better ? 'up' : 'down'}>
                    {index > 0 && ', '}
                    {change.text}
                  </span>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      {children && <div className={`item-actions ${inline ? 'item-actions-inline' : ''}`}>{children}</div>}
    </div>
  );
}

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** A panel that slides up from the bottom of the screen. Closes on Escape, the Close button or a tap outside. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="sheet-body">
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="btn btn-quiet btn-small" onClick={onClose}>
            Close
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
