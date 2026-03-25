import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import admin from "firebase-admin";

// ─── Firebase init (cached across warm invocations) ───────────────────────────

let firebaseInitialized = false;

function getMessaging(): admin.messaging.Messaging {
  if (!firebaseInitialized) {
    const raw = process.env.FIREBASE_KEY_JSON;
    if (!raw) throw new Error("FIREBASE_KEY_JSON is not set");

    const cert = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(cert),
      projectId: cert.project_id,
    });
    firebaseInitialized = true;
  }
  return admin.messaging();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertPayload {
  event_id: string;
  event_type: string;
  severity: "sev_1_critical" | "sev_2_high" | "sev_3_medium" | "sev_4_low";
  title: string;
  description?: string;
  linked_pra_section?: string;
  user_id: string;
  metrics?: Record<string, unknown>;
}

interface DeviceToken {
  id: string;
  device_token: string;
  device_name: string;
}

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  string,
  { channel: string; priority: "high" | "normal"; sound: boolean }
> = {
  sev_1_critical: { channel: "alerts_critical", priority: "high", sound: true },
  sev_2_high: { channel: "alerts_high", priority: "high", sound: true },
  sev_3_medium: { channel: "alerts_medium", priority: "normal", sound: false },
  sev_4_low: { channel: "alerts_low", priority: "normal", sound: false },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL is not set" });

  const sql = neon(dbUrl);

  try {
    const alert = req.body as AlertPayload;

    // 1. Insert alert into Neon
    const [inserted] = await sql`
      INSERT INTO alerts (event_id, event_type, severity, title, description, linked_pra_section, user_id, metrics)
      VALUES (
        ${alert.event_id},
        ${alert.event_type},
        ${alert.severity},
        ${alert.title},
        ${alert.description ?? null},
        ${alert.linked_pra_section ?? null},
        ${alert.user_id},
        ${alert.metrics ? JSON.stringify(alert.metrics) : null}
      )
      RETURNING id
    `;

    console.log(`Alert inserted: ${inserted.id}`);

    // 2. Get active device tokens for this user
    const devices = await sql<DeviceToken[]>`
      SELECT id, device_token, device_name
      FROM user_fcm_tokens
      WHERE user_id = ${alert.user_id}
        AND is_active = true
    `;

    if (devices.length === 0) {
      console.warn(`No active devices for user: ${alert.user_id}`);
      return res.status(200).json({
        ok: true,
        alert_id: inserted.id,
        message: "Alert saved, no devices to notify",
      });
    }

    // 3. Send Firebase notification to each device
    const severityConfig =
      SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG["sev_3_medium"];
    const messaging = getMessaging();

    const results = await Promise.all(
      devices.map(async (device) => {
        try {
          const messageId = await messaging.send({
            notification: {
              title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
              body: alert.description ?? "Tap to view details",
            },
            data: {
              alertId: String(inserted.id),
              eventId: alert.event_id,
              eventType: alert.event_type,
              severity: alert.severity,
              praSection: alert.linked_pra_section ?? "",
              metrics: alert.metrics ? JSON.stringify(alert.metrics) : "{}",
              timestamp: new Date().toISOString(),
            },
            android: {
              priority: severityConfig.priority,
              notification: {
                channelId: severityConfig.channel,
                sound: severityConfig.sound ? "default" : undefined,
                clickAction: "FLUTTER_NOTIFICATION_CLICK",
              },
            },
            token: device.device_token,
          });

          // Update last_used
          await sql`
            UPDATE user_fcm_tokens
            SET last_used = NOW()
            WHERE id = ${device.id}
          `;

          console.log(`Sent to ${device.device_name}: ${messageId}`);
          return { success: true, device: device.device_name, messageId };
        } catch (err: any) {
          console.error(`Failed for ${device.device_name}: ${err.message}`);

          // Deactivate invalid tokens
          if (
            err.message?.includes("registration token is not registered") ||
            err.message?.includes("registration token is invalid")
          ) {
            await sql`
              UPDATE user_fcm_tokens
              SET is_active = false
              WHERE id = ${device.id}
            `;
          }

          return { success: false, device: device.device_name, error: err.message };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    console.log(`Notified ${successCount}/${devices.length} devices`);

    return res.status(200).json({
      ok: true,
      alert_id: inserted.id,
      devices_notified: successCount,
      results,
    });
  } catch (err: any) {
    console.error("Error in send-notification:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
