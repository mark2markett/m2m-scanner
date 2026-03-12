import 'server-only';

export class OpenAIService {
  private static readonly API_URL = 'https://api.openai.com/v1/chat/completions';

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
  }): Promise<{
    keySignal: string;
    risk: string;
    summary: string;
  }> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured.');
    }

    const supportStr = data.support.slice(0, 3).map(s => '$' + s.toFixed(2)).join(', ') || 'none';
    const resistStr = data.resistance.slice(0, 3).map(r => '$' + r.toFixed(2)).join(', ') || 'none';

    const userPrompt = `Summarize the setup for ${data.symbol} at $${data.price.toFixed(2)} (${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}%):

INDICATORS: RSI ${data.rsi.toFixed(1)} | MACD ${data.macd.toFixed(3)} vs Sig ${data.signal.toFixed(3)} (Hist: ${data.histogram.toFixed(3)}) | EMA20 $${data.ema20.toFixed(2)} EMA50 $${data.ema50.toFixed(2)} | ADX ${data.adx.toFixed(1)} | ATR $${data.atr.toFixed(2)} | BB ${data.bbLower.toFixed(2)}-${data.bbUpper.toFixed(2)} | Stoch K${data.stochK.toFixed(1)} D${data.stochD.toFixed(1)} | CMF ${data.cmf.toFixed(3)}
STRUCTURE: Support ${supportStr} | Resistance ${resistStr} | Stage: ${data.setupStage} | Vol Regime: ${data.volatilityRegime}
SCORECARD: ${data.score}/${data.maxScore} (${data.factorsPassed}/${data.totalFactors} factors) | Publishable: ${data.publishable ? 'yes' : 'no'}
SENTIMENT: ${data.sentiment}

Return JSON with exactly these 3 fields:
{
  "keySignal": "the single most important technical signal right now (max 80 chars)",
  "risk": "the primary risk to this setup (max 80 chars)",
  "summary": "2-3 sentence educational assessment of what the indicators show (max 250 chars)"
}`;

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a quantitative setup scanner for the M2M Stock Intelligence platform. Your task: identify the single most important signal and primary risk for a stock setup. Use observational educational language — never advisory language. Return ONLY valid JSON with keySignal, risk, and summary fields.'
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 300,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const responseData = await response.json();

    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    const parsed = JSON.parse(responseData.choices[0].message.content);

    return {
      keySignal: String(parsed.keySignal || '').slice(0, 80),
      risk: String(parsed.risk || '').slice(0, 80),
      summary: String(parsed.summary || '').slice(0, 250),
    };
  }
}
