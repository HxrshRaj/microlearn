const { applyActivity, daysBetween, todayISO } = require('../../server/lib/streak');

describe('daysBetween', () => {
  test('is 0 for the same date', () => {
    expect(daysBetween('2026-01-05', '2026-01-05')).toBe(0);
  });

  test('is 1 for consecutive days', () => {
    expect(daysBetween('2026-01-05', '2026-01-06')).toBe(1);
  });

  test('handles month boundaries', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
  });
});

describe('applyActivity', () => {
  test('first-ever activity starts a streak of 1', () => {
    const result = applyActivity({ currentStreak: 0, longestStreak: 0, lastActivityDate: null }, '2026-01-05');
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1, lastActivityDate: '2026-01-05' });
  });

  test('activity on the very next day extends the streak', () => {
    const result = applyActivity(
      { currentStreak: 3, longestStreak: 3, lastActivityDate: '2026-01-05' },
      '2026-01-06',
    );
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);
    expect(result.lastActivityDate).toBe('2026-01-06');
  });

  test('a second activity on the SAME day does not double-count the streak', () => {
    const result = applyActivity(
      { currentStreak: 3, longestStreak: 5, lastActivityDate: '2026-01-05' },
      '2026-01-05',
    );
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(5);
    expect(result.lastActivityDate).toBe('2026-01-05');
  });

  test('missing a day (gap > 1) resets the current streak to 1', () => {
    const result = applyActivity(
      { currentStreak: 10, longestStreak: 10, lastActivityDate: '2026-01-01' },
      '2026-01-05',
    );
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(10); // longest is a high-water mark, doesn't reset
    expect(result.lastActivityDate).toBe('2026-01-05');
  });

  test('longest streak updates once the current streak surpasses it', () => {
    const result = applyActivity(
      { currentStreak: 5, longestStreak: 5, lastActivityDate: '2026-01-05' },
      '2026-01-06',
    );
    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(6);
  });

  test('accepts a real Date object for lastActivityDate (as a Postgres `date` column can come back as)', () => {
    const asDate = new Date('2026-01-05T00:00:00.000Z');
    const result = applyActivity({ currentStreak: 2, longestStreak: 2, lastActivityDate: asDate }, '2026-01-06');
    expect(result.currentStreak).toBe(3);
  });

  test('accepts string-typed numeric fields (as some drivers/engines return integer columns)', () => {
    const result = applyActivity(
      { currentStreak: '2', longestStreak: '2', lastActivityDate: '2026-01-05' },
      '2026-01-06',
    );
    expect(result.currentStreak).toBe(3);
    expect(typeof result.currentStreak).toBe('number');
  });

  test('defaults `today` to the real current date when not provided', () => {
    const result = applyActivity({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
    expect(result.lastActivityDate).toBe(todayISO());
  });
});
