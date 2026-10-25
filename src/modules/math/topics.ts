import type { MathLevel } from '../../data/types';

export const LEVEL_LABEL: Record<MathLevel, string> = {
  zaklad: 'Maturita – základ',
  rozsireny: 'Maturita – rozšiřující',
  fit: 'Přijímačky FIT ČVUT',
};

export const TOPICS = [
  { id: 'vyrazy', name: 'Výrazy, mocniny, odmocniny', short: 'Výrazy' },
  { id: 'rovnice', name: 'Rovnice a nerovnice', short: 'Rovnice' },
  { id: 'funkce', name: 'Funkce', short: 'Funkce' },
  { id: 'explog', name: 'Exponenciály a logaritmy', short: 'Exp/log' },
  { id: 'gonio', name: 'Goniometrie', short: 'Goniometrie' },
  { id: 'posloupnosti', name: 'Posloupnosti a řady', short: 'Posloupnosti' },
  { id: 'analyticka', name: 'Analytická geometrie', short: 'Analytická' },
  { id: 'geometrie', name: 'Planimetrie a stereometrie', short: 'Geometrie' },
  { id: 'kombinatorika', name: 'Kombinatorika, pravděpodobnost, statistika', short: 'Kombinatorika' },
  { id: 'komplexni', name: 'Komplexní čísla', short: 'Komplexní' },
] as const;

export type TopicId = (typeof TOPICS)[number]['id'];
export const TOPIC_NAME = Object.fromEntries(TOPICS.map((t) => [t.id, t.name])) as Record<TopicId, string>;
export const TOPIC_SHORT = Object.fromEntries(TOPICS.map((t) => [t.id, t.short])) as Record<TopicId, string>;
