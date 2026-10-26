import { useState } from 'react';
import { game, useProfile } from '../../app/context';
import { Modal, XpBar } from '../../components/ui';
import type { FinanceTarget } from '../../data/types';
import { uid } from '../../lib/date';
import { formatDuration, formatMoney, monthlyIncome, monthsToTarget, requiredCapital } from './logic';

const ICONS = ['🏎️', '💸', '🏠', '🏝️', '⌚', '🛥️', '✈️', '🎓', '💎', '🚀'];

function etaText(months: number | null): string {
  if (months === null) return 'při tomhle tempu víc než 100 let';
  if (months === 0) return 'cíl splněn! 🎉';
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `za ${formatDuration(months)} (${d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })})`;
}

/** Velké cíle: kolik procent už mám a kdy je při současném tempu dosáhnu. */
export function FinanceGoals({ total, currency, avgDeposit }: { total: number; currency: string; avgDeposit: number }) {
  const p = useProfile();
  const [editing, setEditing] = useState(false);
  const base = Math.round(avgDeposit > 0 ? avgDeposit : p.financeGoal);
  const [monthly, setMonthly] = useState<number | null>(null);
  const contribution = monthly ?? base;
  const maxSlider = Math.max(50_000, Math.ceil((base * 3) / 1000) * 1000);

  return (
    <section className="panel">
      <div className="row between">
        <h3 style={{ margin: 0 }}>🎯 Velké cíle</h3>
        <button className="btn-sm btn-ghost" onClick={() => setEditing(true)}>Upravit</button>
      </div>

      {p.financeTargets.map((t) => {
        const need = requiredCapital(t, p.financeWithdrawal);
        const pct = Math.min(1, total / need);
        const eta = monthsToTarget(total, contribution, p.financeReturn, need);
        return (
          <div key={t.id} className="list-item">
            <div className="row" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: '1.6rem' }} aria-hidden>{t.icon}</span>
              <div className="grow">
                <b>{t.title}</b>
                <div className="small muted">
                  {t.kind === 'value'
                    ? `${formatMoney(total, currency)} z ${formatMoney(need, currency)}`
                    : `Portfolio by teď dávalo ~${formatMoney(monthlyIncome(total, p.financeWithdrawal), currency)}/měs. · potřeba ${formatMoney(need, currency)}`}
                </div>
              </div>
              <span className="pixel" style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>{(pct * 100).toFixed(pct < 0.1 ? 2 : 1).replace('.', ',')} %</span>
            </div>
            <XpBar value={pct * 1000} max={1000} label={pct >= 1 ? 'SPLNĚNO!' : ' '} />
            <div className="small" style={{ marginTop: 6, color: eta === 0 ? 'var(--green)' : 'var(--muted)' }}>⏳ {etaText(eta)}</div>
          </div>
        );
      })}

      <div style={{ marginTop: 12 }}>
        <label htmlFor="what-if">Co kdybych investoval měsíčně: <b style={{ color: 'var(--gold-2)' }}>{formatMoney(contribution, currency)}</b></label>
        <input id="what-if" type="range" min={0} max={maxSlider} step={500} value={contribution}
          onChange={(e) => setMonthly(Number(e.target.value))} style={{ padding: 0, minHeight: 32, boxShadow: 'none', accentColor: 'var(--gold)' }} />
        <p className="small muted">
          {monthly === null
            ? avgDeposit > 0 ? 'Výchozí hodnota = tvůj průměrný vklad za posledních 6 měsíců.' : 'Výchozí hodnota = tvůj měsíční cíl (zatím nemáš historii vkladů).'
            : <button className="btn-sm btn-ghost" style={{ padding: 0, minHeight: 0 }} onClick={() => setMonthly(null)}>↺ Zpět na můj průměr ({formatMoney(base, currency)})</button>}
          {' '}Odhad počítá s výnosem {p.financeReturn} % ročně a výběrem {p.financeWithdrawal} % ročně – není to investiční doporučení, trh může jít i dolů.
        </p>
      </div>
      <GoalsEditor open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}

function GoalsEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useProfile();
  const [targets, setTargets] = useState<FinanceTarget[]>(p.financeTargets);
  const [ret, setRet] = useState(String(p.financeReturn));
  const [wd, setWd] = useState(String(p.financeWithdrawal));
  const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));
  const update = (i: number, patch: Partial<FinanceTarget>) => setTargets(targets.map((t, k) => (k === i ? { ...t, ...patch } : t)));

  const save = async () => {
    const clean = targets.filter((t) => t.title.trim() && t.target > 0).map((t) => ({ ...t, title: t.title.trim() }));
    await game.saveProfile({
      financeTargets: clean,
      financeReturn: Math.min(30, Math.max(0, num(ret) || 0)),
      financeWithdrawal: Math.min(20, Math.max(0.5, num(wd) || 4)),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Velké cíle">
      {targets.map((t, i) => (
        <div key={t.id} className="panel" style={{ padding: 10 }}>
          <div className="row">
            <select value={t.icon} onChange={(e) => update(i, { icon: e.target.value })} style={{ width: 70 }} aria-label="Ikona">
              {[...new Set([t.icon, ...ICONS])].map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <input value={t.title} onChange={(e) => update(i, { title: e.target.value })} aria-label="Název cíle" />
            <button className="iconbtn btn-ghost" onClick={() => setTargets(targets.filter((_, k) => k !== i))} aria-label="Smazat cíl">🗑</button>
          </div>
          <div className="grid2" style={{ marginTop: 8 }}>
            <select value={t.kind} onChange={(e) => update(i, { kind: e.target.value as FinanceTarget['kind'] })} aria-label="Typ cíle">
              <option value="value">Částka (věc)</option>
              <option value="income">Příjem měsíčně</option>
            </select>
            <input type="number" inputMode="numeric" value={t.target} onChange={(e) => update(i, { target: Number(e.target.value) })} aria-label="Cílová částka" />
          </div>
        </div>
      ))}
      <button className="btn-block" onClick={() => setTargets([...targets, { id: uid(), kind: 'value', title: '', icon: '🚀', target: 100_000 }])}>+ Přidat cíl</button>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="field"><label>Očekávaný výnos % ročně</label><input inputMode="decimal" value={ret} onChange={(e) => setRet(e.target.value)} /></div>
        <div className="field"><label>Výběr z portfolia % ročně</label><input inputMode="decimal" value={wd} onChange={(e) => setWd(e.target.value)} /></div>
      </div>
      <p className="small muted">U cíle „příjem měsíčně“ se potřebná částka počítá tak, aby výběr {wd} % ročně pokryl tvůj měsíční příjem (pravidlo 4 %).</p>
      <button className="primary btn-block" onClick={save}>Uložit cíle</button>
    </Modal>
  );
}
