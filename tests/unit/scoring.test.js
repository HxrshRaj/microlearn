const { scoreQuiz, computeXp } = require('../../server/lib/scoring');

const questions = [
  { id: 1, correct_index: 1 },
  { id: 2, correct_index: 2 },
  { id: 3, correct_index: 0 },
  { id: 4, correct_index: 3 },
];

describe('scoreQuiz', () => {
  test('scores a perfect run as 100', () => {
    const answers = { 1: 1, 2: 2, 3: 0, 4: 3 };
    const result = scoreQuiz(questions, answers);
    expect(result.correct).toBe(4);
    expect(result.score).toBe(100);
    expect(result.results.every((r) => r.correct)).toBe(true);
  });

  test('scores a zero run as 0', () => {
    const answers = { 1: 0, 2: 0, 3: 1, 4: 0 };
    const result = scoreQuiz(questions, answers);
    expect(result.correct).toBe(0);
    expect(result.score).toBe(0);
  });

  test('scores partial credit and rounds to the nearest whole percent', () => {
    // 1 of 4 correct = 25%, evenly divides
    const answers = { 1: 1, 2: 0, 3: 1, 4: 0 };
    const result = scoreQuiz(questions, answers);
    expect(result.correct).toBe(1);
    expect(result.score).toBe(25);
  });

  test('treats a missing answer as incorrect rather than throwing', () => {
    const result = scoreQuiz(questions, { 1: 1, 2: 2 }); // 3 and 4 unanswered
    expect(result.correct).toBe(2);
    expect(result.score).toBe(50);
  });

  test('does not award credit for an answer that happens to be undefined vs undefined', () => {
    // guards against `selected === q.correct_index` being true when both are undefined
    const withUndefinedCorrectIndex = [{ id: 1, correct_index: undefined }];
    const result = scoreQuiz(withUndefinedCorrectIndex, {});
    expect(result.correct).toBe(0);
  });

  test('handles an empty question list without dividing by zero', () => {
    const result = scoreQuiz([], {});
    expect(result.score).toBe(0);
    expect(result.total).toBe(0);
  });

  test('per-question results report the correct index but never leak which option the user picked as "the answer"', () => {
    const result = scoreQuiz(questions, { 1: 3 });
    expect(result.results[0]).toEqual({ questionId: 1, correct: false, correctIndex: 1 });
  });
});

describe('computeXp', () => {
  test('awards full XP for a perfect score', () => {
    expect(computeXp(100, 25)).toBe(25);
  });

  test('awards zero XP for a zero score', () => {
    expect(computeXp(0, 25)).toBe(0);
  });

  test('awards proportional XP for a partial score, rounded to the nearest integer', () => {
    expect(computeXp(50, 25)).toBe(13); // 12.5 rounds up
    expect(computeXp(33, 20)).toBe(7); // 6.6 rounds up
  });
});
