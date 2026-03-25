# Detailed Setup Guide

## Step 1: Create Supabase Project

If not already done:
1. Go to https://supabase.com
2. Create new project
3. Copy Project ID, URL, and keys

## Step 2: Create Firebase Project

If not already done:
1. Go to https://console.firebase.google.com
2. Create new project
3. Download Service Account Key (`firebase-key.json`)

## Step 3: Clone This Repository

```bash
git clone <your-repo>
cd alert-infrastructure
```

## Step 4: Install Dependencies

```bash
npm install
supabase login
supabase link --project-id=your-project-id
```

## Step 5: Copy Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

## Step 6: Add Firebase Secret to Supabase

> **IMPORTANT:** Do NOT commit `firebase-key.json` to Git!

Instead:
1. Go to Supabase Dashboard
2. Settings → Edge Functions → Secrets
3. Click "New Secret"
4. Name: `FIREBASE_KEY_JSON`
5. Value: (copy entire `firebase-key.json` content)
6. Save

The edge function will automatically load this secret from `Deno.env.get("FIREBASE_KEY_JSON")`

## Step 7: Create Database Tables

```bash
supabase db push
```

This runs migrations from `supabase/migrations/`

## Step 8: Deploy Edge Function

### Local Testing

```bash
supabase functions serve send-notification
```

Then in another terminal:

```bash
curl -X POST http://localhost:54321/functions/v1/send-notification \
  -H "Content-Type: application/json" \
  -d '{...}'  # See test payload in README.md
```

### Deploy to Supabase

```bash
supabase functions deploy send-notification
```

Verify:

```bash
supabase functions list
```

Should show: `send-notification` as active

## Step 9: Register a Device Token

Before you can send notifications, you need a device token. This comes from:
- Your Android app (via Firebase FCM SDK)
- Or manually for testing

```sql
-- Insert a test device token
INSERT INTO user_fcm_tokens (user_id, device_token, device_name)
VALUES ('inès', 'YOUR_ACTUAL_FIREBASE_DEVICE_TOKEN_HERE', 'Test Device');
```

Get a real token from:
1. Install your Android app
2. App initializes Firebase FCM
3. Requests device token
4. Sends to your backend

## Step 10: Test the Full Flow

### Via Database Insert

```sql
-- This triggers the function automatically
INSERT INTO alerts (
  event_id, event_type, severity, title, description, user_id, linked_pra_section
) VALUES (
  'TEST_001', 'TEST', 'sev_2_high', 'Test Alert', 'Check your phone!', 'inès', 'TEST_001'
);
```

### Check Supabase Logs:
- Dashboard → Edge Functions → send-notification → Logs
- Should see: "Notification sent to..."

### Check your phone:
- Notification should appear in <1 second

## Troubleshooting

### "FIREBASE_KEY_JSON is not set"
**Solution:** Add the secret to Supabase (see Step 6)

### "No active devices found"
**Solution:** Register a device token (see Step 9)

### "registration token is invalid"
**Solution:** The token has expired. Register a new one. The function will automatically mark the device as inactive.

### "Failed to fetch device tokens"
**Solution:** Check that Supabase credentials are correct in `.env.local`

## Next Steps

1. ✅ Deploy this function to production
2. ✅ Build Android app with Firebase FCM
3. ✅ Integrate with your alerts system
4. ✅ Monitor notification delivery

## Support

For issues, check:
- Supabase Logs (Dashboard → Edge Functions)
- Firebase Console (for token validity)
- This README and SETUP.md
