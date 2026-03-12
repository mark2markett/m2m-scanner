import 'server-only';
import type { NewsItem } from '@/lib/types';
import { analyzeSentimentFromTitle, analyzeSentiment } from '@/lib/utils/sentimentAnalysis';
import { CacheService } from './cacheService';

export { analyzeSentiment };

const NEWS_CACHE_TTL = 15; // 15 minutes

export class NewsService {
  static async getStockNews(symbol: string, limit: number = 5): Promise<NewsItem[]> {
    const cacheKey = `news-${symbol}-${limit}`;
    const cached = CacheService.get(cacheKey);
    if (cached) return cached;

    const apiKey = process.env.POLYGON_API_KEY;

    if (!apiKey || apiKey === 'your_polygon_api_key_here') {
      throw new Error('Polygon API key not configured.');
    }

    const newsUrl = `https://api.polygon.io/v2/reference/news?ticker=${symbol}&limit=${limit}&apikey=${apiKey}`;
    const response = await fetch(newsUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch news: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return [];
    }

    const newsItems: NewsItem[] = data.results.slice(0, limit).map((article: any) => ({
      headline: article.title,
      sentiment: analyzeSentimentFromTitle(article.title),
      date: article.published_utc,
      source: article.publisher?.name || 'Unknown'
    }));

    CacheService.set(cacheKey, newsItems, NEWS_CACHE_TTL);
    return newsItems;
  }

  static analyzeSentiment = analyzeSentiment;
}
