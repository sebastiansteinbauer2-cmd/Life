import { store, useQuery } from '../app/context';
import { BarChart } from '../components/Charts';
import { ACHIEVEMENTS } from '../game/achievements';
import { daysIntoWeek, lastMonday, pctChange, thisMonday, weekReport } from '../game/weekly';
import { MODULES, MODULE_LABEL, STATS } from '../game/xp';
import { addDays, formatDate, parseDateKey } from '../lib/date';

const DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function Delta({ now, before }: { now: number; before: number }) {
  const p = pctChange(now, before);
  if (p === null) return null;
  return <span className="small" style={{ color: p >= 0 ? 'var(--green)' : 'var(--red)' }}>{p >= 0 ? '▲' : '▼'} {Math.abs(p)} %</span>;
}

/** Deník hrdiny: souhrn tohoto a minulého týdne. */
export default function Report() {
  const data = useQuery(async () => {
    const [log, progress, ach] = await Promise.all([store.col('xpLog').all(), store.col('questProgress').all(), store.col('achievements').all()]);
    const n = daysIntoWeek();
    return {
      now: weekReport(log, progress, ach, thisMonday()),
      // srovnání se stejnými dny minulého týdne (Po–dnešek), ať rozběhnutý týden nevypadá hůř
      prev: weekReport(log, progress, ach, lastMonday(), n),
      prevFull: weekReport(log, progress, ach, lastMonday()),
      n,
    };
  });
  if (!data) return null;
  const { now, prev, prevFull, n } = data;
  const range = (m: string) => `${formatDate(m).slice(0, -5)} – ${formatDate(addDays(m, 6))}`;
  const modules = [...MODULES.map((m) => m.id), 'core' as const].filter((m) => now.byModule[m] || prev.byModule[m]);

  return (
    <div>
      <h1>📜 Deník hrdiny</h1>
      <p className="small muted">
        Tento týden ({range(now.monday)}) proti {n < 7 ? `stejným dnům minulého týdne (${n === 1 ? 'pondělí' : `Po–${DAYS[n - 1]}`})` : 'minulému'}.
        {n < 7 && ` Celý minulý týden: ${prevFull.xp} XP.`}
      </p>
      <div className="grid3">
        <div className="panel center"><div className="pixel" style={{ color: 'var(--gold)', fontSize: '1.3rem' }}>{now.xp}</div><div className="small muted">XP</div><Delta now={now.xp} before={prev.xp} /></div>
        <div className="panel center"><div className="pixel" style={{ color: 'var(--gold)', fontSize: '1.3rem' }}>{now.activeDays}/7</div><div className="small muted">aktivních dní</div><Delta now={now.activeDays} before={prev.activeDays} /></div>
        <div className="panel center"><div className="pixel" style={{ color: 'var(--gold)', fontSize: '1.3rem' }}>{now.questsDone}</div><div className="small muted">questů</div><Delta now={now.questsDone} before={prev.questsDone} /></div>
      </div>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>XP po dnech</h3>
        <BarChart labels={DAYS} values={now.daily.map((d) => Math.max(0, d.xp))}
          colors={now.daily.map((d) => (now.bestDay?.date === d.date ? '#f5c542' : '#60a5fa'))} height={180} />
        {now.bestDay && <p className="small muted">Nejlepší den: <b style={{ color: 'var(--gold-2)' }}>{DAYS[(parseDateKey(now.bestDay.date).getDay() + 6) % 7]}</b> s {now.bestDay.xp} XP.</p>}
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Statistiky</h3>
        {STATS.map((s) => (
          <div key={s.id} className="row between list-item">
            <span>{s.icon} {s.label}</span>
            <span><b style={{ color: s.color }}>+{now.byStat[s.id] ?? 0}</b> <span className="small muted">(minule {prev.byStat[s.id] ?? 0})</span></span>
          </div>
        ))}
      </section>

      {modules.length > 0 && (
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Kde jsi makal</h3>
          {modules.map((m) => (
            <div key={m} className="row between list-item">
              <span>{MODULES.find((x) => x.id === m)?.icon ?? '⚔️'} {MODULE_LABEL[m]}</span>
              <span><b>{now.byModule[m] ?? 0} XP</b> <Delta now={now.byModule[m] ?? 0} before={prev.byModule[m] ?? 0} /></span>
            </div>
          ))}
        </section>
      )}

      {now.achievements.length > 0 && (
        <section className="panel gold">
          <h3 style={{ marginTop: 0 }}>Nové odznaky tento týden</h3>
          <div className="row wrap">
            {now.achievements.map((id) => {
              const a = ACHIEVEMENTS.find((x) => x.id === id);
              return a ? <span key={id} className="chip on">{a.icon} {a.title}</span> : null;
            })}
          </div>
        </section>
      )}
      <p className="small muted center">{now.xp >= prev.xp ? 'Lepší než minulý týden – jen tak dál! 🔥' : 'Zatím trochu za minulým týdnem. Co dnes splnit aspoň jeden quest navíc?'}</p>
    </div>
  );
}
