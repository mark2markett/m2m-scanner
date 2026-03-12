'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronRight, ChevronDown } from 'lucide-react';
import type { ScannerStockResult } from '@/lib/types';
import { useIsMobile } from '@/hooks/useIsMobile';

interface ScannerTableProps {
  stocks: ScannerStockResult[];
  onSelectStock: (symbol: string) => void;
}

export function ScannerTable({ stocks, onSelectStock }: ScannerTableProps) {
  const isMobile = useIsMobile();

  if (stocks.length === 0) {
    return (
      <div className="text-center py-12 text-[#6B7280]">
        No stocks match your filters.
      </div>
    );
  }

  if (isMobile) {
    return <MobileCardList stocks={stocks} onSelectStock={onSelectStock} />;
  }

  return <DesktopTable stocks={stocks} onSelectStock={onSelectStock} />;
}

function DesktopTable({ stocks, onSelectStock }: ScannerTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1f2937] text-[#6B7280] text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Symbol</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">Change</th>
              <th className="text-center px-4 py-3">M2M Score</th>
              <th className="text-center px-4 py-3">AI Quality</th>
              <th className="text-center px-4 py-3">Confidence</th>
              <th className="text-center px-4 py-3">Stage</th>
              <th className="text-center px-4 py-3">Trend</th>
              <th className="text-right px-4 py-3">RSI</th>
              <th className="text-center px-4 py-3">MACD</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <>
                <tr
                  key={stock.symbol}
                  className="border-b border-[#1f2937]/50 hover:bg-[#1f2937]/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <div className="font-semibold text-[#E5E7EB]">{stock.symbol}</div>
                    <div className="text-xs text-[#6B7280] truncate max-w-[150px]">{stock.name}</div>
                  </td>
                  <td className="text-right px-4 py-3 font-mono text-[#E5E7EB]" onClick={() => onSelectStock(stock.symbol)}>
                    ${stock.price.toFixed(2)}
                  </td>
                  <td className="text-right px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <ChangeCell change={stock.changePercent} />
                  </td>
                  <td className="px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <ScoreBar score={stock.m2mScore} maxScore={stock.m2mMaxScore} />
                  </td>
                  <td className="text-center px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <AIQualityBadge quality={stock.aiSetupQuality} />
                  </td>
                  <td className="px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <ConfidenceBar confidence={stock.aiConfidence} />
                  </td>
                  <td className="text-center px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <StageBadge stage={stock.setupStage} />
                  </td>
                  <td className="text-center px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <TrendIcon trend={stock.trendAlignment} />
                  </td>
                  <td className="text-right px-4 py-3 font-mono" onClick={() => onSelectStock(stock.symbol)}>
                    <RsiCell rsi={stock.rsi} />
                  </td>
                  <td className="text-center px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <MacdBadge signal={stock.macdSignal} />
                  </td>
                  <td className="text-center px-4 py-3" onClick={() => onSelectStock(stock.symbol)}>
                    <div className="flex items-center gap-1 justify-center">
                      {stock.publishable && (
                        <span className="inline-block px-2 py-0.5 bg-[#00E59B]/10 text-[#00E59B] text-xs rounded-full font-medium">
                          PUB
                        </span>
                      )}
                      {stock.aiEarlyStage && (
                        <span className="inline-block px-2 py-0.5 bg-[#f59e0b]/10 text-[#f59e0b] text-xs rounded-full font-medium">
                          EARLY
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedRow(expandedRow === stock.symbol ? null : stock.symbol);
                      }}
                      className="text-[#374151] hover:text-[#6B7280] transition-colors"
                    >
                      {expandedRow === stock.symbol
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>
                  </td>
                </tr>
                {expandedRow === stock.symbol && stock.aiSummary && (
                  <tr key={`${stock.symbol}-expanded`} className="border-b border-[#1f2937]/50 bg-[#0a0e17]/50">
                    <td colSpan={12} className="px-6 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <span className="text-[#6B7280]">Key Signal: </span>
                            <span className="text-[#E5E7EB]">{stock.aiKeySignal}</span>
                          </div>
                          <div className="flex-1">
                            <span className="text-[#6B7280]">Risk: </span>
                            <span className="text-[#E5E7EB]">{stock.aiRisk}</span>
                          </div>
                          {stock.aiCatalystPresent && (
                            <span className="inline-block px-2 py-0.5 bg-[#8b5cf6]/10 text-[#8b5cf6] text-[10px] rounded-full font-medium">
                              CATALYST
                            </span>
                          )}
                        </div>
                        <div className="text-[#9CA3AF] mt-1">{stock.aiSummary}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileCardList({ stocks, onSelectStock }: ScannerTableProps) {
  return (
    <div className="space-y-2">
      {stocks.map((stock) => (
        <div
          key={stock.symbol}
          onClick={() => onSelectStock(stock.symbol)}
          className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 active:bg-[#1f2937]/50 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div>
                <span className="font-semibold text-[#E5E7EB]">{stock.symbol}</span>
                {stock.publishable && (
                  <span className="ml-2 inline-block px-1.5 py-0.5 bg-[#00E59B]/10 text-[#00E59B] text-[10px] rounded-full font-medium">
                    PUB
                  </span>
                )}
                {stock.aiEarlyStage && (
                  <span className="ml-1 inline-block px-1.5 py-0.5 bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] rounded-full font-medium">
                    EARLY
                  </span>
                )}
              </div>
              <AIQualityBadge quality={stock.aiSetupQuality} />
            </div>
            <div className="text-right">
              <div className="font-mono text-sm text-[#E5E7EB]">${stock.price.toFixed(2)}</div>
              <ChangeCell change={stock.changePercent} />
            </div>
          </div>

          {stock.aiKeySignal && (
            <div className="text-xs text-[#9CA3AF] mb-2 line-clamp-1">
              {stock.aiKeySignal}
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="text-[#6B7280]">Score:</span>
                <span className="text-[#E5E7EB] font-medium">{stock.m2mScore}/{stock.m2mMaxScore}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[#6B7280]">Conf:</span>
                <span className="text-[#E5E7EB] font-medium">{stock.aiConfidence}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon trend={stock.trendAlignment} />
                <MacdBadge signal={stock.macdSignal} />
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#374151]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Helper components ---

function ChangeCell({ change }: { change: number }) {
  const positive = change >= 0;
  return (
    <span className={`text-sm font-mono ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
      {positive ? '+' : ''}{change.toFixed(2)}%
    </span>
  );
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const color = pct >= 70 ? '#00E59B' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-[#1f2937] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-[#E5E7EB]">{score}</span>
    </div>
  );
}

function AIQualityBadge({ quality = 'low' }: { quality: 'high' | 'moderate' | 'low' }) {
  const styles: Record<string, string> = {
    high: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30',
    moderate: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
    low: 'bg-[#6B7280]/10 text-[#6B7280] border-[#6B7280]/30',
  };

  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full border ${styles[quality] || styles.low}`}>
      {quality.toUpperCase()}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence >= 70 ? '#22c55e' : confidence >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-2 bg-[#1f2937] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${confidence}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-[#E5E7EB]">{confidence}</span>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    'Just Triggered': 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
    'Mid Setup': 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30',
    'Setup Forming': 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/30',
    'Late Setup': 'bg-[#6B7280]/10 text-[#6B7280] border-[#6B7280]/30',
  };

  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full border ${colors[stage] || 'bg-[#1f2937] text-[#6B7280] border-[#374151]'}`}>
      {stage}
    </span>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'bullish') return <TrendingUp className="h-4 w-4 text-[#22c55e]" />;
  if (trend === 'bearish') return <TrendingDown className="h-4 w-4 text-[#ef4444]" />;
  return <Minus className="h-4 w-4 text-[#6B7280]" />;
}

function RsiCell({ rsi }: { rsi: number }) {
  const color = rsi > 70 ? 'text-[#ef4444]' : rsi < 30 ? 'text-[#22c55e]' : 'text-[#E5E7EB]';
  return <span className={`text-xs font-mono ${color}`}>{rsi.toFixed(1)}</span>;
}

function MacdBadge({ signal }: { signal: string }) {
  const bullish = signal === 'bullish';
  return (
    <span className={`text-[10px] font-medium ${bullish ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
      {bullish ? '▲' : '▼'}
    </span>
  );
}
