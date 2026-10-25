import type { MathAttempt, MathLevel, TopicSrs } from '../../data/types';
import { addDays, daysBetween } from '../../lib/date';
import { Rng, type Template } from './core';
import { ALGEBRA } from './gen/algebra';
import { ANALYSIS } from './gen/analysis';
import { GEOMETRY } from './gen/geometry';
import type { Answer } from './parse';
import { TOPICS, type TopicId } from './topics';

export const TEMPLATES: Template[] = [...ALGEBRA, ...ANALYSIS, ...GEOMETRY];

export interface Problem {
  uid: string;
  topic: TopicId;
  template: string;
  templateName: string;
  level: MathLevel;
  question: string;
  answer: Answer;
  solution: string[];
}

export const templatesFor = (topic: string, level: MathLevel) =>
  TEMPLATES.filter((t) => t.topic === topic && t.levels.includes(level));

export const topicsFor = (level: MathLevel) => TOPICS.filter((t) => templatesFor(t.id, level).length > 0).map((t) => t.id);

export function generateProblem(topic: TopicId, level: MathLevel, rng: Rng = new Rng(), template?: Template): Problem {
  const pool = templatesFor(topic, level);
  const tpl = template ?? rng.pick(pool.length ? pool : TEMPLATES.filter((t) => t.topic === topic));
  const g = tpl.generate(rng, level);
  return {
    uid: Math.floor(rng.next() * 1e9).toString(36),
    topic,
    template: tpl.id,
    templateName: tpl.name,
    level,
    question: g.question,
    answer: g.answer,
    solution: g.solution,
  };
}

// ───── Opakování s rozestupy (Leitnerův systém po tématech) ─────

const INTERVALS = [0, 1, 2, 4, 8, 16];

export function updateSrs(prev: TopicSrs | undefined, topic: string, correct: boolean, today: string): TopicSrs {
  const box = correct ? Math.min(INTERVALS.length - 1, (prev?.box ?? 0) + 1) : 0;
  return { id: topic, box, due: addDays(today, INTERVALS[box]) };
}

export interface TopicStat { topic: TopicId; attempts: number; correct: number; accuracy: number; recentAccuracy: number }

export function topicStats(attempts: MathAttempt[]): Record<string, TopicStat> {
  const out: Record<string, TopicStat> = {};
  for (const t of TOPICS) {
    const list = attempts.filter((a) => a.topic === t.id).sort((a, b) => a.ts - b.ts);
    const recent = list.slice(-20);
    const correct = list.filter((a) => a.correct).length;
    out[t.id] = {
      topic: t.id,
      attempts: list.length,
      correct,
      accuracy: list.length ? correct / list.length : 0,
      recentAccuracy: recent.length ? recent.filter((a) => a.correct).length / recent.length : 0.5,
    };
  }
  return out;
}

/** Váha tématu: chyby a „splatné“ opakování zvyšují šanci, že téma přijde na řadu. */
export function topicWeights(level: MathLevel, attempts: MathAttempt[], srs: TopicSrs[], today: string): Record<string, number> {
  const stats = topicStats(attempts);
  const byId = new Map(srs.map((s) => [s.id, s]));
  const w: Record<string, number> = {};
  for (const t of topicsFor(level)) {
    const st = stats[t];
    const s = byId.get(t);
    const due = s ? daysBetween(s.due, today) >= 0 : true;
    w[t] = 1 + 3 * (1 - st.recentAccuracy) + (due ? 2 : 0) + (st.attempts === 0 ? 1.5 : 0);
  }
  return w;
}

export function pickTopic(weights: Record<string, number>, rng: Rng = new Rng(), avoid?: string): TopicId {
  const entries = Object.entries(weights).filter(([t]) => t !== avoid || Object.keys(weights).length === 1);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let x = rng.next() * total;
  for (const [t, v] of entries) {
    x -= v;
    if (x <= 0) return t as TopicId;
  }
  return entries[entries.length - 1][0] as TopicId;
}

// ───── Boss fight: simulace přijímacího testu ─────

export const BOSS_QUESTIONS = 20;
export const BOSS_MINUTES = 60;
export const BOSS_PASS = 70;

/** Test s rovnoměrným pokrytím témat (každé téma alespoň jednou). */
export function buildBossTest(level: MathLevel, rng: Rng = new Rng()): Problem[] {
  const topics = topicsFor(level);
  const order: TopicId[] = [];
  while (order.length < BOSS_QUESTIONS) order.push(...rng.shuffle(topics));
  return order.slice(0, BOSS_QUESTIONS).map((t) => generateProblem(t, level, rng));
}

export const bossScore = (correct: number, total: number) => Math.round((100 * correct) / total);
