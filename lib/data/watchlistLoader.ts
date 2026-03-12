import 'server-only';
import fs from 'fs';
import path from 'path';
import type { SP500Stock } from '@/lib/types';
import { SP500_CONSTITUENTS } from './sp500';

export interface WatchlistInfo {
  id: string;
  name: string;
  stockCount: number;
}

const WATCHLIST_DIR = path.join(process.cwd(), 'data', 'watchlists');

/**
 * List all available watchlists (built-in S&P 500 + any CSV files in data/watchlists/).
 */
export function getAvailableWatchlists(): WatchlistInfo[] {
  const watchlists: WatchlistInfo[] = [
    { id: 'sp500', name: 'S&P 500', stockCount: SP500_CONSTITUENTS.length },
  ];

  try {
    if (fs.existsSync(WATCHLIST_DIR)) {
      const files = fs.readdirSync(WATCHLIST_DIR).filter(f => f.endsWith('.csv'));
      for (const file of files) {
        const id = path.basename(file, '.csv');
        if (id === 'sp500') continue; // skip if someone put an sp500.csv in there
        const stocks = parseCSV(path.join(WATCHLIST_DIR, file));
        const displayName = id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        watchlists.push({ id, name: displayName, stockCount: stocks.length });
      }
    }
  } catch (err) {
    console.error('[WatchlistLoader] Error reading watchlist directory:', err);
  }

  return watchlists;
}

/**
 * Load a watchlist by ID. Returns SP500 for 'sp500' or parses a CSV file.
 * CSV format: symbol (required), name (optional), sector (optional).
 * First row is treated as header if it contains 'symbol'.
 */
export function loadWatchlist(id: string): SP500Stock[] {
  if (!id || id === 'sp500') {
    return SP500_CONSTITUENTS;
  }

  const filePath = path.join(WATCHLIST_DIR, `${id}.csv`);

  if (!fs.existsSync(filePath)) {
    console.warn(`[WatchlistLoader] Watchlist "${id}" not found, falling back to S&P 500`);
    return SP500_CONSTITUENTS;
  }

  return parseCSV(filePath);
}

function parseCSV(filePath: string): SP500Stock[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) return [];

  // Detect header row
  const firstLine = lines[0].toLowerCase();
  let symbolIdx = 0;
  let nameIdx = -1;
  let sectorIdx = -1;
  let startLine = 0;

  if (firstLine.includes('symbol')) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    symbolIdx = headers.indexOf('symbol');
    nameIdx = headers.indexOf('name');
    sectorIdx = headers.indexOf('sector');
    startLine = 1;

    if (symbolIdx === -1) {
      // symbol column not found by name, assume first column
      symbolIdx = 0;
    }
  }

  const stocks: SP500Stock[] = [];
  const seen = new Set<string>();

  for (let i = startLine; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    const symbol = (cols[symbolIdx] || '').toUpperCase().trim();

    if (!symbol || symbol.length > 10 || seen.has(symbol)) continue;
    seen.add(symbol);

    stocks.push({
      symbol,
      name: (nameIdx >= 0 ? cols[nameIdx] : '') || symbol,
      sector: (sectorIdx >= 0 ? cols[sectorIdx] : '') || 'Unknown',
    });
  }

  return stocks;
}
