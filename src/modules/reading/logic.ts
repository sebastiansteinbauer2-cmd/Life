import type { ReadBook, ReadLogEntry } from '../../data/types';
import { addDays, dateKey } from '../../lib/date';

/** XP za přečtené stránky: 1 XP za 5 stránek (aspoň 1, nejvýš 60 za zápis). */
export function pagesXp(pages: number): number {
  if (pages <= 0) return 0;
  return Math.min(60, Math.max(1, Math.round(pages / 5)));
}

/** XP za dočtenou knihu: 100 + 1 XP za 10 stránek (nejvýš 200). */
export const bookDoneXp = (pages: number) => Math.min(200, 100 + Math.round(pages / 10));

export interface PageUpdate {
  book: ReadBook;
  delta: number; // nově přečtené stránky (0 při opravě dozadu)
  finished: boolean;
}

/** Posun v knize na stránku `page`. */
export function movePage(book: ReadBook, page: number, today: string = dateKey()): PageUpdate {
  const p = Math.max(0, Math.min(book.pages || page, Math.round(page)));
  const delta = Math.max(0, p - book.page);
  const finished = book.status !== 'done' && book.pages > 0 && p >= book.pages;
  return {
    delta,
    finished,
    book: {
      ...book,
      page: p,
      status: finished ? 'done' : book.status === 'want' && p > 0 ? 'reading' : book.status,
      startedAt: book.startedAt ?? (p > 0 ? today : undefined),
      finishedAt: finished ? today : book.finishedAt,
    },
  };
}

export const logId = (date: string, bookId: string) => `${date}|${bookId}`;

export function pagesOn(log: ReadLogEntry[], date: string): number {
  return log.filter((e) => e.date === date).reduce((n, e) => n + e.pages, 0);
}

/** Stránky po dnech za posledních `days` dní (od nejstaršího). */
export function pagesByDay(log: ReadLogEntry[], days: number, today: string = dateKey()): { date: string; pages: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, pages: pagesOn(log, date) };
  });
}

export interface YearGoal {
  done: number;
  goal: number;
  expected: number; // kolik knih by mělo být dočteno k dnešku
  ahead: number; // + napřed, − pozadu
}

export function yearGoal(books: ReadBook[], goal: number, today: string = dateKey()): YearGoal {
  const year = today.slice(0, 4);
  const done = books.filter((b) => b.status === 'done' && b.finishedAt?.startsWith(year)).length;
  const start = Date.parse(`${year}-01-01T00:00:00`);
  const end = Date.parse(`${Number(year) + 1}-01-01T00:00:00`);
  const frac = (Date.parse(`${today}T12:00:00`) - start) / (end - start);
  const expected = goal * frac;
  return { done, goal, expected, ahead: Math.round((done - expected) * 10) / 10 };
}

/** Citát dne – každý den jiný, stabilní během dne. */
export function quoteOfDay(books: ReadBook[], today: string = dateKey()): { text: string; page?: number; book: ReadBook } | null {
  const all = books.flatMap((b) => b.quotes.map((q) => ({ ...q, book: b })));
  if (!all.length) return null;
  let h = 0;
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return all[h % all.length];
}
