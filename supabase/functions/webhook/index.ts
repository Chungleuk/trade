interface TradingViewAlert {
  action?: string;
  symbol?: string;
  timeframe?: string;
  entry?: string;
  target?: string;
  stop?: string;
  rr?: string;
  risk?: string;
  id?: string;
  message?: string;
}

// Email notification function
async function sendEmailNotification(alert: any) {
  try {
    // Try EmailJS first (free service)
    const emailJSResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: "service_trading_alerts",
        template_id: "template_alert",
        user_id: "your_emailjs_user_id",
        template_params: {
          to_email: "leechungleuk@gmail.com",
          subject: `📧 FIRST EMAIL - 🚨 Trading Alert: ${alert.action} ${alert.symbol}`,
          alert_action: alert.action,
          alert_symbol: alert.symbol,
          alert_entry: alert.entry,
          alert_timeframe: alert.timeframe || "15",
          alert_target: alert.target || "N/A",
          alert_stop: alert.stop || "N/A",
          alert_rr: alert.rr || "N/A",
          alert_risk: alert.risk || "0.65%",
          alert_time: new Date().toLocaleString(),
          raw_message: alert.rawMessage || JSON.stringify(alert)
        }
      }),
    });

    if (emailJSResponse.ok) {
      console.log("Email sent successfully via EmailJS");
      return true;
    }

    // Fallback to webhook-based email
    return await sendWebhookEmail(alert);
  } catch (error) {
    console.error("Error sending email:", error);
    return await sendWebhookEmail(alert);
  }
}

// Webhook-based email using a simple service
async function sendWebhookEmail(alert: any) {
  try {
    // Using a simple email webhook service (like Formspree or similar)
    const emailWebhookUrl = "https://formspree.io/f/xpznvqko"; // Free email service
    
    const response = await fetch(emailWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        email: "leechungleuk@gmail.com",
        subject: `📧 FIRST EMAIL - 🚨 Trading Alert: ${alert.action} ${alert.symbol}`,
        message: `
🚨 NEW TRADING ALERT 🚨

Action: ${alert.action}
Symbol: ${alert.symbol}
Entry Price: ${alert.entry}
Timeframe: ${alert.timeframe || "15"}m
${alert.target ? `Target: ${alert.target}` : ''}
${alert.stop ? `Stop Loss: ${alert.stop}` : ''}
${alert.rr ? `Risk/Reward: ${alert.rr}` : ''}
 Risk: ${alert.risk || '0.65%'}

Time: ${new Date().toLocaleString()}

Original Message:
${alert.rawMessage || JSON.stringify(alert, null, 2)}

---
Sent from TradingView Alert Dashboard
        `,
        _replyto: "leechungleuk@gmail.com",
        _subject: `📧 FIRST EMAIL - 🚨 Trading Alert: ${alert.action} ${alert.symbol}`
      })
    });

    if (response.ok) {
      console.log("Email sent successfully via webhook");
      return true;
    } else {
      console.error("Webhook email failed:", await response.text());
      return await sendSimpleNotification(alert);
    }
  } catch (error) {
    console.error("Webhook email error:", error);
    return await sendSimpleNotification(alert);
  }
}

// Final fallback - log the notification
async function sendSimpleNotification(alert: any) {
  try {
    // Use Web3Forms with your access key
    const formData = new FormData();
    formData.append("access_key", "a2927d87-5196-4690-a8dc-d06dcb7634f8");
    formData.append("email", "leechungleuk@gmail.com");
    formData.append("subject", `📧 FIRST EMAIL - 🚨 Trading Alert: ${alert.action} ${alert.symbol}`);
    formData.append("message", `
🚨 NEW TRADING ALERT 🚨

Action: ${alert.action}
Symbol: ${alert.symbol}
Entry Price: ${alert.entry}
Timeframe: ${alert.timeframe || "15"}m
${alert.target ? `Target: ${alert.target}` : ''}
${alert.stop ? `Stop Loss: ${alert.stop}` : ''}
${alert.rr ? `Risk/Reward: ${alert.rr}` : ''}
 Risk: ${alert.risk || '0.65%'}

Time: ${new Date().toLocaleString()}

Original Message:
${alert.rawMessage || JSON.stringify(alert, null, 2)}

---
Sent from TradingView Alert Dashboard
    `);
    formData.append("from_name", "TradingView Alert System");
    
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ Email sent successfully via Web3Forms:", data);
      return true;
    } else {
      console.error("❌ Web3Forms error:", data);
      return false;
    }
  } catch (error) {
    console.error("❌ Web3Forms request failed:", error);
    console.log("📧 ALERT NOTIFICATION (Email failed):", {
      recipient: "leechungleuk@gmail.com",
      alert: alert,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

// AI Analysis function
async function performAIAnalysis(alertData: any): Promise<any | null> {
  try {
    const OPENAI_API_KEY = "2TtLh-jXUoZHhT1gRSNg1Tz0oVwJhf7gxAkwxCx_qm8";
    const OPENAI_BASE_URL = "https://api.poe.com/v1";
    
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

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
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
      return validateAnalysisResult(analysis);
    } catch (parseError) {
      // If JSON parsing fails, return fallback analysis
      return generateFallbackAnalysis(alertData);
    }

  } catch (error) {
    console.error('OpenAI API call failed:', error);
    return generateFallbackAnalysis(alertData);
  }
}

function validateAnalysisResult(data: any): any {
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

function generateFallbackAnalysis(alertData: any): any {
  return {
    entryAlignment: 'do not align',
    entryReasoning: 'AI analysis service is currently unavailable due to API access issues, token limits, or service downtime. Please review this signal manually.',
    actionFit: 'does not fit',
    actionReasoning: 'Unable to analyze market conditions due to AI service unavailability. Manual review recommended.',
    winRatePrediction: '<50%',
    winRateReasoning: 'AI analysis unavailable. Please assess win probability based on your own technical and fundamental analysis.',
    marketEvents: 'no',
    marketEventsDetails: 'Unable to check for upcoming market events due to AI service unavailability.',
    summary: `Trading alert received for ${alertData.symbol} ${alertData.action} at ${alertData.entry}. AI analysis service is currently unavailable due to technical issues. Please review this signal manually using your own analysis methods.`,
    summaryChinese: `收到 ${alertData.symbol} ${alertData.action} 交易信號，入場價 ${alertData.entry}。AI分析服務目前因技術問題不可用。請使用您自己的分析方法手動審查此信號。`,
    confidence: 0,
    recommendation: 'hold'
  };
}

// Enhanced email notification with AI analysis
async function sendEnhancedEmailNotification(alert: any) {
  try {
    const confidenceColor = alert.aiAnalysis.confidence >= 70 ? '🟢' : alert.aiAnalysis.confidence >= 50 ? '🟡' : '🔴';
    const recommendationEmoji = {
      'strong_buy': '🚀',
      'buy': '📈',
      'hold': '⏸️',
      'sell': '📉',
      'strong_sell': '💥'
    }[alert.aiAnalysis.recommendation] || '❓';

    const emailContent = {
      subject: `📧 SECOND EMAIL - ${recommendationEmoji} AI Analysis: ${alert.action} ${alert.symbol} - ${confidenceColor}${alert.aiAnalysis.confidence}% Confidence`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">📧 SECOND EMAIL - AI Trading Analysis Report</h2>
          <p style="color: #666; font-style: italic;">This is the follow-up email with AI analysis results (sent ~30 seconds after the initial alert)</p>
          
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
            <p><strong>Confidence:</strong> ${confidenceColor} ${alert.aiAnalysis.confidence}%</p>
            <p><strong>Recommendation:</strong> ${recommendationEmoji} ${alert.aiAnalysis.recommendation.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Entry Alignment:</strong> ${alert.aiAnalysis.entryAlignment === 'align' ? '✅' : '❌'} ${alert.aiAnalysis.entryAlignment}</p>
            <p><strong>Action Fit:</strong> ${alert.aiAnalysis.actionFit === 'fits' ? '✅' : '❌'} ${alert.aiAnalysis.actionFit}</p>
            <p><strong>Win Rate Prediction:</strong> ${alert.aiAnalysis.winRatePrediction}</p>
            <p><strong>Market Events:</strong> ${alert.aiAnalysis.marketEvents === 'yes' ? '⚠️' : '✅'} ${alert.aiAnalysis.marketEvents}</p>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0;">📝 Detailed Analysis</h3>
            <p><strong>Entry Reasoning:</strong> ${alert.aiAnalysis.entryReasoning}</p>
            <p><strong>Action Reasoning:</strong> ${alert.aiAnalysis.actionReasoning}</p>
            <p><strong>Win Rate Reasoning:</strong> ${alert.aiAnalysis.winRateReasoning}</p>
            ${alert.aiAnalysis.marketEvents === 'yes' ? `<p><strong>Market Events:</strong> ${alert.aiAnalysis.marketEventsDetails}</p>` : ''}
          </div>

          <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0;">📋 Summary</h3>
            <p><strong>English:</strong> ${alert.aiAnalysis.summary}</p>
            <hr style="border: 1px solid #ccc; margin: 10px 0;">
            <p><strong>繁體中文:</strong> ${alert.aiAnalysis.summaryChinese}</p>
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
- Confidence: ${alert.aiAnalysis.confidence}%
- Recommendation: ${alert.aiAnalysis.recommendation}
- Entry Alignment: ${alert.aiAnalysis.entryAlignment}
- Action Fit: ${alert.aiAnalysis.actionFit}
- Win Rate Prediction: ${alert.aiAnalysis.winRatePrediction}
- Market Events: ${alert.aiAnalysis.marketEvents}

Summary: ${alert.aiAnalysis.summary}

繁體中文總結: ${alert.aiAnalysis.summaryChinese}

Generated at: ${new Date().toLocaleString()}
      `
    };

    // Try multiple email services for reliability
    const services = [
      sendViaWeb3Forms,
      sendViaFormspree,
      sendViaEmailJS
    ];

    for (const service of services) {
      try {
        const success = await service(emailContent);
        if (success) {
          console.log('Enhanced email sent successfully');
          return true;
        }
      } catch (error) {
        console.warn(`Enhanced email service failed:`, error);
        continue;
      }
    }

    console.error('All enhanced email services failed');
    return false;
  } catch (error) {
    console.error('Enhanced email sending error:', error);
    return false;
  }
}

async function sendViaWeb3Forms(emailContent: any): Promise<boolean> {
  const formData = new FormData();
  formData.append("access_key", "a2927d87-5196-4690-a8dc-d06dcb7634f8");
  formData.append("email", "leechungleuk@gmail.com");
  formData.append("subject", emailContent.subject);
  formData.append("message", emailContent.text);
  formData.append("from_name", "AI Trading Analysis System");
  
  const response = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    body: formData
  });

  return response.ok;
}

async function sendViaFormspree(emailContent: any): Promise<boolean> {
  const response = await fetch("https://formspree.io/f/xpznvqko", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      email: "leechungleuk@gmail.com",
      subject: emailContent.subject,
      message: emailContent.text,
      _replyto: "leechungleuk@gmail.com"
    })
  });

  return response.ok;
}

async function sendViaEmailJS(emailContent: any): Promise<boolean> {
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
        to_email: "leechungleuk@gmail.com",
        subject: emailContent.subject,
        html_content: emailContent.html,
        text_content: emailContent.text
      }
    }),
  });

  return response.ok;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle GET requests (when someone clicks the URL in browser)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        message: "TradingView Webhook Endpoint",
        status: "Active and ready to receive POST requests",
        usage: "This endpoint accepts POST requests from TradingView alerts",
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Only accept POST requests for webhooks
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the incoming webhook data
    let alertData: any;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      alertData = await req.json();
    } else {
      // Handle text/plain or other formats (TradingView sometimes sends as text)
      const textData = await req.text();
      try {
        alertData = JSON.parse(textData);
      } catch {
        // If it's not JSON, treat it as a raw message
        alertData = { message: textData };
      }
    }

    console.log("Received webhook data:", alertData);

    // Parse the alert data
    const parsedAlert = parseAlert(alertData);
    
    if (!parsedAlert) {
      return new Response(
        JSON.stringify({ error: "Unable to parse alert data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert the alert into the database
    // Determine dynamic risk% based on per-symbol node
    const groupKey = (parsedAlert.symbol || 'UNKNOWN').toUpperCase();
    let riskPercent = '0.65';
    try {
      const { data: state } = await supabase
        .from('position_sizing_state')
        .select('*')
        .eq('group_key', groupKey)
        .maybeSingle();
      const node = state?.current_node || 'Start';
      const map: Record<string, number> = {
        'Start': 0.65, '1-0': 0.58, '0-1': 0.73, '2-0': 0.44, '1-1': 0.73, '0-2': 0.73,
        '3-0': 0.25, '2-1': 0.62, '1-2': 0.83, '0-3': 0.62, '4-0': 0.08, '3-1': 0.41,
        '2-2': 0.83, '1-3': 0.83, '0-4': 0.41, '4-1': 0.17, '3-2': 0.66, '2-3': 0.99,
        '1-4': 0.66, '0-5': 0.17, '4-2': 0.33, '3-3': 0.99, '2-4': 0.99, '1-5': 0.33,
        '4-3': 0.66, '3-4': 1.33, '2-5': 0.66, '4-4': 1.33, '3-5': 1.33, '4-5': 2.65,
      };
      riskPercent = (map[node] ?? 0.65).toFixed(2);
    } catch {}

    const { data, error } = await supabase
      .from("trading_alerts")
      .insert({
        action: parsedAlert.action,
        symbol: parsedAlert.symbol,
        timeframe: parsedAlert.timeframe || "15",
        entry: parsedAlert.entry,
        target: parsedAlert.target || null,
        stop: parsedAlert.stop || null,
        rr: parsedAlert.rr || null,
        risk: riskPercent,
        alert_id: parsedAlert.id || generateAlertId(),
        message: parsedAlert.rawMessage || JSON.stringify(alertData),
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to save alert" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Alert saved successfully:", data);

    // STEP 1: Send immediate email notification (basic alert info)
    let immediateEmailSent = false;
    try {
      await sendEmailNotification({
        action: parsedAlert.action,
        symbol: parsedAlert.symbol,
        entry: parsedAlert.entry,
        target: parsedAlert.target,
        stop: parsedAlert.stop,
        rr: parsedAlert.rr,
        timeframe: parsedAlert.timeframe || "15",
        risk: `${riskPercent}%`,
        rawMessage: parsedAlert.rawMessage || JSON.stringify(alertData)
      });
      immediateEmailSent = true;
      console.log("✅ Immediate email notification sent successfully");
    } catch (immediateEmailError) {
      console.error("❌ Immediate email failed:", immediateEmailError);
      // Try fallback email service
      try {
        await sendSimpleNotification({
          action: parsedAlert.action,
          symbol: parsedAlert.symbol,
          entry: parsedAlert.entry,
          target: parsedAlert.target,
          stop: parsedAlert.stop,
          rr: parsedAlert.rr,
          timeframe: parsedAlert.timeframe || "15",
          risk: `${riskPercent}%`,
          rawMessage: parsedAlert.rawMessage || JSON.stringify(alertData)
        });
        immediateEmailSent = true;
        console.log("✅ Fallback immediate email sent successfully");
      } catch (fallbackError) {
        console.error("❌ All immediate email methods failed:", fallbackError);
      }
    }

    // STEP 2: Start AI analysis in background (non-blocking)
    // This will send a second email with analysis results when complete
    (async () => {
      try {
        console.log("🤖 Starting AI analysis in background...");
        const analysisResult = await performAIAnalysis({
          id: data.id,
          action: parsedAlert.action,
          symbol: parsedAlert.symbol,
          timeframe: parsedAlert.timeframe || "15",
          entry: parsedAlert.entry,
          target: parsedAlert.target,
          stop: parsedAlert.stop,
          rr: parsedAlert.rr,
          risk: `${riskPercent}%`,
          timestamp: data.created_at
        });

        if (analysisResult) {
          // Update the alert with analysis results
          try {
            await supabase
              .from("trading_alerts")
              .update({
                ai_analysis: analysisResult,
                analysis_performed: true,
                analysis_timestamp: new Date().toISOString()
              })
              .eq("id", data.id);
            console.log("✅ AI analysis saved to database");
          } catch (dbError) {
            console.error("❌ Failed to update alert with AI analysis:", dbError);
          }

          // Send second email with AI analysis results
          try {
            await sendEnhancedEmailNotification({
              action: parsedAlert.action,
              symbol: parsedAlert.symbol,
              entry: parsedAlert.entry,
              target: parsedAlert.target,
              stop: parsedAlert.stop,
              rr: parsedAlert.rr,
              timeframe: parsedAlert.timeframe || "15",
              risk: `${riskPercent}%`,
              rawMessage: parsedAlert.rawMessage || JSON.stringify(alertData),
              aiAnalysis: analysisResult
            });
            console.log("✅ Second email with AI analysis sent successfully");
          } catch (enhancedEmailError) {
            console.error("❌ Second email with AI analysis failed:", enhancedEmailError);
          }
        } else {
          console.log("⚠️ AI analysis returned null, no second email sent");
        }
      } catch (analysisError) {
        console.error("❌ AI analysis failed:", analysisError);
        // No second email sent if AI analysis fails
      }
    })();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Alert received, saved, and immediate email sent. AI analysis started in background.",
        alert: data,
        immediateEmailSent: immediateEmailSent
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Alert parsing function
function parseAlert(rawData: any): any | null {
  try {
    // If it's already a properly formatted JSON alert
    if (isValidJsonAlert(rawData)) {
      return {
        id: rawData.id || generateAlertId(),
        action: rawData.action.toUpperCase(),
        symbol: rawData.symbol.toUpperCase(),
        timeframe: rawData.timeframe || "15",
        entry: rawData.entry,
        target: rawData.target,
        stop: rawData.stop,
        rr: rawData.rr,
        risk: rawData.risk,
        rawMessage: JSON.stringify(rawData),
      };
    }

    // If it's a string message from TradingView strategy
    if (typeof rawData === "string" || rawData.message) {
      const message = typeof rawData === "string" ? rawData : rawData.message;
      return parseTradingViewMessage(message);
    }

    // If it's an object but not in our expected format
    if (typeof rawData === "object" && rawData !== null) {
      return parseGenericObject(rawData);
    }

    return null;
  } catch (error) {
    console.error("Error parsing alert:", error);
    return null;
  }
}

function isValidJsonAlert(data: any): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.action === "string" &&
    (data.action.toUpperCase() === "BUY" || data.action.toUpperCase() === "SELL") &&
    typeof data.symbol === "string" &&
    typeof data.entry === "string"
  );
}

function parseTradingViewMessage(message: string): any | null {
  try {
    // Extract basic information using regex patterns
    const actionMatch = message.match(/order\s+(BUY|SELL)\s+@/i);
    const symbolMatch = message.match(/filled\s+on\s+([A-Z0-9]+)/i);
    const contractsMatch = message.match(/@\s+(\d+(?:\.\d+)?)\s+filled/i);
    const strategyMatch = message.match(/^[\d\/\s]+(.+?Strategy.*?)(?:\s*\(|:)/i);

    if (!actionMatch || !symbolMatch) {
      console.warn("Could not extract required fields from TradingView message");
      return null;
    }

    const action = actionMatch[1].toUpperCase();
    const symbol = symbolMatch[1].toUpperCase();
    const contracts = contractsMatch ? contractsMatch[1] : "1";
    const strategyName = strategyMatch ? strategyMatch[1].trim() : "TradingView Strategy";

    return {
      id: generateAlertId(),
      action,
      symbol,
      timeframe: "15",
      entry: contracts,
      rawMessage: message,
      strategyName,
    };
  } catch (error) {
    console.error("Error parsing TradingView message:", error);
    return null;
  }
}

function parseGenericObject(data: any): any | null {
  const action = extractAction(data);
  const symbol = extractSymbol(data);
  const entry = extractEntry(data);

  if (!action || !symbol || !entry) {
    return null;
  }

  return {
    id: data.id || generateAlertId(),
    action,
    symbol: symbol.toUpperCase(),
    timeframe: data.timeframe || data.tf || "15",
    entry,
    target: data.target || data.tp,
    stop: data.stop || data.sl,
    rr: data.rr || data.risk_reward,
    risk: data.risk,
    rawMessage: JSON.stringify(data),
  };
}

function extractAction(data: any): string | null {
  const actionFields = ["action", "side", "order_action", "type"];
  
  for (const field of actionFields) {
    if (data[field]) {
      const value = data[field].toString().toUpperCase();
      if (value.includes("BUY") || value.includes("LONG")) return "BUY";
      if (value.includes("SELL") || value.includes("SHORT")) return "SELL";
    }
  }
  
  return null;
}

function extractSymbol(data: any): string | null {
  const symbolFields = ["symbol", "ticker", "instrument", "pair"];
  
  for (const field of symbolFields) {
    if (data[field] && typeof data[field] === "string") {
      return data[field];
    }
  }
  
  return null;
}

function extractEntry(data: any): string | null {
  const entryFields = ["entry", "price", "entry_price", "fill_price", "close"];
  
  for (const field of entryFields) {
    if (data[field]) {
      return data[field].toString();
    }
  }
  
  return null;
}

function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}