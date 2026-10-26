import { describe, expect, it } from 'vitest';
import type { ReadBook } from '../../data/types';
import { bookDoneXp, movePage, pagesByDay, pagesXp, quoteOfDay, yearGoal } from './logic';

const book = (o: Partial<ReadBook> = {}): ReadBook => ({ id: 'b', title: 'Duna', author: 'Herbert', pages: 600, page: 100, status: 'reading', quotes: [], createdAt: 0, ...o });

describe('čtení', () => {
  it('XP za stránky a knihu', () => {
    expect(pagesXp(0)).toBe(0);
    expect(pagesXp(2)).toBe(1);
    expect(pagesXp(20)).toBe(4);
    expect(pagesXp(1000)).toBe(60);
    expect(bookDoneXp(600)).toBe(160);
    expect(bookDoneXp(3000)).toBe(200);
  });

  it('posun v knize, dočtení a oprava dozadu', () => {
    expect(movePage(book(), 130)).toMatchObject({ delta: 30, finished: false, book: { page: 130, status: 'reading' } });
    const done = movePage(book(), 650, '2026-10-26');
    expect(done).toMatchObject({ delta: 500, finished: true, book: { page: 600, status: 'done', finishedAt: '2026-10-26' } });
    expect(movePage(done.book, 600).finished).toBe(false);
    expect(movePage(book(), 80)).toMatchObject({ delta: 0, book: { page: 80 } });
    expect(movePage(book({ status: 'want', page: 0, startedAt: undefined }), 5, '2026-10-01').book).toMatchObject({ status: 'reading', startedAt: '2026-10-01' });
  });

  it('stránky po dnech', () => {
    const log = [{ id: '1', date: '2026-10-25', bookId: 'b', pages: 20 }, { id: '2', date: '2026-10-26', bookId: 'c', pages: 5 }, { id: '3', date: '2026-10-26', bookId: 'b', pages: 7 }];
    expect(pagesByDay(log, 3, '2026-10-26')).toEqual([{ date: '2026-10-24', pages: 0 }, { date: '2026-10-25', pages: 20 }, { date: '2026-10-26', pages: 12 }]);
  });

  it('roční cíl', () => {
    const books = [book({ status: 'done', finishedAt: '2026-03-01' }), book({ status: 'done', finishedAt: '2025-12-01' }), book()];
    const g = yearGoal(books, 12, '2026-07-02');
    expect(g.done).toBe(1);
    expect(g.expected).toBeCloseTo(6, 0);
    expect(g.ahead).toBeLessThan(-4);
  });

  it('citát dne', () => {
    expect(quoteOfDay([book()])).toBeNull();
    const q = quoteOfDay([book({ quotes: [{ text: 'Strach zabíjí mysl.' }] })]);
    expect(q?.text).toBe('Strach zabíjí mysl.');
  });
});
