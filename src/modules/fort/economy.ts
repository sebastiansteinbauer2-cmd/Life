// Ekonomika pevnosti: suroviny z XP, stavění s časovačem, výcvik, kořist a nájezdy.
import type { FortLog, FortState, StatId, XpEntry } from '../../data/types';
import { addDays } from '../../lib/date';
import type { ArmyUnit, Battle } from './battle';
import { fallen, stars } from './battle';
import {
  BUILDINGS, FIRST_CLEAR_CRYSTALS, REPLAY_LOOT, RES_FROM, UNITS, armyCap, buildMinutes, buildingDef, defenseFrom, heroStats,
  storageSafe, unitDef, type BuildingId, type Camp, type Res, type UnitId,
} from './data';

export type { FortLog, FortState };

const RES_KEYS = ['wood', 'stone', 'crystal'] as const;
export const ZERO: Res = { wood: 0, stone: 0, crystal: 0 };
const map = (f: (k: keyof Res) => number): Res => ({ wood: f('wood'), stone: f('stone'), crystal: f('crystal') });
export const add = (a: Res, b: Res, k = 1): Res => map((r) => a[r] + b[r] * k);
export const scale = (a: Res, k: number): Res => map((r) => Math.round(a[r] * k));

/** Nová pevnost. Dosavadní XP se nepočítá – suroviny přibývají za XP od založení (plus startovní bonus). */
export function newFort(now: number, today: string, got: Res = ZERO): FortState {
  return {
    id: 'me', createdAt: now, createdDate: today,
    delta: { wood: 150, stone: 150, crystal: 10 },
    buildings: Object.fromEntries(BUILDINGS.map((b) => [b.id, 1])) as Record<BuildingId, number>,
    upgrade: null,
    army: { warrior: 4, archer: 0, mage: 0, knight: 0 },
    camps: {},
    raidChecked: today,
    collected: { ...got },
    collectedAt: now,
  };
}

/**
 * Doplní pole z novějších verzí (nové budovy, sbírání surovin).
 * Starší pevnosti měly suroviny z XP započtené rovnou – převedou se do zůstatku, aby se nic neztratilo.
 */
export function normalizeFort(s: FortState, got: Res, now: number): FortState {
  const buildings = { ...Object.fromEntries(BUILDINGS.map((b) => [b.id, 1])), ...s.buildings } as Record<BuildingId, number>;
  if (s.collected) return { ...s, buildings };
  return { ...s, buildings, delta: add(s.delta, got), collected: { ...got }, collectedAt: now };
}

/** Suroviny získané z XP (1 XP = 1 surovina podle statistiky). */
export function earned(log: Pick<XpEntry, 'amount' | 'stat'>[]): Res {
  const byStat = new Map<StatId, number>();
  for (const e of log) byStat.set(e.stat, (byStat.get(e.stat) ?? 0) + e.amount);
  return map((r) => Math.max(0, RES_FROM[r].reduce((n, s) => n + (byStat.get(s) ?? 0), 0)));
}

/** Zůstatek surovin ve skladu. */
export const balance = (s: FortState): Res => map((r) => Math.max(0, Math.floor(s.delta[r])));

const COLLECTOR: Record<keyof Res, BuildingId> = { wood: 'sawmill', stone: 'quarry', crystal: 'mine' };
export const collectorOf = (r: keyof Res) => COLLECTOR[r];
/** Násobek sběru podle levelu Pily / Kamenolomu / Dolu. */
export const collectMult = (s: FortState, r: keyof Res) => 1 + ((s.buildings[COLLECTOR[r]] ?? 1) - 1) * 0.1;

/** Suroviny z XP, které čekají na sebrání (už s bonusem sběrné budovy). */
export function pending(s: FortState, got: Res): Res {
  const c = s.collected ?? got;
  return map((r) => Math.floor(Math.max(0, got[r] - c[r]) * collectMult(s, r)));
}

/** Sebere čekající suroviny jednoho druhu (nebo všech). */
export function collect(s: FortState, got: Res, now: number, only?: keyof Res): FortState {
  const p = pending(s, got);
  const c = { ...(s.collected ?? got) };
  const delta = { ...s.delta };
  for (const r of RES_KEYS) {
    if (only && r !== only) continue;
    delta[r] += p[r];
    c[r] = Math.max(c[r], got[r]);
  }
  return { ...s, delta, collected: c, collectedAt: now };
}

// ---------- denní truhla ----------

/** Odměna z denní truhly – stejná pro daný den na všech zařízeních. */
export function chestReward(hall: number, date: string): Res {
  const r = (salt: string) => dayRoll(date + salt);
  return {
    wood: Math.round((40 + r('w') * 80) * (1 + (hall - 1) * 0.5)),
    stone: Math.round((40 + r('s') * 80) * (1 + (hall - 1) * 0.5)),
    crystal: Math.round(2 + r('c') * 6 + (hall - 1)),
  };
}
/** Truhlu jde otevřít jednou denně – ale jen když už má hráč ten den nějaké XP. */
export const canOpenChest = (s: FortState, today: string, activeToday: boolean) => activeToday && s.chestDay !== today;
export function openChest(s: FortState, today: string): { state: FortState; reward: Res } {
  const reward = chestReward(s.buildings.hall, today);
  return { state: { ...s, chestDay: today, delta: add(s.delta, reward) }, reward };
}

// ---------- posílení ze skutečného života ----------

export interface LifeBuff { id: string; icon: string; title: string; text: string; atk?: number; hp?: number; kinds?: string[] }
export interface LifeToday { trained: boolean; mind: boolean; discipline: boolean; streak: number }

/** Co jsi dnes udělal ve skutečnosti → posílení armády v bitvě. */
export function lifeBuffs(t: LifeToday): LifeBuff[] {
  const out: LifeBuff[] = [];
  if (t.trained) out.push({ id: 'trained', icon: '💪', title: 'Po tréninku', text: 'Dnes jsi trénoval – celá armáda +15 % útok', atk: 0.15 });
  if (t.mind) out.push({ id: 'mind', icon: '🧠', title: 'Bystrá mysl', text: 'Dnes ses učil – mágové a lučištníci +25 % útok', atk: 0.25, kinds: ['mage', 'archer'] });
  if (t.discipline) out.push({ id: 'dis', icon: '🛡️', title: 'Disciplína', text: 'Dnešní disciplína – celá armáda +10 % životy', hp: 0.1 });
  if (t.streak >= 30) out.push({ id: 'streak', icon: '☄️', title: `Série ${t.streak} dní`, text: 'Hrdina +50 % životy a útok', hp: 0.5, atk: 0.5, kinds: ['hero'] });
  else if (t.streak >= 7) out.push({ id: 'streak', icon: '🔥', title: `Série ${t.streak} dní`, text: 'Hrdina +25 % životy a útok', hp: 0.25, atk: 0.25, kinds: ['hero'] });
  return out;
}
export const canAfford = (bal: Res, cost: Res) => RES_KEYS.every((r) => bal[r] >= cost[r]);

export function maxLevel(s: FortState, id: BuildingId): number {
  const def = buildingDef(id);
  return id === 'hall' ? def.maxLevel : Math.min(def.maxLevel, s.buildings.hall + 1);
}

/** Dokončí stavbu, pokud už uplynul čas. */
export function finishUpgrade(s: FortState, now: number): FortState {
  if (!s.upgrade || now < s.upgrade.endsAt) return s;
  return { ...s, buildings: { ...s.buildings, [s.upgrade.id]: s.upgrade.to }, upgrade: null };
}

export type Check = { ok: true } | { ok: false; reason: string };

export function canUpgrade(s: FortState, id: BuildingId, bal: Res): Check {
  const lvl = s.buildings[id];
  if (s.upgrade) return { ok: false, reason: 'Stavitel právě staví jinou budovu.' };
  if (lvl >= buildingDef(id).maxLevel) return { ok: false, reason: 'Maximální level.' };
  if (lvl >= maxLevel(s, id)) return { ok: false, reason: `Nejdřív vylepši Radnici na level ${lvl}.` };
  if (!canAfford(bal, buildingDef(id).cost(lvl + 1))) return { ok: false, reason: 'Nemáš dost surovin.' };
  return { ok: true };
}

export function startUpgrade(s: FortState, id: BuildingId, bal: Res, now: number): FortState {
  if (!canUpgrade(s, id, bal).ok) return s;
  const to = s.buildings[id] + 1;
  return { ...s, delta: add(s.delta, buildingDef(id).cost(to), -1), upgrade: { id, to, endsAt: now + buildMinutes(to) * 60_000 } };
}

/** Urychlení stavby za krystaly: 1 💎 za každých započatých 15 minut. */
export const speedUpCost = (s: FortState, now: number) => (s.upgrade ? Math.max(1, Math.ceil((s.upgrade.endsAt - now) / 900_000)) : 0);

export function speedUp(s: FortState, bal: Res, now: number): FortState {
  const cost = speedUpCost(s, now);
  if (!s.upgrade || bal.crystal < cost) return s;
  return finishUpgrade({ ...s, delta: { ...s.delta, crystal: s.delta.crystal - cost }, upgrade: { ...s.upgrade, endsAt: now } }, now);
}

// ---------- armáda ----------

export const armySize = (s: FortState) => Object.values(s.army).reduce((n, v) => n + v, 0);

export function canTrain(s: FortState, id: UnitId, bal: Res, statLevels: Record<StatId, number>): Check {
  const u = unitDef(id);
  if (s.buildings.barracks < u.barracks) return { ok: false, reason: `Potřebuješ Kasárna level ${u.barracks}.` };
  if (u.stat && (statLevels[u.stat.id] ?? 1) < u.stat.level) return { ok: false, reason: `Potřebuješ ${STAT_NAME[u.stat.id]} level ${u.stat.level} (ze skutečného života).` };
  if (armySize(s) >= armyCap(s.buildings.barracks)) return { ok: false, reason: 'Armáda je plná – vylepši Kasárna.' };
  if (!canAfford(bal, u.cost)) return { ok: false, reason: 'Nemáš dost surovin.' };
  return { ok: true };
}
const STAT_NAME: Record<StatId, string> = { int: 'Inteligenci', str: 'Sílu', dis: 'Disciplínu', chess: 'Šachy', end: 'Vytrvalost' };

export function train(s: FortState, id: UnitId, bal: Res, statLevels: Record<StatId, number>): FortState {
  if (!canTrain(s, id, bal, statLevels).ok) return s;
  return { ...s, delta: add(s.delta, unitDef(id).cost, -1), army: { ...s.army, [id]: s.army[id] + 1 } };
}

export const modifiers = (s: FortState) => ({ atk: 1 + (s.buildings.forge - 1) * 0.08, hp: 1 + (s.buildings.academy - 1) * 0.08 });

/** Armáda do bitvy – hrdina a všichni vycvičení vojáci (s bonusy z Kovárny a Akademie). */
export function battleArmy(s: FortState, heroLevel: number, buffs: LifeBuff[] = [], heroIcon = '🦸'): ArmyUnit[] {
  const m = modifiers(s);
  const boost = (kind: string, st: { hp: number; atk: number; move: number; range: number }) => {
    const mine = buffs.filter((b) => !b.kinds || b.kinds.includes(kind));
    const atk = mine.reduce((k, b) => k + (b.atk ?? 0), 0);
    const hp = mine.reduce((k, b) => k + (b.hp ?? 0), 0);
    return { ...st, hp: Math.round(st.hp * m.hp * (1 + hp)), atk: Math.round(st.atk * m.atk * (1 + atk)) };
  };
  const list: ArmyUnit[] = [{ kind: 'hero', name: 'Hrdina', icon: heroIcon, stats: boost('hero', heroStats(heroLevel)) }];
  for (const u of UNITS) for (let i = 0; i < s.army[u.id]; i++) list.push({ kind: u.id, name: u.name, icon: u.icon, stats: boost(u.id, u) });
  return list;
}

/** Výsledek výpravy: padlí vojáci zmizí, za výhru kořist (napoprvé plná + krystaly navíc). */
export function applyBattle(s: FortState, camp: Camp, b: Battle): { state: FortState; loot: Res; first: boolean; stars: number } {
  const army = { ...s.army };
  for (const k of fallen(b)) army[k as UnitId] = Math.max(0, army[k as UnitId] - 1);
  const st = stars(b);
  const first = st > 0 && !s.camps[camp.id];
  const loot = st === 0 ? ZERO : first ? { ...camp.loot, crystal: camp.loot.crystal + FIRST_CLEAR_CRYSTALS } : scale(camp.loot, REPLAY_LOOT);
  return {
    state: { ...s, army, delta: add(s.delta, loot), camps: st > 0 ? { ...s.camps, [camp.id]: Math.max(st, s.camps[camp.id] ?? 0) } : s.camps },
    loot, first, stars: st,
  };
}

/** Další výprava, kterou lze podniknout (první nedobytá). */
export const unlockedCamp = (s: FortState) => Object.keys(s.camps).filter((k) => s.camps[k] > 0).length + 1;

// ---------- nájezdy ----------

export const defense = (s: FortState) => defenseFrom('walls', s.buildings.walls) + defenseFrom('tower', s.buildings.tower) + armySize(s) * 2;
export const raidStrength = (hall: number, streak: number) => 20 + hall * 10 + streak * 10;

const dayRoll = (date: string) => {
  let h = 2166136261;
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

export interface Raid { date: string; win: boolean; strength: number; defense: number; stolen: Res }

/**
 * Vyhodnotí nájezdy za dny bez jediného XP (od posledního vyhodnocení do včerejška).
 * Prohra = nájezdníci ukradnou 25 % dřeva a kamene nad ochranu skladu. Budovy ani vojáci se neztrácí.
 */
export function resolveRaids(s0: FortState, activeDays: Set<string>, today: string): { state: FortState; raids: Raid[] } {
  let s = s0;
  const raids: Raid[] = [];
  let streak = 0;
  // nejvýš 5 posledních dní (po dlouhé pauze nepřijde lavina nájezdů)
  const from = s0.raidChecked < addDays(today, -5) ? addDays(today, -5) : s0.raidChecked;
  for (let d = from; d < today; d = addDays(d, 1)) {
    if (d < s0.createdDate || activeDays.has(d)) {
      streak = 0;
      continue;
    }
    streak++;
    const strength = raidStrength(s.buildings.hall, Math.min(streak, 5));
    const def = defense(s);
    const win = def * (0.75 + dayRoll(d) * 0.5) >= strength;
    let stolen = ZERO;
    if (!win) {
      const bal = balance(s);
      const safe = storageSafe(s.buildings.storage);
      stolen = { wood: Math.floor(Math.max(0, bal.wood - safe) * 0.25), stone: Math.floor(Math.max(0, bal.stone - safe) * 0.25), crystal: 0 };
      s = { ...s, delta: add(s.delta, stolen, -1) };
    }
    raids.push({ date: d, win, strength, defense: def, stolen });
  }
  return { state: { ...s, raidChecked: today > s0.raidChecked ? today : s0.raidChecked }, raids };
}
