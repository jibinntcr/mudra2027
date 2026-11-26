import type { QuizScoringRules } from '@/lib/db/types';

export const DEFAULT_SCORING_RULES: QuizScoringRules = {
  basePoints: 1000,
  speedBonusMax: 500,
  speedBonusEnabled: true,
  streakBonusPoints: 100,
  streakThreshold: 3,
  streakBonusEnabled: true,
};

export interface ScoreCalculationInput {
  isCorrect: boolean;
  responseTimeMs: number;
  timeLimitSeconds: number;
  previousStreak: number;
  rules: QuizScoringRules;
}

export interface ScoreCalculationResult {
  isCorrect: boolean;
  basePointsEarned: number;
  speedBonusEarned: number;
  streakBonusEarned: number;
  totalPointsEarned: number;
  streakAfterAnswer: number;
}

/**
 * Server-side deterministic scoring calculation:
 * - Base points: `rules.basePoints` (default 1,000) for a correct answer.
 * - Speed bonus: linearly decreasing up to `rules.speedBonusMax` (default 500) across question duration.
 *   At t=0ms -> 500 pts; at t >= durationMs -> 0 pts.
 * - Streak bonus: `rules.streakBonusPoints` (default 100) from the 3rd consecutive correct answer onward.
 * - Wrong or unanswered questions earn 0 points and reset the streak to 0.
 * - Either bonus can be disabled per quiz/session.
 */
export function calculateQuestionScore(input: ScoreCalculationInput): ScoreCalculationResult {
  if (!input.isCorrect) {
    return {
      isCorrect: false,
      basePointsEarned: 0,
      speedBonusEarned: 0,
      streakBonusEarned: 0,
      totalPointsEarned: 0,
      streakAfterAnswer: 0,
    };
  }

  const rules = { ...DEFAULT_SCORING_RULES, ...(input.rules || {}) };
  const durationMs = Math.max(1000, (input.timeLimitSeconds || 20) * 1000);
  const clampedResponseMs = Math.max(0, Math.min(durationMs, input.responseTimeMs));

  const basePointsEarned = Math.max(0, Math.round(rules.basePoints));

  let speedBonusEarned = 0;
  if (rules.speedBonusEnabled && rules.speedBonusMax > 0) {
    const remainingRatio = Math.max(0, Math.min(1, 1 - clampedResponseMs / durationMs));
    speedBonusEarned = Math.round(rules.speedBonusMax * remainingRatio);
  }

  const streakAfterAnswer = Math.max(0, input.previousStreak) + 1;

  let streakBonusEarned = 0;
  const threshold = Math.max(2, rules.streakThreshold || 3);
  if (rules.streakBonusEnabled && rules.streakBonusPoints > 0 && streakAfterAnswer >= threshold) {
    streakBonusEarned = Math.round(rules.streakBonusPoints);
  }

  const totalPointsEarned = basePointsEarned + speedBonusEarned + streakBonusEarned;

  return {
    isCorrect: true,
    basePointsEarned,
    speedBonusEarned,
    streakBonusEarned,
    totalPointsEarned,
    streakAfterAnswer,
  };
}

export interface RankableParticipant {
  participantId: string;
  displayName: string;
  totalPoints: number;
  correctCount: number;
  answeredCount: number;
  cumulativeCorrectTimeMs: number;
  currentStreak: number;
  maxStreak: number;
  isGuest?: boolean;
}

export interface RankedParticipant extends RankableParticipant {
  rank: number;
  isTied: boolean;
}

/**
 * Ranks participants by:
 * 1. Total points (descending)
 * 2. Number correct (descending)
 * 3. Lowest cumulative response time across correct answers (ascending)
 * Assigns a shared rank when all three values are identical.
 */
export function rankParticipants<T extends RankableParticipant>(
  participants: T[]
): Array<T & { rank: number; isTied: boolean }> {
  const sorted = [...participants].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.correctCount !== a.correctCount) {
      return b.correctCount - a.correctCount;
    }
    if (a.cumulativeCorrectTimeMs !== b.cumulativeCorrectTimeMs) {
      return a.cumulativeCorrectTimeMs - b.cumulativeCorrectTimeMs;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const ranked: Array<T & { rank: number; isTied: boolean }> = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const isSameAsPrev =
      prev !== null &&
      prev.totalPoints === curr.totalPoints &&
      prev.correctCount === curr.correctCount &&
      prev.cumulativeCorrectTimeMs === curr.cumulativeCorrectTimeMs;

    const rank = isSameAsPrev ? ranked[i - 1].rank : i + 1;
    ranked.push({
      ...curr,
      rank,
      isTied: isSameAsPrev,
    });
  }

  // Mark the first item of a tie group with isTied = true as well
  for (let i = 0; i < ranked.length - 1; i++) {
    if (ranked[i + 1].rank === ranked[i].rank) {
      ranked[i].isTied = true;
    }
  }

  return ranked;
}
