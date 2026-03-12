# M2M S&P 500 Scanner

Pre-market scanner that analyzes all S&P 500 stocks with M2M 5-factor scoring, AI-powered setup detection, and trend alignment.

Extracted from [m2m-single-stock](https://github.com/mark2markett/m2m-single-stock) to run as a standalone service.

## Stack

- **Next.js 14** — App Router with API routes
- **Polygon.io** — Real-time stock data and historical OHLCV
- **Anthropic Claude Haiku** — AI narrative for scanned setups
- **Upstash Redis** — Batch state persistence across serverless invocations
- **Tailwind CSS** — Dark theme UI (#0a0e17 bg, #00E59B accent)

## Getting Started

```bash
cp .env.example .env.local   # fill in your keys
npm install
npm run dev
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/scanner/trigger` | GET | Kick off a scan slice (cron-triggered) |
| `/api/scanner/batch` | POST | Process a 10-stock batch (chained) |
| `/api/scanner/finalize` | POST | Aggregate batch results into final scan |
| `/api/scanner/merge` | GET | Merge all slice results |
| `/api/scanner/status` | GET | Current scan progress |
| `/api/scanner/results` | GET | Latest completed scan results |

## Architecture

1. **Cron triggers** `/api/scanner/trigger` with a slice range (e.g., stocks 0-120)
2. Each slice processes stocks in batches of 10 via `/api/scanner/batch`
3. After all batches complete, `/api/scanner/finalize` aggregates results
4. `/api/scanner/merge` combines all slices into the final result
5. Frontend polls `/api/scanner/status` and displays results from `/api/scanner/results`
