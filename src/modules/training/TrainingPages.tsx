import { useEffect, useState } from 'react';
import { game, store, useProfile, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { LineChart } from '../../components/Charts';
import { QuestList } from '../../components/Quests';
import { Empty, MiniBar, Modal, Tabs } from '../../components/ui';
import type { Exercise, ExerciseCategory, TrainingGoal, Workout } from '../../data/types';
import { WEEKDAYS, dateKey, formatDate, uid, weekdayIndex } from '../../lib/date';
import { levelFromXp } from '../../game/xp';
import {
  CATEGORY_LABEL, GOAL_LABEL, WEEK_PLAN, exerciseLevelScale, planForDate, setPoints, suggestTarget, workoutXp,
} from './plan';

const TABS = [
  { path: '/training', label: 'Přehled' },
  { path: '/training/log', label: 'Zapsat trénink' },
  { path: '/training/stats', label: 'Pokrok' },
];
const PR_XP = 20;
const unitLabel = (e: Exercise) => (e.unit === 'sec' ? 's' : '×');

function useTrainingData() {
  return useQuery(async () => {
    const [exercises, workouts] = await Promise.all([store.col('exercises').all(), store.col('workouts').all()]);
    return { exercises: exercises.filter((e) => !e.archived), workouts: workouts.sort((a, b) => b.ts - a.ts) };
  });
}

function WeekPlan() {
  const today = weekdayIndex();
  return (
    <div className="grid3" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {WEEK_PLAN.map((d, i) => (
        <div key={i} className="center small" style={{
          padding: '8px 2px', borderRadius: 8, border: `1px solid ${i === today ? 'var(--gold)' : 'var(--border)'}`,
          background: i === today ? 'rgba(245,197,66,.1)' : 'var(--bg-2)',
        }}>
          <div className="pixel" style={{ fontSize: '0.65rem', color: i === today ? 'var(--gold)' : 'var(--muted)' }}>{WEEKDAYS[i]}</div>
          <div style={{ fontSize: '1.1rem' }}>{d.kind === 'rest' ? '🧘' : d.focus.includes('upper') ? '💪' : d.focus.includes('lower') ? '🦵' : '🎯'}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', lineHeight: 1.1 }}>{d.kind === 'rest' ? 'volno' : d.focus.map((f) => CATEGORY_LABEL[f].split(' ')[0]).join('+')}</div>
        </div>
      ))}
    </div>
  );
}

function AddExerciseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Exercise['unit']>('reps');
  const [category, setCategory] = useState<ExerciseCategory>('upper');
  const [max, setMax] = useState(10);
  const save = async () => {
    if (!name.trim()) return;
    await store.col('exercises').put({ id: `ex-${uid()}`, name: name.trim(), unit, category, builtIn: false, max: max || 1, xp: 0 });
    setName('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Vlastní cvik">
      <div className="field"><label>Název</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Pike kliky" /></div>
      <div className="grid2">
        <div className="field"><label>Měří se</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Exercise['unit'])}><option value="reps">Opakování</option><option value="sec">Sekundy</option></select>
        </div>
        <div className="field"><label>Partie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)}>
            {(Object.keys(CATEGORY_LABEL) as ExerciseCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>Současné maximum</label><input type="number" inputMode="numeric" value={max} onChange={(e) => setMax(Number(e.target.value))} /></div>
      <button className="primary btn-block" onClick={save} disabled={!name.trim()}>Přidat cvik</button>
    </Modal>
  );
}

function TrainingHome() {
  const p = useProfile();
  const data = useTrainingData();
  const quests = useQuests('training');
  const [adding, setAdding] = useState(false);
  const plan = planForDate();
  if (!data) return null;
  const focus = plan.kind === 'train' ? data.exercises.filter((e) => plan.focus.includes(e.category)) : [];
  const thisWeek = data.workouts.filter((w) => {
    const d = new Date(w.ts);
    return Date.now() - d.getTime() < 7 * 86_400_000;
  }).length;

  return (
    <div>
      <h1>🏋️ Trénink</h1>
      <Tabs items={TABS} active="/training" />
      <section className="panel">
        <div className="row between small muted" style={{ marginBottom: 8 }}>
          <span>{p.heightCm} cm · {p.weightKg} kg · cíl: <b style={{ color: 'var(--gold-2)' }}>{GOAL_LABEL[p.trainingGoal]}</b></span>
          <span>{thisWeek}× za 7 dní</span>
        </div>
        <WeekPlan />
      </section>
      <QuestList quests={quests ?? []} />
      <section className="panel gold">
        <h2 style={{ marginTop: 0 }}>Dnes: {plan.label}</h2>
        {plan.kind === 'rest' ? (
          <p>Den volna je taky quest 🧘 – protáhni se, projdi se, vyspi se. Odškrtni regeneraci v questech.</p>
        ) : (
          <>
            {focus.map((e) => {
              const s = suggestTarget(e, p.trainingGoal, data.workouts);
              return (
                <div key={e.id} className="row between list-item">
                  <div><b>{e.name}</b><div className="small muted">{s.reason}</div></div>
                  <span className="pixel" style={{ color: 'var(--gold)' }}>{s.sets}×{s.value}{e.unit === 'sec' ? 's' : ''}</span>
                </div>
              );
            })}
            <a className="btn btn-gold btn-block" href="#/training/log" style={{ marginTop: 10 }}>Zapsat dnešní trénink ▶</a>
          </>
        )}
      </section>
      <div className="row between"><h2>Cviky</h2><button className="btn-sm" onClick={() => setAdding(true)}>+ Vlastní cvik</button></div>
      <section className="panel">
        {data.exercises.map((e) => {
          const lv = levelFromXp(e.xp, exerciseLevelScale);
          return (
            <div key={e.id} className="list-item">
              <div className="row between">
                <span><b>{e.name}</b> <span className="chip">{CATEGORY_LABEL[e.category]}</span></span>
                <span className="small">Rekord <b style={{ color: 'var(--gold-2)' }}>{e.max}{unitLabel(e)}</b> · <span className="pixel" style={{ fontSize: '0.7rem', color: 'var(--c-str)' }}>LV {lv.level}</span></span>
              </div>
              <div style={{ marginTop: 6 }}><MiniBar value={lv.progress} color="var(--c-str)" /></div>
            </div>
          );
        })}
      </section>
      <AddExerciseModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

interface Draft { exerciseId: string; sets: string[] }

function TrainingLog() {
  const p = useProfile();
  const data = useTrainingData();
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [saved, setSaved] = useState<{ xp: number; prs: string[] } | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!data || draft) return;
    const plan = planForDate();
    const focus = plan.kind === 'train' ? data.exercises.filter((e) => plan.focus.includes(e.category)) : [];
    setDraft(focus.map((e) => {
      const s = suggestTarget(e, p.trainingGoal, data.workouts);
      return { exerciseId: e.id, sets: Array(s.sets).fill(String(s.value)) };
    }));
  }, [data, draft, p.trainingGoal]);

  if (!data || !draft) return null;
  const byId = new Map(data.exercises.map((e) => [e.id, e]));
  const update = (i: number, sets: string[]) => setDraft(draft.map((d, k) => (k === i ? { ...d, sets } : d)));
  const unused = data.exercises.filter((e) => !draft.some((d) => d.exerciseId === e.id));

  const save = async () => {
    const entries = draft
      .map((d) => ({ exerciseId: d.exerciseId, sets: d.sets.map(Number).filter((n) => Number.isFinite(n) && n > 0) }))
      .filter((d) => d.sets.length && byId.has(d.exerciseId));
    if (!entries.length) return;
    let points = 0;
    const prs: string[] = [];
    for (const en of entries) {
      const ex = byId.get(en.exerciseId)!;
      const pts = en.sets.reduce((s, v) => s + setPoints(ex.unit, v), 0);
      points += pts;
      const best = Math.max(...en.sets);
      const isPr = best > ex.max;
      if (isPr) prs.push(ex.id);
      await store.col('exercises').put({ ...ex, max: Math.max(ex.max, best), xp: ex.xp + Math.round(pts) });
    }
    const xp = workoutXp(points);
    const w: Workout = { id: uid(), ts: Date.now(), date: dateKey(), entries, xp, prs, note: note.trim() || undefined };
    await store.col('workouts').put(w);
    await game.award({ amount: xp, stat: 'str', module: 'training', label: 'Trénink' });
    for (const id of prs) {
      await game.award({ amount: PR_XP, stat: 'str', module: 'training', label: `Osobní rekord: ${byId.get(id)!.name}` });
    }
    await game.progressQuest('train-workout');
    setSaved({ xp: xp + prs.length * PR_XP, prs });
  };

  if (saved) {
    return (
      <div>
        <h1>Trénink zapsán 💪</h1>
        <section className="panel gold center">
          <div className="pixel" style={{ fontSize: '2rem', color: 'var(--gold)' }}>+{saved.xp} XP</div>
          {saved.prs.length > 0 && <p>🏆 Nové rekordy: {saved.prs.map((id) => byId.get(id)?.name).join(', ')}</p>}
          <a className="btn btn-block" href="#/training">Zpět na přehled</a>
        </section>
      </div>
    );
  }

  return (
    <div>
      <h1>Zapsat trénink</h1>
      <Tabs items={TABS} active="/training/log" />
      {draft.length === 0 && <Empty>Dnes je podle plánu volno. Pokud přesto trénuješ, přidej cviky níže.</Empty>}
      {draft.map((d, i) => {
        const ex = byId.get(d.exerciseId)!;
        const s = suggestTarget(ex, p.trainingGoal, data.workouts);
        return (
          <section key={d.exerciseId} className="panel">
            <div className="row between">
              <b>{ex.name}</b>
              <button className="iconbtn btn-sm" onClick={() => setDraft(draft.filter((_, k) => k !== i))} aria-label="Odebrat cvik">✕</button>
            </div>
            <div className="small muted" style={{ marginBottom: 8 }}>Cíl {s.sets}×{s.value}{ex.unit === 'sec' ? ' s' : ''} · rekord {ex.max}{unitLabel(ex)}</div>
            <div className="setrow">
              {d.sets.map((v, k) => (
                <input key={k} type="number" inputMode="numeric" value={v} aria-label={`Série ${k + 1}`}
                  onChange={(e) => update(i, d.sets.map((x, j) => (j === k ? e.target.value : x)))}
                  style={Number(v) > ex.max ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined} />
              ))}
              <button className="btn-sm" onClick={() => update(i, [...d.sets, d.sets[d.sets.length - 1] ?? String(s.value)])}>+ série</button>
              {d.sets.length > 1 && <button className="btn-sm btn-ghost" onClick={() => update(i, d.sets.slice(0, -1))}>−</button>}
            </div>
          </section>
        );
      })}
      {unused.length > 0 && (
        <div className="field">
          <select value="" onChange={(e) => {
            const ex = byId.get(e.target.value);
            if (!ex) return;
            const s = suggestTarget(ex, p.trainingGoal, data.workouts);
            setDraft([...draft, { exerciseId: ex.id, sets: Array(s.sets).fill(String(s.value)) }]);
          }} aria-label="Přidat cvik">
            <option value="">+ Přidat cvik…</option>
            {unused.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label>Poznámka (nepovinné)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="jak to šlo?" /></div>
      <button className="primary btn-block" onClick={save} disabled={!draft.length}>Uložit trénink ✔</button>
    </div>
  );
}

function TrainingStats() {
  const p = useProfile();
  const data = useTrainingData();
  const weights = useQuery(async () => (await store.col('weights').all()).sort((a, b) => a.date.localeCompare(b.date)));
  const [exId, setExId] = useState('kliky');
  const [kg, setKg] = useState('');
  if (!data || !weights) return null;
  const ex = data.exercises.find((e) => e.id === exId) ?? data.exercises[0];
  const points = [...data.workouts].reverse()
    .map((w) => ({ date: w.date, best: Math.max(0, ...(w.entries.find((e) => e.exerciseId === ex?.id)?.sets ?? [])) }))
    .filter((x) => x.best > 0);
  let running = 0;
  const maxSeries = points.map((x) => (running = Math.max(running, x.best)));

  const addWeight = async () => {
    const v = Number(kg.replace(',', '.'));
    if (!(v > 20 && v < 400)) return;
    await store.col('weights').put({ id: dateKey(), date: dateKey(), kg: v });
    await game.saveProfile({ weightKg: v });
    setKg('');
  };

  return (
    <div>
      <h1>Pokrok</h1>
      <Tabs items={TABS} active="/training/stats" />
      <section className="panel">
        <div className="field">
          <select value={ex?.id} onChange={(e) => setExId(e.target.value)} aria-label="Cvik">
            {data.exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        {points.length ? (
          <LineChart labels={points.map((x) => formatDate(x.date).slice(0, -5))}
            series={[{ label: 'Nejlepší série', data: points.map((x) => x.best), color: '#f87171' }, { label: 'Maximum', data: maxSeries, color: '#f5c542', dashed: true }]} />
        ) : <Empty>Zatím žádná data pro tento cvik.</Empty>}
      </section>
      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Váha</h3>
        <div className="row">
          <input type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={`${p.weightKg} kg`} aria-label="Váha v kg" />
          <button onClick={addWeight}>Zapsat</button>
        </div>
        {weights.length > 1 ? (
          <div style={{ marginTop: 10 }}>
            <LineChart labels={weights.map((w) => formatDate(w.date).slice(0, -5))} series={[{ label: 'kg', data: weights.map((w) => w.kg), color: '#60a5fa', fill: true }]} />
          </div>
        ) : <p className="small muted">Graf se ukáže po dvou a více záznamech. BMI: {(p.weightKg / (p.heightCm / 100) ** 2).toFixed(1)}</p>}
      </section>
      <h2>Historie tréninků</h2>
      <section className="panel">
        {data.workouts.length ? data.workouts.slice(0, 30).map((w) => (
          <div key={w.id} className="list-item small">
            <div className="row between"><b>{formatDate(w.date)}</b><span className="xp-chip">+{w.xp}</span></div>
            <div className="muted">{w.entries.map((e) => {
              const x = data.exercises.find((q) => q.id === e.exerciseId);
              return `${x?.name ?? e.exerciseId} ${e.sets.join('/')}${w.prs.includes(e.exerciseId) ? ' 🏆' : ''}`;
            }).join(' · ')}</div>
            {w.note && <div>{w.note}</div>}
          </div>
        )) : <Empty>Zatím žádný trénink.</Empty>}
      </section>
      <section className="panel">
        <label>Cíl tréninku</label>
        <select value={p.trainingGoal} onChange={(e) => game.saveProfile({ trainingGoal: e.target.value as TrainingGoal })}>
          {(Object.keys(GOAL_LABEL) as TrainingGoal[]).map((g) => <option key={g} value={g}>{GOAL_LABEL[g]}</option>)}
        </select>
      </section>
    </div>
  );
}

export default function TrainingPages({ route }: { route: string }) {
  if (route === '/training/log') return <TrainingLog />;
  if (route === '/training/stats') return <TrainingStats />;
  return <TrainingHome />;
}
