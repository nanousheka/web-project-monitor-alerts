-- ===== TABLE 1: user_fcm_tokens =====
-- Stores device tokens for each user

CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User & device info
  user_id VARCHAR(100) NOT NULL,
  device_token TEXT NOT NULL UNIQUE,
  device_name VARCHAR(100),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  last_used TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  CONSTRAINT user_fcm_tokens_user_id_idx UNIQUE (user_id, device_token)
);

CREATE INDEX idx_user_fcm_tokens_user_id ON user_fcm_tokens(user_id);
CREATE INDEX idx_user_fcm_tokens_is_active ON user_fcm_tokens(is_active);
CREATE INDEX idx_user_fcm_tokens_created_at ON user_fcm_tokens(created_at DESC);

-- ===== TABLE 2: alerts =====
-- Stores events/alerts

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identification
  event_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL,

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  metrics JSONB,

  -- PRA linkage
  linked_pra_section VARCHAR(100),

  -- User (for notification routing)
  user_id VARCHAR(100) NOT NULL DEFAULT 'inès',

  -- Status
  status VARCHAR(50) DEFAULT 'triggered',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  CONSTRAINT alerts_id_pk PRIMARY KEY (id)
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_event_id ON alerts(event_id);

-- ===== Enable Realtime (optional, for live updates) =====
ALTER TABLE alerts REPLICA IDENTITY FULL;
ALTER TABLE user_fcm_tokens REPLICA IDENTITY FULL;
