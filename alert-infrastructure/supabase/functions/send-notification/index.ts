import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import * as admin from "firebase-admin/mod.ts";
import { initializeApp } from "firebase-admin/app.ts";
import { getMessaging } from "firebase-admin/messaging.ts";

// Load Firebase credentials from environment
const firebaseKeyJson = Deno.env.get("FIREBASE_KEY_JSON");
if (!firebaseKeyJson) {
  throw new Error(
    "FIREBASE_KEY_JSON environment variable is not set. Add it to Supabase secrets."
  );
}

const firebaseConfig = JSON.parse(firebaseKeyJson);

// Initialize Firebase Admin SDK
const app = initializeApp({
  credential: admin.credential.cert(firebaseConfig),
  projectId: firebaseConfig.project_id,
});

const messaging = getMessaging(app);

// Types
interface AlertPayload {
  new: {
    id: string;
    event_id: string;
    event_type: string;
    severity: string;
    title: string;
    description: string;
    linked_pra_section: string;
    user_id: string;
    metrics?: Record<string, any>;
  };
}

interface SendNotificationRequest {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: AlertPayload["new"];
}

/**
 * Supabase Edge Function: Send Firebase Notification
 *
 * Triggered when a new alert is inserted into the alerts table.
 *
 * Does:
 * 1. Gets user_id from the alert
 * 2. Queries user_fcm_tokens table for device tokens
 * 3. Constructs notification message based on severity
 * 4. Sends via Firebase FCM to each device
 * 5. Logs results and handles errors
 */
serve(async (req: Request) => {
  try {
    const payload: SendNotificationRequest = await req.json();

    // Only process INSERT events
    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const alert = payload.record;
    const userId = alert.user_id;

    console.log(`Processing alert for user: ${userId}`, {
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title,
    });

    // Map severity to notification channel + priority
    const severityMap: Record<string, { channel: string; priority: string }> =
      {
        sev_1_critical: { channel: "alerts_critical", priority: "high" },
        sev_2_high: { channel: "alerts_high", priority: "high" },
        sev_3_medium: { channel: "alerts_medium", priority: "normal" },
        sev_4_low: { channel: "alerts_low", priority: "normal" },
      };

    const severityConfig = severityMap[alert.severity] || {
      channel: "alerts_medium",
      priority: "normal",
    };

    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials in environment");
    }

    // Query device tokens for this user
    const devicesResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_fcm_tokens?user_id=eq.${userId}&is_active=eq.true`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!devicesResponse.ok) {
      throw new Error(
        `Failed to fetch device tokens: ${devicesResponse.statusText}`
      );
    }

    const devices = await devicesResponse.json();

    if (!devices || devices.length === 0) {
      console.warn(`No active devices found for user: ${userId}`);
      return new Response(
        JSON.stringify({ ok: true, message: "No devices to notify" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${devices.length} active devices for ${userId}`);

    // Send notification to each device
    const notifications = devices.map(async (device: any) => {
      const message = {
        notification: {
          title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          body: alert.description || "Click to view details",
        },
        data: {
          alertId: alert.id,
          eventId: alert.event_id,
          eventType: alert.event_type,
          severity: alert.severity,
          praSectionLink: alert.linked_pra_section || "none",
          metricsJson: alert.metrics ? JSON.stringify(alert.metrics) : "{}",
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: severityConfig.priority,
          notification: {
            channel_id: severityConfig.channel,
            sound: shouldPlaySound(alert.severity) ? "default" : undefined,
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
          },
        },
        token: device.device_token,
      };

      try {
        const messageId = await messaging.send(message as any);
        console.log(
          `Notification sent to ${device.device_name}: ${messageId}`
        );

        // Update last_used timestamp
        await fetch(
          `${supabaseUrl}/rest/v1/user_fcm_tokens?id=eq.${device.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ last_used: new Date().toISOString() }),
          }
        );

        return { success: true, device: device.device_name, messageId };
      } catch (error: any) {
        console.error(
          `Failed to send to ${device.device_name}:`,
          error.message
        );

        // If token is invalid, mark device as inactive
        if (
          error.message.includes("registration token is invalid") ||
          error.message.includes("registration token is not registered")
        ) {
          console.log(`Marking device ${device.id} as inactive (invalid token)`);
          await fetch(
            `${supabaseUrl}/rest/v1/user_fcm_tokens?id=eq.${device.id}`,
            {
              method: "PATCH",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ is_active: false }),
            }
          );
        }

        return {
          success: false,
          device: device.device_name,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(notifications);
    const successCount = results.filter((r) => r.success).length;

    console.log(
      `Notification sent to ${successCount}/${results.length} devices`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        alert_id: alert.id,
        user_id: userId,
        devices_notified: successCount,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-notification:", error.message);
    console.error("Stack:", error.stack);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Helper: Determine if notification should play sound
 */
function shouldPlaySound(severity: string): boolean {
  return severity === "sev_1_critical" || severity === "sev_2_high";
}
