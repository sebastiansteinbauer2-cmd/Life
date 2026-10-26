// Mapa světa: velké životní cíle jako hrady na cestě. Každý má postup 0..1.
import type { Activity, FinanceSnapshot, Profile, ReadBook } from '../data/types';
import { formatMoney, requiredCapital } from '../modules/finance/logic';
import { readiness } from '../modules/ironman/sports';
import { yearGoal } from '../modules/reading/logic';
import { levelFromXp } from './xp';

export interface Castle {
  id: string;
  icon: string;
  title: string;
  progress: number; // 0..1
  detail: string;
  route: string;
}

export interface MapData {
  profile: Profile;
  bossBest: number;
  acts: Activity[];
  snapshot?: FinanceSnapshot;
  books: ReadBook[];
  codeSolved: number;
  codeTotal: number;
  budgetMonths: number;
  fortCamps?: number; // dobyté výpravy v Pevnosti (z 12)
  today: string;
}

const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function buildCastles(d: MapData): Castle[] {
  const p = d.profile;
  const castles: Castle[] = [];
  const exam = p.examDate ? Math.ceil((Date.parse(`${p.examDate}T00:00:00`) - Date.parse(`${d.today}T00:00:00`)) / 86_400_000) : null;
  castles.push({
    id: 'exam', icon: '🎓', title: 'Přijímačky na ČVUT', route: '/math/boss',
    progress: clamp(d.bossBest / 70),
    detail: `Nejlepší simulace ${d.bossBest}/100 bodů (potřeba 70)${exam !== null && exam >= 0 ? ` · zbývá ${exam} dní` : ''}`,
  });
  const r = readiness(d.acts, p.ironmanRace);
  castles.push({
    id: 'ironman', icon: '🏊', title: p.ironmanRace === 'half' ? 'Ironman 70.3' : 'Ironman', route: '/ironman',
    progress: clamp(r.total),
    detail: r.parts.map((x) => `${x.label} ${Math.round(x.pct * 100)} %`).join(' · '),
  });
  for (const t of p.financeTargets) {
    const need = requiredCapital(t, p.financeWithdrawal);
    const total = d.snapshot?.total ?? 0;
    const cur = d.snapshot?.currency ?? 'CZK';
    castles.push({
      id: `fin-${t.id}`, icon: t.icon, title: t.title, route: '/finance',
      progress: clamp(total / need),
      detail: d.snapshot ? `${formatMoney(total, cur)} z ${formatMoney(need, cur)}` : 'Propoj Trading 212 v sekci Finance',
    });
  }
  const g = yearGoal(d.books, p.readingGoal, d.today);
  castles.push({
    id: 'reading', icon: '📚', title: `${p.readingGoal} knih za rok`, route: '/reading',
    progress: clamp(g.done / Math.max(1, g.goal)), detail: `Letos dočteno ${g.done} z ${g.goal}`,
  });
  castles.push({
    id: 'code', icon: '💻', title: 'Programátor', route: '/code',
    progress: clamp(d.codeSolved / Math.max(1, d.codeTotal)), detail: `Vyřešeno ${d.codeSolved} z ${d.codeTotal} úloh`,
  });
  castles.push({
    id: 'budget', icon: '🏦', title: 'Pán peněz', route: '/budget',
    progress: clamp(d.budgetMonths / 6), detail: `${d.budgetMonths} z 6 měsíců v rozpočtu`,
  });
  castles.push({
    id: 'fort', icon: '🐉', title: 'Drakobijec', route: '/fort/campaign',
    progress: clamp((d.fortCamps ?? 0) / 12), detail: `Dobyto ${d.fortCamps ?? 0} z 12 výprav v Pevnosti`,
  });
  const lvl = levelFromXp(p.xp).level;
  castles.push({
    id: 'legend', icon: '👑', title: 'Legenda', route: '/achievements',
    progress: clamp((lvl - 1) / 29), detail: `Level ${lvl} z 30`,
  });
  // nejbližší cíle (nejvíc hotové) jsou na začátku cesty, Legenda vždy na konci
  const legend = castles.pop()!;
  return [...castles.sort((a, b) => b.progress - a.progress), legend];
}

/** Kde stojí hrdina: u prvního nedobytého hradu (index), nebo na konci. */
export const heroIndex = (castles: Castle[]) => {
  const i = castles.findIndex((c) => c.progress < 1);
  return i === -1 ? castles.length - 1 : i;
};
