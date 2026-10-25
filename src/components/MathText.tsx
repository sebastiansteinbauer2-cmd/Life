import katex from 'katex';
import 'katex/dist/katex.min.css';
import { memo } from 'react';

/** Rozdělí text na části mimo/uvnitř $…$ (inline) a $$…$$ (display). */
export function splitMath(text: string): { math: boolean; display: boolean; s: string }[] {
  const out: { math: boolean; display: boolean; s: string }[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ math: false, display: false, s: text.slice(last, m.index) });
    out.push({ math: true, display: m[1] !== undefined, s: m[1] ?? m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ math: false, display: false, s: text.slice(last) });
  return out;
}

const render = (tex: string, display: boolean) =>
  katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' });

/** Text s matematikou vykreslenou přes KaTeX. */
export const MathText = memo(function MathText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {splitMath(text).map((p, i) =>
        p.math ? <span key={i} dangerouslySetInnerHTML={{ __html: render(p.s, p.display) }} /> : <span key={i}>{p.s}</span>,
      )}
    </span>
  );
});
