import { useState } from 'react';
import { game, store } from '../app/context';
import type { Equipment, MathLevel, TrainingGoal } from '../data/types';
import { NumberField } from '../components/ui';
import { dateKey } from '../lib/date';
import { BUILTIN_EXERCISES, DEFAULT_MAX, GOAL_LABEL } from '../modules/training/plan';
import { LEVEL_LABEL } from '../modules/math/topics';

const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'hrazda', label: 'Hrazda' },
  { id: 'cinky', label: 'Činky' },
  { id: 'gumy', label: 'Odporové gumy' },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [height, setHeight] = useState(183);
  const [weight, setWeight] = useState(88);
  const [goal, setGoal] = useState<TrainingGoal>('svaly');
  const [equipment, setEquipment] = useState<Equipment[]>(['hrazda']);
  const [maxes, setMaxes] = useState<Record<string, number>>({ ...DEFAULT_MAX });
  const [chess, setChess] = useState('');
  const [fide, setFide] = useState(1980);
  const [level, setLevel] = useState<MathLevel>('rozsireny');
  const [examDate, setExamDate] = useState('');

  const finish = async () => {
    await game.saveProfile({
      name: name.trim() || 'Hrdina', heightCm: height, weightKg: weight, trainingGoal: goal, equipment,
      chessUsername: chess.trim(), fideRating: fide, mathLevel: level, examDate, onboarded: true, createdAt: Date.now(),
    });
    const exercises = await store.col('exercises').all();
    await store.col('exercises').bulkPut(exercises.map((e) => (maxes[e.id] !== undefined && Number.isFinite(maxes[e.id]) ? { ...e, max: maxes[e.id] } : e)));
    if (weight) await store.col('weights').put({ id: dateKey(), date: dateKey(), kg: weight });
    onDone();
  };

  const steps = [
    <div key="0" className="stack">
      <h1>Questy života</h1>
      <p>Vítej, dobrodruhu! Všechno, co děláš – učení, trénink, šachy, objevy – jsou questy. Za každý dostaneš XP, levelneš a zlepšíš statistiky své postavy.</p>
      <div className="field">
        <label>Jméno postavy</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Sebastian" autoFocus />
      </div>
    </div>,
    <div key="1">
      <h2>🏋️ Trénink</h2>
      <div className="grid2">
        <NumberField label="Výška" suffix="cm" value={height} onChange={setHeight} />
        <NumberField label="Váha" suffix="kg" value={weight} onChange={setWeight} step={0.1} />
      </div>
      <div className="field">
        <label>Cíl</label>
        <div className="row wrap">
          {(Object.keys(GOAL_LABEL) as TrainingGoal[]).map((g) => (
            <button key={g} className={`chip ${goal === g ? 'on' : ''}`} onClick={() => setGoal(g)}>{GOAL_LABEL[g]}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Vybavení</label>
        <div className="row wrap">
          {EQUIPMENT.map((e) => (
            <label key={e.id} className="check">
              <input type="checkbox" checked={equipment.includes(e.id)}
                onChange={(ev) => setEquipment(ev.target.checked ? [...equipment, e.id] : equipment.filter((x) => x !== e.id))} />
              {e.label}
            </label>
          ))}
        </div>
      </div>
      <h3>Maximum v jedné sérii</h3>
      <div className="grid2">
        {BUILTIN_EXERCISES.map((e) => (
          <NumberField key={e.id} label={e.name} suffix={e.unit === 'sec' ? 's' : 'opak.'} value={maxes[e.id]}
            onChange={(v) => setMaxes({ ...maxes, [e.id]: v })} />
        ))}
      </div>
    </div>,
    <div key="2">
      <h2>♞ Šachy</h2>
      <div className="field">
        <label>Uživatelské jméno na Chess.com</label>
        <input value={chess} onChange={(e) => setChess(e.target.value)} placeholder="tvoje_jmeno" autoCapitalize="none" autoCorrect="off" />
      </div>
      <NumberField label="FIDE rating" value={fide} onChange={setFide} />
      <p className="small muted">Jméno můžeš zadat i později v Nastavení. Partie se pak načítají automaticky.</p>
    </div>,
    <div key="3">
      <h2>∑ Matematika</h2>
      <p className="small muted">Cíl: přijímačky FIT ČVUT (hranice 70 bodů) a maturita z matematiky.</p>
      <div className="field">
        <label>Úroveň příkladů</label>
        <div className="stack">
          {(Object.keys(LEVEL_LABEL) as MathLevel[]).map((l) => (
            <button key={l} className={`btn-block ${level === l ? 'btn-gold' : ''}`} onClick={() => setLevel(l)}>{LEVEL_LABEL[l]}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Datum přijímaček / maturity (nepovinné)</label>
        <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
      </div>
    </div>,
  ];

  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        {steps.map((_, i) => (
          <div key={i} className="grow" style={{ height: 4, borderRadius: 2, background: i <= step ? 'var(--gold)' : 'var(--border)' }} />
        ))}
      </div>
      <div className="panel">{steps[step]}</div>
      <div className="row">
        {step > 0 && <button onClick={() => setStep(step - 1)}>Zpět</button>}
        <span className="grow" />
        {step < steps.length - 1 ? (
          <button className="primary" onClick={() => setStep(step + 1)}>Dál ›</button>
        ) : (
          <button className="primary" onClick={finish}>Začít dobrodružství ⚔️</button>
        )}
      </div>
    </div>
  );
}
