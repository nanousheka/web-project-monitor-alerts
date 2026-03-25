# Alert Infrastructure : Supabase + Firebase

Supabase Edge Function that sends Firebase push notifications when alerts are created.

## Architecture

```
Alert Created in DB
        ↓
  Trigger fires
        ↓
Edge Function: send-notification
        ↓
Queries user device tokens
        ↓
  Sends via Firebase FCM
        ↓
  Notification on phone
```

## Setup

### 1. Prerequisites

- Supabase project (created)
- Firebase project (created)
- Supabase CLI: `npm install -g supabase`
- Node.js 18+

### 2. Clone & Install

```bash
git clone <your-repo>
cd alert-infrastructure
npm install
supabase login
supabase link --project-id=your-project-id
```

### 3. Add Firebase Secret

1. Go to Supabase Dashboard
2. Settings → Secrets
3. Create secret:
   - Name: `FIREBASE_KEY_JSON`
   - Value: (paste entire firebase-key.json content)

### 4. Create Database Tables

```bash
supabase db push
```

This creates:
- `user_fcm_tokens` (device tokens)
- `alerts` (events)

### 5. Deploy Edge Function

```bash
supabase functions deploy send-notification
```

### 6. Test

```bash
# Local test
supabase functions serve send-notification

# In another terminal:
curl -X POST http://localhost:54321/functions/v1/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "alerts",
    "record": {
      "id": "test-123",
      "event_id": "TEST_001",
      "event_type": "TEST",
      "severity": "sev_2_high",
      "title": "Test Alert",
      "description": "This is a test",
      "linked_pra_section": "TEST_001",
      "user_id": "inès",
      "metrics": {}
    }
  }'
```

## Usage

### Register Device Token

```sql
INSERT INTO user_fcm_tokens (user_id, device_token, device_name)
VALUES ('inès', 'YOUR_FIREBASE_DEVICE_TOKEN', 'My Phone');
```

### Create Alert (triggers notification)

```sql
INSERT INTO alerts (event_id, event_type, severity, title, description, user_id, linked_pra_section)
VALUES (
  'PERF_001',
  'PERF',
  'sev_2_high',
  'Lighthouse Score Dropped',
  'Score fell from 85 to 62',
  'inès',
  'PERF_001'
);

-- Notification should arrive on your phone in <1 second
```

## Files

- `supabase/functions/send-notification/index.ts` - Main edge function
- `supabase/functions/send-notification/deno.json` - Dependencies
- `supabase/migrations/` - Database migrations

## Environment Variables

See `.env.example`

## Security

- ✅ Firebase credentials stored in Supabase Secrets (never in Git)
- ✅ Service role key used for database access
- ✅ Device tokens validated by Firebase
- ✅ Invalid tokens automatically marked inactive

## Next Steps

1. Deploy to Supabase
2. Register device tokens
3. Create alerts to test
4. Monitor function logs in Supabase Dashboard

For more info, see `SETUP.md`
