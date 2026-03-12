import 'server-only';
import { TechnicalIndicators } from '@/lib/utils/technicalIndicators';
import { SupportResistanceAnalyzer } from '@/lib/utils/supportResistance';
import { TradeSetupAnalyzer } from '@/lib/utils/tradeSetupAnalysis';
import { PolygonService } from './polygonService';
import { NewsService } from './newsService';
import { OpenAIService } from './openaiService';
import { assessQuality } from '@/lib/utils/qualityAssessment';
import type { SP500Stock, ScannerStockResult } from '@/lib/types';

const CONCURRENCY = 10;

async function analyzeStock(stock: SP500Stock): Promise<ScannerStockResult> {
  const historicalLimit = 120;
  const newsLimit = 3;

  const [stockData, historicalData, newsData] = await Promise.all([
    PolygonService.getStockDetails(stock.symbol),
    PolygonService.getHistoricalData(stock.symbol, 'day', historicalLimit),
    NewsService.getStockNews(stock.symbol, newsLimit),
  ]);

  const closes = historicalData.map((d: any) => d.close);
  const highs = historicalData.map((d: any) => d.high);
  const lows = historicalData.map((d: any) => d.low);
  const volumes = historicalData.map((d: any) => d.volume);

  const indicatorResults = TechnicalIndicators.computeIndicators(highs, lows, closes, volumes, 'daily');
  const indicators = indicatorResults.indicators;

  const pivots = SupportResistanceAnalyzer.findPivotPoints(highs, lows, closes);
  const { support, resistance } = SupportResistanceAnalyzer.getKeyLevels(pivots, stockData.price);

  const setupStage = TradeSetupAnalyzer.analyzeSetupStage(indicators, stockData.price, support, resistance, closes);

  const scorecard = TradeSetupAnalyzer.calculateM2MScorecard(
    indicators,
    setupStage,
    indicatorResults.regime as 'High' | 'Normal' | 'Low',
    newsData,
    stockData.price,
    support,
    resistance,
    null // skip options data for scanner
  );

  const macdSignal: 'bullish' | 'bearish' = indicators.macd.macd > indicators.macd.signal ? 'bullish' : 'bearish';
  const ema20above50 = indicators.ema20 > indicators.ema50;
  const priceAboveEma20 = stockData.price > indicators.ema20;
  const trendAlignment: 'bullish' | 'bearish' | 'neutral' =
    ema20above50 && priceAboveEma20 ? 'bullish' :
    !ema20above50 && !priceAboveEma20 ? 'bearish' : 'neutral';

  const sentiment = newsData.length > 0
    ? newsData.map(n => `${n.headline} (${n.sentiment})`).join('; ')
    : 'No significant news';

  // Algorithmic scoring — deterministic, transparent, consistent across runs
  const quality = assessQuality(scorecard, indicators, setupStage, false);
  const aiSetupQuality = quality.setupQuality;
  const aiConfidence = quality.signalConfidence;
  const aiEarlyStage = quality.earlyStage;
  const aiCatalystPresent = quality.catalystPresent;

  // AI narrative — contextual interpretation that algorithms can't do
  let aiKeySignal = '';
  let aiRisk = '';
  let aiSummary = '';

  try {
    const insight = await OpenAIService.generateScannerInsight({
      symbol: stock.symbol,
      price: stockData.price,
      change: stockData.changePercent,
      rsi: indicators.rsi,
      macd: indicators.macd.macd,
      signal: indicators.macd.signal,
      histogram: indicators.macd.histogram,
      ema20: indicators.ema20,
      ema50: indicators.ema50,
      adx: indicators.adx,
      atr: indicators.atr,
      bbLower: indicators.bollingerBands.lower,
      bbUpper: indicators.bollingerBands.upper,
      stochK: indicators.stochastic.k,
      stochD: indicators.stochastic.d,
      cmf: indicators.cmf,
      support,
      resistance,
      setupStage,
      volatilityRegime: indicatorResults.regime as string,
      score: scorecard.totalScore,
      maxScore: scorecard.maxScore,
      factorsPassed: scorecard.factorsPassed,
      totalFactors: scorecard.totalFactors,
      publishable: scorecard.publishable,
      sentiment,
    });

    aiKeySignal = insight.keySignal;
    aiRisk = insight.risk;
    aiSummary = insight.summary;
  } catch (err) {
    console.error(`[Scanner] AI narrative failed for ${stock.symbol}: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Build recommendation algorithmically (same logic as analysisEngine)
  const scoreSummary = `M2M Score: ${scorecard.totalScore}/${scorecard.maxScore} (${scorecard.factorsPassed}/${scorecard.totalFactors} factors passed).`;
  const recommendation = scorecard.publishable
    ? `${scoreSummary} Setup signals aligned.`
    : `${scoreSummary} Signals mixed or insufficient.`;

  return {
    symbol: stockData.symbol,
    name: stock.name,
    sector: stock.sector,
    price: stockData.price,
    change: stockData.change,
    changePercent: stockData.changePercent,
    volume: stockData.volume,
    marketCap: stockData.marketCap,
    m2mScore: scorecard.totalScore,
    m2mMaxScore: scorecard.maxScore,
    factorsPassed: scorecard.factorsPassed,
    totalFactors: scorecard.totalFactors,
    publishable: scorecard.publishable,
    setupStage,
    volatilityRegime: indicatorResults.regime as string,
    rsi: indicators.rsi,
    macdSignal,
    trendAlignment,
    recommendation: recommendation.slice(0, 300),
    aiSetupQuality,
    aiConfidence,
    aiEarlyStage,
    aiKeySignal,
    aiRisk,
    aiCatalystPresent,
    aiSummary,
    partial: false,
    analyzedAt: new Date().toISOString(),
  };
}

function mapToErrorResult(stock: SP500Stock, error: string): ScannerStockResult {
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    marketCap: 0,
    m2mScore: 0,
    m2mMaxScore: 0,
    factorsPassed: 0,
    totalFactors: 0,
    publishable: false,
    setupStage: 'Unknown',
    volatilityRegime: 'Normal',
    rsi: 0,
    macdSignal: 'bearish',
    trendAlignment: 'neutral',
    recommendation: '',
    aiSetupQuality: 'low',
    aiConfidence: 0,
    aiEarlyStage: false,
    aiKeySignal: '',
    aiRisk: '',
    aiCatalystPresent: false,
    aiSummary: '',
    partial: false,
    error,
    analyzedAt: new Date().toISOString(),
  };
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export class ScannerEngine {
  static async analyzeBatch(stocks: SP500Stock[]): Promise<ScannerStockResult[]> {
    const results: ScannerStockResult[] = [];

    await runWithConcurrency(stocks, async (stock) => {
      try {
        const result = await analyzeStock(stock);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        console.error(`[Scanner] Failed to analyze ${stock.symbol}: ${message}`);
        results.push(mapToErrorResult(stock, message));
      }
    }, CONCURRENCY);

    return results;
  }
}
