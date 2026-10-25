import { useRef } from 'react';
import { MathText } from '../../components/MathText';
import type { Problem } from './generator';
import { ANSWER_HINT } from './parse';
import { TOPIC_SHORT } from './topics';

const KEYS = ['√', 'π', '/', '^', ';', 'i', '(', ')', '∞', '∪', '<', '>'];

export function AnswerInput({ value, onChange, onSubmit, kind, disabled }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; kind: Problem['answer']['kind']; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const insert = (k: string) => {
    const el = ref.current;
    if (!el) return onChange(value + k);
    const s = el.selectionStart ?? value.length, e = el.selectionEnd ?? value.length;
    const next = value.slice(0, s) + k + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + k.length, s + k.length);
    });
  };
  const keys = kind === 'interval' ? KEYS : kind === 'line' || kind === 'expr' ? ['x', 'y', '=', ...KEYS.slice(0, 4), '(', ')'] : KEYS.slice(0, 8);
  return (
    <div>
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        placeholder="Tvoje odpověď"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="text"
        aria-label="Odpověď"
      />
      {!disabled && (
        <div className="keypad">
          {keys.map((k) => (
            <button key={k} type="button" onClick={() => insert(k)} aria-label={`Vložit ${k}`}>{k}</button>
          ))}
        </div>
      )}
      <div className="small muted">{ANSWER_HINT[kind]}</div>
    </div>
  );
}

export function ProblemText({ problem, index }: { problem: Problem; index?: number }) {
  return (
    <div>
      <div className="row between small muted" style={{ marginBottom: 6 }}>
        <span>{index !== undefined ? `Úloha ${index + 1} · ` : ''}{TOPIC_SHORT[problem.topic]} · {problem.templateName}</span>
      </div>
      <div className="problem"><MathText text={problem.question} /></div>
    </div>
  );
}

export function Solution({ problem }: { problem: Problem }) {
  return (
    <div className="solution">
      <div className="small muted">Správně: <MathText text={`$${problem.answer.tex}$`} /></div>
      <ol>
        {problem.solution.map((s, i) => <li key={i}><MathText text={s} /></li>)}
      </ol>
    </div>
  );
}
