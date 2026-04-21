export const DIMENSION_NAMES = ['技术基础', '项目经验', '场景解决能力', '逻辑思维', '表达流畅度'] as const;

export type DimensionName = (typeof DIMENSION_NAMES)[number];

export interface DimensionScore {
  name: DimensionName;
  score: number;
}

type DimensionScoreMap = Partial<Record<DimensionName, number>>;

export const MAX_DIMENSION_SCORE = 20;
export const MAX_TOTAL_SCORE = DIMENSION_NAMES.length * MAX_DIMENSION_SCORE;
export const DIMENSION_SCORE_REGEX = /(技术基础|项目经验|场景解决能力|逻辑思维|表达流畅度)[：:]\s*(-?\d{1,3})\s*分/g;
export const TOTAL_SCORE_REGEX = /总分[：:]\s*-?\d{1,3}\s*分/g;
const TOTAL_SCORE_CAPTURE_REGEX = /总分[：:]\s*(-?\d{1,3})\s*分/;

function clampScore(score: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, Math.round(score)));
}

export function normalizeTotalScore(score: number) {
  return clampScore(score, MAX_TOTAL_SCORE);
}

export function sumDimensionScores(scoreMap: DimensionScoreMap) {
  return DIMENSION_NAMES.reduce((sum, name) => sum + (scoreMap[name] ?? 0), 0);
}

export function parseDimensionScoreMap(
  feedback: string,
  options: { allowOutOfRange?: boolean } = {}
) {
  const scoreMap: DimensionScoreMap = {};

  if (!feedback) {
    return scoreMap;
  }

  for (const match of feedback.matchAll(new RegExp(DIMENSION_SCORE_REGEX))) {
    const name = match[1] as DimensionName;
    const score = parseInt(match[2], 10);

    if (Number.isNaN(score)) {
      continue;
    }

    if (options.allowOutOfRange || (score >= 0 && score <= MAX_DIMENSION_SCORE)) {
      scoreMap[name] = score;
    }
  }

  return scoreMap;
}

export function extractTotalScore(feedback: string) {
  if (!feedback) {
    return null;
  }

  const totalMatch = feedback.match(TOTAL_SCORE_CAPTURE_REGEX);
  if (!totalMatch) {
    return null;
  }

  const parsedScore = parseInt(totalMatch[1], 10);
  return Number.isNaN(parsedScore) ? null : normalizeTotalScore(parsedScore);
}

export function distributeScore(totalScore: number, count: number) {
  if (count <= 0) {
    return [];
  }

  const safeTotal = normalizeTotalScore(totalScore);
  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal % count;

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function allocateScoresFromWeights(weights: number[], targetTotal: number) {
  const safeTargetTotal = normalizeTotalScore(targetTotal);
  const safeWeights = weights.map((weight) => Math.max(0, weight));

  if (safeTargetTotal === 0) {
    return Array.from({ length: weights.length }, () => 0);
  }

  if (safeWeights.every((weight) => weight === 0)) {
    return distributeScore(safeTargetTotal, weights.length);
  }

  const scores = Array.from({ length: weights.length }, () => 0);
  let activeIndexes = weights.map((_, index) => index);
  let remainingTarget = safeTargetTotal;

  while (activeIndexes.length > 0 && remainingTarget > 0) {
    const activeWeightTotal = activeIndexes.reduce((sum, index) => sum + safeWeights[index], 0);

    if (activeWeightTotal <= 0) {
      const distributedScores = distributeScore(remainingTarget, activeIndexes.length);

      activeIndexes.forEach((index, position) => {
        scores[index] += distributedScores[position] ?? 0;
      });
      break;
    }

    const overflowingIndexes = activeIndexes.filter((index) => {
      const idealScore = (remainingTarget * safeWeights[index]) / activeWeightTotal;
      return idealScore >= MAX_DIMENSION_SCORE;
    });

    if (overflowingIndexes.length === 0) {
      const idealScores = activeIndexes.map((index) => {
        const idealScore = (remainingTarget * safeWeights[index]) / activeWeightTotal;
        const flooredScore = Math.floor(idealScore);
        scores[index] += flooredScore;
        return {
          index,
          idealScore,
          flooredScore,
        };
      });

      let remainder = remainingTarget - idealScores.reduce((sum, item) => sum + item.flooredScore, 0);
      const remainderCandidates = idealScores
        .map((item) => ({
          index: item.index,
          fraction: item.idealScore - item.flooredScore,
          weight: safeWeights[item.index],
        }))
        .sort((a, b) => b.fraction - a.fraction || b.weight - a.weight || a.index - b.index);

      let cursor = 0;
      while (remainder > 0 && remainderCandidates.length > 0) {
        const candidate = remainderCandidates[cursor % remainderCandidates.length];

        if (scores[candidate.index] < MAX_DIMENSION_SCORE) {
          scores[candidate.index] += 1;
          remainder -= 1;
        }

        cursor += 1;
      }

      break;
    }

    overflowingIndexes.forEach((index) => {
      scores[index] = MAX_DIMENSION_SCORE;
    });

    activeIndexes = activeIndexes.filter((index) => !overflowingIndexes.includes(index));
    remainingTarget = safeTargetTotal - scores.reduce((sum, score) => sum + score, 0);
  }

  return scores;
}

export function buildDimensionScores(feedback: string, totalScore: number): DimensionScore[] {
  const safeTotalScore = normalizeTotalScore(totalScore);
  const validScoreMap = parseDimensionScoreMap(feedback);
  const rawScoreMap = parseDimensionScoreMap(feedback, { allowOutOfRange: true });
  const validDimensionCount = Object.keys(validScoreMap).length;
  const validDimensionTotal = sumDimensionScores(validScoreMap);

  if (validDimensionCount === DIMENSION_NAMES.length && validDimensionTotal === safeTotalScore) {
    return DIMENSION_NAMES.map((name) => ({
      name,
      score: validScoreMap[name] ?? 0,
    }));
  }

  if (validDimensionCount > 0 && validDimensionCount < DIMENSION_NAMES.length) {
    const missingNames = DIMENSION_NAMES.filter((name) => validScoreMap[name] === undefined);
    const remainingScore = safeTotalScore - validDimensionTotal;

    if (remainingScore >= 0 && remainingScore <= missingNames.length * MAX_DIMENSION_SCORE) {
      const distributedScores = distributeScore(remainingScore, missingNames.length);
      let distributedIndex = 0;

      return DIMENSION_NAMES.map((name) => {
        if (validScoreMap[name] !== undefined) {
          return {
            name,
            score: validScoreMap[name] ?? 0,
          };
        }

        const score = distributedScores[distributedIndex] ?? 0;
        distributedIndex += 1;

        return {
          name,
          score,
        };
      });
    }
  }

  const baseWeights = DIMENSION_NAMES.map((name) => {
    const rawScore = rawScoreMap[name];
    if (typeof rawScore === 'number') {
      return clampScore(rawScore, MAX_DIMENSION_SCORE);
    }

    return validScoreMap[name] ?? 0;
  });

  const normalizedScores = allocateScoresFromWeights(baseWeights, safeTotalScore);

  return DIMENSION_NAMES.map((name, index) => ({
    name,
    score: normalizedScores[index] ?? 0,
  }));
}

export function replaceDimensionScores(feedback: string, dimensionScores: DimensionScore[]) {
  if (!feedback) {
    return feedback;
  }

  const scoreMap = dimensionScores.reduce<Record<string, number>>((result, item) => {
    result[item.name] = item.score;
    return result;
  }, {});

  return feedback.replace(new RegExp(DIMENSION_SCORE_REGEX), (_, name: DimensionName) => {
    const safeScore = scoreMap[name] ?? 0;
    return `${name}：${safeScore}分`;
  });
}

export function replaceTotalScore(feedback: string, totalScore: number) {
  if (!feedback || !feedback.match(TOTAL_SCORE_REGEX)) {
    return feedback;
  }

  return feedback.replace(TOTAL_SCORE_REGEX, `总分：${normalizeTotalScore(totalScore)}分`);
}

export function normalizeInterviewFeedback(feedback: string, totalScore: number) {
  const dimensionScores = buildDimensionScores(feedback, totalScore);
  const normalizedTotalScore = dimensionScores.reduce((sum, item) => sum + item.score, 0);

  return {
    feedback: replaceTotalScore(
      replaceDimensionScores(feedback, dimensionScores),
      normalizedTotalScore
    ),
    totalScore: normalizedTotalScore,
    dimensionScores,
  };
}
