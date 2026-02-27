# Supabase Webhook Troubleshooting

## Webhook URL
```
https://xdjthqpnsyrlulqldlpi.supabase.co/functions/v1/webhook
```

## TradingView Requirements
- **Timeout:** 3 seconds max ([TradingView docs](https://www.tradingview.com/support/solutions/43000529348-about-webhooks/))
- **Content-Type:** `application/json` (if message is valid JSON) or `text/plain`
- **Ports:** 80 or 443 only

## Fixes Applied (to prevent "Webhook delivery failed")

1. **Fast response** – Return 200 immediately after DB insert. Email, AI analysis, and position sizing run in background.
2. **No blocking before response** – Position sizing lookup moved to background (saves ~100–300ms).
3. **Flexible parsing** – Accepts `entry` as number or string.
4. **Better error handling** – Clear 400 responses for invalid/empty body.

## Deploy the Updated Function
```bash
cd c:\Users\User\Desktop\Fin1\project
supabase functions deploy webhook
```

## Keep Function Warm (reduce cold starts)
Supabase Edge Functions can have 1–3 second cold starts after idle. To reduce this:

1. Go to [UptimeRobot](https://uptimerobot.com) (free)
2. Create a monitor: **HTTP(s)** → `https://xdjthqpnsyrlulqldlpi.supabase.co/functions/v1/webhook`
3. Set interval to **5 minutes**
4. The GET request will keep the function warm

## Test the Webhook
```powershell
# Test POST (simulates TradingView)
curl -X POST "https://xdjthqpnsyrlulqldlpi.supabase.co/functions/v1/webhook" -H "Content-Type: application/json" -d "{\"action\":\"BUY\",\"symbol\":\"GBPJPY\",\"entry\":\"195.5\",\"target\":\"196.2\",\"stop\":\"194.8\",\"id\":\"test-1\",\"rr\":\"1.05\",\"risk\":\"1.0%\",\"timeframe\":\"15\"}"
```

## Check Supabase Logs
1. Supabase Dashboard → **Edge Functions** → **webhook** → **Logs**
2. Look for errors when TradingView fires an alert
