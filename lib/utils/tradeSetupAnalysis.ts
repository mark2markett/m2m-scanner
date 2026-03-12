import type { TechnicalIndicators as TI, M2MScorecard, M2MScoreFactor } from '@/lib/types';

export type SetupStage = 'Setup Forming' | 'Just Triggered' | 'Mid Setup' | 'Late Setup' | 'No Setup';

const PUBLICATION_THRESHOLD = 65;
const REQUIRED_FACTORS_PASSED = 3;
const TOTAL_FACTORS = 4;

export class TradeSetupAnalyzer {
  static analyzeSetupStage(
    indicators: TI,
    currentPrice: number,
    support: number[],
    resistance: number[],
    recentPrices: number[],
    volumes: number[]
  ): SetupStage {
    const { rsi, macd, ema20, ema50, bollingerBands } = indicators;

    const nearResistance = resistance.some(r => Math.abs(currentPrice - r) / currentPrice < 0.02);
    const nearSupport = support.some(s => Math.abs(currentPrice - s) / currentPrice < 0.02);
    const recentBreakout = this.checkRecentBreakout(recentPrices, resistance, support);

    const macdBullish = macd.macd > macd.signal;
    const emaBullish = ema20 > ema50;
    const rsiBullish = rsi > 50 && rsi < 80;

    // Volume confirmation: recent 5-bar avg >= 80% of 20-bar avg
    const hasVolumeConfirmation = this.checkVolumeConfirmation(volumes);

    // Moving average alignment: price and EMAs stacked in same direction
    const maAligned = (currentPrice > ema20 && ema20 > ema50) || (currentPrice < ema20 && ema20 < ema50);

    const macdMagnitude = Math.abs(macd.macd);
    const histogramRatio = macdMagnitude > 0 ? Math.abs(macd.histogram) / macdMagnitude : 0;
    const recentMacdCross = histogramRatio < 0.15;

    // Late Setup: extreme RSI indicates exhaustion — classify first to avoid false triggers
    if (rsi > 80 || rsi < 20) {
      return 'Late Setup';
    }

    // Just Triggered: requires breakout + MACD cross + volume confirmation
    if (recentBreakout && recentMacdCross && hasVolumeConfirmation) {
      return 'Just Triggered';
    }

    // Mid Setup: all signals aligned + MA stacked + not near resistance + volume
    if (rsiBullish && emaBullish && macdBullish && !nearResistance && maAligned) {
      if (currentPrice > bollingerBands.upper || rsi > 75) {
        return 'Late Setup';
      }
      if (hasVolumeConfirmation) {
        return 'Mid Setup';
      }
    }

    // Setup Forming: near key S/R level + MA alignment + not a breakout
    if ((nearSupport || nearResistance) && maAligned && !recentBreakout) {
      return 'Setup Forming';
    }

    // No Setup: conditions not met — no catch-all inflation
    return 'No Setup';
  }

  private static checkVolumeConfirmation(volumes: number[]): boolean {
    if (volumes.length < 20) return false;
    const recent5 = volumes.slice(-5);
    const avg5 = recent5.reduce((a, b) => a + b, 0) / recent5.length;
    const avg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    return avg20 > 0 && (avg5 / avg20) >= 0.8;
  }

  private static checkRecentBreakout(recentPrices: number[], resistance: number[], support: number[]): boolean {
    if (recentPrices.length < 3) return false;

    const currentPrice = recentPrices[recentPrices.length - 1];
    const previousPrices = recentPrices.slice(-5, -1);

    const brokeResistance = resistance.some(r =>
      currentPrice > r && previousPrices.some(p => p < r * 0.98)
    );

    const brokeSupport = support.some(s =>
      currentPrice < s && previousPrices.some(p => p > s * 1.02)
    );

    return brokeResistance || brokeSupport;
  }

  /**
   * M2M 4-Factor Scoring System (100pts total)
   *
   * 1. Strategy Signal Strength (30 pts)
   * 2. Technical Structure (25 pts)
   * 3. Short Interest Alignment (25 pts) — flow-based proxy using CMF + volume
   * 4. Risk/Reward Ratio (20 pts)
   */
  static calculateM2MScorecard(
    indicators: TI,
    setupStage: SetupStage,
    volatilityRegime: 'High' | 'Normal' | 'Low',
    currentPrice: number,
    support: number[],
    resistance: number[],
    volumes: number[]
  ): M2MScorecard {
    const factors: M2MScoreFactor[] = [
      this.scoreStrategySignalStrength(indicators),
      this.scoreTechnicalStructure(indicators, setupStage, currentPrice),
      this.scoreShortInterestAlignment(indicators, currentPrice, volumes),
      this.scoreRiskReward(indicators, currentPrice, support, resistance),
    ];

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxScore = factors.reduce((sum, f) => sum + f.maxPoints, 0);
    const factorsPassed = factors.filter(f => f.passed).length;

    const meetsPublicationThreshold = totalScore >= PUBLICATION_THRESHOLD;
    const meetsMultiFactorRule = factorsPassed >= REQUIRED_FACTORS_PASSED;
    const publishable = meetsPublicationThreshold && meetsMultiFactorRule;

    return {
      totalScore,
      maxScore,
      factorsPassed,
      totalFactors: TOTAL_FACTORS,
      meetsPublicationThreshold,
      meetsMultiFactorRule,
      publishable,
      factors,
    };
  }

  private static scoreStrategySignalStrength(indicators: TI): M2MScoreFactor {
    const maxPoints = 30;
    let score = 0;
    const reasons: string[] = [];

    const { rsi, macd, ema20, ema50 } = indicators;

    const emaBullish = ema20 > ema50;
    const macdBullish = macd.macd > macd.signal;
    const rsiBullish = rsi > 50;

    const allBullish = emaBullish && macdBullish && rsiBullish;
    const allBearish = !emaBullish && !macdBullish && !rsiBullish;

    if (allBullish || allBearish) {
      score += 18;
      reasons.push(`All 3 signals aligned ${allBullish ? 'bullish' : 'bearish'}`);
    } else {
      let aligned = 0;
      if (emaBullish) aligned++;
      if (macdBullish) aligned++;
      if (rsiBullish) aligned++;
      score += aligned * 5;
      reasons.push(`${aligned}/3 signals aligned`);
    }

    if (rsi > 30 && rsi < 70) {
      score += 6;
      reasons.push('RSI in healthy range');
    }

    if (Math.abs(macd.histogram) > 0) {
      const histogramDirectionMatchesMacd =
        (macd.macd > 0 && macd.histogram > 0) ||
        (macd.macd < 0 && macd.histogram < 0);
      if (histogramDirectionMatchesMacd) {
        score += 6;
        reasons.push('MACD histogram confirms momentum');
      }
    }

    score = Math.min(score, maxPoints);
    const passed = score >= maxPoints * 0.5;

    return { name: 'Strategy Signal Strength', maxPoints, score, passed, rationale: reasons.join('; ') };
  }

  private static scoreTechnicalStructure(indicators: TI, setupStage: SetupStage, currentPrice: number): M2MScoreFactor {
    const maxPoints = 25;
    let score = 0;
    const reasons: string[] = [];

    if (indicators.adx > 25) {
      score += 8;
      reasons.push('ADX confirms trend strength');
    } else if (indicators.adx > 20) {
      score += 4;
      reasons.push('ADX shows moderate trend');
    } else {
      reasons.push('ADX weak — no clear trend');
    }

    const { upper, lower } = indicators.bollingerBands;
    const bbPosition = (currentPrice - lower) / (upper - lower);
    if (bbPosition > 0.2 && bbPosition < 0.8) {
      score += 5;
      reasons.push('Price within Bollinger mid-zone');
    } else {
      score += 2;
      reasons.push(bbPosition >= 0.8 ? 'Price near upper Bollinger' : 'Price near lower Bollinger');
    }

    switch (setupStage) {
      case 'Just Triggered': score += 9; reasons.push('Setup just triggered'); break;
      case 'Mid Setup': score += 7; reasons.push('Mid-setup progression'); break;
      case 'Setup Forming': score += 4; reasons.push('Setup still forming'); break;
      case 'Late Setup': score += 1; reasons.push('Late-stage setup — extended'); break;
      case 'No Setup': score += 0; reasons.push('No actionable setup detected'); break;
    }

    const { k } = indicators.stochastic;
    if (k > 20 && k < 80) {
      score += 3;
      reasons.push('Stochastic in healthy range');
    }

    score = Math.min(score, maxPoints);
    const passed = score >= maxPoints * 0.5;

    return { name: 'Technical Structure', maxPoints, score, passed, rationale: reasons.join('; ') };
  }

  /**
   * Short Interest Alignment (25pts)
   * Uses CMF + volume trends as a flow-based proxy for institutional positioning.
   * No Ortex/short interest data source available — CMF measures accumulation/distribution
   * and volume trends confirm institutional conviction.
   */
  private static scoreShortInterestAlignment(
    indicators: TI,
    currentPrice: number,
    volumes: number[]
  ): M2MScoreFactor {
    const maxPoints = 25;
    let score = 0;
    const reasons: string[] = [];

    // 1. CMF direction & magnitude (up to 10pts)
    const cmf = indicators.cmf;
    if (cmf > 0.15) {
      score += 10;
      reasons.push(`Strong accumulation (CMF: ${cmf.toFixed(2)})`);
    } else if (cmf > 0.05) {
      score += 7;
      reasons.push(`Moderate accumulation (CMF: ${cmf.toFixed(2)})`);
    } else if (cmf > -0.05) {
      score += 4;
      reasons.push(`Neutral flow (CMF: ${cmf.toFixed(2)})`);
    } else if (cmf > -0.15) {
      score += 2;
      reasons.push(`Moderate distribution (CMF: ${cmf.toFixed(2)})`);
    } else {
      reasons.push(`Heavy distribution (CMF: ${cmf.toFixed(2)})`);
    }

    // 2. Volume trend (up to 8pts) — compare last 5 bars avg to 20-bar avg
    if (volumes.length >= 20) {
      const recent5 = volumes.slice(-5);
      const avg5 = recent5.reduce((a, b) => a + b, 0) / recent5.length;
      const avg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const volumeRatio = avg20 > 0 ? avg5 / avg20 : 1;

      if (volumeRatio > 1.5) {
        score += 8;
        reasons.push('Volume surge — strong institutional interest');
      } else if (volumeRatio > 1.1) {
        score += 5;
        reasons.push('Above-average volume — accumulation signal');
      } else if (volumeRatio > 0.8) {
        score += 3;
        reasons.push('Normal volume activity');
      } else {
        score += 1;
        reasons.push('Below-average volume — low conviction');
      }
    } else {
      score += 3;
      reasons.push('Insufficient volume history');
    }

    // 3. Flow-price alignment (up to 7pts)
    const priceAboveEma = currentPrice > indicators.ema20;
    const cmfPositive = cmf > 0;
    const aligned = (priceAboveEma && cmfPositive) || (!priceAboveEma && !cmfPositive);

    if (aligned) {
      score += 7;
      reasons.push('Flow direction confirms price trend');
    } else {
      score += 2;
      reasons.push('Flow diverges from price trend — caution');
    }

    score = Math.min(score, maxPoints);
    const passed = score >= maxPoints * 0.5;

    return { name: 'Short Interest Alignment', maxPoints, score, passed, rationale: reasons.join('; ') };
  }

  private static scoreRiskReward(indicators: TI, currentPrice: number, support: number[], resistance: number[]): M2MScoreFactor {
    const maxPoints = 20;
    let score = 0;
    const reasons: string[] = [];

    const validSupport = support.filter(s => s < currentPrice * 0.99);
    const validResistance = resistance.filter(r => r > currentPrice * 1.01);

    const nearestSupport = validSupport.length > 0 ? validSupport[0] : currentPrice * 0.95;
    const nearestResistance = validResistance.length > 0 ? validResistance[0] : currentPrice * 1.05;

    const risk = Math.abs(currentPrice - nearestSupport);
    const reward = Math.abs(nearestResistance - currentPrice);
    const rrRatio = risk > 0 ? reward / risk : 0;

    if (rrRatio >= 3) { score += 20; reasons.push(`Excellent R/R ratio: ${rrRatio.toFixed(1)}:1`); }
    else if (rrRatio >= 2) { score += 15; reasons.push(`Good R/R ratio: ${rrRatio.toFixed(1)}:1`); }
    else if (rrRatio >= 1.5) { score += 10; reasons.push(`Acceptable R/R ratio: ${rrRatio.toFixed(1)}:1`); }
    else if (rrRatio >= 1) { score += 5; reasons.push(`Marginal R/R ratio: ${rrRatio.toFixed(1)}:1`); }
    else { reasons.push(`Poor R/R ratio: ${rrRatio.toFixed(1)}:1`); }

    const passed = score >= maxPoints * 0.5;

    return { name: 'Risk/Reward Ratio', maxPoints, score, passed, rationale: reasons.join('; ') };
  }
}
