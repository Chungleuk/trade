import { TradingAlert } from '../types/alert';

export interface AnalysisResult {
  entryAlignment: 'align' | 'do not align';
  entryReasoning: string;
  actionFit: 'fits' | 'does not fit';
  actionReasoning: string;
  winRatePrediction: '≥50%' | '<50%';
  winRateReasoning: string;
  marketEvents: 'yes' | 'no';
  marketEventsDetails: string;
  summary: string;
  summaryChinese: string;
  confidence: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

export class OpenAIAnalysisService {
  private static readonly OPENAI_API_KEY = '2TtLh-jXUoZHhT1gRSNg1Tz0oVwJhf7gxAkwxCx_qm8';
  private static readonly OPENAI_BASE_URL = 'https://api.poe.com/v1';
  private static readonly EMAIL_RECIPIENT = 'leechungleuk@gmail.com';

  static async analyzeAlert(alert: TradingAlert): Promise<AnalysisResult | null> {
    try {
      const alertData = {
        action: alert.action,
        symbol: alert.symbol,
        timeframe: alert.timeframe,
        entry: alert.entry,
        target: alert.target,
        stop: alert.stop,
        rr: alert.rr,
        risk: alert.risk,
        id: alert.id,
        timestamp: alert.timestamp
      };

      const analysis = await this.callOpenAI(alertData);
      return analysis;
    } catch (error) {
      console.error('Error analyzing alert with OpenAI:', error);
      return null;
    }
  }

  private static async callOpenAI(alertData: any): Promise<AnalysisResult> {
    const alertString = JSON.stringify(alertData, null, 2);
    
    const prompt = `Evaluate the trading signal with specific, definitive judgments. Provide:

1. Clear assessment of whether entry, target, and stop align with the symbol's timeframe price action and trend (state "align" or "do not align" with rationale).  
2. Explicit confirmation if the action (SELL/BUY) fits current market conditions (confirm "fits" or "does not fit" with reasoning).  
3. Definitive win rate prediction (≥50% or <50%) with concrete justification tied to trend, price action, and risk-reward.  
4. Confirmation of whether major market events/data releases are scheduled within 60 minutes could have a great impact on forex market/XAUUSD (state "yes" or "no" with specifics if applicable, with the name of event/incident).  

Avoid conditional language. Base conclusions on observable trading principles. Summarize in 100 words and 200字繁體中文.

Alert data:
${alertString}

Please respond in the following JSON format:
{
  "entryAlignment": "align|do not align",
  "entryReasoning": "detailed reasoning",
  "actionFit": "fits|does not fit", 
  "actionReasoning": "detailed reasoning",
  "winRatePrediction": "≥50%|<50%",
  "winRateReasoning": "detailed reasoning",
  "marketEvents": "yes|no",
  "marketEventsDetails": "specific events if any",
  "summary": "100 word summary in English",
  "summaryChinese": "200字繁體中文總結",
  "confidence": 85,
  "recommendation": "strong_buy|buy|hold|sell|strong_sell"
}`;

    try {
      const response = await fetch(`${this.OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'Assistant',
          messages: [
            {
              role: 'system',
              content: 'You are a professional trading analyst. Provide clear, actionable analysis in the exact JSON format requested.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Try to parse JSON response
      try {
        const analysis = JSON.parse(content);
        return this.validateAnalysisResult(analysis);
      } catch (parseError) {
        // If JSON parsing fails, try to extract structured data from text
        return this.parseTextResponse(content);
      }

    } catch (error) {
      console.error('OpenAI API call failed:', error);
      return this.generateFallbackAnalysis(alertData);
    }
  }

  private static validateAnalysisResult(data: any): AnalysisResult {
    return {
      entryAlignment: data.entryAlignment || 'do not align',
      entryReasoning: data.entryReasoning || 'Analysis unavailable',
      actionFit: data.actionFit || 'does not fit',
      actionReasoning: data.actionReasoning || 'Analysis unavailable',
      winRatePrediction: data.winRatePrediction || '<50%',
      winRateReasoning: data.winRateReasoning || 'Analysis unavailable',
      marketEvents: data.marketEvents || 'no',
      marketEventsDetails: data.marketEventsDetails || 'No major events detected',
      summary: data.summary || 'Analysis unavailable',
      summaryChinese: data.summaryChinese || '分析不可用',
      confidence: data.confidence || 50,
      recommendation: data.recommendation || 'hold'
    };
  }

  private static parseTextResponse(content: string): AnalysisResult {
    // Fallback parsing for non-JSON responses
    const lines = content.split('\n');
    let summary = '';
    let summaryChinese = '';
    
    for (const line of lines) {
      if (line.includes('Summary:') || line.includes('summary:')) {
        summary = line.replace(/.*[Ss]ummary:\s*/, '').trim();
      }
      if (line.includes('中文') || line.includes('Chinese')) {
        summaryChinese = line.replace(/.*[Cc]hinese[:\s]*/, '').trim();
      }
    }

    return {
      entryAlignment: content.toLowerCase().includes('align') ? 'align' : 'do not align',
      entryReasoning: 'Parsed from text response',
      actionFit: content.toLowerCase().includes('fits') ? 'fits' : 'does not fit',
      actionReasoning: 'Parsed from text response',
      winRatePrediction: content.includes('≥50%') ? '≥50%' : '<50%',
      winRateReasoning: 'Parsed from text response',
      marketEvents: content.toLowerCase().includes('yes') ? 'yes' : 'no',
      marketEventsDetails: 'Parsed from text response',
      summary: summary || 'Analysis completed via text parsing',
      summaryChinese: summaryChinese || '通過文本解析完成分析',
      confidence: 60,
      recommendation: 'hold'
    };
  }

  private static generateFallbackAnalysis(alertData: any): AnalysisResult {
    return {
      entryAlignment: 'do not align',
      entryReasoning: 'Analysis service unavailable',
      actionFit: 'does not fit',
      actionReasoning: 'Analysis service unavailable',
      winRatePrediction: '<50%',
      winRateReasoning: 'Analysis service unavailable',
      marketEvents: 'no',
      marketEventsDetails: 'Unable to check market events',
      summary: `Trading alert received for ${alertData.symbol} ${alertData.action} at ${alertData.entry}. Analysis service is currently unavailable. Please review manually.`,
      summaryChinese: `收到 ${alertData.symbol} ${alertData.action} 交易信號，入場價 ${alertData.entry}。分析服務目前不可用，請手動審查。`,
      confidence: 0,
      recommendation: 'hold'
    };
  }

  static async sendAnalysisEmail(alert: TradingAlert, analysis: AnalysisResult): Promise<boolean> {
    try {
      const emailContent = this.generateEmailContent(alert, analysis);
      
      // Try multiple email services for reliability
      const services = [
        this.sendViaWeb3Forms,
        this.sendViaFormspree,
        this.sendViaEmailJS
      ];

      for (const service of services) {
        try {
          const success = await service(emailContent);
          if (success) {
            console.log('Email sent successfully');
            return true;
          }
        } catch (error) {
          console.warn(`Email service failed:`, error);
          continue;
        }
      }

      console.error('All email services failed');
      return false;
    } catch (error) {
      console.error('Email sending error:', error);
      return false;
    }
  }

  private static generateEmailContent(alert: TradingAlert, analysis: AnalysisResult) {
    const confidenceColor = analysis.confidence >= 70 ? '🟢' : analysis.confidence >= 50 ? '🟡' : '🔴';
    const recommendationEmoji = {
      'strong_buy': '🚀',
      'buy': '📈',
      'hold': '⏸️',
      'sell': '📉',
      'strong_sell': '💥'
    }[analysis.recommendation] || '❓';

    return {
      subject: `${recommendationEmoji} AI Analysis: ${alert.action} ${alert.symbol} - ${confidenceColor}${analysis.confidence}% Confidence`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🤖 AI Trading Analysis Report</h2>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0;">📊 Signal Details</h3>
            <p><strong>Action:</strong> ${alert.action}</p>
            <p><strong>Symbol:</strong> ${alert.symbol}</p>
            <p><strong>Entry:</strong> ${alert.entry}</p>
            <p><strong>Target:</strong> ${alert.target || 'N/A'}</p>
            <p><strong>Stop:</strong> ${alert.stop || 'N/A'}</p>
            <p><strong>Risk:</strong> ${alert.risk || '0.65%'}</p>
            <p><strong>Timeframe:</strong> ${alert.timeframe || '15'}m</p>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0;">🎯 AI Analysis Results</h3>
            <p><strong>Confidence:</strong> ${confidenceColor} ${analysis.confidence}%</p>
            <p><strong>Recommendation:</strong> ${recommendationEmoji} ${analysis.recommendation.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Entry Alignment:</strong> ${analysis.entryAlignment === 'align' ? '✅' : '❌'} ${analysis.entryAlignment}</p>
            <p><strong>Action Fit:</strong> ${analysis.actionFit === 'fits' ? '✅' : '❌'} ${analysis.actionFit}</p>
            <p><strong>Win Rate Prediction:</strong> ${analysis.winRatePrediction}</p>
            <p><strong>Market Events:</strong> ${analysis.marketEvents === 'yes' ? '⚠️' : '✅'} ${analysis.marketEvents}</p>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0;">📝 Detailed Analysis</h3>
            <p><strong>Entry Reasoning:</strong> ${analysis.entryReasoning}</p>
            <p><strong>Action Reasoning:</strong> ${analysis.actionReasoning}</p>
            <p><strong>Win Rate Reasoning:</strong> ${analysis.winRateReasoning}</p>
            ${analysis.marketEvents === 'yes' ? `<p><strong>Market Events:</strong> ${analysis.marketEventsDetails}</p>` : ''}
          </div>

          <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0;">📋 Summary</h3>
            <p><strong>English:</strong> ${analysis.summary}</p>
            <hr style="border: 1px solid #ccc; margin: 10px 0;">
            <p><strong>繁體中文:</strong> ${analysis.summaryChinese}</p>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
            <p>🤖 Generated by AI Trading Analysis System</p>
            <p>⏰ ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
      text: `
AI Trading Analysis Report

Signal Details:
- Action: ${alert.action}
- Symbol: ${alert.symbol}
- Entry: ${alert.entry}
- Target: ${alert.target || 'N/A'}
- Stop: ${alert.stop || 'N/A'}
- Risk: ${alert.risk || '0.65%'}

AI Analysis:
- Confidence: ${analysis.confidence}%
- Recommendation: ${analysis.recommendation}
- Entry Alignment: ${analysis.entryAlignment}
- Action Fit: ${analysis.actionFit}
- Win Rate Prediction: ${analysis.winRatePrediction}
- Market Events: ${analysis.marketEvents}

Summary: ${analysis.summary}

繁體中文總結: ${analysis.summaryChinese}

Generated at: ${new Date().toLocaleString()}
      `
    };
  }

  private static async sendViaWeb3Forms(emailContent: any): Promise<boolean> {
    const formData = new FormData();
    formData.append("access_key", "a2927d87-5196-4690-a8dc-d06dcb7634f8");
    formData.append("email", this.EMAIL_RECIPIENT);
    formData.append("subject", emailContent.subject);
    formData.append("message", emailContent.text);
    formData.append("from_name", "AI Trading Analysis System");
    
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData
    });

    return response.ok;
  }

  private static async sendViaFormspree(emailContent: any): Promise<boolean> {
    const response = await fetch("https://formspree.io/f/xpznvqko", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        email: this.EMAIL_RECIPIENT,
        subject: emailContent.subject,
        message: emailContent.text,
        _replyto: this.EMAIL_RECIPIENT
      })
    });

    return response.ok;
  }

  private static async sendViaEmailJS(emailContent: any): Promise<boolean> {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: "service_trading_alerts",
        template_id: "template_ai_analysis",
        user_id: "your_emailjs_user_id",
        template_params: {
          to_email: this.EMAIL_RECIPIENT,
          subject: emailContent.subject,
          html_content: emailContent.html,
          text_content: emailContent.text
        }
      }),
    });

    return response.ok;
  }
}
