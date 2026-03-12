import type { M2MScorecard, TechnicalIndicators, NewsItem } from '@/lib/types';

export interface QualityAssessment {
  setupQuality: 'high' | 'moderate' | 'low';
  signalConfidence: number;
  earlyStage: boolean;
  catalystPresent: boolean;
}

function computeSetupQuality(scorecard: M2MScorecard): 'high' | 'moderate' | 'low' {
  const pct = scorecard.maxScore > 0 ? (scorecard.totalScore / scorecard.maxScore) * 100 : 0;

  // Factor indices: [0]=Strategy Signal, [1]=Technical Structure, [2]=Short Interest Alignment, [3]=Risk/Reward
  const signalStrengthPasses = scorecard.factors[0].passed;
  const techStructurePasses = scorecard.factors[1].passed;
  const riskRewardPasses = scorecard.factors[3].passed;

  if (
    signalStrengthPasses &&
    techStructurePasses &&
    riskRewardPasses &&
    pct >= 70 &&
    scorecard.factorsPassed >= 3
  ) {
    return 'high';
  }

  if (pct >= 45 && scorecard.factorsPassed >= 2) {
    return 'moderate';
  }

  return 'low';
}

function computeConfidence(scorecard: M2MScorecard, indicators: TechnicalIndicators): number {
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

  const pct = scorecard.maxScore > 0 ? (scorecard.totalScore / scorecard.maxScore) * 100 : 50;
  const convictionScore = (Math.abs(pct - 50) / 50) * 100;

  return Math.round(
    consensusScore * 0.35 +
    adxScore * 0.25 +
    momentumScore * 0.25 +
    convictionScore * 0.15
  );
}

/**
 * Quality assessment for scanner stock analysis.
 */
export function assessQuality(
  scorecard: M2MScorecard,
  indicators: TechnicalIndicators,
  setupStage: string,
  newsData: NewsItem[]
): QualityAssessment {
  return {
    setupQuality: computeSetupQuality(scorecard),
    signalConfidence: computeConfidence(scorecard, indicators),
    earlyStage: setupStage === 'Setup Forming' || setupStage === 'Just Triggered',
    catalystPresent: newsData.some(n => n.sentiment === 'Positive'),
  };
}
