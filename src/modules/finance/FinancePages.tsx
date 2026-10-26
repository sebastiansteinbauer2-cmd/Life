import { useState } from 'react';
import { game, store, useProfile, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { BarChart, LineChart } from '../../components/Charts';
import { QuestList } from '../../components/Quests';
import { Empty, Tabs, XpBar } from '../../components/ui';
import { addMonths, formatDate, monthKey } from '../../lib/date';
import {
  formatMoney, formatPct, milestonesFor, monthStreak, netByMonth, positionReturn, shortTicker,
} from './logic';
import { syncFinance } from './sync';
import { loadCreds, saveCreds, type T212Env } from './t212Api';

const TABS = [
  { path: '/finance', label: 'Přehled' },
  { path: '/finance/positions', label: 'Pozice' },
  { path: '/finance/history', label: 'Vklady' },
];
const MONTHS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const monthLabel = (key: string) => MONTHS[Number(key.slice(5)) - 1];
/** České skloňování: plural(1, 'vklad', 'vklady', 'vkladů') */
const plural = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

function useFinance() {
  return useQuery(async () => {
    const [snaps, txs, divs, last] = await Promise.all([
      store.col('financeSnapshots').all(), store.col('financeTx').all(), store.col('financeDividends').all(),
      store.col('meta').get('financeLastSync'),
    ]);
    return {
      snaps: snaps.sort((a, b) => a.id.localeCompare(b.id)),
      txs: txs.sort((a, b) => b.ts - a.ts),
      divs: divs.sort((a, b) => b.ts - a.ts),
      lastSync: last?.value as number | undefined,
    };
  });
}

function ConnectForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const p = useProfile();
  const prev = loadCreds();
  const [key, setKey] = useState(prev?.key ?? '');
  const [secret, setSecret] = useState(prev?.secret ?? '');
  const [env, setEnv] = useState<T212Env>(prev?.env ?? 'live');
  const [proxy, setProxy] = useState(p.financeProxyUrl);
  const [goal, setGoal] = useState(String(p.financeGoal));

  const save = async () => {
    saveCreds({ key: key.trim(), secret: secret.trim(), env });
    // odstraň tečku / lomítko / mezery na konci (častá chyba při kopírování)
    const cleanProxy = proxy.trim().replace(/[.\s/]+$/, '');
    await game.saveProfile({ financeProxyUrl: cleanProxy, financeGoal: Math.max(0, Number(goal.replace(',', '.')) || 0) });
    onDone();
  };

  return (
    <section className="panel gold">
      <h2 style={{ marginTop: 0 }}>Propojení s Trading 212</h2>
      <details style={{ marginBottom: 12 }}>
        <summary className="small" style={{ color: 'var(--gold-2)' }}>Jak získat API klíč?</summary>
        <ol className="small" style={{ paddingLeft: 18 }}>
          <li>Otevři Trading 212 (web nebo aplikaci) → <b>Nastavení</b> → <b>API (Beta)</b>.</li>
          <li>Vygeneruj nový klíč. Povol jen <b>čtení</b>: účet (Account data), portfolio a historii. <b>Obchodování nepovoluj.</b></li>
          <li>Zkopíruj <b>API klíč</b> (a pokud ho Trading 212 ukáže, i <b>API secret</b>) sem.</li>
        </ol>
        <p className="small muted">Klíč zůstává jen v tomto telefonu – není v exportu zálohy ani nikam jinam neodchází (kromě Trading 212, případně tvé vlastní proxy).</p>
      </details>
      <div className="field"><label>API klíč</label>
        <input value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} /></div>
      <div className="field"><label>API secret</label>
        <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" autoComplete="off" />
        {!secret.trim() && <div className="small" style={{ color: 'var(--gold-2)', marginTop: 4 }}>Nové klíče Trading 212 bez secretu nefungují. Secret se ukazuje jen při vytvoření klíče – pokud ho nemáš, vytvoř nový klíč.</div>}
      </div>
      <div className="grid2">
        <div className="field"><label>Účet</label>
          <select value={env} onChange={(e) => setEnv(e.target.value as T212Env)}>
            <option value="live">Skutečný (live)</option><option value="demo">Demo (cvičný)</option>
          </select></div>
        <div className="field"><label>Měsíční cíl investic</label>
          <input type="number" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
      </div>
      <details style={{ marginBottom: 8 }}>
        <summary className="small" style={{ color: 'var(--gold-2)' }}>Jak získat proxy URL (Vercel, zdarma)?</summary>
        <ol className="small" style={{ paddingLeft: 18 }}>
          <li>Na <a href="https://vercel.com/signup" target="_blank" rel="noopener noreferrer">vercel.com</a> se zaregistruj (Hobby) přes <b>Continue with GitHub</b>.</li>
          <li><b>Add New → Project</b> → u repozitáře <b>Life</b> klepni <b>Import</b> → <b>Deploy</b>.</li>
          <li>Po nasazení zkopíruj adresu projektu (např. <code>life-abc.vercel.app</code>).</li>
          <li>Sem vlož <code>https://TVOJE-ADRESA.vercel.app/api/t212</code> a ulož.</li>
        </ol>
      </details>
      <div className="field"><label>Proxy URL (pokud přímé spojení nefunguje)</label>
        <input value={proxy} onChange={(e) => setProxy(e.target.value)} placeholder="https://tvoje-app.vercel.app/api/t212" autoCapitalize="none" /></div>
      <div className="row">
        {onCancel && <button onClick={onCancel}>Zrušit</button>}
        <button className="primary grow" onClick={save} disabled={!key.trim()}>Uložit</button>
      </div>
    </section>
  );
}

function SyncButton({ lastSync }: { lastSync?: number }) {
  const [state, setState] = useState<{ busy: boolean; msg?: string; err?: boolean }>({ busy: false });
  const run = async () => {
    setState({ busy: true, msg: 'Připojuji se…' });
    try {
      const r = await syncFinance((msg) => setState({ busy: true, msg }));
      const parts = r.firstSync
        ? ['Účet načten. XP dostaneš za nové vklady a dividendy od teď.']
        : [
          r.newDeposits ? plural(r.newDeposits, 'nový vklad', 'nové vklady', 'nových vkladů') : 'Žádné nové vklady',
          r.newDividends ? plural(r.newDividends, 'dividenda', 'dividendy', 'dividend') : '',
          r.xp ? `+${r.xp} XP` : '',
        ];
      const warn = r.missing.length
        ? ` ⚠️ Klíči chybí oprávnění: ${r.missing.join(', ')} – tahle data se nenačetla. Vytvoř nový klíč s nimi.`
        : '';
      setState({ busy: false, err: r.missing.length > 0, msg: parts.filter(Boolean).join(' · ') + warn });
    } catch (e) {
      setState({ busy: false, err: true, msg: (e as Error).message });
    }
  };
  return (
    <div>
      <button className="primary btn-block" onClick={run} disabled={state.busy}>{state.busy ? '⏳ Synchronizuji…' : '⟳ Synchronizovat s Trading 212'}</button>
      <div className="small muted center" style={{ marginTop: 4 }}>
        {lastSync ? `Naposledy: ${new Date(lastSync).toLocaleString('cs-CZ')}` : 'Zatím nesynchronizováno'}
      </div>
      {state.msg && <p className="center small" style={{ color: state.err ? 'var(--red)' : state.busy ? 'var(--muted)' : 'var(--green)' }}>{state.msg}</p>}
      {state.busy && <p className="center small muted">Trading 212 povoluje jen pár dotazů za minutu, synchronizace trvá asi půl minuty.</p>}
    </div>
  );
}

function FinanceHome() {
  const p = useProfile();
  const data = useFinance();
  const quests = useQuests('finance');
  const [editing, setEditing] = useState(false);
  const [, force] = useState(0);
  const creds = loadCreds();
  if (!data) return null;

  if (!creds?.key || editing) {
    return (
      <div>
        <h1>💰 Finance</h1>
        <ConnectForm onDone={() => { setEditing(false); force((n) => n + 1); }} onCancel={creds?.key ? () => setEditing(false) : undefined} />
      </div>
    );
  }

  const snap = data.snaps[data.snaps.length - 1];
  const cur = snap?.currency ?? 'CZK';
  const byMonth = netByMonth(data.txs);
  const thisMonth = byMonth[monthKey()] ?? 0;
  const streak = monthStreak(byMonth, p.financeGoal);
  const ms = milestonesFor(cur);
  const nextMs = snap ? ms.find((m) => snap.total < m) : ms[0];

  return (
    <div>
      <h1>💰 Finance</h1>
      <Tabs items={TABS} active="/finance" />
      <section className="panel gold">
        {snap ? (
          <>
            <div className="small muted">Hodnota účtu</div>
            <div className="pixel" style={{ fontSize: '1.6rem', color: 'var(--gold)' }}>{formatMoney(snap.total, cur)}</div>
            <div className="row wrap small" style={{ gap: 14, margin: '6px 0 12px' }}>
              <span>Zisk/ztráta <b style={{ color: snap.ppl >= 0 ? 'var(--green)' : 'var(--red)' }}>{snap.ppl >= 0 ? '+' : ''}{formatMoney(snap.ppl, cur)}</b></span>
              <span className="muted">Investováno {formatMoney(snap.invested, cur)}</span>
              <span className="muted">Hotovost {formatMoney(snap.free, cur)}</span>
            </div>
            {nextMs && <div className="small muted" style={{ marginBottom: 12 }}>Další milník: {formatMoney(nextMs, cur)} ({Math.round((snap.total / nextMs) * 100)} %)</div>}
          </>
        ) : <p>Účet je propojený. Klepni na synchronizaci a načti data.</p>}
        <SyncButton lastSync={data.lastSync} />
      </section>

      <section className="panel">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Tento měsíc</h3>
          <span className="streak">🔥 {plural(streak.current, 'měsíc', 'měsíce', 'měsíců')}</span>
        </div>
        <div style={{ margin: '10px 0' }}>
          <XpBar value={Math.min(thisMonth, p.financeGoal)} max={p.financeGoal || 1} label={`${formatMoney(thisMonth, cur)} / ${formatMoney(p.financeGoal, cur)}`} />
        </div>
        <p className="small muted">Série = měsíce v řadě se splněným cílem. Bonus za 3, 6 a 12 měsíců.</p>
      </section>

      <QuestList quests={quests ?? []} />

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Vývoj portfolia</h3>
        {data.snaps.length >= 2 ? (
          <LineChart
            labels={data.snaps.map((s) => formatDate(s.id).slice(0, -5))}
            series={[
              { label: 'Hodnota', data: data.snaps.map((s) => Math.round(s.total)), color: '#f5c542', fill: true },
              { label: 'Vloženo', data: data.snaps.map((s) => Math.round(s.invested)), color: '#60a5fa', dashed: true },
            ]}
          />
        ) : <Empty>Graf se začne kreslit po synchronizaci ve dvou různých dnech. Synchronizuj klidně každý den.</Empty>}
      </section>
      <button className="btn-block btn-ghost" onClick={() => setEditing(true)}>⚙️ Nastavení propojení a cíle</button>
      <button className="btn-block btn-danger" style={{ marginTop: 8 }} onClick={() => {
        if (confirm('Odpojit Trading 212? Klíč se smaže z telefonu, načtená data zůstanou.')) { saveCreds(null); force((n) => n + 1); }
      }}>Odpojit</button>
    </div>
  );
}

function Positions() {
  const data = useFinance();
  if (!data) return null;
  const snap = data.snaps[data.snaps.length - 1];
  const list = snap ? [...snap.positions].sort((a, b) => b.quantity * b.currentPrice - a.quantity * a.currentPrice) : [];
  return (
    <div>
      <h1>Pozice</h1>
      <Tabs items={TABS} active="/finance/positions" />
      <section className="panel">
        {list.length ? (
          <table>
            <thead><tr><th>Titul</th><th className="num">Kusů</th><th className="num">Výnos</th><th className="num">Zisk</th></tr></thead>
            <tbody>
              {list.map((p) => {
                const ret = positionReturn(p);
                return (
                  <tr key={p.ticker}>
                    <td><b>{shortTicker(p.ticker)}</b></td>
                    <td className="num">{Math.round(p.quantity * 1000) / 1000}</td>
                    <td className="num" style={{ color: ret >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPct(ret)}</td>
                    <td className="num" style={{ color: p.ppl >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatMoney(p.ppl, snap.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Empty>Žádné pozice. Synchronizuj v přehledu.</Empty>}
      </section>
      {snap && <p className="small muted center">Stav k {new Date(snap.ts).toLocaleString('cs-CZ')}. Výnos je podle ceny akcie, zisk v měně účtu (vč. kurzu).</p>}
    </div>
  );
}

function History() {
  const p = useProfile();
  const data = useFinance();
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;
  const cur = data.snaps[data.snaps.length - 1]?.currency ?? 'CZK';
  const byMonth = netByMonth(data.txs);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(monthKey(), i - 11));
  const values = months.map((m) => Math.round(byMonth[m] ?? 0));
  const items = [
    ...data.txs.map((t) => ({ id: t.id, ts: t.ts, label: t.type === 'DEPOSIT' ? 'Vklad' : t.type === 'WITHDRAW' ? 'Výběr' : t.type === 'FEE' ? 'Poplatek' : 'Převod', amount: t.type === 'WITHDRAW' || t.type === 'FEE' ? -Math.abs(t.amount) : t.amount, icon: t.type === 'DEPOSIT' ? '⬇️' : '↗️' })),
    ...data.divs.map((d) => ({ id: d.id, ts: d.ts, label: `Dividenda ${shortTicker(d.ticker)}`, amount: d.amount, icon: '🪙' })),
  ].sort((a, b) => b.ts - a.ts);
  const totalDiv = data.divs.reduce((s, d) => s + d.amount, 0);

  return (
    <div>
      <h1>Vklady a dividendy</h1>
      <Tabs items={TABS} active="/finance/history" />
      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Čisté vklady po měsících</h3>
        <BarChart labels={months.map(monthLabel)} values={values}
          colors={values.map((v) => (v >= p.financeGoal ? '#4ade80' : v > 0 ? '#f5c542' : '#2a3150'))} height={200} />
        <p className="small muted">Zelená = splněný cíl {formatMoney(p.financeGoal, cur)}.</p>
      </section>
      <div className="grid2">
        <div className="panel center"><div className="pixel" style={{ color: 'var(--gold)' }}>{data.divs.length}</div><div className="small muted">{data.divs.length === 1 ? 'dividenda' : data.divs.length >= 2 && data.divs.length <= 4 ? 'dividendy' : 'dividend'}</div></div>
        <div className="panel center"><div className="pixel" style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>{formatMoney(totalDiv, cur)}</div><div className="small muted">na dividendách</div></div>
      </div>
      <section className="panel">
        {items.length ? (showAll ? items : items.slice(0, 20)).map((i) => (
          <div key={i.id} className="row list-item small">
            <span>{i.icon}</span>
            <span className="grow">{i.label}<br /><span className="muted">{new Date(i.ts).toLocaleDateString('cs-CZ')}</span></span>
            <b style={{ color: i.amount >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatMoney(i.amount, cur)}</b>
          </div>
        )) : <Empty>Zatím žádné vklady. Synchronizuj v přehledu.</Empty>}
        {!showAll && items.length > 20 && <button className="btn-block btn-ghost" onClick={() => setShowAll(true)}>Zobrazit vše ({items.length})</button>}
      </section>
    </div>
  );
}

export default function FinancePages({ route }: { route: string }) {
  if (route === '/finance/positions') return <Positions />;
  if (route === '/finance/history') return <History />;
  return <FinanceHome />;
}
