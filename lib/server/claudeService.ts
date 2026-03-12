import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeService {
  /**
   * Scanner AI — narrative-only insight for a scanned stock.
   * Quality, confidence, earlyStage, and catalystPresent are computed
   * algorithmically in scannerEngine.ts. The AI provides only the
   * narrative fields that require contextual interpretation.
   */
  static async generateScannerInsight(data: {
    symbol: string;
    price: number;
    change: number;
    rsi: number;
    macd: number;
    signal: number;
    histogram: number;
    ema20: number;
    ema50: number;
    adx: number;
    atr: number;
    bbLower: number;
    bbUpper: number;
    stochK: number;
    stochD: number;
    cmf: number;
    support: number[];
    resistance: number[];
    setupStage: string;
    volatilityRegime: string;
    score: number;
    maxScore: number;
    factorsPassed: number;
    totalFactors: number;
    publishable: boolean;
    sentiment: string;
    rs10?: number;
    rs20?: number;
    rs50?: number;
  }): Promise<{
    keySignal: string;
    risk: string;
    summary: string;
  }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      throw new Error('Anthropic API key not configured.');
    }

    const client = new Anthropic({ apiKey });

    const supportStr = data.support.slice(0, 3).map(s => '$' + s.toFixed(2)).join(', ') || 'none';
    const resistStr = data.resistance.slice(0, 3).map(r => '$' + r.toFixed(2)).join(', ') || 'none';

    const userPrompt = `Summarize the setup for ${data.symbol} at $${data.price.toFixed(2)} (${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}%):

INDICATORS: RSI ${data.rsi.toFixed(1)} | MACD ${data.macd.toFixed(3)} vs Sig ${data.signal.toFixed(3)} (Hist: ${data.histogram.toFixed(3)}) | EMA20 $${data.ema20.toFixed(2)} EMA50 $${data.ema50.toFixed(2)} | ADX ${data.adx.toFixed(1)} | ATR $${data.atr.toFixed(2)} | BB ${data.bbLower.toFixed(2)}-${data.bbUpper.toFixed(2)} | Stoch K${data.stochK.toFixed(1)} D${data.stochD.toFixed(1)} | CMF ${data.cmf.toFixed(3)}
STRUCTURE: Support ${supportStr} | Resistance ${resistStr} | Stage: ${data.setupStage} | Vol Regime: ${data.volatilityRegime}${data.rs10 != null ? `\nRELATIVE STRENGTH vs SPY: 10d ${data.rs10.toFixed(2)} | 20d ${data.rs20!.toFixed(2)} | 50d ${data.rs50!.toFixed(2)}` : ''}
SCORECARD: ${data.score}/${data.maxScore} (${data.factorsPassed}/${data.totalFactors} factors) | Publishable: ${data.publishable ? 'yes' : 'no'}
SENTIMENT: ${data.sentiment}

Return JSON with exactly these 3 fields:
{
  "keySignal": "the single most important technical signal right now (max 80 chars)",
  "risk": "the primary risk to this setup (max 80 chars)",
  "summary": "2-3 sentence educational assessment of what the indicators show (max 250 chars)"
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-3-5-20251001',
      max_tokens: 300,
      temperature: 0.2,
      system: 'You are a quantitative setup scanner for the M2M Stock Intelligence platform. Your task: identify the single most important signal and primary risk for a stock setup. Use observational educational language — never advisory language. Return ONLY valid JSON with keySignal, risk, and summary fields.',
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Invalid response from Anthropic API');
    }

    let rawText = textBlock.text.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(rawText);

    return {
      keySignal: String(parsed.keySignal || '').slice(0, 80),
      risk: String(parsed.risk || '').slice(0, 80),
      summary: String(parsed.summary || '').slice(0, 250),
    };
  }
}
