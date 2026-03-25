-- ===== TABLE 1: user_fcm_tokens =====
-- Stores FCM device tokens for push notifications

CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR(100) NOT NULL,
  device_token TEXT        NOT NULL UNIQUE,
  device_name VARCHAR(100),
  is_active   BOOLEAN     DEFAULT true,
  last_used   TIMESTAMP   DEFAULT NOW(),
  created_at  TIMESTAMP   DEFAULT NOW(),
  updated_at  TIMESTAMP   DEFAULT NOW(),

  CONSTRAINT user_fcm_tokens_user_device_uq UNIQUE (user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id   ON user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_is_active ON user_fcm_tokens(is_active);

-- ===== TABLE 2: alerts =====

CREATE TABLE IF NOT EXISTS alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            VARCHAR(100) NOT NULL,
  event_type          VARCHAR(100) NOT NULL,
  severity            VARCHAR(50)  NOT NULL,
  title               TEXT        NOT NULL,
  description         TEXT,
  metrics             JSONB,
  linked_pra_section  VARCHAR(100),
  user_id             VARCHAR(100) NOT NULL DEFAULT 'inès',
  status              VARCHAR(50)  DEFAULT 'triggered',
  created_at          TIMESTAMP   DEFAULT NOW(),
  updated_at          TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id    ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity   ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status     ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_event_id   ON alerts(event_id);
