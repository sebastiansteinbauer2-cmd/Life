import { useEffect, useMemo, useRef, useState } from 'react';
import { game, store, useProfile, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { BarChart, LineChart } from '../../components/Charts';
import { MathText } from '../../components/MathText';
import { QuestList } from '../../components/Quests';
import { Empty, Tabs, XpBar } from '../../components/ui';
import type { MathLevel } from '../../data/types';
import { dateKey, daysBetween, uid } from '../../lib/date';
import { Rng } from './core';
import {
  BOSS_MINUTES, BOSS_PASS, BOSS_QUESTIONS, bossScore, buildBossTest, generateProblem, pickTopic, topicStats, topicWeights, topicsFor,
  type Problem,
} from './generator';
import { checkAnswer } from './parse';
import { AnswerInput, ProblemText, Solution } from './ProblemCard';
import { LEVEL_LABEL, TOPICS, TOPIC_NAME, TOPIC_SHORT, type TopicId } from './topics';
import { recordAttempt } from './useMath';

const TABS = [
  { path: '/math', label: 'Přehled' },
  { path: '/math/practice', label: 'Procvičování' },
  { path: '/math/boss', label: '🐉 Boss fight' },
  { path: '/math/stats', label: 'Pokrok' },
];

function LevelPicker() {
  const p = useProfile();
  return (
    <div className="tabs">
      {(Object.keys(LEVEL_LABEL) as MathLevel[]).map((l) => (
        <button key={l} className={p.mathLevel === l ? 'active' : ''} onClick={() => game.saveProfile({ mathLevel: l })}>{LEVEL_LABEL[l]}</button>
      ))}
    </div>
  );
}

export function MathHome() {
  const p = useProfile();
  const quests = useQuests('math');
  const data = useQuery(async () => {
    const [attempts, boss] = await Promise.all([store.col('mathAttempts').all(), store.col('bossResults').all()]);
    return { attempts, boss };
  });
  const today = dateKey();
  const solvedToday = data?.attempts.filter((a) => a.date === today && a.correct).length ?? 0;
  const stats = data ? topicStats(data.attempts) : null;
  const weak = stats
    ? Object.values(stats).filter((s) => s.attempts >= 3).sort((a, b) => a.recentAccuracy - b.recentAccuracy).slice(0, 3)
    : [];
  const best = data?.boss.length ? Math.max(...data.boss.map((b) => b.score)) : null;
  const daysLeft = p.examDate ? daysBetween(today, p.examDate) : null;

  return (
    <div>
      <h1>∑ Matematika</h1>
      <Tabs items={TABS} active="/math" />
      <p className="small muted">Cíl: přijímačky FIT ČVUT (0–100 bodů, hranice {BOSS_PASS}) a maturita – ideálně rozšiřující matematika za 1–2.</p>
      <LevelPicker />
      <section className="panel gold">
        <div className="row between">
          <div>
            <div className="pixel" style={{ color: 'var(--gold-2)' }}>Dnes: {solvedToday}/10</div>
            <div className="small muted">správně vyřešených příkladů</div>
          </div>
          {daysLeft !== null && daysLeft >= 0 && <div className="center"><div className="pixel" style={{ color: 'var(--gold)' }}>{daysLeft}</div><div className="small muted">dní do zkoušky</div></div>}
        </div>
        <div style={{ marginTop: 10 }}><XpBar value={Math.min(10, solvedToday)} max={10} label={`${Math.min(10, solvedToday)} / 10`} /></div>
        <a className="btn btn-gold btn-block" style={{ marginTop: 12 }} href="#/math/practice">Procvičovat ▶</a>
      </section>
      <QuestList quests={quests ?? []} />
      <div className="grid2">
        <a className="panel" href="#/math/boss" style={{ textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ fontSize: '1.6rem' }}>🐉</div>
          <div className="pixel small" style={{ color: 'var(--gold-2)' }}>Boss fight</div>
          <div className="small muted">{best !== null ? `Nejlepší: ${best} b.` : 'Simulace přijímaček'}</div>
        </a>
        <a className="panel" href="#/math/stats" style={{ textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ fontSize: '1.6rem' }}>📊</div>
          <div className="pixel small" style={{ color: 'var(--gold-2)' }}>Pokrok</div>
          <div className="small muted">{data?.attempts.length ?? 0} pokusů celkem</div>
        </a>
      </div>
      {weak.length > 0 && (
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Slabá místa</h3>
          {weak.map((w) => (
            <a key={w.topic} href={`#/math/practice?t=${w.topic}`} className="row between list-item" style={{ color: 'var(--text)', textDecoration: 'none' }}>
              <span>{TOPIC_NAME[w.topic]}</span>
              <span className="chip tag-loss">{Math.round(w.recentAccuracy * 100)} %</span>
            </a>
          ))}
        </section>
      )}
      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Doporučené video</h3>
        <p className="small">3Blue1Brown – vizuální intuice pro funkce, vektory a kombinatoriku.</p>
        <a className="btn btn-sm" href="https://www.youtube.com/@3blue1brown" target="_blank" rel="noopener noreferrer">Otevřít 3Blue1Brown ↗</a>
      </section>
    </div>
  );
}

const topicFromHash = (): TopicId | 'mix' => {
  const m = /[?&]t=([a-z]+)/.exec(location.hash);
  return (m && TOPICS.some((t) => t.id === m[1]) ? m[1] : 'mix') as TopicId | 'mix';
};

export function MathPractice() {
  const profile = useProfile();
  const level = profile.mathLevel;
  const [mode, setMode] = useState<TopicId | 'mix'>(topicFromHash);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [anim, setAnim] = useState('');
  const rng = useMemo(() => new Rng(), []);
  const lastTopic = useRef<string | undefined>(undefined);

  const next = async () => {
    let topic: TopicId;
    if (mode === 'mix') {
      const [attempts, srs] = await Promise.all([store.col('mathAttempts').all(), store.col('topicSrs').all()]);
      topic = pickTopic(topicWeights(level, attempts.filter((a) => a.level === level), srs, dateKey()), rng, lastTopic.current);
    } else topic = mode;
    lastTopic.current = topic;
    setProblem(generateProblem(topic, level, rng));
    setInput('');
    setResult(null);
  };

  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, level]);

  const submit = async () => {
    if (!problem || result?.ok !== undefined && result.error === undefined) return;
    const res = checkAnswer(problem.answer, input);
    if (res.error && !res.ok) {
      setResult(res);
      return;
    }
    setResult(res);
    setStreak(res.ok ? streak + 1 : 0);
    setAnim(res.ok ? 'pulse-good' : 'shake');
    setTimeout(() => setAnim(''), 600);
    await recordAttempt(problem, res.ok);
  };

  const available = topicsFor(level);
  const answered = result !== null && result.error === undefined;

  return (
    <div>
      <h1>Procvičování</h1>
      <Tabs items={TABS} active="/math/practice" />
      <div className="field">
        <select value={mode} onChange={(e) => setMode(e.target.value as TopicId | 'mix')} aria-label="Téma">
          <option value="mix">🎯 Mix – víc toho, co ti nejde</option>
          {TOPICS.filter((t) => available.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="row between small muted" style={{ marginBottom: 8 }}>
        <span>{LEVEL_LABEL[level]}</span>
        {streak > 1 && <span className="streak">🔥 {streak} v řadě</span>}
      </div>
      {problem && (
        <section className={`panel ${anim}`}>
          <ProblemText problem={problem} />
          <div style={{ marginTop: 12 }}>
            <AnswerInput value={input} onChange={setInput} onSubmit={answered ? next : submit} kind={problem.answer.kind} disabled={answered} />
          </div>
          {result?.error && <p className="feedback-bad small">{result.error}</p>}
          {answered && (
            <div style={{ marginTop: 10 }}>
              {result.ok ? <p className="feedback-ok">✔ Správně!</p> : <p className="feedback-bad">✘ Špatně – tady je řešení krok za krokem:</p>}
              {!result.ok && <Solution problem={problem} />}
              {result.ok && (
                <details>
                  <summary className="small muted">Zobrazit postup</summary>
                  <Solution problem={problem} />
                </details>
              )}
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            {!answered ? (
              <>
                <button onClick={() => { setResult({ ok: false }); recordAttempt(problem, false); setStreak(0); }}>Nevím</button>
                <button className="primary grow" onClick={submit}>Zkontrolovat</button>
              </>
            ) : (
              <button className="primary grow" onClick={next}>Další příklad ›</button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export function MathBoss() {
  const profile = useProfile();
  const history = useQuery(async () => (await store.col('bossResults').all()).sort((a, b) => a.ts - b.ts));
  const [test, setTest] = useState<Problem[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState<{ score: number; correct: boolean[] } | null>(null);

  const remaining = test && !done ? Math.max(0, BOSS_MINUTES * 60 - Math.floor((now - startedAt) / 1000)) : 0;

  useEffect(() => {
    if (!test || done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [test, done]);

  const start = () => {
    setTest(buildBossTest(profile.mathLevel));
    setAnswers(Array(BOSS_QUESTIONS).fill(''));
    setIdx(0);
    setStartedAt(Date.now());
    setNow(Date.now());
    setDone(null);
  };

  const finish = async () => {
    if (!test || done) return;
    const correct = test.map((p, i) => checkAnswer(p.answer, answers[i]).ok);
    const n = correct.filter(Boolean).length;
    const score = bossScore(n, test.length);
    setDone({ score, correct });
    await store.col('bossResults').put({
      id: uid(), ts: Date.now(), level: profile.mathLevel, score, correct: n, total: test.length,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
    });
    for (let i = 0; i < test.length; i++) await recordAttempt(test[i], correct[i], { award: false });
    await game.award({ amount: Math.round(score / 2) + (score >= BOSS_PASS ? 50 : 0), stat: 'int', module: 'math', label: `Boss fight: ${score} bodů` });
    await game.progressQuest('math-boss');
  };

  useEffect(() => {
    if (test && !done && remaining === 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  if (test && !done) {
    const p = test[idx];
    const mm = Math.floor(remaining / 60), ss = String(remaining % 60).padStart(2, '0');
    const filled = answers.filter((a) => a.trim()).length;
    return (
      <div>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>🐉 Boss fight</h1>
          <span className={`timer ${remaining < 300 ? 'low' : ''}`}>⏱ {mm}:{ss}</span>
        </div>
        <div className="tabs">
          {test.map((_, i) => (
            <button key={i} className={i === idx ? 'active' : ''} onClick={() => setIdx(i)} style={{ minWidth: 38, color: answers[i].trim() && i !== idx ? 'var(--green)' : undefined }}>{i + 1}</button>
          ))}
        </div>
        <section className="panel">
          <ProblemText problem={p} index={idx} />
          <div style={{ marginTop: 12 }}>
            <AnswerInput value={answers[idx]} onChange={(v) => setAnswers(answers.map((a, i) => (i === idx ? v : a)))} onSubmit={() => setIdx(Math.min(test.length - 1, idx + 1))} kind={p.answer.kind} />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>‹</button>
            <span className="grow center small muted">Vyplněno {filled}/{test.length}</span>
            <button disabled={idx === test.length - 1} onClick={() => setIdx(idx + 1)}>›</button>
          </div>
        </section>
        <button className="primary btn-block" onClick={() => confirm('Odevzdat test?') && finish()}>Odevzdat test</button>
      </div>
    );
  }

  return (
    <div>
      <h1>🐉 Boss fight</h1>
      <Tabs items={TABS} active="/math/boss" />
      {done && test && (
        <section className={`panel ${done.score >= BOSS_PASS ? 'gold' : ''}`}>
          <div className="center">
            <div className="pixel" style={{ fontSize: '2.4rem', color: done.score >= BOSS_PASS ? 'var(--gold)' : 'var(--red)' }}>{done.score}</div>
            <div>bodů ze 100 · hranice {BOSS_PASS}</div>
            <p className={done.score >= BOSS_PASS ? 'feedback-ok' : 'feedback-bad'}>{done.score >= BOSS_PASS ? 'Boss poražen! Takhle bys byl přijat. 🎓' : `Chybí ${BOSS_PASS - done.score} bodů. Zkus to znovu!`}</p>
          </div>
          <h3>Rozbor chyb</h3>
          {test.map((p, i) => done.correct[i] ? null : (
            <details key={p.uid} className="list-item">
              <summary>✘ Úloha {i + 1}: {TOPIC_SHORT[p.topic]} {answers[i] ? <span className="muted small">(tvoje: {answers[i]})</span> : <span className="muted small">(bez odpovědi)</span>}</summary>
              <div style={{ marginTop: 8 }}><MathText text={p.question} className="problem" /></div>
              <Solution problem={p} />
            </details>
          ))}
          {done.correct.every(Boolean) && <p className="center">Bez jediné chyby! 🏆</p>}
        </section>
      )}
      <section className="panel">
        <p>Simulace přijímacího testu: <b>{BOSS_QUESTIONS} úloh</b> z různých témat, <b>{BOSS_MINUTES} minut</b>, každá úloha za {100 / BOSS_QUESTIONS} bodů. Hranice přijetí: <b>{BOSS_PASS} bodů</b>.</p>
        <p className="small muted">Úroveň: {LEVEL_LABEL[profile.mathLevel]} (změníš v přehledu). XP: polovina bodů + 50 za překonání hranice.</p>
        <button className="primary btn-block" onClick={start}>{done ? 'Nový pokus' : 'Začít souboj ⚔️'}</button>
      </section>
      <BossHistory history={history ?? []} />
    </div>
  );
}

function BossHistory({ history }: { history: { ts: number; score: number }[] }) {
  if (!history.length) return <Empty>Zatím žádný boss fight. Výsledky se tu zobrazí v grafu.</Empty>;
  return (
    <section className="panel">
      <h3 style={{ marginTop: 0 }}>Historie výsledků</h3>
      <LineChart
        labels={history.map((h) => new Date(h.ts).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }))}
        series={[
          { label: 'Body', data: history.map((h) => h.score) },
          { label: 'Hranice 70', data: history.map(() => BOSS_PASS), color: '#f87171', dashed: true },
        ]}
        yMin={0}
        yMax={100}
      />
    </section>
  );
}

export function MathStats() {
  const data = useQuery(async () => {
    const [attempts, boss] = await Promise.all([store.col('mathAttempts').all(), store.col('bossResults').all()]);
    return { attempts, boss: boss.sort((a, b) => a.ts - b.ts) };
  });
  if (!data) return null;
  const stats = topicStats(data.attempts);
  const rows = TOPICS.map((t) => stats[t.id]);
  const total = data.attempts.length;
  const correct = data.attempts.filter((a) => a.correct).length;
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return dateKey(d);
  });
  return (
    <div>
      <h1>Pokrok</h1>
      <Tabs items={TABS} active="/math/stats" />
      <div className="grid3">
        <div className="panel center"><div className="pixel" style={{ color: 'var(--gold)' }}>{correct}</div><div className="small muted">vyřešeno</div></div>
        <div className="panel center"><div className="pixel" style={{ color: 'var(--gold)' }}>{total ? Math.round((100 * correct) / total) : 0} %</div><div className="small muted">úspěšnost</div></div>
        <div className="panel center"><div className="pixel" style={{ color: 'var(--gold)' }}>{data.boss.length ? Math.max(...data.boss.map((b) => b.score)) : '–'}</div><div className="small muted">max. boss</div></div>
      </div>
      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Úspěšnost podle témat</h3>
        {total ? (
          <BarChart
            horizontal
            labels={rows.map((r) => TOPIC_SHORT[r.topic])}
            values={rows.map((r) => Math.round(r.accuracy * 100))}
            colors={rows.map((r) => (r.attempts === 0 ? '#2a3150' : r.accuracy >= 0.7 ? '#4ade80' : r.accuracy >= 0.5 ? '#f5c542' : '#f87171'))}
            max={100}
            height={300}
            suffix=" %"
          />
        ) : <Empty>Vyřeš pár příkladů a uvidíš, kde jsi silný.</Empty>}
      </section>
      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Vyřešené příklady (14 dní)</h3>
        <BarChart labels={last14.map((d) => d.slice(8) + '.')} values={last14.map((d) => data.attempts.filter((a) => a.date === d && a.correct).length)} height={180} />
      </section>
      <section className="panel">
        <table>
          <thead><tr><th>Téma</th><th className="num">Pokusy</th><th className="num">Správně</th><th className="num">Posl. 20</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.topic}>
                <td>{TOPIC_SHORT[r.topic]}</td>
                <td className="num">{r.attempts}</td>
                <td className="num">{r.attempts ? Math.round(r.accuracy * 100) + ' %' : '–'}</td>
                <td className="num">{r.attempts ? Math.round(r.recentAccuracy * 100) + ' %' : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <BossHistory history={data.boss} />
    </div>
  );
}

export function MathRouter({ route }: { route: string }) {
  if (route === '/math/practice') return <MathPractice />;
  if (route === '/math/boss') return <MathBoss />;
  if (route === '/math/stats') return <MathStats />;
  return <MathHome />;
}
