export interface PivotPoint {
  price: number;
  index: number;
  type: 'support' | 'resistance';
  strength: number;
}

export class SupportResistanceAnalyzer {
  // Find pivot points (swing highs and lows)
  static findPivotPoints(highs: number[], lows: number[], closes: number[], lookback: number = 5): PivotPoint[] {
    const pivots: PivotPoint[] = [];

    // Find swing highs
    for (let i = lookback; i < highs.length - lookback; i++) {
      const current = highs[i];
      let isSwingHigh = true;

      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && highs[j] >= current) {
          isSwingHigh = false;
          break;
        }
      }

      if (isSwingHigh) {
        pivots.push({
          price: current,
          index: i,
          type: 'resistance',
          strength: this.calculatePivotStrength(highs, lows, i, lookback, 'resistance')
        });
      }
    }

    // Find swing lows
    for (let i = lookback; i < lows.length - lookback; i++) {
      const current = lows[i];
      let isSwingLow = true;

      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && lows[j] <= current) {
          isSwingLow = false;
          break;
        }
      }

      if (isSwingLow) {
        pivots.push({
          price: current,
          index: i,
          type: 'support',
          strength: this.calculatePivotStrength(highs, lows, i, lookback, 'support')
        });
      }
    }

    return pivots.sort((a, b) => b.strength - a.strength);
  }

  private static calculatePivotStrength(highs: number[], lows: number[], index: number, lookback: number, type: 'support' | 'resistance'): number {
    let strength = 1;
    const pivotPrice = type === 'resistance' ? highs[index] : lows[index];
    const tolerance = pivotPrice * 0.015;

    const recentBars = Math.min(30, highs.length);
    const startIndex = Math.max(0, highs.length - recentBars);

    for (let i = startIndex; i < highs.length; i++) {
      if (i !== index) {
        if (Math.abs(highs[i] - pivotPrice) <= tolerance || Math.abs(lows[i] - pivotPrice) <= tolerance) {
          strength++;
        }
      }
    }

    const recency = highs.length - index;
    if (recency <= 10) {
      strength *= 1.5;
    } else if (recency <= 20) {
      strength *= 1.2;
    }

    return strength;
  }

  private static clusterLevels(levels: number[], tolerance: number = 0.015): number[] {
    if (levels.length === 0) return [];

    const clustered: number[] = [];
    const sorted = [...levels].sort((a, b) => a - b);

    let currentCluster: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(sorted[i] - sorted[i - 1]) / sorted[i - 1];

      if (diff <= tolerance) {
        currentCluster.push(sorted[i]);
      } else {
        clustered.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
        currentCluster = [sorted[i]];
      }
    }

    if (currentCluster.length > 0) {
      clustered.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
    }

    return clustered;
  }

  static getKeyLevels(pivots: PivotPoint[], currentPrice: number): { support: number[]; resistance: number[] } {
    const supportPrices = pivots
      .filter(p => p.type === 'support' && p.price < currentPrice * 0.99)
      .map(p => p.price);

    const resistancePrices = pivots
      .filter(p => p.type === 'resistance' && p.price > currentPrice * 1.01)
      .map(p => p.price);

    const clusteredSupport = this.clusterLevels(supportPrices, 0.015);
    const clusteredResistance = this.clusterLevels(resistancePrices, 0.015);

    const supportLevels = clusteredSupport
      .sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice))
      .slice(0, 3);

    const resistanceLevels = clusteredResistance
      .sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice))
      .slice(0, 3);

    return { support: supportLevels, resistance: resistanceLevels };
  }
}
