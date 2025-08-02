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
        risk: parsedAlert.risk || null,
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Alert received and saved",
        alert: data 
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