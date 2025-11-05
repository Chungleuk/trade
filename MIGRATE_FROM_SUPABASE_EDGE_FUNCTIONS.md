# 🚀 Migration Guide: From Supabase Edge Functions to Express Backend

## Overview

This guide shows you how to migrate your webhook handling from **Supabase Edge Functions** (which cost resources) to your **Express.js backend** (which you already have running).

## ✅ Benefits

1. **No Supabase Edge Function costs** - Everything runs on your existing backend
2. **Full control** - You control the infrastructure and resources
3. **Better logging** - Use your existing Winston logger
4. **Same functionality** - All features work exactly the same

## 📦 New Files Created

### 1. `backend/services/emailService.js`
- Handles sending immediate alert emails
- Supports Web3Forms and Formspree as fallback

### 2. `backend/services/supabaseService.js`
- Saves alerts to Supabase database (optional)
- Works even if Supabase is not configured

### 3. Updated `backend/routes/webhook.js`
- Complete webhook handler (replaces Supabase Edge Function)
- Handles alert saving and email sending
- Fast response (< 1 second)

## 🔧 Installation

### Step 1: Install Dependencies

```bash
cd backend
npm install @supabase/supabase-js
```

### Step 2: Update Environment Variables

Add these to your `.env` file:

```env
# Supabase Configuration (optional - for storing alerts)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Email Configuration
WEB3FORMS_ACCESS_KEY=a2927d87-5196-4690-a8dc-d06dcb7634f8
ALERT_EMAIL=leechungleuk@gmail.com
FORMSPREE_URL=https://formspree.io/f/xpznvqko
```

### Step 3: Update TradingView Webhook URL

**Change your TradingView webhook URL from:**
```
https://your-project.supabase.co/functions/v1/webhook
```

**To:**
```
https://your-backend-url.com/api/webhook/tradingview
```

## 🎯 How It Works

### Request Flow:

1. **TradingView sends webhook** → Your Express backend
2. **Backend validates** webhook signature
3. **Saves alert** to Supabase (if configured)
4. **Sends email** immediately with signal details
5. **Queues signal** for MT5 processing
6. **Returns response** immediately (< 1 second)

### Features:

- ✅ **Fast processing** - Response in < 1 second
- ✅ **Immediate email** - Sent right away with signal details
- ✅ **Database storage** - Saves to Supabase (if configured)
- ✅ **Error handling** - Continues even if one step fails
- ✅ **No delays** - No AI analysis processing

## 🔍 Testing

### Test Webhook Endpoint

```bash
curl -X POST http://localhost:3001/api/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "x-tradingview-signature: your-signature" \
  -H "x-tradingview-timestamp: $(date +%s)000" \
  -d '{
    "action": "BUY",
    "symbol": "USDJPY",
    "entry": "154.354",
    "target": "154.4436",
    "stop": "154.2644",
    "risk": "0.83%",
    "timeframe": "15"
  }'
```

### Check Logs

Watch your backend logs to see:
- ✅ Alert received
- ✅ Alert saved to Supabase
- ✅ Immediate email sent
- ✅ Signal queued for MT5

## 🚨 Important Notes

### 1. Supabase Edge Function Can Be Disabled

Once you've verified everything works with your Express backend:
- You can disable the Supabase Edge Function
- Or keep it as a backup (but you won't use it)

### 2. Environment Variables

- **SUPABASE_URL** and **SUPABASE_ANON_KEY** are optional
- If not set, alerts won't be saved to Supabase (but everything else works)

### 3. Email Services

- **Web3Forms** is tried first
- **Formspree** is used as fallback
- Both are free services (with limits)

## 📊 Cost Comparison

| Feature | Supabase Edge Functions | Express Backend |
|---------|------------------------|-----------------|
| **Webhook Handler** | 💰 Charges per invocation | ✅ Free (your server) |
| **Email Sending** | 💰 Charges per email | ✅ Free (Web3Forms/Formspree) |
| **Database Storage** | 💰 Charges per write | ✅ Free (if using Supabase free tier) |

## 🎉 Result

You now have **zero Supabase Edge Function costs** with fast, efficient webhook processing!

All webhook processing and email sending now happens on your Express backend server - **fast response in < 1 second** with no AI analysis delays.

