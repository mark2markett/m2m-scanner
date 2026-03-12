import 'server-only';
import { Redis } from '@upstash/redis';
import type { ScannerStockResult, ScannerResult, ScanBatchStatus } from '@/lib/types';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const KEYS = {
  scanStatus: (date: string) => `scan:status:${date}`,
  sliceResult: (date: string, start: number, end: number) => `scan:slice:${date}:${start}-${end}`,
  batchResult: (date: string, batch: number) => `scan:batch:${date}:${batch}`,
  latestResult: 'scan:latest',
  latestDate: 'scan:latest-date',
};

// TTL: keep scan data for 48 hours
const SCAN_TTL_SECONDS = 48 * 60 * 60;

export class KVStore {
  // --- Scan Status ---

  static async setScanStatus(status: ScanBatchStatus): Promise<void> {
    await redis.set(KEYS.scanStatus(status.scanDate), JSON.stringify(status), { ex: SCAN_TTL_SECONDS });
    await redis.set(KEYS.latestDate, status.scanDate, { ex: SCAN_TTL_SECONDS });
  }

  static async getScanStatus(date: string): Promise<ScanBatchStatus | null> {
    return redis.get<ScanBatchStatus>(KEYS.scanStatus(date));
  }

  static async getLatestScanStatus(): Promise<ScanBatchStatus | null> {
    const date = await redis.get<string>(KEYS.latestDate);
    if (!date) return null;
    return this.getScanStatus(date);
  }

  // --- Slice Results ---

  static async setSliceResults(date: string, start: number, end: number, results: ScannerStockResult[]): Promise<void> {
    await redis.set(KEYS.sliceResult(date, start, end), JSON.stringify(results), { ex: SCAN_TTL_SECONDS });
  }

  static async getSliceResults(date: string, start: number, end: number): Promise<ScannerStockResult[] | null> {
    return redis.get<ScannerStockResult[]>(KEYS.sliceResult(date, start, end));
  }

  // --- Batch Results (legacy, kept for compatibility) ---

  static async setBatchResults(date: string, batch: number, results: ScannerStockResult[]): Promise<void> {
    await redis.set(KEYS.batchResult(date, batch), JSON.stringify(results), { ex: SCAN_TTL_SECONDS });
  }

  static async getBatchResults(date: string, batch: number): Promise<ScannerStockResult[] | null> {
    return redis.get<ScannerStockResult[]>(KEYS.batchResult(date, batch));
  }

  // --- Final Results ---

  static async setLatestResult(result: ScannerResult): Promise<void> {
    await redis.set(KEYS.latestResult, JSON.stringify(result), { ex: SCAN_TTL_SECONDS });
    await redis.set(KEYS.latestDate, result.scanDate, { ex: SCAN_TTL_SECONDS });
  }

  static async getLatestResult(): Promise<ScannerResult | null> {
    return redis.get<ScannerResult>(KEYS.latestResult);
  }
}
