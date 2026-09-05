// Pure streak-calculation logic, extracted from the route handler so the
// date-math edge cases (same-day, one-day gap, missed day) can be unit
// tested directly (see tests/unit/streak.test.js) without touching a DB.

function todayISO(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(isoDateA, isoDateB) {
  const a = new Date(`${isoDateA}T00:00:00Z`);
  const b = new Date(`${isoDateB}T00:00:00Z`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Postgres `date` columns can come back from a driver as a JS Date object
// rather than a 'YYYY-MM-DD' string (node-pg does this). Normalize either
// shape to a plain date string so comparisons below are reliable regardless
// of which driver/test double handed us the row.
function toDateString(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * @param {{currentStreak: number, longestStreak: number, lastActivityDate: string|Date|null}} stats
 * @param {string} today - YYYY-MM-DD
 * @returns {{currentStreak: number, longestStreak: number, lastActivityDate: string}}
 */
function applyActivity(stats, today = todayISO()) {
  let currentStreak = Number(stats.currentStreak) || 0;
  let longestStreak = Number(stats.longestStreak) || 0;
  let lastActivityDate = toDateString(stats.lastActivityDate);

  if (lastActivityDate !== today) {
    const gap = lastActivityDate ? daysBetween(lastActivityDate, today) : null;
    // gap === 1: activity yesterday, streak continues.
    // gap === 0 can't happen here (that's the lastActivityDate === today case above).
    // Anything else (no prior activity, or a gap > 1 day) resets the streak to 1.
    currentStreak = gap === 1 ? currentStreak + 1 : 1;
    lastActivityDate = today;
  }
  // else: already logged activity today — streak doesn't change twice in one day.

  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak, lastActivityDate };
}

module.exports = { todayISO, daysBetween, applyActivity };
