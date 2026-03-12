export interface RelativeStrengthData {
  rs10: number;
  rs20: number;
  rs50: number;
}

/**
 * Calculate relative strength of a stock vs SPY over multiple periods.
 * RS > 1 means outperforming SPY, RS < 1 means underperforming.
 */
export function calculateRelativeStrength(
  stockCloses: number[],
  spyCloses: number[],
): RelativeStrengthData {
  return {
    rs10: calcPeriodRS(stockCloses, spyCloses, 10),
    rs20: calcPeriodRS(stockCloses, spyCloses, 20),
    rs50: calcPeriodRS(stockCloses, spyCloses, 50),
  };
}

function calcPeriodRS(stockCloses: number[], spyCloses: number[], period: number): number {
  if (stockCloses.length < period + 1 || spyCloses.length < period + 1) return 1;

  const stockReturn = stockCloses[stockCloses.length - 1] / stockCloses[stockCloses.length - 1 - period];
  const spyReturn = spyCloses[spyCloses.length - 1] / spyCloses[spyCloses.length - 1 - period];

  return spyReturn > 0 ? stockReturn / spyReturn : 1;
}
