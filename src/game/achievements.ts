export interface AchievementCtx {
  level: number;
  totalXp: number;
  bestStreak: number;
  questsDone: number;
  mathCorrect: number;
  bossBest: number;
  bossCount: number;
  workouts: number;
  prs: number;
  restDays: number;
  chessGames: number;
  chessAnalyzed: number;
  booksDone: number;
  chaptersDone: number;
  discoveries: number;
  quizzes: number;
  modulesToday: number;
  financeDeposits: number;
  financeDividends: number;
  financeMilestone: number;
  financePositions: number;
  financeBestStreak: number;
  financeGoalsDone: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (c: AchievementCtx) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-xp', title: 'První krok', description: 'Získej první XP', icon: '👣', check: (c) => c.totalXp > 0 },
  { id: 'lvl-5', title: 'Tovaryš', description: 'Dosáhni levelu 5', icon: '⭐', check: (c) => c.level >= 5 },
  { id: 'lvl-12', title: 'Veterán', description: 'Dosáhni levelu 12', icon: '🌟', check: (c) => c.level >= 12 },
  { id: 'lvl-30', title: 'Legenda', description: 'Dosáhni levelu 30', icon: '👑', check: (c) => c.level >= 30 },
  { id: 'streak-7', title: 'Týden v řadě', description: 'Série 7 dní', icon: '🔥', check: (c) => c.bestStreak >= 7 },
  { id: 'streak-30', title: 'Měsíc železné vůle', description: 'Série 30 dní', icon: '☄️', check: (c) => c.bestStreak >= 30 },
  { id: 'streak-100', title: 'Stovka', description: 'Série 100 dní', icon: '💯', check: (c) => c.bestStreak >= 100 },
  { id: 'quests-50', title: 'Questař', description: 'Splň 50 questů', icon: '📜', check: (c) => c.questsDone >= 50 },
  { id: 'all-modules', title: 'Renesanční člověk', description: 'Za jeden den získej XP ve všech 4 modulech', icon: '🎭', check: (c) => c.modulesToday >= 4 },
  { id: 'math-100', title: 'Počtář', description: 'Vyřeš správně 100 příkladů', icon: '➗', check: (c) => c.mathCorrect >= 100 },
  { id: 'math-1000', title: 'Matematik', description: 'Vyřeš správně 1000 příkladů', icon: '∞', check: (c) => c.mathCorrect >= 1000 },
  { id: 'boss-first', title: 'Výzva přijata', description: 'Dokonči první boss fight', icon: '🐉', check: (c) => c.bossCount >= 1 },
  { id: 'boss-70', title: 'Přijat!', description: 'V simulaci přijímaček získej aspoň 70 bodů', icon: '🎓', check: (c) => c.bossBest >= 70 },
  { id: 'boss-100', title: 'Bezchybný', description: 'V simulaci získej 100 bodů', icon: '🏆', check: (c) => c.bossBest >= 100 },
  { id: 'workout-1', title: 'První pot', description: 'Zapiš první trénink', icon: '💦', check: (c) => c.workouts >= 1 },
  { id: 'workout-50', title: 'Železný', description: 'Zapiš 50 tréninků', icon: '🦾', check: (c) => c.workouts >= 50 },
  { id: 'pr-10', title: 'Lamač rekordů', description: 'Překonej 10 osobních rekordů', icon: '📈', check: (c) => c.prs >= 10 },
  { id: 'rest-10', title: 'Moudrost odpočinku', description: '10 dní regenerace', icon: '🧘', check: (c) => c.restDays >= 10 },
  { id: 'chess-sync', title: 'Napojeno', description: 'Načti partie z Chess.com', icon: '🔗', check: (c) => c.chessGames >= 1 },
  { id: 'chess-100', title: 'Stovka partií', description: 'Měj v aplikaci 100 partií', icon: '♟️', check: (c) => c.chessGames >= 100 },
  { id: 'chess-analysis-10', title: 'Analytik', description: 'Rozeber 10 partií bez enginu', icon: '🔍', check: (c) => c.chessAnalyzed >= 10 },
  { id: 'book-chapter', title: 'Čtenář', description: 'Dokonči kapitolu šachové knihy', icon: '📖', check: (c) => c.chaptersDone >= 1 },
  { id: 'book-done', title: 'Knihomol', description: 'Dočti celou šachovou knihu', icon: '📚', check: (c) => c.booksDone >= 1 },
  { id: 'discover-10', title: 'Zvídavý', description: 'Zapiš 10 objevů', icon: '💡', check: (c) => c.discoveries >= 10 },
  { id: 'discover-100', title: 'Encyklopedie', description: 'Zapiš 100 objevů', icon: '🧭', check: (c) => c.discoveries >= 100 },
  { id: 'quiz-1', title: 'Paměť jako slon', description: 'Dokonči opakovací kvíz', icon: '🐘', check: (c) => c.quizzes >= 1 },
  { id: 'fin-first', title: 'Investor', description: 'Načti první vklad z Trading 212', icon: '💰', check: (c) => c.financeDeposits >= 1 },
  { id: 'fin-m1', title: 'Semínko', description: 'Portfolio přes 10 000 Kč (500 €/$)', icon: '🌱', check: (c) => c.financeMilestone >= 1 },
  { id: 'fin-m3', title: 'Stromek', description: 'Portfolio přes 100 000 Kč (5 000 €/$)', icon: '🌳', check: (c) => c.financeMilestone >= 3 },
  { id: 'fin-m5', title: 'Les', description: 'Portfolio přes 500 000 Kč (25 000 €/$)', icon: '🌲', check: (c) => c.financeMilestone >= 5 },
  { id: 'fin-m6', title: 'Milionář', description: 'Portfolio přes 1 000 000 Kč (50 000 €/$)', icon: '💎', check: (c) => c.financeMilestone >= 6 },
  { id: 'fin-div', title: 'Pasivní příjem', description: 'Získej první dividendu', icon: '🪙', check: (c) => c.financeDividends >= 1 },
  { id: 'fin-diverse', title: 'Diverzifikace', description: 'Měj v portfoliu 10 a víc pozic', icon: '🧺', check: (c) => c.financePositions >= 10 },
  { id: 'fin-streak-6', title: 'Pravidelný investor', description: 'Splň měsíční cíl 6 měsíců v řadě', icon: '📅', check: (c) => c.financeBestStreak >= 6 },
  { id: 'fin-dream', title: 'Splněný sen', description: 'Dosáhni velkého cíle ve Financích', icon: '🏁', check: (c) => c.financeGoalsDone >= 1 },
  { id: 'fin-streak-12', title: 'Rok disciplíny', description: 'Splň měsíční cíl 12 měsíců v řadě', icon: '🏦', check: (c) => c.financeBestStreak >= 12 },
];
