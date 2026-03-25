# Alert Infrastructure — Neon + Vercel + Firebase

Vercel Serverless Function that inserts alerts into Neon (PostgreSQL) and sends Firebase FCM push notifications.

## Architecture

```
POST /api/send-notification
        ↓
  Insert alert → Neon DB
        ↓
  Query device tokens ← Neon DB
        ↓
  Send via Firebase FCM
        ↓
  Notification on phone
```

## Setup

### 1. Prerequisites

- [Neon](https://neon.tech) project (free tier works)
- [Firebase](https://console.firebase.google.com) project with FCM enabled
- [Vercel](https://vercel.com) account
- Node.js 18+

### 2. Install

```bash
cd alert-infrastructure
npm install
```

### 3. Create tables in Neon

Run the migration in the Neon SQL editor or via psql:

```bash
psql $DATABASE_URL -f migrations/001_create_tables.sql
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
# Fill in DATABASE_URL and FIREBASE_KEY_JSON
```

Add the same variables to Vercel:

```bash
vercel env add DATABASE_URL
vercel env add FIREBASE_KEY_JSON
```

### 5. Deploy

```bash
npm run deploy
```

### 6. Test

```bash
curl -X POST https://your-app.vercel.app/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "TEST_001",
    "event_type": "TEST",
    "severity": "sev_2_high",
    "title": "Test Alert",
    "description": "Check your phone!",
    "user_id": "inès"
  }'
```

## Usage

### Register a device token

```sql
INSERT INTO user_fcm_tokens (user_id, device_token, device_name)
VALUES ('inès', 'YOUR_FCM_DEVICE_TOKEN', 'My Phone');
```

### Create an alert + send notification

```bash
curl -X POST https://your-app.vercel.app/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "PERF_001",
    "event_type": "PERF",
    "severity": "sev_2_high",
    "title": "Lighthouse Score Dropped",
    "description": "Score fell from 85 to 62",
    "user_id": "inès",
    "linked_pra_section": "PERF_001",
    "metrics": { "before": 85, "after": 62 }
  }'
```

## Severity levels

| Severity         | FCM Channel     | Priority | Sound |
|------------------|-----------------|----------|-------|
| `sev_1_critical` | alerts_critical | high     | yes   |
| `sev_2_high`     | alerts_high     | high     | yes   |
| `sev_3_medium`   | alerts_medium   | normal   | no    |
| `sev_4_low`      | alerts_low      | normal   | no    |

## Files

- `api/send-notification.ts` — Vercel serverless function
- `migrations/001_create_tables.sql` — PostgreSQL tables for Neon
- `vercel.json` — Vercel configuration
- `.env.example` — Required environment variables

## Security

- ✅ Firebase credentials stored in Vercel env vars (never in Git)
- ✅ Neon connection string stored in Vercel env vars (never in Git)
- ✅ Invalid FCM tokens automatically deactivated
