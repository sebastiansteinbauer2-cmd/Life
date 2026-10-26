// Pevnost hrdiny – definice budov, jednotek, nepřátel a výprav.
import type { FortBuildingId, FortRes, FortUnitId, StatId } from '../../data/types';

export type Res = FortRes;
export const RES_ICON: Record<keyof Res, string> = { wood: '🪵', stone: '🪨', crystal: '💎' };
export const RES_LABEL: Record<keyof Res, string> = { wood: 'Dřevo', stone: 'Kámen', crystal: 'Krystaly' };
/** Z jaké statistiky se suroviny získávají (1 XP = 1 surovina). */
export const RES_FROM: Record<keyof Res, StatId[]> = { wood: ['str', 'end'], stone: ['int', 'chess'], crystal: ['dis'] };

export type BuildingId = FortBuildingId;

export interface BuildingDef {
  id: BuildingId;
  name: string;
  icon: string;
  text: string;
  maxLevel: number;
  /** Cena vylepšení na level `to` (level 1 se nestaví – je od začátku). */
  cost: (to: number) => Res;
  /** Co budova na daném levelu dává (text). */
  effect: (lvl: number) => string;
}

const grow = (base: number, to: number, k = 1.75) => Math.round((base * Math.pow(k, to - 2)) / 10) * 10;

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'hall', name: 'Radnice', icon: '🏛️', maxLevel: 8,
    text: 'Srdce pevnosti. Její level určuje, jak vysoko můžeš vylepšit ostatní budovy.',
    cost: (to) => ({ wood: grow(250, to, 2), stone: grow(250, to, 2), crystal: grow(20, to, 1.9) }),
    effect: (l) => `Ostatní budovy do levelu ${l + 1}`,
  },
  {
    id: 'barracks', name: 'Kasárna', icon: '⚔️', maxLevel: 9,
    text: 'Výcvik armády. Vyšší level = víc vojáků a nové druhy jednotek.',
    cost: (to) => ({ wood: grow(120, to), stone: grow(60, to), crystal: 0 }),
    effect: (l) => `Armáda až ${armyCap(l)} vojáků`,
  },
  {
    id: 'forge', name: 'Kovárna', icon: '🔨', maxLevel: 9,
    text: 'Lepší zbraně – všechny tvoje jednotky útočí silněji.',
    cost: (to) => ({ wood: grow(80, to), stone: grow(120, to), crystal: grow(5, to, 1.6) }),
    effect: (l) => `Útok +${(l - 1) * 8} %`,
  },
  {
    id: 'academy', name: 'Akademie', icon: '📚', maxLevel: 9,
    text: 'Výcvik a zbroj – všechny tvoje jednotky vydrží víc.',
    cost: (to) => ({ wood: grow(60, to), stone: grow(140, to), crystal: grow(5, to, 1.6) }),
    effect: (l) => `Životy +${(l - 1) * 8} %`,
  },
  {
    id: 'walls', name: 'Hradby', icon: '🧱', maxLevel: 9,
    text: 'Chrání pevnost při nájezdech, když vynecháš den.',
    cost: (to) => ({ wood: grow(60, to), stone: grow(150, to), crystal: 0 }),
    effect: (l) => `Obrana ${defenseFrom('walls', l)}`,
  },
  {
    id: 'tower', name: 'Obranná věž', icon: '🗼', maxLevel: 9,
    text: 'Střílí na nájezdníky. Spolu s hradbami rozhoduje o obraně.',
    cost: (to) => ({ wood: grow(140, to), stone: grow(90, to), crystal: grow(3, to, 1.6) }),
    effect: (l) => `Obrana ${defenseFrom('tower', l)}`,
  },
  {
    id: 'sawmill', name: 'Pila', icon: '🪚', maxLevel: 9,
    text: 'Zpracovává dřevo z tvých tréninků. Vyšší level = víc dřeva za každé XP.',
    cost: (to) => ({ wood: grow(50, to), stone: grow(110, to), crystal: 0 }),
    effect: (l) => `Dřevo +${(l - 1) * 10} %`,
  },
  {
    id: 'quarry', name: 'Kamenolom', icon: '⛏️', maxLevel: 9,
    text: 'Těží kámen z tvého učení. Vyšší level = víc kamene za každé XP.',
    cost: (to) => ({ wood: grow(110, to), stone: grow(50, to), crystal: 0 }),
    effect: (l) => `Kámen +${(l - 1) * 10} %`,
  },
  {
    id: 'mine', name: 'Krystalový důl', icon: '💎', maxLevel: 9,
    text: 'Krystaly z tvé disciplíny. Vyšší level = víc krystalů za každé XP.',
    cost: (to) => ({ wood: grow(120, to), stone: grow(120, to), crystal: grow(8, to, 1.6) }),
    effect: (l) => `Krystaly +${(l - 1) * 10} %`,
  },
  {
    id: 'storage', name: 'Sklad', icon: '🏚️', maxLevel: 9,
    text: 'Suroviny ve skladu nájezdníci neukradnou.',
    cost: (to) => ({ wood: grow(100, to), stone: grow(100, to), crystal: 0 }),
    effect: (l) => `Chrání ${storageSafe(l)} od každé suroviny`,
  },
];
export const buildingDef = (id: BuildingId) => BUILDINGS.find((b) => b.id === id)!;

export const armyCap = (barracks: number) => 3 + barracks; // max 12 + hrdina = 2 řady bojiště
export const storageSafe = (lvl: number) => lvl * 250;
export const defenseFrom = (id: 'walls' | 'tower', lvl: number) => (id === 'walls' ? lvl * 12 : lvl * 15);

/** Doba stavby v minutách (skutečný čas). */
export function buildMinutes(to: number): number {
  return [0, 0, 5, 30, 120, 360, 720, 1080, 1440, 1440][Math.min(to, 9)];
}

// ---------- jednotky ----------

export type UnitId = FortUnitId;

export interface UnitStats { hp: number; atk: number; move: number; range: number }

export interface UnitDef extends UnitStats {
  id: UnitId;
  name: string;
  icon: string;
  cost: Res;
  text: string;
  barracks: number; // potřebný level kasáren
  stat?: { id: StatId; level: number }; // potřebný level statistiky ze skutečného života
}

export const UNITS: UnitDef[] = [
  { id: 'warrior', name: 'Válečník', icon: '🗡️', hp: 30, atk: 8, move: 2, range: 1, cost: { wood: 25, stone: 0, crystal: 0 }, barracks: 1, text: 'Odolný bojovník na blízko.' },
  { id: 'archer', name: 'Lučištník', icon: '🏹', hp: 18, atk: 7, move: 2, range: 3, cost: { wood: 20, stone: 15, crystal: 0 }, barracks: 2, stat: { id: 'dis', level: 2 }, text: 'Střílí na 3 pole. Drž ho za válečníky.' },
  { id: 'mage', name: 'Mág', icon: '🧙', hp: 16, atk: 13, move: 2, range: 2, cost: { wood: 0, stone: 40, crystal: 4 }, barracks: 3, stat: { id: 'int', level: 3 }, text: 'Silná magie na 2 pole, ale křehký.' },
  { id: 'knight', name: 'Rytíř', icon: '🐎', hp: 48, atk: 11, move: 4, range: 1, cost: { wood: 50, stone: 20, crystal: 6 }, barracks: 4, stat: { id: 'str', level: 3 }, text: 'Rychlý a tvrdý – dojede daleko.' },
];
export const unitDef = (id: UnitId) => UNITS.find((u) => u.id === id)!;

/** Hrdina – tvůj avatar. Sílí s tvým levelem a v bitvě nikdy neumírá natrvalo. */
export const heroStats = (level: number): UnitStats => ({ hp: 36 + level * 4, atk: 9 + level, move: 3, range: 1 });

// ---------- nepřátelé ----------

export type EnemyId = 'goblin' | 'gobArcher' | 'orc' | 'shaman' | 'troll' | 'skeleton' | 'darkKnight' | 'dragon';

export interface EnemyDef extends UnitStats { id: EnemyId; name: string; icon: string }

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  goblin: { id: 'goblin', name: 'Goblin', icon: '👺', hp: 14, atk: 5, move: 3, range: 1 },
  gobArcher: { id: 'gobArcher', name: 'Goblin lučištník', icon: '🎯', hp: 12, atk: 5, move: 2, range: 3 },
  orc: { id: 'orc', name: 'Ork', icon: '👹', hp: 34, atk: 9, move: 2, range: 1 },
  shaman: { id: 'shaman', name: 'Šaman', icon: '🔮', hp: 18, atk: 11, move: 2, range: 2 },
  skeleton: { id: 'skeleton', name: 'Kostlivec', icon: '💀', hp: 22, atk: 8, move: 2, range: 1 },
  troll: { id: 'troll', name: 'Troll', icon: '🧌', hp: 75, atk: 14, move: 1, range: 1 },
  darkKnight: { id: 'darkKnight', name: 'Temný rytíř', icon: '🦹', hp: 60, atk: 14, move: 3, range: 1 },
  dragon: { id: 'dragon', name: 'Drak', icon: '🐉', hp: 110, atk: 12, move: 2, range: 2 },
};

// ---------- výpravy ----------

export interface Camp {
  id: number;
  name: string;
  icon: string;
  enemies: EnemyId[];
  loot: Res;
  /** Kameny a stromy na bojišti (sloupec, řádek). */
  rocks: [number, number][];
}

export const CAMPS: Camp[] = [
  { id: 1, name: 'Goblinní tábor', icon: '⛺', enemies: ['goblin', 'goblin', 'goblin'], loot: { wood: 60, stone: 40, crystal: 2 }, rocks: [[1, 4], [5, 4]] },
  { id: 2, name: 'Lesní přepadení', icon: '🌲', enemies: ['goblin', 'goblin', 'gobArcher', 'gobArcher'], loot: { wood: 90, stone: 50, crystal: 3 }, rocks: [[2, 3], [3, 5], [5, 3]] },
  { id: 3, name: 'Orkská hlídka', icon: '🪓', enemies: ['orc', 'goblin', 'goblin', 'gobArcher'], loot: { wood: 110, stone: 80, crystal: 4 }, rocks: [[0, 4], [3, 4], [6, 4]] },
  { id: 4, name: 'Šamanův kruh', icon: '🔮', enemies: ['shaman', 'orc', 'goblin', 'goblin', 'gobArcher'], loot: { wood: 130, stone: 130, crystal: 5 }, rocks: [[2, 4], [4, 4]] },
  { id: 5, name: 'Most přes řeku', icon: '🌉', enemies: ['orc', 'orc', 'gobArcher', 'gobArcher', 'shaman'], loot: { wood: 160, stone: 150, crystal: 6 }, rocks: [[0, 4], [1, 4], [2, 4], [4, 4], [5, 4], [6, 4]] },
  { id: 6, name: 'Trollí jeskyně', icon: '🕳️', enemies: ['troll', 'goblin', 'goblin', 'goblin', 'gobArcher'], loot: { wood: 200, stone: 180, crystal: 8 }, rocks: [[1, 3], [5, 3], [3, 5]] },
  { id: 7, name: 'Prokletý hřbitov', icon: '🪦', enemies: ['skeleton', 'skeleton', 'skeleton', 'skeleton', 'shaman', 'shaman'], loot: { wood: 220, stone: 240, crystal: 10 }, rocks: [[1, 4], [3, 3], [5, 4]] },
  { id: 8, name: 'Orkská pevnost', icon: '🏯', enemies: ['orc', 'orc', 'orc', 'shaman', 'gobArcher', 'gobArcher', 'troll'], loot: { wood: 280, stone: 280, crystal: 12 }, rocks: [[2, 3], [4, 3], [3, 5]] },
  { id: 9, name: 'Temný průsmyk', icon: '⛰️', enemies: ['darkKnight', 'skeleton', 'skeleton', 'shaman', 'gobArcher', 'gobArcher'], loot: { wood: 330, stone: 330, crystal: 15 }, rocks: [[0, 3], [1, 4], [5, 4], [6, 3]] },
  { id: 10, name: 'Trollí král', icon: '👑', enemies: ['troll', 'troll', 'orc', 'orc', 'shaman', 'shaman'], loot: { wood: 400, stone: 400, crystal: 18 }, rocks: [[3, 4]] },
  { id: 11, name: 'Brána temného hradu', icon: '🏰', enemies: ['darkKnight', 'darkKnight', 'skeleton', 'skeleton', 'shaman', 'shaman', 'gobArcher'], loot: { wood: 480, stone: 480, crystal: 22 }, rocks: [[1, 3], [5, 3], [2, 5], [4, 5]] },
  { id: 12, name: 'Dračí doupě', icon: '🐉', enemies: ['dragon', 'darkKnight', 'shaman', 'shaman'], loot: { wood: 700, stone: 700, crystal: 40 }, rocks: [[2, 4], [4, 4]] },
];
/** Nepřátelé na dalších výpravách jsou silnější (násobek životů a útoku). */
// (vyladěno simulací: se startovní armádou padnou 3 tábory, drak až s plně vylepšenou pevností)
export const campScale = (id: number) => ({ hp: 1 + (id - 1) * 0.22, atk: 1 + (id - 1) * 0.13 });

/** Opakovaná výprava dává menší kořist. */
export const REPLAY_LOOT = 0.4;
/** Odměna za první dobytí – krystaly navíc. */
export const FIRST_CLEAR_CRYSTALS = 10;
