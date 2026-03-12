import type { M2MScorecard, TechnicalIndicators } from '@/lib/types';

export interface QualityAssessment {
  setupQuality: 'high' | 'moderate' | 'low';
  signalConfidence: number;
  earlyStage: boolean;
  catalystPresent: boolean;
}

/**
 * Adjusted scoring that removes the options factor inflation when options data is missing.
 */
export function getAdjustedScoring(scorecard: M2MScorecard, hasOptionsData: boolean) {
  if (hasOptionsData) {
    const pct = scorecard.maxScore > 0 ? (scorecard.totalScore / scorecard.maxScore) * 100 : 0;
    return {
      adjustedScore: scorecard.totalScore,
      adjustedMax: scorecard.maxScore,
      adjustedPct: pct,
      realFactorsPassed: scorecard.factorsPassed,
    };
  }

  const optionsFactor = scorecard.factors[2]; // Factor 3: Options Quality
  const adjustedScore = scorecard.totalScore - optionsFactor.score;
  const adjustedMax = scorecard.maxScore - optionsFactor.maxPoints;
  const adjustedPct = adjustedMax > 0 ? (adjustedScore / adjustedMax) * 100 : 0;
  const realFactorsPassed = scorecard.factorsPassed - (optionsFactor.passed ? 1 : 0);
  return { adjustedScore, adjustedMax, adjustedPct, realFactorsPassed };
}

function computeSetupQuality(scorecard: M2MScorecard, hasOptionsData: boolean): 'high' | 'moderate' | 'low' {
  const { adjustedPct, realFactorsPassed } = getAdjustedScoring(scorecard, hasOptionsData);

  const signalStrengthPasses = scorecard.factors[0].passed;
  const techStructurePasses = scorecard.factors[1].passed;
  const riskRewardPasses = scorecard.factors[3].passed;

  if (
    signalStrengthPasses &&
    techStructurePasses &&
    riskRewardPasses &&
    adjustedPct >= 70 &&
    realFactorsPassed >= 3
  ) {
    return 'high';
  }

  if (adjustedPct >= 45 && realFactorsPassed >= 2) {
    return 'moderate';
  }

  return 'low';
}

function computeConfidence(scorecard: M2MScorecard, indicators: TechnicalIndicators, hasOptionsData: boolean): number {
  const signals = [
    indicators.ema20 > indicators.ema50,
    indicators.macd.macd > indicators.macd.signal,
    indicators.rsi > 50,
    indicators.cmf > 0,
    indicators.stochastic.k > indicators.stochastic.d,
  ];
  const bullishCount = signals.filter(Boolean).length;
  const consensusRaw = Math.abs(bullishCount - 2.5) / 2.5;
  const consensusScore = consensusRaw * 100;

  const adxScore = Math.min(indicators.adx / 50, 1) * 100;

  const histConfirms =
    (indicators.macd.macd > 0 && indicators.macd.histogram > 0) ||
    (indicators.macd.macd < 0 && indicators.macd.histogram < 0);
  const rsiHealthy = indicators.rsi > 30 && indicators.rsi < 70;
  const stochHealthy = indicators.stochastic.k > 20 && indicators.stochastic.k < 80;
  const momentumScore = (histConfirms ? 40 : 0) + (rsiHealthy ? 30 : 0) + (stochHealthy ? 30 : 0);

  const { adjustedPct } = getAdjustedScoring(scorecard, hasOptionsData);
  const convictionScore = (Math.abs(adjustedPct - 50) / 50) * 100;

  const completenessScore = hasOptionsData ? 100 : 80;

  return Math.round(
    consensusScore * 0.30 +
    adxScore * 0.25 +
    momentumScore * 0.20 +
    convictionScore * 0.15 +
    completenessScore * 0.10
  );
}

/**
 * Quality assessment for scanner stock analysis.
 */
export function assessQuality(
  scorecard: M2MScorecard,
  indicators: TechnicalIndicators,
  setupStage: string,
  hasOptionsData: boolean
): QualityAssessment {
  return {
    setupQuality: computeSetupQuality(scorecard, hasOptionsData),
    signalConfidence: computeConfidence(scorecard, indicators, hasOptionsData),
    earlyStage: setupStage === 'Setup Forming' || setupStage === 'Just Triggered',
    catalystPresent: scorecard.factors[4].passed,
  };
}
