import { useState, type CSSProperties } from 'react';
import { store, useProfile, useQuery } from '../app/context';
import { useQuests, useStreaks } from '../app/hooks';
import { AddQuestModal, QuestList } from '../components/Quests';
import { PixelAvatar } from '../components/PixelAvatar';
import { MiniBar, XpBar } from '../components/ui';
import { ACHIEVEMENTS } from '../game/achievements';
import { MODULES, STATS, levelFromXp, nextTitle, titleForLevel, titleTier } from '../game/xp';
import { parseDateKey } from '../lib/date';
import { planForDate } from '../modules/training/plan';
import { backupNow } from '../app/backup';
import { backupDue, coinBalance, daysIntoWeek, lastMonday, pctChange, thisMonday, weekReport, type Purchase } from '../game/weekly';

export function Hud() {
  const p = useProfile();
  const coins = useQuery(async () => coinBalance(p.xp, ((await store.col('meta').get('shopPurchases'))?.value as Purchase[] | undefined) ?? []), [p.xp]);
  const lv = levelFromXp(p.xp);
  const nt = nextTitle(lv.level);
  return (
    <section className="panel gold">
      <div className="hud">
        <div className="avatar" aria-hidden>
          <PixelAvatar tier={titleTier(lv.level)} size={62} />
          <span className="lvl pixel">{lv.level}</span>
        </div>
        <div className="grow">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="hero-name">{p.name}</div>
              <div className="title-badge">{titleForLevel(lv.level)} · LVL {lv.level}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="xp-chip" title="Celkové XP">✦ {p.xp}</div>
              <a href="#/shop" className="xp-chip" style={{ textDecoration: 'none' }} title="Zlaťáky – obchod">🪙 {coins ?? '…'}</a>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <XpBar value={lv.intoLevel} max={lv.needed} />
          </div>
          {nt && <div className="small muted" style={{ marginTop: 5 }}>Další titul: <b style={{ color: 'var(--gold-2)' }}>{nt.title}</b> na levelu {nt.level}</div>}
        </div>
      </div>
      <div className="stats">
        {STATS.map((s) => {
          const sl = levelFromXp(p.statXp[s.id] ?? 0);
          return (
            <div className="stat" key={s.id} style={{ '--sc': s.color } as CSSProperties}>
              <span className="sic" aria-hidden>{s.icon}</span>
              <div className="grow">
                <div className="top"><span>{s.label}</span><b style={{ color: s.color }}>LV {sl.level}</b></div>
                <MiniBar value={sl.progress} color={s.color} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const DAY_LETTERS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

export default function Home() {
  const profile = useProfile();
  const quests = useQuests();
  const streaks = useStreaks();
  const [adding, setAdding] = useState(false);
  const recent = useQuery(async () => (await store.col('achievements').all()).sort((a, b) => b.unlockedAt - a.unlockedAt).slice(0, 4));
  const today = quests?.filter((q) => q.recurrence === 'daily') ?? [];
  const weekly = quests?.filter((q) => q.recurrence === 'weekly') ?? [];
  const monthly = quests?.filter((q) => q.recurrence === 'monthly') ?? [];
  const once = quests?.filter((q) => q.recurrence === 'once' && !q.done) ?? [];
  const doneToday = today.filter((q) => q.done).length;
  const plan = planForDate();
  const current = streaks?.all.current ?? 0;
  const extra = useQuery(async () => {
    const [last, log, progress, ach] = await Promise.all([
      store.col('meta').get('lastBackup'), store.col('xpLog').all(), store.col('questProgress').all(), store.col('achievements').all(),
    ]);
    return {
      backupDue: log.length > 0 && backupDue((last?.value as number | undefined) ?? null, profile.createdAt),
      week: weekReport(log, progress, ach, thisMonday()).xp,
      prevWeek: weekReport(log, progress, ach, lastMonday(), daysIntoWeek()).xp,
    };
  });

  return (
    <div>
      <Hud />

      {extra?.backupDue && (
        <section className="panel row" style={{ borderColor: 'rgba(96,165,250,.5)' }}>
          <span style={{ fontSize: '1.6rem' }}>☁️</span>
          <div className="grow small"><b>Zálohuj si postup.</b><br /><span className="muted">Data jsou jen v tomhle telefonu. Ulož si zálohu třeba na Google Disk.</span></div>
          <button className="btn-sm primary" onClick={() => backupNow()}>Zálohovat</button>
        </section>
      )}

      <section className="panel">
        <div className="row">
          <span className="flame" aria-hidden>🔥</span>
          <div className="grow">
            <div className="streak" style={{ fontSize: '1.5rem' }}>{current} {current === 1 ? 'den' : current >= 2 && current <= 4 ? 'dny' : 'dní'} v řadě</div>
            <div className="small muted">
              {current ? (streaks?.all.activeToday ? 'Dnes splněno – série pokračuje!' : 'Dnes ještě něco udělej, ať série nezhasne!') : 'Splň dnes jakýkoli quest a začni sérii.'}
            </div>
          </div>
        </div>
        {streaks && (
          <div className="week-dots" aria-label="Aktivita za posledních 7 dní">
            {streaks.week.map((d, i) => (
              <div key={d.date} className={`d ${d.on ? 'on' : ''} ${i === 6 ? 'today' : ''}`}>
                <i />
                {i === 6 ? 'dnes' : DAY_LETTERS[parseDateKey(d.date).getDay()]}
              </div>
            ))}
          </div>
        )}
        {streaks && (
          <div className="mod-streaks">
            {MODULES.map((m) => (
              <span key={m.id} className={streaks[m.id].activeToday ? 'on' : ''} title={`Série: ${m.label}`}>
                {m.icon} {streaks[m.id].current}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="row between">
          <h2>Dnešní questy <span className="xp-chip">{doneToday}/{today.length}</span></h2>
          <button className="btn-sm" onClick={() => setAdding(true)}>+ Vlastní</button>
        </div>
        <p className="small muted" style={{ marginTop: -4 }}>Trénink dnes: <b>{plan.label}</b></p>
        <QuestList quests={today} />
        {once.length > 0 && (
          <>
            <h3>Jednorázové</h3>
            <QuestList quests={once} />
          </>
        )}
        <h2>Týdenní questy</h2>
        <QuestList quests={weekly} />
        {monthly.length > 0 && (
          <>
            <h2>Měsíční questy</h2>
            <QuestList quests={monthly} />
          </>
        )}
      </section>

      <h2>Moduly</h2>
      <div className="tiles">
        {MODULES.map((m) => {
          const mine = quests?.filter((q) => q.module === m.id) ?? [];
          const done = mine.filter((q) => q.done).length;
          return (
            <a key={m.id} className="tile" data-m={m.id} href={`#${m.route}`}>
              <span className="ic" aria-hidden>{m.icon}</span>
              <span className="nm">{m.label}</span>
              <span className="small muted">{done}/{mine.length} questů</span>
              <div className="qbar"><div style={{ width: `${mine.length ? (done / mine.length) * 100 : 0}%` }} /></div>
            </a>
          );
        })}
      </div>

      {extra && (
        <a href="#/report" className="panel row" style={{ textDecoration: 'none', color: 'var(--text)', marginTop: 12 }}>
          <span style={{ fontSize: '1.6rem' }}>📜</span>
          <div className="grow">
            <b>Deník hrdiny</b>
            <div className="small muted">
              Tento týden {extra.week} XP
              {pctChange(extra.week, extra.prevWeek) !== null && (
                <span style={{ color: extra.week >= extra.prevWeek ? 'var(--green)' : 'var(--red)' }}> · {extra.week >= extra.prevWeek ? '▲' : '▼'} {Math.abs(pctChange(extra.week, extra.prevWeek)!)} % proti stejným dnům minulého týdne</span>
              )}
            </div>
          </div>
          <span className="small muted">›</span>
        </a>
      )}

      <a href="#/map" className="panel row" style={{ textDecoration: 'none', color: 'var(--text)', marginTop: 12 }}>
        <span style={{ fontSize: '1.6rem' }}>🗺️</span>
        <div className="grow">
          <b>Mapa světa</b>
          <div className="small muted">Tvoje cesta k velkým cílům – ČVUT, Ironman, Porsche…</div>
        </div>
        <span className="small muted">›</span>
      </a>

      {recent && recent.length > 0 && (
        <>
          <h2>Poslední odznaky</h2>
          <a href="#/achievements" className="panel row" style={{ textDecoration: 'none', color: 'var(--text)' }}>
            {recent.map((r) => {
              const a = ACHIEVEMENTS.find((x) => x.id === r.id);
              return a ? <span key={r.id} title={a.title} style={{ fontSize: '1.7rem', filter: 'drop-shadow(0 0 6px rgba(245,197,66,.45))' }}>{a.icon}</span> : null;
            })}
            <span className="grow" />
            <span className="small muted">Všechny ›</span>
          </a>
        </>
      )}

      <AddQuestModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
