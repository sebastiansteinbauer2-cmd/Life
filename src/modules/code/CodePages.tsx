import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { game, store, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { QuestList } from '../../components/Quests';
import { Empty, MiniBar, Tabs } from '../../components/ui';
import { dateKey, uid } from '../../lib/date';
import { C_QUESTIONS, C_XP, isCorrect, wrapC, type CQuestion } from './cquiz';
import { callRepr, dailyTask, newlineIndent, pyRepr, solvedIds } from './logic';
import { pythonLoaded, runTask, type RunResult } from './runner';
import { LEVEL_LABEL, LEVEL_XP, PY_TASKS, VISIBLE_TESTS, taskById, type PyTask, type TaskLevel } from './tasks';

const TABS = [
  { path: '/code', label: 'Přehled' },
  { path: '/code/tasks', label: 'Úlohy' },
  { path: '/code/c', label: 'Kvíz C' },
];
const LEVEL_COLOR: Record<TaskLevel, string> = { e: 'var(--green)', m: 'var(--gold)', h: 'var(--red)' };
const C_DAILY = 3; // správné odpovědi v kvízu C, které splní denní quest

function useAttempts() {
  return useQuery(() => store.col('codeAttempts').all());
}

function LevelBadge({ level }: { level: TaskLevel }) {
  return <span className="small" style={{ color: LEVEL_COLOR[level], fontWeight: 600 }}>{LEVEL_LABEL[level]} · {LEVEL_XP[level]} XP</span>;
}

function CodeHome() {
  const attempts = useAttempts();
  const quests = useQuests('code');
  if (!attempts) return null;
  const solved = solvedIds(attempts);
  const daily = dailyTask(solved);
  const today = dateKey();
  const cToday = attempts.filter((a) => a.date === today && a.passed && a.taskId.startsWith('c:')).length;
  return (
    <div>
      <h1>💻 Programování</h1>
      <Tabs items={TABS} active="/code" />
      <section className="panel gold">
        <div className="small muted">Úloha dne</div>
        <h2 style={{ margin: '4px 0' }}>{daily.title} {solved.has(daily.id) && '✅'}</h2>
        <LevelBadge level={daily.level} />
        <p className="small" style={{ marginBottom: 10 }}>{daily.text}</p>
        <a className="btn primary btn-block" href={`#/code/task/${daily.id}`}>▶ Řešit</a>
      </section>
      <QuestList quests={quests ?? []} />
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Postup – {solved.size} / {PY_TASKS.length}</h2>
        {(['e', 'm', 'h'] as TaskLevel[]).map((l) => {
          const all = PY_TASKS.filter((t) => t.level === l);
          const n = all.filter((t) => solved.has(t.id)).length;
          return (
            <div key={l} style={{ marginBottom: 8 }}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><span>{LEVEL_LABEL[l]}</span><span>{n} / {all.length}</span></div>
              <MiniBar value={n / all.length} color={LEVEL_COLOR[l]} />
            </div>
          );
        })}
      </section>
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>©️ Kvíz C – „Co program vypíše?“</h2>
        <p className="small">Příprava na předmět PA1 na FIT: krátké programy v C, odhadni výstup. Dnes {Math.min(cToday, C_DAILY)}/{C_DAILY} správně.</p>
        <a className="btn btn-block" href="#/code/c">Spustit kvíz</a>
      </section>
      <p className="small muted center">Python běží přímo v telefonu – poprvé se stáhne asi 10 MB, pak funguje i offline.</p>
    </div>
  );
}

function CodeTasks() {
  const attempts = useAttempts();
  if (!attempts) return null;
  const solved = solvedIds(attempts);
  return (
    <div>
      <h1>💻 Programování</h1>
      <Tabs items={TABS} active="/code/tasks" />
      {(['e', 'm', 'h'] as TaskLevel[]).map((l) => (
        <section key={l} className="panel">
          <h2 style={{ marginTop: 0, color: LEVEL_COLOR[l] }}>{LEVEL_LABEL[l]} ({LEVEL_XP[l]} XP)</h2>
          {PY_TASKS.filter((t) => t.level === l).map((t) => (
            <a key={t.id} href={`#/code/task/${t.id}`} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', color: 'inherit', textDecoration: 'none' }}>
              <span>{t.title}</span>
              <span>{solved.has(t.id) ? '✅' : '›'}</span>
            </a>
          ))}
        </section>
      ))}
    </div>
  );
}

const draftKey = (id: string) => `questy.code.${id}`;
const loadDraft = (t: PyTask) => {
  try {
    return localStorage.getItem(draftKey(t.id)) ?? t.starter;
  } catch {
    return t.starter;
  }
};

function Editor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  // kurzor nastavit hned po překreslení – ještě před dalším stiskem klávesy
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null) {
      el.selectionStart = el.selectionEnd = caret.current;
      caret.current = null;
    }
  }, [value]);
  const insert = (text: string, back = 0) => {
    const el = ref.current!;
    const { selectionStart: a, selectionEnd: b } = el;
    caret.current = a + text.length - back;
    el.focus();
    onChange(el.value.slice(0, a) + text + el.value.slice(b));
  };
  return (
    <div>
      <textarea
        ref={ref} className="code-editor" value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off"
        rows={Math.max(8, value.split('\n').length + 2)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            insert('    ');
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            insert(newlineIndent(value.slice(0, e.currentTarget.selectionStart)));
          }
        }}
      />
      <div className="row wrap code-keys" style={{ gap: 4, marginTop: 4 }}>
        {[['⇥', '    '], [':', ':'], ['( )', '()', 1], ['[ ]', '[]', 1], ['" "', '""', 1], ['=', ' = '], ['==', ' == '], ['#', '# ']].map(([l, t, back]) => (
          <button key={l as string} className="btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(t as string, (back as number) ?? 0)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function Results({ task, res }: { task: PyTask; res: RunResult }) {
  if (res.kind === 'timeout') return <p style={{ color: 'var(--red)' }}>⏱️ Časový limit – nemáš v kódu nekonečný cyklus?</p>;
  if (res.kind === 'failed') return <p style={{ color: 'var(--red)' }}>⚠️ {res.error}</p>;
  const stdout = res.stdout && (
    <div><div className="small muted">Výpis (print):</div><pre className="code-out">{res.stdout}</pre></div>
  );
  if (res.kind === 'error') {
    return (
      <div>
        <p style={{ color: 'var(--red)', marginBottom: 4 }}>❌ Chyba{res.line ? ` na řádku ${res.line}` : ''}:</p>
        <pre className="code-out">{res.error}</pre>
        {stdout}
      </div>
    );
  }
  const passed = res.results.filter((r) => r.ok).length;
  const hiddenFailed = res.results.slice(VISIBLE_TESTS).filter((r) => !r.ok).length;
  return (
    <div>
      <p style={{ color: passed === res.results.length ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
        {passed === res.results.length ? '✅ Všechny testy prošly!' : `Prošlo ${passed} z ${res.results.length} testů`}
      </p>
      {res.results.slice(0, VISIBLE_TESTS).map((r, i) => (
        <div key={i} className="small" style={{ marginBottom: 6 }}>
          {r.ok ? '✅' : '❌'} <code>{callRepr(task.fn, task.tests[i][0])}</code>
          {!r.ok && (
            <div style={{ paddingLeft: 22 }}>
              očekáváno <code>{pyRepr(task.tests[i][1])}</code>, {r.error ? <>chyba <code>{r.error}</code>{r.line ? ` (řádek ${r.line})` : ''}</> : <>vráceno <code>{r.got}</code></>}
            </div>
          )}
        </div>
      ))}
      {hiddenFailed > 0 && <p className="small muted">+ {hiddenFailed} skrytých testů neprošlo – zkus okrajové případy (prázdný vstup, 0, záporná čísla…).</p>}
      {stdout}
    </div>
  );
}

function CodeTask({ id }: { id: string }) {
  const task = taskById(id);
  const attempts = useAttempts();
  const [code, setCode] = useState(() => (task ? loadDraft(task) : ''));
  const [res, setRes] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState<'' | 'load' | 'run'>('');
  const [hint, setHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  useEffect(() => {
    try {
      if (task) localStorage.setItem(draftKey(task.id), code);
    } catch { /* nevadí */ }
  }, [task, code]);
  if (!task) return <Empty>Úloha nenalezena. <a href="#/code/tasks">Zpět na úlohy</a></Empty>;
  const mine = (attempts ?? []).filter((a) => a.taskId === task.id);
  const solved = mine.some((a) => a.passed);
  const fails = mine.filter((a) => !a.passed).length;
  const idx = PY_TASKS.indexOf(task);
  const next = PY_TASKS[idx + 1];

  const run = async () => {
    setBusy(pythonLoaded() ? 'run' : 'load');
    setRes(null);
    const r = await runTask(task, code);
    setRes(r);
    setBusy('');
    if (r.kind === 'failed') return;
    const passed = r.kind === 'done' && r.results.every((x) => x.ok);
    await store.col('codeAttempts').put({ id: uid(), ts: Date.now(), date: dateKey(), taskId: task.id, passed, code: passed ? code : undefined });
    if (passed && !solved) {
      await game.award({ amount: LEVEL_XP[task.level], stat: 'int', module: 'code', label: `Úloha: ${task.title}` });
      await game.progressQuest('code-daily');
      await game.progressQuest('code-weekly');
    }
  };

  return (
    <div>
      <h1>💻 {task.title} {solved && '✅'}</h1>
      <LevelBadge level={task.level} />
      <section className="panel" style={{ marginTop: 8 }}>
        <p style={{ marginTop: 0 }}>{task.text}</p>
        <div className="small muted">Příklady:</div>
        {task.tests.slice(0, VISIBLE_TESTS).map(([args, exp], i) => (
          <div key={i} className="small"><code>{callRepr(task.fn, args)}</code> → <code>{pyRepr(exp)}</code></div>
        ))}
      </section>
      <Editor value={code} onChange={setCode} />
      <div className="grid2" style={{ marginTop: 10 }}>
        <button className="primary" disabled={!!busy} onClick={run}>{busy === 'load' ? 'Načítám Python…' : busy === 'run' ? 'Běží…' : '▶ Spustit testy'}</button>
        <button onClick={() => setHint(!hint)}>💡 Nápověda</button>
      </div>
      {busy === 'load' && <p className="small muted">Poprvé se stahuje Python (asi 10 MB), chvilku to trvá.</p>}
      {hint && <p className="small panel" style={{ marginTop: 8 }}>💡 {task.hint}</p>}
      {res && <section className="panel" style={{ marginTop: 10 }}><Results task={task} res={res} /></section>}
      {solved && next && <a className="btn btn-gold btn-block" style={{ marginTop: 8 }} href={`#/code/task/${next.id}`}>Další úloha: {next.title} ›</a>}
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        {(solved || fails >= 3) && <button className="btn-sm" onClick={() => setShowSolution(!showSolution)}>📖 Vzorové řešení</button>}
        {!solved && fails < 3 && <span className="small muted">Vzorové řešení se odemkne po vyřešení nebo po 3 pokusech.</span>}
        <button className="btn-sm" onClick={() => confirm('Smazat tvůj kód a začít znovu?') && setCode(task.starter)}>↺ Začít znovu</button>
      </div>
      {showSolution && <pre className="code-out" style={{ marginTop: 8 }}>{task.solution}</pre>}
    </div>
  );
}

function pickQuestion(correct: Set<string>, skip?: string): CQuestion {
  const fresh = C_QUESTIONS.filter((q) => !correct.has(q.id) && q.id !== skip);
  const pool = fresh.length ? fresh : C_QUESTIONS.filter((q) => q.id !== skip);
  return pool[Math.floor(Math.random() * pool.length)];
}

function CQuiz() {
  const attempts = useAttempts();
  const correct = useMemo(() => new Set((attempts ?? []).filter((a) => a.passed && a.taskId.startsWith('c:')).map((a) => a.taskId)), [attempts]);
  const [q, setQ] = useState<CQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  useEffect(() => {
    if (attempts && !q) setQ(pickQuestion(correct));
  }, [attempts, q, correct]);
  if (!q) return null;
  const today = dateKey();

  const check = async () => {
    const ok = isCorrect(q, answer);
    setResult(ok);
    await store.col('codeAttempts').put({ id: uid(), ts: Date.now(), date: today, taskId: q.id, passed: ok });
    if (ok && !correct.has(q.id)) await game.award({ amount: C_XP, stat: 'int', module: 'code', label: `Kvíz C: ${q.topic}` });
    const n = (await store.col('codeAttempts').all()).filter((a) => a.date === today && a.passed && a.taskId.startsWith('c:')).length;
    if (n >= C_DAILY) await game.progressQuest('code-daily');
  };
  const next = () => {
    setQ(pickQuestion(correct, q.id));
    setAnswer('');
    setResult(null);
  };

  return (
    <div>
      <h1>💻 Programování</h1>
      <Tabs items={TABS} active="/code/c" />
      <p className="small muted">Zvládnuto {correct.size} / {C_QUESTIONS.length} · za novou správnou odpověď {C_XP} XP</p>
      <section className="panel">
        <div className="small muted">{q.topic} · Co program vypíše?</div>
        <pre className="code-out" style={{ marginTop: 8 }}>{wrapC(q)}</pre>
        <div className="field">
          <label>Výstup programu</label>
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={result !== null} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            style={{ fontFamily: 'ui-monospace, monospace' }} onKeyDown={(e) => e.key === 'Enter' && answer.trim() && result === null && check()} />
        </div>
        {result === null ? (
          <button className="primary btn-block" disabled={!answer.trim()} onClick={check}>Zkontrolovat</button>
        ) : (
          <>
            <p style={{ color: result ? 'var(--green)' : 'var(--red)', fontWeight: 600, marginBottom: 4 }}>{result ? '✅ Správně!' : '❌ Špatně'}</p>
            {!result && <p className="small" style={{ margin: '4px 0' }}>Správně: <code>{q.answer}</code></p>}
            <p className="small">{q.explain}</p>
            <button className="primary btn-block" onClick={next}>Další ›</button>
          </>
        )}
      </section>
    </div>
  );
}

export default function CodePages({ route }: { route: string }) {
  if (route.startsWith('/code/task/')) return <CodeTask key={route} id={decodeURIComponent(route.slice('/code/task/'.length))} />;
  if (route === '/code/tasks') return <CodeTasks />;
  if (route === '/code/c') return <CQuiz />;
  return <CodeHome />;
}
