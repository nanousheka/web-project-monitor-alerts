-- ===== TRIGGER: Send notification when alert is created =====

-- First, create the helper function that calls the edge function
CREATE OR REPLACE FUNCTION invoke_send_notification_function()
RETURNS TRIGGER AS $$
DECLARE
  request_body JSONB;
BEGIN
  -- Build the payload for the edge function
  request_body := jsonb_build_object(
    'type', 'INSERT',
    'table', 'alerts',
    'record', row_to_json(NEW)
  );

  -- Call the edge function via pg_net (if available)
  -- Otherwise, use net.http_post if you have postgres-http extension

  -- For now, we'll just log that the trigger fired
  -- In production, you'd call the edge function here

  RAISE NOTICE 'Alert created, sending notification: %', request_body;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_send_notification ON alerts;
CREATE TRIGGER trigger_send_notification
  AFTER INSERT ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION invoke_send_notification_function();
