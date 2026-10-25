import type { Book, Resource } from '../data/types';
import { BUILTIN_EXERCISES, DEFAULT_MAX } from '../modules/training/plan';
import { store } from './context';

export const BUILTIN_BOOKS: Omit<Book, 'done'>[] = [
  { id: 'woodpecker', title: 'The Woodpecker Method', author: 'Smith & Tikkanen', chapters: 4, builtIn: true },
  { id: 'calculation', title: 'Calculation', author: 'Jacob Aagaard', chapters: 6, builtIn: true },
  { id: '100-endgames', title: '100 Endgames You Must Know', author: 'Jesús de la Villa', chapters: 10, builtIn: true },
  { id: 'mcs', title: 'Mastering Chess Strategy', author: 'Johan Hellsten', chapters: 10, builtIn: true },
  { id: 'dem', title: "Dvoretsky's Endgame Manual", author: 'Mark Dvoretsky', chapters: 15, builtIn: true },
];

export const BUILTIN_RESOURCES: Resource[] = [
  { id: 'toulky', title: 'Toulky českou minulostí', url: 'https://www.mujrozhlas.cz/toulky-ceskou-minulosti', category: 'historie', description: 'Český rozhlas – příběhy české historie', builtIn: true },
  { id: 'kings-generals', title: 'Kings and Generals', url: 'https://www.youtube.com/@KingsandGenerals', category: 'historie', description: 'Animované dokumenty o bitvách a říších', builtIn: true },
  { id: 'crashcourse', title: 'Crash Course World History', url: 'https://www.youtube.com/@crashcourse', category: 'historie', description: 'Svižný přehled světových dějin', builtIn: true },
  { id: 'kurzgesagt', title: 'Kurzgesagt', url: 'https://www.youtube.com/@kurzgesagt', category: 'věda', description: 'Věda v krásných animacích', builtIn: true },
  { id: 'veritasium', title: 'Veritasium', url: 'https://www.youtube.com/@veritasium', category: 'věda', description: 'Fyzika a překvapivé experimenty', builtIn: true },
  { id: '3b1b', title: '3Blue1Brown', url: 'https://www.youtube.com/@3blue1brown', category: 'věda', description: 'Matematika vizuálně – skvělé k přípravě na FIT', builtIn: true },
  { id: 'wbw', title: 'Wait But Why', url: 'https://waitbutwhy.com', category: 'přemýšlení', description: 'Dlouhé eseje o velkých otázkách', builtIn: true },
  { id: 'owid', title: 'Our World in Data', url: 'https://ourworldindata.org', category: 'svět v datech', description: 'Data o tom, jak se svět mění', builtIn: true },
];

export const WIKI_RANDOM = 'https://cs.wikipedia.org/wiki/Speci%C3%A1ln%C3%AD:N%C3%A1hodn%C3%A1_str%C3%A1nka';

/** Doplní vestavěné cviky, knihy a zdroje (idempotentní). */
export async function ensureSeed() {
  const ex = new Set((await store.col('exercises').all()).map((e) => e.id));
  const missingEx = BUILTIN_EXERCISES.filter((e) => !ex.has(e.id)).map((e) => ({ ...e, max: DEFAULT_MAX[e.id] ?? 10, xp: 0 }));
  if (missingEx.length) await store.col('exercises').bulkPut(missingEx);

  const books = new Set((await store.col('books').all()).map((b) => b.id));
  const missingBooks = BUILTIN_BOOKS.filter((b) => !books.has(b.id)).map((b) => ({ ...b, done: 0 }));
  if (missingBooks.length) await store.col('books').bulkPut(missingBooks);

  const res = new Set((await store.col('resources').all()).map((r) => r.id));
  const missingRes = BUILTIN_RESOURCES.filter((r) => !res.has(r.id));
  if (missingRes.length) await store.col('resources').bulkPut(missingRes);
}
