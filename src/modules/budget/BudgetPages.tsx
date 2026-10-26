import { useEffect, useState } from 'react';
import { game, store, useProfile, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { navigate } from '../../app/router';
import { LineChart } from '../../components/Charts';
import { QuestList } from '../../components/Quests';
import { Empty, MiniBar, Tabs } from '../../components/ui';
import type { Expense } from '../../data/types';
import { addMonths, dateKey, formatDate, monthKey, uid } from '../../lib/date';
import { formatDuration, monthsToTarget, requiredCapital } from '../finance/logic';
import {
  IN_CATEGORIES, MONTH_BUDGET_XP, OUT_CATEGORIES, categoryOf, formatKc, lastMonths, monthInBudget, monthLabel,
  monthSummary, parseAmount, savingsRate, totalLimit,
} from './logic';

const TABS = [
  { path: '/budget', label: 'Přehled' },
  { path: '/budget/add', label: '+ Zápis' },
  { path: '/budget/history', label: 'Historie' },
  { path: '/budget/plan', label: 'Rozpočet' },
];

function useExpenses() {
  return useQuery(async () => (await store.col('expenses').all()).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts));
}

/** Po začátku nového měsíce vyhodnotí ten minulý (bonus za měsíc v rozpočtu). */
let checkedMonth = '';
async function checkLastMonth(list: Expense[], limits: Partial<Record<string, number>>, income: number) {
  const prev = addMonths(monthKey(), -1);
  const id = `budgetMonth:${prev}`;
  if (checkedMonth === prev) return;
  checkedMonth = prev;
  if (await store.col('meta').get(id)) return;
  const s = monthSummary(list, prev, income);
  if (!s.entries) return;
  const ok = monthInBudget(s, limits);
  await store.col('meta').put({ id, value: ok });
  if (ok) await game.award({ amount: MONTH_BUDGET_XP, stat: 'dis', module: 'budget', label: `Měsíc v rozpočtu (${monthLabel(prev)})` });
  else await game.checkAchievements();
}

/** Zápis se počítá do denního questu (stačí jeden za den). */
async function logged(date: string) {
  if (date === dateKey()) await game.progressQuest('bud-log');
}

function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
      <button className="btn-sm" onClick={() => onChange(addMonths(month, -1))} aria-label="Předchozí měsíc">‹</button>
      <b className="pixel" style={{ textTransform: 'uppercase' }}>{monthLabel(month)}</b>
      <button className="btn-sm" onClick={() => onChange(addMonths(month, 1))} disabled={month >= monthKey()} aria-label="Další měsíc">›</button>
    </div>
  );
}

/** Kolik dřív by byl splněný první velký cíl z Financí, kdyby se investovalo i to, co zbývá. */
function GoalHint({ extra }: { extra: number }) {
  const p = useProfile();
  const snap = useQuery(async () => (await store.col('financeSnapshots').all()).sort((a, b) => b.ts - a.ts)[0]);
  const target = p.financeTargets[0];
  if (!snap || !target || extra <= 0 || !['CZK', 'Kč'].includes(snap.currency) || !p.financeGoal) return null;
  const need = requiredCapital(target, p.financeWithdrawal);
  const base = monthsToTarget(snap.total, p.financeGoal, p.financeReturn, need);
  const more = monthsToTarget(snap.total, p.financeGoal + extra, p.financeReturn, need);
  if (base === null || more === null || base - more < 1) return null;
  return (
    <p className="small" style={{ marginTop: 8 }}>
      {target.icon} Kdybys investoval i zbývajících <b>{formatKc(extra)}</b>, {target.title} bys měl o <b>{formatDuration(base - more)}</b> dřív.
    </p>
  );
}

function BudgetHome() {
  const p = useProfile();
  const list = useExpenses();
  const quests = useQuests('budget');
  const [month, setMonth] = useState(monthKey());
  useEffect(() => {
    if (list) checkLastMonth(list, p.budgetLimits, p.budgetIncome);
  }, [list, p.budgetLimits, p.budgetIncome]);
  if (!list) return null;
  const s = monthSummary(list, month, p.budgetIncome);
  const rate = savingsRate(s);
  const limit = totalLimit(p.budgetLimits);
  const cats = OUT_CATEGORIES.map((c) => ({ ...c, spent: s.byCategory[c.id] ?? 0, limit: p.budgetLimits[c.id] ?? 0 }))
    .filter((c) => c.spent > 0 || c.limit > 0)
    .sort((a, b) => b.spent - a.spent);
  const months = lastMonths(6);
  const sums = months.map((m) => monthSummary(list, m, p.budgetIncome));
  const isNow = month === monthKey();
  const investable = Math.max(0, s.left - p.financeGoal);

  return (
    <div>
      <h1>💸 Rozpočet</h1>
      <Tabs items={TABS} active="/budget" />
      <section className="panel gold">
        <MonthPicker month={month} onChange={setMonth} />
        <div className="grid3" style={{ marginBottom: 10 }}>
          {[['Příjmy', s.income, 'var(--green)'], ['Výdaje', s.spent, 'var(--red)'], ['Zbývá', s.left, s.left >= 0 ? 'var(--gold)' : 'var(--red)']].map(([l, v, c]) => (
            <div key={l as string} className="center">
              <div className="pixel" style={{ color: c as string, fontSize: '0.9rem' }}>{formatKc(v as number)}</div>
              <div className="small muted">{l}</div>
            </div>
          ))}
        </div>
        {limit > 0 && (
          <>
            <div className="row small" style={{ justifyContent: 'space-between' }}>
              <span>Rozpočet {formatKc(s.spent)} / {formatKc(limit)}</span>
              <b style={{ color: s.spent > limit ? 'var(--red)' : 'var(--green)' }}>{s.spent > limit ? 'Překročeno!' : `zbývá ${formatKc(limit - s.spent)}`}</b>
            </div>
            <MiniBar value={Math.min(1, s.spent / limit)} color={s.spent > limit ? 'var(--red)' : 'var(--m-budget)'} />
          </>
        )}
        {rate !== null && (
          <p className="small" style={{ marginBottom: 0 }}>
            Ušetříš <b style={{ color: rate >= 0.2 ? 'var(--green)' : rate >= 0 ? 'var(--gold)' : 'var(--red)' }}>{Math.round(rate * 100)} %</b> příjmu
            {p.financeGoal > 0 && <> · investiční cíl {formatKc(p.financeGoal)} {s.left >= p.financeGoal ? '✅' : '⚠️'}</>}
          </p>
        )}
        {isNow && <GoalHint extra={investable} />}
        {!p.budgetIncome && !s.income && (
          <p className="small muted" style={{ marginBottom: 0 }}>Tip: v záložce <a href="#/budget/plan">Rozpočet</a> si nastav příjem a limity – appka pak hlídá, kolik ti zbývá.</p>
        )}
      </section>

      {isNow && (
        <>
          <QuestList quests={quests ?? []} />
          <div className="grid2" style={{ marginBottom: 12 }}>
            <a className="btn primary" href="#/budget/add">+ Přidat výdaj</a>
            <button onClick={async () => {
              await store.col('meta').put({ id: `budgetNone:${dateKey()}`, value: true });
              await logged(dateKey());
            }}>🙌 Dnes jsem nic neutratil</button>
          </div>
        </>
      )}

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Kam mizí peníze</h2>
        {cats.length === 0 && <Empty>Tento měsíc zatím žádné výdaje.</Empty>}
        {cats.map((c) => {
          const over = c.limit > 0 && c.spent > c.limit;
          return (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div className="row small" style={{ justifyContent: 'space-between' }}>
                <span>{c.icon} {c.label}</span>
                <span style={{ color: over ? 'var(--red)' : undefined }}>
                  {formatKc(c.spent)}{c.limit > 0 && <span className="muted"> / {formatKc(c.limit)}</span>}
                </span>
              </div>
              <MiniBar value={c.limit > 0 ? Math.min(1, c.spent / c.limit) : s.spent ? c.spent / s.spent : 0} color={over ? 'var(--red)' : c.color} />
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Posledních 6 měsíců</h2>
        <LineChart
          labels={months.map((m) => monthLabel(m).split(' ')[0].slice(0, 3))}
          series={[
            { label: 'Příjmy', data: sums.map((x) => (x.entries && x.income) || null), color: '#4ade80' },
            { label: 'Výdaje', data: sums.map((x) => x.spent || null), color: '#f87171', fill: true },
          ]}
          yMin={0}
        />
      </section>
    </div>
  );
}

function BudgetAdd() {
  const [kind, setKind] = useState<Expense['kind']>('out');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(dateKey());
  const [msg, setMsg] = useState('');
  const cats = kind === 'out' ? OUT_CATEGORIES : IN_CATEGORIES;
  const value = parseAmount(amount);

  const save = async () => {
    if (!value) return;
    const [typed, typedNote] = [amount, note];
    await store.col('expenses').put({ id: uid(), ts: Date.now(), date, amount: value, kind, category, note: note.trim() });
    setMsg(`Uloženo ✓ ${kind === 'out' ? '−' : '+'}${formatKc(value)} · ${categoryOf(category).label}`);
    // vyčistit jen to, co se uložilo (mezitím už může být napsaná další částka)
    setAmount((cur) => (cur === typed ? '' : cur));
    setNote((cur) => (cur === typedNote ? '' : cur));
    await logged(date);
    await game.checkAchievements();
  };

  return (
    <div>
      <h1>💸 Rozpočet</h1>
      <Tabs items={TABS} active="/budget/add" />
      <section className="panel">
        <div className="grid2" style={{ marginBottom: 12 }}>
          <button className={kind === 'out' ? 'primary' : ''} onClick={() => { setKind('out'); setCategory('food'); }}>− Výdaj</button>
          <button className={kind === 'in' ? 'primary' : ''} onClick={() => { setKind('in'); setCategory('salary'); }}>+ Příjem</button>
        </div>
        <div className="field">
          <label>Částka (Kč)</label>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus
            style={{ fontSize: '1.6rem', textAlign: 'center' }} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </div>
        <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
          {cats.map((c) => (
            <button key={c.id} className={`chip ${category === c.id ? 'on' : ''}`} onClick={() => setCategory(c.id)}>{c.icon} {c.label}</button>
          ))}
        </div>
        <div className="grid2">
          <div className="field">
            <label>Poznámka</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="např. oběd s kámoši" />
          </div>
          <div className="field">
            <label>Datum</label>
            <input type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value || dateKey())} />
          </div>
        </div>
        <button className="primary btn-block" disabled={!value} onClick={save}>Uložit</button>
        {msg && <p className="center small" style={{ color: 'var(--green)' }}>{msg}</p>}
        {msg && <button className="btn-block" style={{ marginTop: 6 }} onClick={() => navigate('/budget')}>Hotovo ›</button>}
      </section>
    </div>
  );
}

function BudgetHistory() {
  const p = useProfile();
  const list = useExpenses();
  const [month, setMonth] = useState(monthKey());
  if (!list) return null;
  const items = list.filter((e) => e.date.startsWith(month));
  const days = [...new Set(items.map((e) => e.date))];
  const s = monthSummary(list, month, p.budgetIncome);
  return (
    <div>
      <h1>💸 Rozpočet</h1>
      <Tabs items={TABS} active="/budget/history" />
      <MonthPicker month={month} onChange={setMonth} />
      <p className="small muted center">{s.entries} zápisů · výdaje {formatKc(s.spent)}</p>
      {!items.length && <Empty>Žádné zápisy v tomto měsíci.</Empty>}
      {days.map((d) => (
        <section key={d} className="panel" style={{ padding: '10px 14px' }}>
          <div className="small muted" style={{ marginBottom: 6 }}>{formatDate(d)}</div>
          {items.filter((e) => e.date === d).map((e) => {
            const c = categoryOf(e.category);
            return (
              <div key={e.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{c.icon} {e.note || c.label}</span>
                <span className="row" style={{ gap: 8 }}>
                  <b style={{ color: e.kind === 'in' ? 'var(--green)' : undefined }}>{e.kind === 'in' ? '+' : '−'}{formatKc(e.amount)}</b>
                  <button className="btn-sm" aria-label="Smazat" onClick={() => confirm('Smazat tento zápis?') && store.col('expenses').delete(e.id)}>✕</button>
                </span>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function BudgetPlan() {
  const p = useProfile();
  const [income, setIncome] = useState(p.budgetIncome ? String(p.budgetIncome) : '');
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(p.budgetLimits).map(([k, v]) => [k, v ? String(v) : ''])),
  );
  const [msg, setMsg] = useState('');
  const total = OUT_CATEGORIES.reduce((n, c) => n + (parseAmount(limits[c.id] ?? '') ?? 0), 0);
  const inc = parseAmount(income) ?? 0;
  const save = async () => {
    const next: Record<string, number> = {};
    for (const c of OUT_CATEGORIES) {
      const v = parseAmount(limits[c.id] ?? '');
      if (v) next[c.id] = v;
    }
    await game.saveProfile({ budgetIncome: inc, budgetLimits: next });
    setMsg('Uloženo ✓');
  };
  return (
    <div>
      <h1>💸 Rozpočet</h1>
      <Tabs items={TABS} active="/budget/plan" />
      <section className="panel">
        <div className="field">
          <label>Čistý měsíční příjem (Kč) – použije se, když příjmy nezapisuješ</label>
          <input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="např. 25 000" />
        </div>
        <h2>Měsíční limity</h2>
        <p className="small muted">Kolik chceš max. utratit v každé kategorii. Prázdné = bez limitu.</p>
        {OUT_CATEGORIES.map((c) => (
          <div key={c.id} className="row" style={{ marginBottom: 6 }}>
            <span className="grow">{c.icon} {c.label}</span>
            <input inputMode="decimal" style={{ width: 120, textAlign: 'right' }} value={limits[c.id] ?? ''} placeholder="–"
              onChange={(e) => setLimits({ ...limits, [c.id]: e.target.value })} />
          </div>
        ))}
        <p className="small">
          Celkem <b>{formatKc(total)}</b>
          {inc > 0 && <> · zbude <b style={{ color: inc - total >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatKc(inc - total)}</b>{p.financeGoal > 0 && <> (investiční cíl {formatKc(p.financeGoal)})</>}</>}
        </p>
        <button className="primary btn-block" onClick={save}>Uložit rozpočet</button>
        {msg && <p className="center small" style={{ color: 'var(--green)' }}>{msg}</p>}
        <p className="small muted">Za každý měsíc, kdy nepřekročíš celkový limit (a zapíšeš aspoň 10 výdajů), dostaneš +{MONTH_BUDGET_XP} XP do Disciplíny.</p>
      </section>
    </div>
  );
}

export default function BudgetPages({ route }: { route: string }) {
  if (route === '/budget/add') return <BudgetAdd />;
  if (route === '/budget/history') return <BudgetHistory />;
  if (route === '/budget/plan') return <BudgetPlan />;
  return <BudgetHome />;
}
