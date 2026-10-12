export interface QuestionKey { id: number; correct_index: number }

/** Pure quiz scoring (ported from server/lib/scoring.js). */
export function scoreQuiz(questions: QuestionKey[], answers: Record<string, number> = {}) {
  let correct = 0;
  const results = questions.map((q) => {
    const selected = answers[q.id];
    const isCorrect = selected !== undefined && selected === q.correct_index;
    if (isCorrect) correct += 1;
    return { questionId: q.id, correct: isCorrect, correctIndex: q.correct_index };
  });
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  return { correct, total: questions.length, score, results };
}

export function computeXp(score: number, xpReward: number): number {
  return Math.round((score / 100) * xpReward);
}
