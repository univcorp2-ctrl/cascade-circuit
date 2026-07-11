const PLAY_KEY = 'cascade-circuit:daily-plays';
const BEST_KEY = 'cascade-circuit:best-score';
const FREE_PLAYS = 5;
interface DailyUsage { date: string; used: number; }
function localDateKey(date = new Date()): string { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); }
export function remainingFreePlays(): number { const usage = readUsage(); return Math.max(0, FREE_PLAYS - usage.used); }
export function consumeFreePlay(): number { const usage = readUsage(); const next = { ...usage, used: Math.min(FREE_PLAYS, usage.used + 1) }; localStorage.setItem(PLAY_KEY, JSON.stringify(next)); return Math.max(0, FREE_PLAYS - next.used); }
export function readBestScore(): number { return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0; }
export function saveBestScore(score: number): number { const best = Math.max(readBestScore(), score); localStorage.setItem(BEST_KEY, String(best)); return best; }
function readUsage(): DailyUsage {
  const today = localDateKey();
  try { const parsed = JSON.parse(localStorage.getItem(PLAY_KEY) ?? 'null') as DailyUsage | null; if (parsed?.date === today && Number.isFinite(parsed.used)) return parsed; } catch { /* reset corrupt state */ }
  return { date: today, used: 0 };
}
