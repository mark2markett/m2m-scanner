// Technical Indicator Calculations - Matching Python implementation
export class TechnicalIndicators {
  // Calculate RSI using Wilder's smoothing method (standard RSI calculation)
  static rsi(prices: number[], period: number = 14): number[] {
    const result: number[] = [];

    if (prices.length < period + 1) return result;

    // Calculate price changes
    const deltas: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      deltas.push(prices[i] - prices[i - 1]);
    }

    // Separate gains and losses
    const gains = deltas.map(d => d > 0 ? d : 0);
    const losses = deltas.map(d => d < 0 ? -d : 0);

    // Calculate initial average gain and loss (simple average for first period)
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Calculate first RSI value
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));

    // Use Wilder's smoothing for subsequent values (alpha = 1/period)
    for (let i = period; i < gains.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }

    return result;
  }

  // Calculate EMA using span (matches pandas ewm)
  static ema(prices: number[], span: number): number[] {
    const result: number[] = [];
    const alpha = 2 / (span + 1);

    if (prices.length === 0) return result;

    let ema = prices[0];
    result.push(ema);

    for (let i = 1; i < prices.length; i++) {
      ema = alpha * prices[i] + (1 - alpha) * ema;
      result.push(ema);
    }

    return result;
  }

  // Calculate MACD using EMA spans
  static macd(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9) {
    const fastEma = this.ema(prices, fast);
    const slowEma = this.ema(prices, slow);

    // MACD line
    const macdLine: number[] = [];
    for (let i = 0; i < Math.min(fastEma.length, slowEma.length); i++) {
      macdLine.push(fastEma[i] - slowEma[i]);
    }

    // Signal line
    const signalLine = this.ema(macdLine, signal);

    return {
      macd: macdLine[macdLine.length - 1] || 0,
      signal: signalLine[signalLine.length - 1] || 0,
      histogram: (macdLine[macdLine.length - 1] || 0) - (signalLine[signalLine.length - 1] || 0),
      macdLine,
      signalLine
    };
  }

  // Calculate ATR using rolling mean
  static atr(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < 2) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    // Rolling mean for the period
    if (trueRanges.length < period) return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;

    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;
  }

  // Calculate Bollinger Bands using rolling mean and std
  static bollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
    if (prices.length < period) {
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      return { upper: mean, middle: mean, lower: mean };
    }

    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b, 0) / period;

    // Calculate standard deviation
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    return {
      upper: sma + (stdDev * std),
      middle: sma,
      lower: sma - (stdDev * std)
    };
  }

  // Calculate CMF (Chaikin Money Flow)
  static cmf(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 20): number {
    if (highs.length < period) return 0;

    const mfvs: number[] = [];

    for (let i = 0; i < highs.length; i++) {
      const range = highs[i] - lows[i];
      if (range === 0) {
        mfvs.push(0);
      } else {
        const mfMultiplier = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
        mfvs.push(mfMultiplier * volumes[i]);
      }
    }

    const recentMFV = mfvs.slice(-period).reduce((a, b) => a + b, 0);
    const recentVolume = volumes.slice(-period).reduce((a, b) => a + b, 0);

    return recentVolume === 0 ? 0 : recentMFV / recentVolume;
  }

  // Calculate Stochastics
  static stochastic(highs: number[], lows: number[], closes: number[], period: number = 14, dPeriod: number = 3) {
    const kValues: number[] = [];

    for (let i = period - 1; i < closes.length; i++) {
      const recentHighs = highs.slice(i - period + 1, i + 1);
      const recentLows = lows.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...recentHighs);
      const lowestLow = Math.min(...recentLows);

      const range = highestHigh - lowestLow;
      const k = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
      kValues.push(k);
    }

    // Calculate %D as rolling mean of %K
    const dValues: number[] = [];
    for (let i = dPeriod - 1; i < kValues.length; i++) {
      const recentK = kValues.slice(i - dPeriod + 1, i + 1);
      const d = recentK.reduce((a, b) => a + b, 0) / dPeriod;
      dValues.push(d);
    }

    return {
      k: kValues[kValues.length - 1] || 50,
      d: dValues[dValues.length - 1] || 50
    };
  }

  // Calculate ADX (Average Directional Index)
  static adx(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period * 2) return 0;

    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const trueRanges: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];

      let plusDMValue = 0;
      let minusDMValue = 0;

      if (highDiff > lowDiff && highDiff > 0) {
        plusDMValue = highDiff;
      }
      if (lowDiff > highDiff && lowDiff > 0) {
        minusDMValue = lowDiff;
      }

      plusDM.push(plusDMValue);
      minusDM.push(minusDMValue);

      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    const dxValues: number[] = [];

    for (let i = period - 1; i < trueRanges.length; i++) {
      const recentPlusDM = plusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      const recentMinusDM = minusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      const recentTR = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);

      if (recentTR === 0) continue;

      const plusDI = 100 * (recentPlusDM / recentTR);
      const minusDI = 100 * (recentMinusDM / recentTR);
      const diSum = plusDI + minusDI;

      if (diSum === 0) continue;

      const dx = (Math.abs(plusDI - minusDI) / diSum) * 100;
      dxValues.push(dx);
    }

    if (dxValues.length < period) {
      return dxValues.reduce((a, b) => a + b, 0) / dxValues.length;
    }

    const adxEma = this.ema(dxValues, period);
    return adxEma[adxEma.length - 1];
  }

  // Detect volatility regime
  static detectVolatilityRegime(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
    zThresh: number = 1.0
  ): 'high' | 'normal' | 'low' {
    const atr = this.atr(highs, lows, closes, period);
    const currentPrice = closes[closes.length - 1];
    const atrPct = (atr / currentPrice) * 100;

    const atrPcts: number[] = [];
    for (let i = period; i < closes.length; i++) {
      const historicalATR = this.atr(
        highs.slice(0, i + 1),
        lows.slice(0, i + 1),
        closes.slice(0, i + 1),
        period
      );
      atrPcts.push((historicalATR / closes[i]) * 100);
    }

    if (atrPcts.length === 0) return 'normal';

    const mean = atrPcts.reduce((a, b) => a + b, 0) / atrPcts.length;
    const variance = atrPcts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / atrPcts.length;
    const std = Math.sqrt(variance);

    if (atrPct > mean + zThresh * std) {
      return 'high';
    } else if (atrPct < mean - zThresh * std) {
      return 'low';
    } else {
      return 'normal';
    }
  }

  // Compute all indicators with adaptive periods based on volatility
  static computeIndicators(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    timeframe: 'daily' | 'weekly' | '4h' = 'daily'
  ) {
    const minBarsRequired = 20;
    if (closes.length < minBarsRequired) {
      throw new Error(`Insufficient data: required ${minBarsRequired}, got ${closes.length}`);
    }

    const regime = this.detectVolatilityRegime(highs, lows, closes);

    let baseFast: number, baseSlow: number, baseRsi: number;

    switch (timeframe) {
      case 'weekly':
        baseFast = 5;
        baseSlow = 13;
        baseRsi = 14;
        break;
      case '4h':
        baseFast = 8;
        baseSlow = 20;
        baseRsi = 14;
        break;
      default:
        baseFast = 20;
        baseSlow = 50;
        baseRsi = 14;
    }

    const fastSpan = baseFast;
    const slowSpan = baseSlow;
    const rsiPeriod = baseRsi;

    const fastEma = this.ema(closes, fastSpan);
    const slowEma = this.ema(closes, slowSpan);
    const rsi = this.rsi(closes, rsiPeriod);
    const macd = this.macd(closes, 12, 26, 9);
    const atr = this.atr(highs, lows, closes, 14);
    const bollingerBands = this.bollingerBands(closes, 20, 2);
    const cmf = this.cmf(highs, lows, closes, volumes, 20);
    const stochastic = this.stochastic(highs, lows, closes, 14, 3);
    const adx = this.adx(highs, lows, closes, 14);

    return {
      regime,
      fastSpan,
      slowSpan,
      rsiPeriod,
      indicators: {
        rsi: rsi[rsi.length - 1] || 50,
        macd: {
          macd: macd.macd,
          signal: macd.signal,
          histogram: macd.histogram
        },
        ema20: fastEma[fastEma.length - 1] || closes[closes.length - 1],
        ema50: slowEma[slowEma.length - 1] || closes[closes.length - 1],
        bollingerBands,
        atr,
        adx,
        stochastic,
        cmf
      }
    };
  }
}
