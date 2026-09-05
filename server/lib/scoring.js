// Pure quiz-scoring and XP-calculation logic, extracted from the route
// handler so it can be unit tested directly (see tests/unit/scoring.test.js).

/**
 * @param {Array<{id: number, correct_index: number}>} questions
 * @param {Record<string, number>} answers - map of questionId -> selected option index
 */
function scoreQuiz(questions, answers = {}) {
  let correct = 0;
  const results = questions.map((q) => {
    const selected = answers[q.id];
    // Explicit undefined check: `selected === q.correct_index` alone would
    // score an unanswered question as "correct" in the (should-never-happen,
    // but don't bet on it) case where correct_index is itself undefined.
    const isCorrect = selected !== undefined && selected === q.correct_index;
    if (isCorrect) correct += 1;
    return { questionId: q.id, correct: isCorrect, correctIndex: q.correct_index };
  });

  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;

  return { correct, total: questions.length, score, results };
}

/**
 * @param {number} score - 0-100
 * @param {number} xpReward - max XP available for a perfect score on this lesson
 */
function computeXp(score, xpReward) {
  return Math.round((score / 100) * xpReward);
}

module.exports = { scoreQuiz, computeXp };
