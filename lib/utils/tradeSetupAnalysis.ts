import type { TechnicalIndicators as TI, M2MScorecard, M2MScoreFactor, NewsItem, OptionsData } from '@/lib/types';
import { analyzeSentiment } from '@/lib/utils/sentimentAnalysis';

export type SetupStage = 'Setup Forming' | 'Just Triggered' | 'Mid Setup' | 'Late Setup';

const PUBLICATION_THRESHOLD = 65;
const REQUIRED_FACTORS_PASSED = 3;
const TOTAL_FACTORS = 5;

export class TradeSetupAnalyzer {
  static analyzeSetupStage(
    indicators: TI,
    currentPrice: number,
    support: number[],
    resistance: number[],
    recentPrices: number[]
  ): SetupStage {
    const { rsi, macd, ema20, ema50, bollingerBands } = indicators;

    const nearResistance = resistance.some(r => Math.abs(currentPrice - r) / currentPrice < 0.02);
    const nearSupport = support.some(s => Math.abs(currentPrice - s) / currentPrice < 0.02);
    const recentBreakout = this.checkRecentBreakout(recentPrices, resistance, support);

    const macdBullish = macd.macd > macd.signal;
    const emaBullish = ema20 > ema50;
    const rsiBullish = rsi > 50 && rsi < 80;

    const macdMagnitude = Math.abs(macd.macd);
    const histogramRatio = macdMagnitude > 0 ? Math.abs(macd.histogram) / macdMagnitude : 0;
    const recentMacdCross = histogramRatio < 0.15;

    if (recentBreakout && recentMacdCross) {
      return 'Just Triggered';
    } else if (rsiBullish && emaBullish && macdBullish && !nearResistance) {
      if (rsi > 75 || (currentPrice > bollingerBands.upper)) {
        return 'Late Setup';
      } else {
        return 'Mid Setup';
      }
    } else if ((nearSupport || nearResistance) && !recentBreakout) {
      return 'Setup Forming';
    } else if (rsi > 80 || rsi < 20) {
      return 'Late Setup';
    } else {
      return 'Setup Forming';
    }
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
   * M2M 5-Factor Scoring System
   *
   * 1. Strategy Signal Strength (30 pts)
   * 2. Technical Structure (25 pts)
   * 3. Options Quality (25 pts)
   * 4. Risk/Reward Ratio (10 pts)
   * 5. Catalyst Presence (10 pts)
   */
  static calculateM2MScorecard(
    indicators: TI,
    setupStage: SetupStage,
    volatilityRegime: 'High' | 'Normal' | 'Low',
    newsData: NewsItem[],
    currentPrice: number,
    support: number[],
    resistance: number[],
    optionsData?: OptionsData | null
  ): M2MScorecard {
    const factors: M2MScoreFactor[] = [
      this.scoreStrategySignalStrength(indicators),
      this.scoreTechnicalStructure(indicators, setupStage, currentPrice),
      this.scoreOptionsQuality(optionsData || null, indicators.atr, currentPrice),
      this.scoreRiskReward(indicators, currentPrice, support, resistance),
      this.scoreCatalystPresence(newsData),
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

  private static scoreOptionsQuality(optionsData: OptionsData | null, atr: number, currentPrice: number): M2MScoreFactor {
    const maxPoints = 25;

    if (!optionsData) {
      return {
        name: 'Options Quality',
        maxPoints,
        score: 13,
        passed: true,
        rationale: 'Options data unavailable — neutral score applied.',
      };
    }

    let score = 0;
    const reasons: string[] = [];

    const totalVolume = optionsData.totalCallVolume + optionsData.totalPutVolume;
    const totalOI = optionsData.totalCallOI + optionsData.totalPutOI;
    if (totalVolume > 10000 && totalOI > 50000) { score += 10; reasons.push('Excellent options liquidity'); }
    else if (totalVolume > 5000 && totalOI > 20000) { score += 7; reasons.push('Good options liquidity'); }
    else if (totalVolume > 1000 && totalOI > 5000) { score += 4; reasons.push('Moderate options liquidity'); }
    else { score += 1; reasons.push('Low options liquidity'); }

    const pcr = optionsData.putCallRatio;
    if (pcr < 0.7) { score += 8; reasons.push(`Bullish P/C ratio: ${pcr.toFixed(2)}`); }
    else if (pcr <= 1.0) { score += 5; reasons.push(`Neutral P/C ratio: ${pcr.toFixed(2)}`); }
    else { score += 2; reasons.push(`Bearish P/C ratio: ${pcr.toFixed(2)}`); }

    const realizedVol = (atr / currentPrice) * Math.sqrt(252) * 100;
    const avgIV = optionsData.avgImpliedVolatility * 100;
    const ivRatio = avgIV > 0 ? realizedVol / avgIV : 1;

    if (ivRatio > 0.8 && ivRatio < 1.2) { score += 7; reasons.push('IV fairly priced vs realized vol'); }
    else if (ivRatio >= 1.2) { score += 5; reasons.push('IV below realized vol — options cheap'); }
    else { score += 3; reasons.push('IV elevated vs realized vol — options expensive'); }

    score = Math.min(score, maxPoints);
    const passed = score >= maxPoints * 0.5;

    return { name: 'Options Quality', maxPoints, score, passed, rationale: reasons.join('; ') };
  }

  private static scoreRiskReward(indicators: TI, currentPrice: number, support: number[], resistance: number[]): M2MScoreFactor {
    const maxPoints = 10;
    let score = 0;
    const reasons: string[] = [];

    const validSupport = support.filter(s => s < currentPrice * 0.99);
    const validResistance = resistance.filter(r => r > currentPrice * 1.01);

    const nearestSupport = validSupport.length > 0 ? validSupport[0] : currentPrice * 0.95;
    const nearestResistance = validResistance.length > 0 ? validResistance[0] : currentPrice * 1.05;

    const risk = Math.abs(currentPrice - nearestSupport);
    const reward = Math.abs(nearestResistance - currentPrice);
    const rrRatio = risk > 0 ? reward / risk : 0;

    if (rrRatio >= 3) { score += 10; reasons.push(`Excellent R/R ratio: ${rrRatio.toFixed(1)}:1`); }
    else if (rrRatio >= 2) { score += 7; reasons.push(`Good R/R ratio: ${rrRatio.toFixed(1)}:1`); }
    else if (rrRatio >= 1.5) { score += 5; reasons.push(`Acceptable R/R ratio: ${rrRatio.toFixed(1)}:1`); }
    else if (rrRatio >= 1) { score += 3; reasons.push(`Marginal R/R ratio: ${rrRatio.toFixed(1)}:1`); }
    else { reasons.push(`Poor R/R ratio: ${rrRatio.toFixed(1)}:1`); }

    const passed = score >= maxPoints * 0.5;

    return { name: 'Risk/Reward Ratio', maxPoints, score, passed, rationale: reasons.join('; ') };
  }

  private static scoreCatalystPresence(newsData: NewsItem[]): M2MScoreFactor {
    const maxPoints = 10;
    let score = 0;
    const reasons: string[] = [];

    if (newsData.length === 0) {
      score = 3;
      reasons.push('No recent news — neutral catalyst environment');
    } else {
      const sentiment = analyzeSentiment(newsData);

      if (sentiment === 'Positive') {
        score = 10;
        reasons.push('Positive news sentiment provides catalyst support');
      } else if (sentiment === 'Neutral') {
        score = 5;
        reasons.push('Neutral news sentiment — no catalyst headwind or tailwind');
      } else {
        score = 1;
        reasons.push('Negative news sentiment presents catalyst headwind');
      }
    }

    const passed = score >= maxPoints * 0.5;

    return { name: 'Catalyst Presence', maxPoints, score, passed, rationale: reasons.join('; ') };
  }
}
