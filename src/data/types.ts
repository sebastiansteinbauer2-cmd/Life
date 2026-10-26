// Datové typy celé aplikace. Všechny záznamy mají string `id`,
// aby šly snadno ukládat do IndexedDB i do budoucí cloudové databáze (Supabase).

export type StatId = 'int' | 'str' | 'dis' | 'chess' | 'end';
export type ModuleId = 'core' | 'math' | 'training' | 'chess' | 'discover' | 'finance' | 'ironman' | 'budget' | 'code' | 'reading';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'epic';
export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';
export type MathLevel = 'zaklad' | 'rozsireny' | 'fit';
export type TrainingGoal = 'sila' | 'vytrvalost' | 'svaly' | 'spalovani';
export type Equipment = 'hrazda' | 'cinky' | 'gumy';
export type ExerciseCategory = 'upper' | 'lower' | 'core';

export interface Profile {
  id: 'me';
  name: string;
  onboarded: boolean;
  createdAt: number;
  xp: number;
  statXp: Record<StatId, number>;
  bestStreak: number;
  heightCm: number;
  weightKg: number;
  trainingGoal: TrainingGoal;
  equipment: Equipment[];
  chessUsername: string;
  chessProxyUrl: string;
  fideRating: number;
  mathLevel: MathLevel;
  examDate: string;
  financeGoal: number; // měsíční cíl investování (v měně účtu)
  financeProxyUrl: string;
  financeTargets: FinanceTarget[];
  financeReturn: number; // očekávaný roční výnos v % (pro odhad)
  financeWithdrawal: number; // bezpečná míra výběru v % ročně (pravidlo 4 %)
  serverUrl: string; // vlastní Vercel server (proxy pro Trading 212, YouTube a Stravu)
  ironmanDate: string; // datum závodu (YYYY-MM-DD), nepovinné
  ironmanWeeklyHours: number; // týdenní cíl tréninkových hodin
  ironmanRace: 'full' | 'half'; // typ závodu pro tréninkový plán
  navPinned: ModuleId[]; // sekce ve spodní liště (zbytek je pod „Více“)
  shopRewards: ShopReward[];
  budgetIncome: number; // čistý měsíční příjem (Kč), nepovinné
  budgetLimits: Partial<Record<string, number>>; // měsíční limit podle kategorie výdajů (Kč)
  readingGoal: number; // kolik knih za rok
}

/** Odměna v obchodě za zlaťáky. */
export interface ShopReward {
  id: string;
  title: string;
  icon: string;
  price: number;
}

/** Velký cíl: částka (např. auto) nebo pasivní příjem měsíčně. */
export interface FinanceTarget {
  id: string;
  kind: 'value' | 'income';
  title: string;
  icon: string;
  target: number;
}

export interface XpEntry {
  id: string;
  ts: number;
  date: string; // YYYY-MM-DD (lokální čas)
  amount: number;
  stat: StatId;
  module: ModuleId;
  label: string;
}

/** Vlastní quest vytvořený uživatelem (vestavěné questy jsou definované v kódu). */
export interface CustomQuest {
  id: string;
  title: string;
  module: ModuleId;
  stat: StatId;
  difficulty: Difficulty;
  recurrence: Recurrence;
  target: number;
  createdAt: number;
  archived?: boolean;
}

export interface QuestProgress {
  id: string; // `${questId}|${periodKey}`
  questId: string;
  periodKey: string;
  count: number;
  completedAt?: number;
  xpAwarded?: number;
}

export interface AchievementRecord {
  id: string;
  unlockedAt: number;
}

export interface MetaRecord {
  id: string;
  value: unknown;
}

export interface MathAttempt {
  id: string;
  ts: number;
  date: string;
  topic: string;
  template: string;
  level: MathLevel;
  correct: boolean;
}

export interface TopicSrs {
  id: string; // topic id
  box: number;
  due: string; // YYYY-MM-DD
}

export interface BossResult {
  id: string;
  ts: number;
  level: MathLevel;
  score: number;
  correct: number;
  total: number;
  durationSec: number;
}

export interface Exercise {
  id: string;
  name: string;
  unit: 'reps' | 'sec';
  category: ExerciseCategory;
  builtIn: boolean;
  max: number; // osobní rekord v jedné sérii
  xp: number; // nasbíraný objem (pro level cviku)
  archived?: boolean;
}

export interface WorkoutEntry {
  exerciseId: string;
  sets: number[];
}

export interface Workout {
  id: string;
  ts: number;
  date: string;
  entries: WorkoutEntry[];
  xp: number;
  prs: string[]; // id cviků, kde padl rekord
  note?: string;
}

export interface WeightEntry {
  id: string; // datum YYYY-MM-DD
  date: string;
  kg: number;
}

export type ChessResult = 'win' | 'draw' | 'loss';
export type ChessTimeClass = 'rapid' | 'blitz' | 'bullet' | 'daily';

export interface ChessGame {
  id: string; // URL partie
  endTime: number; // ms
  timeClass: ChessTimeClass;
  timeControl: string;
  rated: boolean;
  color: 'white' | 'black';
  result: ChessResult;
  myRating: number;
  opponent: string;
  opponentRating: number;
  eco: string;
  opening: string;
  note?: string;
  analyzed?: boolean;
  xp?: number;
}

export interface ChessRatingSnapshot {
  id: string; // datum
  ts: number;
  rapid?: number;
  blitz?: number;
  bullet?: number;
  daily?: number;
  puzzles?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  chapters: number;
  done: number;
  builtIn: boolean;
}

export interface Discovery {
  id: string;
  ts: number;
  date: string;
  text: string;
  tags: string[];
  sourceId?: string;
  lastReviewed?: string;
  videoId?: string;
  videoTitle?: string;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  builtIn: boolean;
  hidden?: boolean; // skrytý vestavěný zdroj (seed ho znovu nepřidá)
}

export interface FinancePosition {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  ppl: number; // zisk/ztráta v měně účtu
}

/** Denní snímek účtu Trading 212 (jeden záznam na den). */
export interface FinanceSnapshot {
  id: string; // YYYY-MM-DD
  ts: number;
  currency: string;
  total: number;
  invested: number;
  ppl: number;
  free: number;
  positions: FinancePosition[];
}

export type FinanceTxType = 'DEPOSIT' | 'WITHDRAW' | 'FEE' | 'TRANSFER';

export interface FinanceTx {
  id: string; // reference z Trading 212
  type: FinanceTxType;
  amount: number;
  ts: number;
}

export interface FinanceDividend {
  id: string;
  ticker: string;
  amount: number;
  ts: number;
}

/** Sportovní aktivita ze Stravy. */
export interface Activity {
  id: string; // ID aktivity ve Stravě
  ts: number; // začátek (ms)
  date: string; // YYYY-MM-DD (lokální)
  sport: string; // Run, Ride, Walk, Hike, …
  name: string;
  distance: number; // metry
  movingTime: number; // sekundy
  elevation: number; // metry
  avgHr?: number;
  xp?: number;
}

/** Mapa všech kolekcí – jediný zdroj pravdy pro úložiště, export i import. */
export interface Collections {
  profile: Profile;
  xpLog: XpEntry;
  quests: CustomQuest;
  questProgress: QuestProgress;
  achievements: AchievementRecord;
  meta: MetaRecord;
  mathAttempts: MathAttempt;
  topicSrs: TopicSrs;
  bossResults: BossResult;
  exercises: Exercise;
  workouts: Workout;
  weights: WeightEntry;
  chessGames: ChessGame;
  chessRatings: ChessRatingSnapshot;
  books: Book;
  discoveries: Discovery;
  resources: Resource;
  financeSnapshots: FinanceSnapshot;
  financeTx: FinanceTx;
  financeDividends: FinanceDividend;
  activities: Activity;
  expenses: Expense;
  codeAttempts: CodeAttempt;
  readBooks: ReadBook;
  readLog: ReadLogEntry;
}

/** Výdaj nebo příjem v rozpočtu (Kč). */
export interface Expense {
  id: string;
  ts: number;
  date: string; // YYYY-MM-DD
  amount: number; // vždy kladné
  kind: 'out' | 'in';
  category: string;
  note: string;
}

/** Pokus o programovací úlohu (Python) nebo otázku z kvízu C. */
export interface CodeAttempt {
  id: string;
  ts: number;
  date: string;
  taskId: string;
  passed: boolean;
  code?: string;
}

/** Kniha ke čtení (obecná – šachové knihy jsou v modulu Šachy). */
export interface ReadBook {
  id: string;
  title: string;
  author: string;
  pages: number;
  page: number; // kde právě jsem
  status: 'reading' | 'done' | 'want';
  startedAt?: string;
  finishedAt?: string;
  rating?: number; // 1–5
  quotes: { text: string; page?: number }[];
  createdAt: number;
}

/** Přečtené stránky za den. */
export interface ReadLogEntry {
  id: string; // `${date}|${bookId}`
  date: string;
  bookId: string;
  pages: number;
}

export type CollectionName = keyof Collections;


export const COLLECTION_NAMES: CollectionName[] = [
  'profile', 'xpLog', 'quests', 'questProgress', 'achievements', 'meta',
  'mathAttempts', 'topicSrs', 'bossResults', 'exercises', 'workouts', 'weights',
  'chessGames', 'chessRatings', 'books', 'discoveries', 'resources',
  'financeSnapshots', 'financeTx', 'financeDividends',
  'activities',
  'expenses', 'codeAttempts', 'readBooks', 'readLog',
];
