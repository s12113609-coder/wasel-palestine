require('dotenv').config();
const { pool } = require('../src/config/database');

const migrations = `
-- =============================================
-- WASEL PALESTINE - DATABASE SCHEMA
-- =============================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen','moderator','admin')),
  is_active BOOLEAN DEFAULT true,
  reputation_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHECKPOINTS
CREATE TABLE IF NOT EXISTS checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'military' CHECK (type IN ('military','police','flying','crossing','other')),
  region VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHECKPOINT STATUS HISTORY
CREATE TABLE IF NOT EXISTS checkpoint_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL CHECK (status IN ('open','closed','restricted','delayed','unknown')),
  notes TEXT,
  reported_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INCIDENTS
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(30) NOT NULL CHECK (type IN ('closure','delay','accident','weather_hazard','military_operation','road_damage','other')),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','verified','resolved','closed')),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  checkpoint_id UUID REFERENCES checkpoints(id),
  region VARCHAR(100),
  reported_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INCIDENT AUDIT LOG
CREATE TABLE IF NOT EXISTS incident_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  performed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CITIZEN REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('checkpoint_closure','delay','road_damage','hazard','protest','military','other')),
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','duplicate')),
  confidence_score DECIMAL(4,2) DEFAULT 0.5,
  duplicate_of UUID REFERENCES reports(id),
  submitted_by UUID REFERENCES users(id),
  moderated_by UUID REFERENCES users(id),
  moderation_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REPORT VOTES
CREATE TABLE IF NOT EXISTS report_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (1,-1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_id, user_id)
);

-- REPORT AUDIT LOG
CREATE TABLE IF NOT EXISTS report_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL,
  performed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALERT SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region VARCHAR(100),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  radius_km DECIMAL(6,2) DEFAULT 10,
  categories TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, region)
);

-- ALERTS
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES incidents(id),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_region ON incidents(region);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_submitted_by ON reports(submitted_by);
CREATE INDEX IF NOT EXISTS idx_checkpoints_region ON checkpoints(region);
CREATE INDEX IF NOT EXISTS idx_checkpoint_status_checkpoint ON checkpoint_status_history(checkpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_subscription ON alerts(subscription_id, is_read);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
`;

async function migrate() {
  try {
    console.log('🚀 Running migrations...');
    await pool.query(migrations);
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
