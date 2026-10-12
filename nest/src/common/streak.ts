export interface StreakStats { currentStreak: number; longestStreak: number; lastActivityDate: string | Date | null }

export const todayISO = (date = new Date()) => date.toISOString().slice(0, 10);

export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

function toDateString(v: string | Date | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

/** Pure streak update (ported from server/lib/streak.js). */
export function applyActivity(stats: StreakStats, today: string = todayISO()) {
  let currentStreak = Number(stats.currentStreak) || 0;
  let longestStreak = Number(stats.longestStreak) || 0;
  let lastActivityDate = toDateString(stats.lastActivityDate);
  if (lastActivityDate !== today) {
    const gap = lastActivityDate ? daysBetween(lastActivityDate, today) : null;
    currentStreak = gap === 1 ? currentStreak + 1 : 1;
    lastActivityDate = today;
  }
  longestStreak = Math.max(longestStreak, currentStreak);
  return { currentStreak, longestStreak, lastActivityDate: lastActivityDate as string };
}
