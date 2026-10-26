import { useEffect, useState } from 'react';
import { game, store, useProfile, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { LineChart } from '../../components/Charts';
import { QuestList } from '../../components/Quests';
import { Empty, MiniBar, Tabs, XpBar } from '../../components/ui';
import type { Activity } from '../../data/types';
import { addDays, dateKey, daysBetween, formatDate, weekStart } from '../../lib/date';
import { serverBase } from '../discover/videos';
import {
  DISCIPLINES, RACES, SPORT_LABEL, activityStatText, formatMinSec, formatTime, kmText, paceSec, readiness, records,
  speedKmh, sportIcon, swimPace100, weekVolume,
} from './sports';
import { consumeCallback, loadTokens, loginUrl, saveTokens, serverConfigured } from './strava';
import { syncStrava } from './sync';

const TABS = [
  { path: '/ironman', label: 'Přehled' },
  { path: '/ironman/activities', label: 'Aktivity' },
];

function useActivities() {
  return useQuery(async () => (await store.col('activities').all()).sort((a, b) => b.ts - a.ts));
}

function SetupGuide({ base }: { base: string }) {
  const host = new URL(base).host;
  return (
    <section className="panel gold">
      <h2 style={{ marginTop: 0 }}>Propojení se Stravou – jednorázové nastavení</h2>
      <p className="small">Strava vyžaduje vlastní „API aplikaci“. Zabere to asi 5 minut a jde to z telefonu:</p>
      <ol className="small" style={{ paddingLeft: 18 }}>
        <li>Otevři <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer">strava.com/settings/api</a> (přihlas se) a vyplň:
          <ul>
            <li><b>Application Name:</b> Questy zivota</li>
            <li><b>Category:</b> Training</li>
            <li><b>Website:</b> {location.origin}</li>
            <li><b>Authorization Callback Domain:</b> <code>{host}</code></li>
          </ul>
          Nahraj libovolnou ikonu a ulož.
        </li>
        <li>Opiš si <b>Client ID</b> a <b>Client Secret</b> (u secretu klepni na „show“).</li>
        <li>Na <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a> otevři projekt → <b>Settings → Environment Variables</b> a přidej:
          <ul>
            <li><code>STRAVA_CLIENT_ID</code> = tvoje Client ID</li>
            <li><code>STRAVA_CLIENT_SECRET</code> = tvůj Client Secret</li>
          </ul>
        </li>
        <li>Ve Vercelu dej <b>Deployments → … u posledního → Redeploy</b>, aby se proměnné načetly.</li>
        <li>Vrať se sem a obnov stránku – objeví se tlačítko <b>Propojit se Stravou</b>.</li>
      </ol>
    </section>
  );
}

function ConnectCard() {
  const p = useProfile();
  const base = serverBase(p);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    if (base) serverConfigured(base).then(setConfigured);
  }, [base]);

  if (!base) {
    return <Empty>Nejdřív nastav adresu svého Vercel serveru v <a href="#/settings">Nastavení</a> (stejný server jako u Financí).</Empty>;
  }
  if (configured === null) return <div className="empty">Kontroluji server…</div>;
  if (!configured) return <SetupGuide base={base} />;
  return (
    <section className="panel gold center">
      <div style={{ fontSize: '2.4rem' }}>🏊🚴🏃</div>
      <p>Propoj Stravu a každý trénink se ti započítá automaticky – XP, questy, připravenost na Ironman.</p>
      <a className="btn btn-block strava-btn" href={loginUrl(base)}>Propojit se Stravou</a>
      <p className="small muted">Appka si přečte jen tvoje aktivity. Přihlašovací token zůstává jen v tomto telefonu.</p>
    </section>
  );
}

function SyncButton({ base }: { base: string }) {
  const last = useQuery(async () => (await store.col('meta').get('stravaLastSync'))?.value as number | undefined);
  const [state, setState] = useState<{ busy: boolean; msg?: string; err?: boolean }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    try {
      const r = await syncStrava(base);
      setState({
        busy: false,
        msg: r.firstSync
          ? `Načteno ${r.added} aktivit za poslední 4 měsíce. XP dostaneš za nové tréninky od teď.`
          : r.added ? `${r.added} ${r.added === 1 ? 'nová aktivita' : r.added <= 4 ? 'nové aktivity' : 'nových aktivit'} · +${r.xp} XP${r.prs.length ? ` · 🏆 ${r.prs.join(', ')}` : ''}` : 'Žádné nové aktivity.',
      });
    } catch (e) {
      setState({ busy: false, err: true, msg: (e as Error).message });
    }
  };
  return (
    <div>
      <button className="btn-block strava-btn" onClick={run} disabled={state.busy}>{state.busy ? 'Synchronizuji…' : '⟳ Synchronizovat se Stravou'}</button>
      <div className="small muted center" style={{ marginTop: 4 }}>{last ? `Naposledy: ${new Date(last).toLocaleString('cs-CZ')}` : 'Zatím nesynchronizováno'}</div>
      {state.msg && <p className="center small" style={{ color: state.err ? 'var(--red)' : 'var(--green)' }}>{state.msg}</p>}
    </div>
  );
}

function Readiness({ acts }: { acts: Activity[] }) {
  const [race, setRace] = useState<keyof typeof RACES>('full');
  const r = readiness(acts, race);
  return (
    <section className="panel">
      <div className="row between">
        <h3 style={{ margin: 0 }}>Připravenost na závod</h3>
        <span className="pixel" style={{ color: 'var(--m-ironman)', fontSize: '1.3rem' }}>{Math.round(r.total * 100)} %</span>
      </div>
      <div className="tabs" style={{ marginTop: 8 }}>
        {(Object.keys(RACES) as (keyof typeof RACES)[]).map((k) => (
          <button key={k} className={race === k ? 'active' : ''} onClick={() => setRace(k)}>{RACES[k].name}</button>
        ))}
      </div>
      {r.parts.map((p) => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <div className="row between small"><span>{p.icon} {p.label}</span><span className="muted">nejdelší {p.best.toFixed(1).replace('.', ',')} / {String(p.target).replace('.', ',')} km</span></div>
          <MiniBar value={p.pct} color={p.color} />
        </div>
      ))}
      <p className="small muted" style={{ marginBottom: 0 }}>Počítá se nejdelší jednotlivý trénink v každé disciplíně vůči závodní vzdálenosti.</p>
    </section>
  );
}

function WeekChart({ acts }: { acts: Activity[] }) {
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(weekStart(), (i - 11) * 7));
  const vols = weeks.map((w) => {
    const list = acts.filter((a) => weekStart(new Date(a.ts)) === w);
    const h = (f: (s: string) => boolean) => Math.round((list.filter((a) => f(a.sport)).reduce((n, a) => n + a.movingTime, 0) / 3600) * 10) / 10;
    return {
      swim: h((s) => s === 'Swim'),
      bike: h((s) => /Ride/.test(s) && s !== 'EBikeRide'),
      run: h((s) => /Run/.test(s)),
    };
  });
  if (!acts.length) return null;
  return (
    <section className="panel">
      <h3 style={{ marginTop: 0 }}>Hodiny tréninku po týdnech</h3>
      <LineChart
        labels={weeks.map((w) => formatDate(w).slice(0, -5))}
        series={DISCIPLINES.map((d) => ({ label: d.label, data: vols.map((v) => v[d.id]), color: d.color }))}
      />
    </section>
  );
}

function Records({ acts }: { acts: Activity[] }) {
  const r = records(acts);
  const rows = [
    ['🏃 Nejrychlejší 5+ km', r.fastest5k && `${formatMinSec(paceSec(r.fastest5k))} /km`, r.fastest5k],
    ['🏃 Nejrychlejší 10+ km', r.fastest10k && `${formatMinSec(paceSec(r.fastest10k))} /km`, r.fastest10k],
    ['🏊 Nejrychlejší plavání (400+ m)', r.fastestSwim && `${formatMinSec(swimPace100(r.fastestSwim))} /100 m`, r.fastestSwim],
    ['🚴 Nejrychlejší kolo (20+ km)', r.fastestRide && `${speedKmh(r.fastestRide).toFixed(1).replace('.', ',')} km/h`, r.fastestRide],
  ] as const;
  return (
    <section className="panel">
      <h3 style={{ marginTop: 0 }}>Osobní rekordy</h3>
      {rows.map(([label, val, a]) => (
        <div key={label} className="row between list-item small">
          <span>{label}</span>
          <span>{val ? <b style={{ color: 'var(--gold-2)' }}>{val}</b> : <span className="muted">–</span>}{a && <span className="muted"> · {formatDate(a.date)}</span>}</span>
        </div>
      ))}
    </section>
  );
}

function IronmanHome() {
  const p = useProfile();
  const base = serverBase(p);
  const acts = useActivities();
  const quests = useQuests('ironman');
  const [, force] = useState(0);
  const [cbMsg, setCbMsg] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    // návrat ze Stravy přijde v URL (#/ironman?strava=…) – při načtení stránky i při změně hashe
    const check = () => {
      const r = consumeCallback();
      if (r) { setCbMsg(r); force((n) => n + 1); }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const connected = !!loadTokens();
  const today = dateKey();
  const daysLeft = p.ironmanDate ? daysBetween(today, p.ironmanDate) : null;
  const week = acts ? weekVolume(acts) : null;

  return (
    <div>
      <h1>🏊 Ironman</h1>
      <Tabs items={TABS} active="/ironman" />
      {cbMsg && <p className={cbMsg.ok ? 'feedback-ok center' : 'feedback-bad center'}>{cbMsg.ok ? '✔ Strava je propojená! Teď klepni na Synchronizovat.' : cbMsg.error}</p>}

      <section className="panel gold">
        <div className="row between">
          <div>
            <div className="small muted">Ironman: 3,8 km plavání · 180 km kolo · 42,2 km běh</div>
            {daysLeft !== null && daysLeft >= 0
              ? <div className="pixel" style={{ fontSize: '1.6rem', color: 'var(--m-ironman)' }}>{daysLeft} dní do závodu</div>
              : <div className="small" style={{ marginTop: 4 }}>Nastav datum závodu níže a uvidíš odpočet.</div>}
          </div>
        </div>
        {week && (
          <div style={{ marginTop: 12 }}>
            <div className="small muted" style={{ marginBottom: 4 }}>Tento týden</div>
            <XpBar value={Math.min(week.hours, p.ironmanWeeklyHours)} max={p.ironmanWeeklyHours || 1}
              label={`${week.hours.toFixed(1).replace('.', ',')} / ${p.ironmanWeeklyHours} h`} />
            <div className="grid3" style={{ marginTop: 10 }}>
              {DISCIPLINES.map((d) => (
                <div key={d.id} className="center">
                  <div style={{ fontSize: '1.3rem' }}>{d.icon}</div>
                  <div className="pixel" style={{ color: d.color }}>{week[d.id].km.toFixed(1).replace('.', ',')} km</div>
                  <div className="small muted">{week[d.id].count}×</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: 12 }}>{connected && base ? <SyncButton base={base} /> : null}</div>
      </section>

      {!connected && <ConnectCard />}

      <QuestList quests={quests ?? []} />
      {acts && <Readiness acts={acts} />}
      {acts && <WeekChart acts={acts} />}
      {acts && acts.length > 0 && <Records acts={acts} />}

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Nastavení</h3>
        <div className="grid2">
          <div className="field"><label>Datum závodu</label>
            <input type="date" value={p.ironmanDate} onChange={(e) => game.saveProfile({ ironmanDate: e.target.value })} /></div>
          <div className="field"><label>Cíl hodin týdně</label>
            <input type="number" inputMode="decimal" value={p.ironmanWeeklyHours} onChange={(e) => game.saveProfile({ ironmanWeeklyHours: Math.max(1, Number(e.target.value) || 1) })} /></div>
        </div>
        {connected && (
          <button className="btn-danger btn-block" onClick={() => { if (confirm('Odpojit Stravu? Načtené aktivity zůstanou.')) { saveTokens(null); force((n) => n + 1); } }}>
            Odpojit Stravu
          </button>
        )}
      </section>
      <p className="small muted center">Data z aktivit poskytuje Strava.</p>
    </div>
  );
}

function Activities() {
  const acts = useActivities();
  const [filter, setFilter] = useState<'all' | 'swim' | 'bike' | 'run'>('all');
  if (!acts) return null;
  const list = acts.filter((a) => filter === 'all'
    || (filter === 'swim' && a.sport === 'Swim') || (filter === 'bike' && /Ride/.test(a.sport)) || (filter === 'run' && /Run/.test(a.sport)));
  return (
    <div>
      <h1>Aktivity</h1>
      <Tabs items={TABS} active="/ironman/activities" />
      <div className="tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Vše</button>
        {DISCIPLINES.map((d) => <button key={d.id} className={filter === d.id ? 'active' : ''} onClick={() => setFilter(d.id)}>{d.icon} {d.label}</button>)}
      </div>
      <section className="panel">
        {list.length ? list.slice(0, 100).map((a) => (
          <a key={a.id} className="row list-item" href={`https://www.strava.com/activities/${a.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>
            <span style={{ fontSize: '1.5rem' }}>{sportIcon(a.sport)}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <b style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</b>
              <span className="small muted">{formatDate(a.date)} · {SPORT_LABEL[a.sport] ?? a.sport} · {formatTime(a.movingTime)}</span>
            </span>
            <span className="center small">
              <b>{a.distance ? `${kmText(a.distance)} km` : ''}</b><br />
              <span className="muted">{activityStatText(a)}</span>
            </span>
            {a.xp ? <span className="xp-chip">+{a.xp}</span> : null}
          </a>
        )) : <Empty>Zatím žádné aktivity. Propoj Stravu v Přehledu.</Empty>}
      </section>
    </div>
  );
}

export default function IronmanPages({ route }: { route: string }) {
  if (route === '/ironman/activities') return <Activities />;
  return <IronmanHome />;
}
