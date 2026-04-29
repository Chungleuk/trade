import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

interface ParsedAlert {
  id: string;
  action: string;
  symbol: string;
  timeframe: string;
  entry: string;
  target: string | null;
  stop: string | null;
  rr?: string;
  risk?: string;
  rawMessage: string;
  strategyName?: string;
}

const FETCH_TIMEOUT_MS = 8000;
/**
 * TradingView closes the connection after ~3s.
 * We aim to respond well before this to reduce timeouts.
 */
const TV_RESPONSE_DEADLINE_MS = 1800;

// Cached Supabase client -- reused across requests in the same isolate
let _supabase: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }
  _supabase = createClient(url, key);
  return _supabase;
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Email notification function
async function sendEmailNotification(alert: any): Promise<boolean> {
  try {
    const emailJsUserId = Deno.env.get("EMAILJS_USER_ID") || "";
    if (emailJsUserId && !emailJsUserId.includes("your_")) {
      const emailJSResponse = await fetchWithTimeout("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: Deno.env.get("EMAILJS_SERVICE_ID") || "service_trading_alerts",
          template_id: Deno.env.get("EMAILJS_TEMPLATE_ID") || "template_alert",
          user_id: emailJsUserId,
          template_params: {
            to_email: Deno.env.get("ALERT_EMAIL") || "leechungleuk@gmail.com",
            subject: `📧 FIRST EMAIL - 🚨 Trading Alert: ${alert.action} ${alert.symbol}`,
            alert_action: alert.action,
            alert_symbol: alert.symbol,
            alert_entry: alert.entry || "N/A",
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
      console.warn("EmailJS returned non-OK:", emailJSResponse.status, await emailJSResponse.text());
    }

    return await sendWebhookEmail(alert);
  } catch (error) {
    console.error("Error sending email:", error);
    return await sendWebhookEmail(alert);
  }
}

// Webhook-based email using Formspree. Requires FORMSPREE_URL to be a valid form
// from https://formspree.io (e.g. https://formspree.io/f/YOUR_FORM_ID).
async function sendWebhookEmail(alert: any) {
  try {
    const formspreeUrl = Deno.env.get("FORMSPREE_URL") || "";
    if (!formspreeUrl || !formspreeUrl.includes("formspree.io")) {
      console.warn("FORMSPREE_URL not set or invalid. Create a form at formspree.io and set FORMSPREE_URL in Supabase secrets.");
      return sendSimpleNotification(alert);
    }

    const recipientEmail = Deno.env.get("ALERT_EMAIL") || "leechungleuk@gmail.com";

    const response = await fetchWithTimeout(formspreeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        email: recipientEmail,
        subject: `📧 FIRST EMAIL - 🚨 Trading Alert: ${alert.action} ${alert.symbol}`,
        message: `
🚨 NEW TRADING ALERT 🚨

Action: ${alert.action}
Symbol: ${alert.symbol}
Entry Price: ${alert.entry?.toString()?.trim() ? alert.entry : "N/A"}
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
        _replyto: recipientEmail,
        _subject: `📧 FIRST EMAIL - 🚨 Trading Alert: ${alert.action} ${alert.symbol}`
      })
    });

    const responseText = await response.text();
    if (response.ok) {
      console.log("Email sent successfully via webhook");
      return true;
    }

    // Form not found = form ID in FORMSPREE_URL is wrong or form was deleted
    if (responseText.includes("FORM_NOT_FOUND") || responseText.includes("Form not found")) {
      console.error(
        "Formspree form not found. Create a new form at https://formspree.io, copy the form endpoint URL (e.g. https://formspree.io/f/xxxxx), and set Supabase secret: supabase secrets set FORMSPREE_URL=<your-url>"
      );
    } else {
      console.error("Webhook email failed:", responseText);
    }
    return sendSimpleNotification(alert);
  } catch (error) {
    console.error("Webhook email error:", error);
    return sendSimpleNotification(alert);
  }
}

// Final fallback - log only (Formspree failed or not configured)
function sendSimpleNotification(alert: any): false {
  const recipient = Deno.env.get("ALERT_EMAIL") || "leechungleuk@gmail.com";
  console.log("📧 Email fallback: Formspree failed. Alert logged (no email sent):", {
    action: alert.action,
    symbol: alert.symbol,
    entry: alert.entry,
    recipient,
    timestamp: new Date().toISOString()
  });
  console.log("📧 To fix: create a form at https://formspree.io and set Supabase secret FORMSPREE_URL to your form URL.");
  return false;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-webhook-secret",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        message: "TradingView Webhook Endpoint",
        status: "Active and ready to receive POST requests",
        usage: "POST JSON alert here. Responds within ~1.8s to avoid TradingView 3s timeout.",
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Optional webhook secret: if WEBHOOK_SECRET is set, require it in the request
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET") || "";
    if (webhookSecret) {
      const providedSecret =
        req.headers.get("x-webhook-secret") ||
        new URL(req.url).searchParams.get("secret") ||
        "";
      if (providedSecret !== webhookSecret) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            hint: "TradingView cannot send custom headers. Add the secret to the URL: https://YOUR_PROJECT.supabase.co/functions/v1/webhook?secret=YOUR_SECRET",
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse the incoming webhook data (TradingView: application/json or text/plain, 3s timeout)
    let alertData: any;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      try {
        alertData = await req.json();
      } catch (e) {
        console.error("JSON parse error:", e);
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const textData = await req.text();
      if (!textData || !textData.trim()) {
        return new Response(JSON.stringify({ error: "Empty request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        alertData = JSON.parse(textData);
      } catch {
        alertData = { message: textData };
      }
    }

    if (!alertData || (typeof alertData === "object" && Object.keys(alertData).length === 0)) {
      return new Response(JSON.stringify({ error: "Empty alert data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const supabase = getSupabaseClient();
    if (!supabase) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RISK_MAP: Record<string, number> = {
      'Start': 0.65, '1-0': 0.58, '0-1': 0.73, '2-0': 0.44, '1-1': 0.73, '0-2': 0.73,
      '3-0': 0.25, '2-1': 0.62, '1-2': 0.83, '0-3': 0.62, '4-0': 0.08, '3-1': 0.41,
      '2-2': 0.83, '1-3': 0.83, '0-4': 0.41, '4-1': 0.17, '3-2': 0.66, '2-3': 0.99,
      '1-4': 0.66, '0-5': 0.17, '4-2': 0.33, '3-3': 0.99, '2-4': 0.99, '1-5': 0.33,
      '4-3': 0.66, '3-4': 1.33, '2-5': 0.66, '4-4': 1.33, '3-5': 1.33, '4-5': 2.65,
    };

    // Resolve risk quickly: cap position_sizing_state lookup at 300ms so we don't block the save
    const RISK_LOOKUP_TIMEOUT_MS = 300;
    async function getRiskPercent(): Promise<string> {
      try {
        const sizingMode = (Deno.env.get("POSITION_SIZING_MODE") || "global").toLowerCase();
        const groupKey = sizingMode === "per_pair" ? (parsedAlert.symbol || "UNKNOWN").toUpperCase() : "GLOBAL";
        const timeoutPromise = new Promise<string>((resolve) =>
          setTimeout(() => resolve("0.65"), RISK_LOOKUP_TIMEOUT_MS)
        );
        const sizingPromise = supabase
          .from('position_sizing_state')
          .select('current_node')
          .eq('group_key', groupKey)
          .maybeSingle()
          .then(({ data: state }) => {
            const node = state?.current_node || 'Start';
            return (RISK_MAP[node] ?? 0.65).toFixed(2);
          })
          .catch(() => "0.65");
        return await Promise.race([sizingPromise, timeoutPromise]);
      } catch (e) {
        console.warn("Position sizing lookup failed, using 0.65%:", e);
        return "0.65";
      }
    }

    async function saveAlert(): Promise<{ data: any; riskPercent: string }> {
      const riskPercent = await getRiskPercent();
      const alertId = parsedAlert.id || generateAlertId();
      const { data, error } = await supabase
        .from("trading_alerts")
        .insert({
          action: parsedAlert.action,
          symbol: parsedAlert.symbol,
          timeframe: parsedAlert.timeframe || "15",
          entry: parsedAlert.entry != null ? String(parsedAlert.entry) : "",
          target: parsedAlert.target || null,
          stop: parsedAlert.stop || null,
          rr: parsedAlert.rr || null,
          risk: riskPercent,
          alert_id: alertId,
          message: parsedAlert.rawMessage || JSON.stringify(alertData),
          status: "active",
        })
        .select('id, alert_id, action, symbol, entry, risk, status, created_at')
        .single();
      if (error) throw error;
      return { data, riskPercent };
    }

    const deadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TV_DEADLINE")), TV_RESPONSE_DEADLINE_MS)
    );

    let result: { data: any; riskPercent: string };
    try {
      result = await Promise.race([saveAlert(), deadline]);
    } catch (e) {
      if (e instanceof Error && e.message === "TV_DEADLINE") {
        console.warn("Responding within TradingView deadline; save and email in background.");
        (async () => {
          try {
            const riskPercent = await getRiskPercent();
            const alertId = parsedAlert.id || generateAlertId();
            const { error } = await supabase
              .from("trading_alerts")
              .insert({
                action: parsedAlert.action,
                symbol: parsedAlert.symbol,
                timeframe: parsedAlert.timeframe || "15",
                entry: parsedAlert.entry != null ? String(parsedAlert.entry) : "",
                target: parsedAlert.target || null,
                stop: parsedAlert.stop || null,
                rr: parsedAlert.rr || null,
                risk: riskPercent,
                alert_id: alertId,
                message: parsedAlert.rawMessage || JSON.stringify(alertData),
                status: "active",
              });
            if (error) console.error("Background save on deadline failed:", error);
            else console.log("Alert saved in background:", alertId);
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
          } catch (_) { /* ignore */ }
        })();
        return new Response(
          JSON.stringify({
            success: true,
            message: "Alert received; processing may be delayed. Check your dashboard.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Database error:", e);
      return new Response(
        JSON.stringify({ error: "Failed to save alert" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, riskPercent } = result;
    console.log("Alert saved:", data.alert_id);

    (async () => {
      try {
        const sent = await sendEmailNotification({
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
        console.log(sent ? "✅ Email sent" : "⚠️ Email failed (logged)");
      } catch (emailError) {
        console.error("❌ Email error:", emailError);
      }
    })();

    return new Response(
      JSON.stringify({ success: true, message: "Alert received and saved.", alert: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        action: rawData.action.toString().toUpperCase(),
        symbol: rawData.symbol.toString().toUpperCase(),
        timeframe: rawData.timeframe || "15",
        entry: rawData.entry != null ? String(rawData.entry) : "",
        target: rawData.target != null ? String(rawData.target) : null,
        stop: rawData.stop != null ? String(rawData.stop) : null,
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
  if (typeof data !== "object" || data === null) return false;
  const action = data.action?.toString().toUpperCase();
  if (action !== "BUY" && action !== "SELL") return false;
  if (data.symbol == null || (typeof data.symbol !== "string" && typeof data.symbol !== "number")) return false;
  if (data.entry != null && typeof data.entry !== "string" && typeof data.entry !== "number") return false;
  return true;
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

  if (!action || !symbol) {
    return null;
  }

  const target = data.target ?? data.tp;
  const stop = data.stop ?? data.sl;
  return {
    id: data.id || generateAlertId(),
    action,
    symbol: symbol.toUpperCase(),
    timeframe: data.timeframe || data.tf || "15",
    entry: entry ?? "",
    target: target != null ? String(target) : null,
    stop: stop != null ? String(stop) : null,
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
    if (data[field] != null && (typeof data[field] === "string" || typeof data[field] === "number")) {
      return String(data[field]);
    }
  }
  
  return null;
}

function extractEntry(data: any): string | null {
  const entryFields = ["entry", "price", "entry_price", "fill_price", "close"];
  
  for (const field of entryFields) {
    if (data[field] != null && data[field] !== "") {
      return data[field].toString();
    }
  }
  
  return null;
}

function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}