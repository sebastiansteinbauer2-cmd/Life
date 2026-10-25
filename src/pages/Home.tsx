import { useState } from 'react';
import { store, useProfile, useQuery } from '../app/context';
import { useQuests, useStreaks } from '../app/hooks';
import { AddQuestModal, QuestList } from '../components/Quests';
import { MiniBar, XpBar } from '../components/ui';
import { ACHIEVEMENTS } from '../game/achievements';
import { MODULES, STATS, levelFromXp, nextTitle, titleForLevel } from '../game/xp';
import { planForDate } from '../modules/training/plan';

export function Hud() {
  const p = useProfile();
  const lv = levelFromXp(p.xp);
  const nt = nextTitle(lv.level);
  return (
    <section className="panel gold">
      <div className="hud">
        <div className="avatar" aria-hidden>
          {p.name.slice(0, 1).toUpperCase()}
          <span className="lvl pixel">{lv.level}</span>
        </div>
        <div className="grow">
          <div className="row between">
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{p.name}</div>
              <div className="title-badge">{titleForLevel(lv.level)} · LVL {lv.level}</div>
            </div>
            <div className="xp-chip" title="Celkové XP">{p.xp} XP</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <XpBar value={lv.intoLevel} max={lv.needed} />
          </div>
          {nt && <div className="small muted" style={{ marginTop: 4 }}>Titul {nt.title} na levelu {nt.level}</div>}
        </div>
      </div>
      <div className="stats">
        {STATS.map((s) => {
          const sl = levelFromXp(p.statXp[s.id] ?? 0);
          return (
            <div className="stat" key={s.id}>
              <div className="top"><span>{s.icon} {s.label}</span><b style={{ color: s.color }}>LV {sl.level}</b></div>
              <MiniBar value={sl.progress} color={s.color} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const quests = useQuests();
  const streaks = useStreaks();
  const [adding, setAdding] = useState(false);
  const recent = useQuery(async () => (await store.col('achievements').all()).sort((a, b) => b.unlockedAt - a.unlockedAt).slice(0, 3));
  const today = quests?.filter((q) => q.recurrence === 'daily') ?? [];
  const weekly = quests?.filter((q) => q.recurrence === 'weekly') ?? [];
  const once = quests?.filter((q) => q.recurrence === 'once' && !q.done) ?? [];
  const doneToday = today.filter((q) => q.done).length;
  const plan = planForDate();

  return (
    <div>
      <Hud />

      <section className="panel">
        <div className="row between">
          <div>
            <div className="streak" style={{ fontSize: '1.3rem' }}>🔥 {streaks?.all.current ?? 0}</div>
            <div className="small muted">
              {streaks?.all.current ? (streaks.all.activeToday ? 'dní v řadě – dnes splněno' : 'dní v řadě – dnes ještě něco udělej!') : 'Začni sérii ještě dnes'}
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            {MODULES.map((m) => (
              <div key={m.id} className="center small" title={`Série: ${m.label}`}>
                <div>{m.icon}</div>
                <div className="pixel" style={{ fontSize: '0.7rem', color: streaks?.[m.id].activeToday ? '#fb923c' : 'var(--muted)' }}>
                  {streaks?.[m.id].current ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="row between">
          <h2>Dnešní questy <span className="muted small">{doneToday}/{today.length}</span></h2>
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
      </section>

      <h2>Moduly</h2>
      <div className="tiles">
        {MODULES.map((m) => (
          <a key={m.id} className="tile" href={`#${m.route}`}>
            <span className="ic">{m.icon}</span>
            <span className="nm">{m.label}</span>
            <span className="small muted">
              {quests ? `${quests.filter((q) => q.module === m.id && q.done).length}/${quests.filter((q) => q.module === m.id).length} questů` : ''}
            </span>
          </a>
        ))}
      </div>

      {recent && recent.length > 0 && (
        <>
          <h2>Poslední odznaky</h2>
          <a href="#/achievements" className="panel row" style={{ textDecoration: 'none', color: 'var(--text)' }}>
            {recent.map((r) => {
              const a = ACHIEVEMENTS.find((x) => x.id === r.id);
              return a ? <span key={r.id} title={a.title} style={{ fontSize: '1.6rem' }}>{a.icon}</span> : null;
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
