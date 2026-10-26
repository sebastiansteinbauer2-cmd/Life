// Import historie z exportu Stravy (Nastavení → Můj účet → Stáhnout nebo smazat účet → Vyžádat archiv).
// Bere celý ZIP (rozbalí z něj jen activities.csv, zbytek přeskočí) nebo samotný activities.csv.

import { Unzip, UnzipInflate } from 'fflate';
import type { Activity } from '../../data/types';
import { dateKey } from '../../lib/date';

/** CSV parser s uvozovkami (pole mohou obsahovat čárky i nové řádky). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

/** Číslo z exportu: „10.02“, „1,500“ (tisíce), „10,5“ (desetinná čárka). */
export function parseNum(raw: string | undefined): number {
  const s = (raw ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
  if (/^-?\d+,\d+$/.test(s)) return Number(s.replace(',', '.'));
  return NaN;
}

const MONTHS_CZ = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Datum aktivity (v exportu je v UTC): „Oct 20, 2026, 7:15:32 AM“ nebo „20. 10. 2026 7:15:32“. */
export function parseStravaDate(raw: string): number {
  const s = raw.trim();
  const cz = MONTHS_CZ.exec(s);
  if (cz) {
    const [, d, m, y, hh, mm, ss] = cz;
    return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? 0));
  }
  const iso = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) ? Date.parse(s.replace(' ', 'T') + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? '' : 'Z')) : NaN;
  if (!Number.isNaN(iso)) return iso;
  const en = Date.parse(`${s.replace(/,(\s*\d{1,2}:)/, '$1')} UTC`);
  return en;
}

const TYPE_MAP: Record<string, string> = {
  run: 'Run', běh: 'Run', trailrun: 'TrailRun', 'trailový běh': 'TrailRun', virtualrun: 'VirtualRun', 'virtuální běh': 'VirtualRun',
  ride: 'Ride', 'jízda na kole': 'Ride', cyklistika: 'Ride', kolo: 'Ride', virtualride: 'VirtualRide', 'virtuální jízda': 'VirtualRide',
  gravelride: 'GravelRide', mountainbikeride: 'MountainBikeRide', 'e-bikeride': 'EBikeRide', ebikeride: 'EBikeRide',
  swim: 'Swim', plavání: 'Swim', walk: 'Walk', chůze: 'Walk', hike: 'Hike', turistika: 'Hike',
  weighttraining: 'WeightTraining', posilování: 'WeightTraining', 'silový trénink': 'WeightTraining', workout: 'Workout', trénink: 'Workout',
  yoga: 'Yoga', jóga: 'Yoga',
};

export function normalizeType(raw: string): string {
  const t = raw.trim().toLowerCase();
  return TYPE_MAP[t] ?? TYPE_MAP[t.replace(/\s+/g, '')] ?? raw.replace(/\s+/g, '');
}

const ALIASES = {
  id: ['activity id', 'id aktivity'],
  date: ['activity date', 'datum aktivity'],
  name: ['activity name', 'název aktivity'],
  type: ['activity type', 'typ aktivity'],
  elapsed: ['elapsed time', 'uplynulý čas'],
  moving: ['moving time', 'čas v pohybu', 'čas pohybu'],
  distance: ['distance', 'vzdálenost'],
  elevation: ['elevation gain', 'převýšení', 'nastoupané metry'],
  hr: ['average heart rate', 'průměrná tepová frekvence'],
};

/** Převede activities.csv na aktivity. Neznámé řádky přeskočí. */
export function activitiesFromCsv(text: string): { activities: Activity[]; skipped: number } {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Soubor neobsahuje žádné aktivity.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const all = (key: keyof typeof ALIASES) => head.flatMap((h, i) => (ALIASES[key].includes(h) ? [i] : []));
  const first = (key: keyof typeof ALIASES, fallback: number) => all(key)[0] ?? fallback;
  const col = {
    id: first('id', 0), date: first('date', 1), name: first('name', 2), type: first('type', 3), elapsed: first('elapsed', 5),
    // „Distance“ je v exportu dvakrát: poprvé v km, podruhé v metrech
    distKm: all('distance')[0] ?? 6, distM: all('distance')[1], moving: all('moving')[0], elevation: all('elevation')[0], hr: all('hr')[0],
  };
  if (!/^\d+$/.test((rows[1][col.id] ?? '').trim())) throw new Error('Tohle nevypadá jako activities.csv ze Stravy.');

  const activities: Activity[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const id = (r[col.id] ?? '').trim();
    const ts = parseStravaDate(r[col.date] ?? '');
    if (!/^\d+$/.test(id) || Number.isNaN(ts)) { skipped++; continue; }
    const sport = normalizeType(r[col.type] ?? '');
    let distance = col.distM !== undefined ? parseNum(r[col.distM]) : NaN;
    if (Number.isNaN(distance)) {
      const d = parseNum(r[col.distKm]);
      // plavání bývá v prvním sloupci v metrech, ostatní v km
      distance = Number.isNaN(d) ? 0 : sport === 'Swim' && d >= 50 ? d : d * 1000;
    }
    const moving = col.moving !== undefined ? parseNum(r[col.moving]) : NaN;
    const elapsed = parseNum(r[col.elapsed]);
    const hr = col.hr !== undefined ? parseNum(r[col.hr]) : NaN;
    activities.push({
      id, ts, date: dateKey(new Date(ts)), sport, name: (r[col.name] ?? '').trim() || sport,
      distance: Math.max(0, distance), movingTime: Math.round(Number.isNaN(moving) || moving <= 0 ? (Number.isNaN(elapsed) ? 0 : elapsed) : moving),
      elevation: col.elevation !== undefined ? Math.max(0, parseNum(r[col.elevation]) || 0) : 0,
      avgHr: Number.isNaN(hr) || hr <= 0 ? undefined : Math.round(hr),
    });
  }
  return { activities, skipped };
}

/** Z vybraného souboru (ZIP nebo CSV) vrátí text activities.csv. ZIP čte po kouscích – nerozbaluje GPS soubory. */
export async function readActivitiesCsv(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (!isZip) return file.text();

  return new Promise<string>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let found = false;
    let done = false;
    const unzip = new Unzip((entry) => {
      if (!/(^|\/)activities\.csv$/i.test(entry.name)) return;
      found = true;
      entry.ondata = (err, data, final) => {
        if (err) return reject(err);
        chunks.push(data);
        if (final) {
          done = true;
          const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
          let o = 0;
          for (const c of chunks) { out.set(c, o); o += c.length; }
          resolve(new TextDecoder().decode(out));
        }
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
    const reader = file.stream().getReader();
    const pump = async () => {
      try {
        for (;;) {
          const { value, done: end } = await reader.read();
          if (end) { unzip.push(new Uint8Array(0), true); break; }
          unzip.push(value);
          if (done) { await reader.cancel(); return; }
        }
        if (!found) reject(new Error('V archivu není soubor activities.csv. Vyber ZIP, který ti poslala Strava.'));
      } catch (e) {
        reject(e);
      }
    };
    pump();
  });
}
