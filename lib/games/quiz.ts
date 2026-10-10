// Quiz scoring (pure — unit-tested). The answer key lives only in the
// server-side game session; each choice is locked in when it's first
// revealed, so a player can't peek at the answer and then change their pick.

export interface QuizKey {
  /** Question ids in the order shown. */
  ids: string[];
  /** Correct choice per question, same order. */
  correct: number[];
}

/** Choices locked in so far, by question position. */
export type QuizProgress = Record<string, number>;

export function checkQuiz(key: QuizKey, progress: QuizProgress): number {
  return key.correct.filter((answer, i) => progress[String(i)] === answer).length;
}

/** Quiz questions per level come from the matching difficulty in the question bank. */
export const QUIZ_LENGTH = 10;
