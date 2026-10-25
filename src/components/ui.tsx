import { useEffect, useState, type ReactNode } from 'react';
import { game } from '../app/context';
import type { GameEvent } from '../game/engine';
import { STAT_LABEL } from '../game/xp';

export function XpBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="xpbar" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label="Zkušenosti">
      <div className="fill" style={{ width: `${pct}%` }} />
      <div className="label">{label ?? `${value} / ${max} XP`}</div>
    </div>
  );
}

export function MiniBar({ value, color = 'var(--gold)' }: { value: number; color?: string }) {
  return (
    <div className="minibar">
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Zavřít">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

interface ToastItem { id: number; icon: string; big: string; text: string; neg?: boolean }

/** Toasty za XP / achievementy / streaky a celoobrazovkový efekt LEVEL UP. */
export function GameFeedback() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null);

  useEffect(() => {
    let n = 0;
    const push = (t: Omit<ToastItem, 'id'>) => {
      const id = ++n;
      setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3100);
    };
    return game.on((e: GameEvent) => {
      if (e.type === 'xp') {
        push({ icon: e.amount > 0 ? '✨' : '↩️', big: `${e.amount > 0 ? '+' : ''}${e.amount} XP`, text: `${STAT_LABEL[e.stat]} · ${e.label}`, neg: e.amount < 0 });
        if (e.amount > 0 && navigator.vibrate) navigator.vibrate(20);
      } else if (e.type === 'achievement') {
        push({ icon: e.achievement.icon, big: 'Odznak!', text: `${e.achievement.title} – ${e.achievement.description}` });
      } else if (e.type === 'streak') {
        push({ icon: '🔥', big: `${e.days} dní`, text: `Bonus za sérii: +${e.xp} XP` });
      } else if (e.type === 'levelup') {
        setLevelUp({ level: e.level, title: e.title });
        if (navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 120]);
      }
    });
  }, []);

  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.neg ? 'neg' : ''}`}>
            <span style={{ fontSize: '1.4rem' }}>{t.icon}</span>
            <span className="big">{t.big}</span>
            <span className="small grow">{t.text}</span>
          </div>
        ))}
      </div>
      {levelUp && (
        <div className="levelup" onClick={() => setLevelUp(null)} role="alertdialog" aria-label="Level up">
          <div className="rays" />
          <div className="box">
            <div className="pixel" style={{ color: 'var(--gold-2)' }}>LEVEL UP!</div>
            <div className="lv">{levelUp.level}</div>
            <div className="title-badge" style={{ fontSize: '1rem' }}>{levelUp.title}</div>
            <p className="muted small" style={{ marginTop: 18 }}>Klepni pro pokračování</p>
          </div>
        </div>
      )}
    </>
  );
}

export function Tabs({ items, active }: { items: { path: string; label: string }[]; active: string }) {
  return (
    <nav className="tabs">
      {items.map((i) => (
        <a key={i.path} href={`#${i.path}`} className={active === i.path ? 'active' : ''}>{i.label}</a>
      ))}
    </nav>
  );
}

export function NumberField({ label, value, onChange, min = 0, step = 1, suffix }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="field">
      <label>{label}{suffix ? ` (${suffix})` : ''}</label>
      <input type="number" inputMode="decimal" min={min} step={step} value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
    </div>
  );
}
