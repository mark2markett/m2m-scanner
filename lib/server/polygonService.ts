import 'server-only';
import { CacheService } from './cacheService';

const BASE_URL = 'https://api.polygon.io/v2';
const REST_URL = 'https://api.polygon.io/v3';

const POLYGON_CACHE_TTL = 5; // 5 minutes

function getApiKey(): string {
  const key = process.env.POLYGON_API_KEY;
  if (!key || key === 'your_polygon_api_key_here') {
    throw new Error('Polygon API key not configured.');
  }
  return key;
}

export class PolygonService {
  static async getStockDetails(symbol: string) {
    const cacheKey = `stock-details-${symbol}`;
    const cached = CacheService.get(cacheKey);
    if (cached) return cached;

    const apiKey = getApiKey();

    const detailsUrl = `${REST_URL}/reference/tickers/${symbol}?apikey=${apiKey}`;
    const detailsResponse = await fetch(detailsUrl);

    if (!detailsResponse.ok) {
      throw new Error(`Failed to fetch ticker details: ${detailsResponse.status}`);
    }

    const detailsData = await detailsResponse.json();

    const snapshotUrl = `${BASE_URL}/snapshot/locale/us/markets/stocks/tickers/${symbol}?apikey=${apiKey}`;
    const snapshotResponse = await fetch(snapshotUrl);

    if (!snapshotResponse.ok) {
      throw new Error(`Failed to fetch snapshot data: ${snapshotResponse.status}`);
    }

    const snapshotData = await snapshotResponse.json();

    if (!snapshotData.ticker) {
      throw new Error('No snapshot data available from Polygon.io');
    }

    const ticker = snapshotData.ticker;
    const currentPrice = ticker.lastTrade?.p || ticker.day?.c || ticker.prevDay?.c;
    const previousClose = ticker.prevDay?.c || currentPrice;
    const volume = ticker.day?.v || ticker.prevDay?.v || 0;

    const change = previousClose > 0 ? currentPrice - previousClose : 0;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    const result = {
      symbol: symbol.toUpperCase(),
      name: detailsData.results?.name || `${symbol.toUpperCase()} Corporation`,
      price: currentPrice,
      change,
      changePercent,
      volume: volume || 0,
      marketCap: detailsData.results?.market_cap || 0,
      peRatio: 0,
      lastUpdated: new Date().toISOString()
    };

    CacheService.set(cacheKey, result, POLYGON_CACHE_TTL);
    return result;
  }

  static async getHistoricalData(symbol: string, timeframe: string = 'day', limit: number = 50) {
    const cacheKey = `historical-${symbol}-${timeframe}-${limit}`;
    const cached = CacheService.get(cacheKey);
    if (cached) return cached;

    const apiKey = getApiKey();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (limit + 10));

    const multiplier = timeframe === 'week' ? 1 : timeframe === '4hour' ? 4 : 1;
    const timespan = timeframe === 'week' ? 'week' : timeframe === '4hour' ? 'hour' : 'day';

    const histUrl = `${BASE_URL}/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=${limit}&apikey=${apiKey}`;
    const response = await fetch(histUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error('No historical data available from Polygon.io');
    }

    const result = data.results.map((bar: any) => ({
      timestamp: new Date(bar.t).toISOString(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v
    }));

    CacheService.set(cacheKey, result, POLYGON_CACHE_TTL);
    return result;
  }
}
