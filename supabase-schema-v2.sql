-- PredictMax Database Schema V2
-- Enhanced schema for prediction tracking and performance analytics
-- Run this in your Supabase SQL Editor AFTER the initial schema

-- ============================================
-- PREDICTIONS TABLE
-- Track AI predictions and outcomes
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  category TEXT,
  question TEXT NOT NULL,
  
  -- Prediction data
  predicted_probability DECIMAL(5,4) NOT NULL,
  market_price DECIMAL(5,4) NOT NULL,
  edge DECIMAL(5,4) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL', 'WAIT')),
  side TEXT CHECK (side IN ('YES', 'NO')),
  
  -- Model details
  models_used JSONB DEFAULT '[]',
  key_factors JSONB DEFAULT '[]',
  risk_assessment JSONB DEFAULT '{}',
  
  -- Outcome tracking
  actual_outcome TEXT CHECK (actual_outcome IN ('YES', 'NO')),
  settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  
  -- Performance metrics
  accuracy DECIMAL(5,4),
  brier_score DECIMAL(5,4),
  profit_loss DECIMAL(15,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_market_id ON predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_predictions_platform ON predictions(platform);
CREATE INDEX IF NOT EXISTS idx_predictions_category ON predictions(category);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_settled ON predictions(settled);
CREATE INDEX IF NOT EXISTS idx_predictions_action ON predictions(action);

-- ============================================
-- PERFORMANCE METRICS TABLE
-- Aggregate performance by category
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  platform TEXT,
  
  -- Metrics
  total_predictions INTEGER DEFAULT 0,
  settled_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,4),
  avg_edge DECIMAL(5,4),
  avg_confidence DECIMAL(5,4),
  brier_score DECIMAL(5,4),
  profitable_trades INTEGER DEFAULT 0,
  total_profit_loss DECIMAL(15,2) DEFAULT 0,
  
  -- Time window
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Calibration data
  calibration_data JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(category, platform, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_performance_category ON performance_metrics(category);
CREATE INDEX IF NOT EXISTS idx_performance_period ON performance_metrics(period_start, period_end);

-- ============================================
-- MARKET ALERTS TABLE
-- Track market alerts and notifications
-- ============================================
CREATE TABLE IF NOT EXISTS market_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  
  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'PRICE_SPIKE', 'VOLUME_SURGE', 'EDGE_OPPORTUNITY',
    'SPREAD_CHANGE', 'LIQUIDITY_DROP', 'SETTLEMENT_NEAR',
    'NEWS_EVENT', 'ARBITRAGE'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  
  -- Status
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON market_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_market_id ON market_alerts(market_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON market_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON market_alerts(acknowledged);

-- ============================================
-- USER TRADING HISTORY
-- Track user's actual trades
-- ============================================
CREATE TABLE IF NOT EXISTS user_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  
  -- Trade details
  side TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
  entry_price DECIMAL(5,4) NOT NULL,
  exit_price DECIMAL(5,4),
  position_size DECIMAL(15,2) NOT NULL,
  
  -- Outcome
  outcome TEXT CHECK (outcome IN ('WIN', 'LOSS', 'PENDING')),
  profit_loss DECIMAL(15,2),
  
  -- AI context
  prediction_id UUID REFERENCES predictions(id),
  followed_recommendation BOOLEAN,
  
  -- Timestamps
  entry_at TIMESTAMPTZ DEFAULT NOW(),
  exit_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user_id ON user_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON user_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_outcome ON user_trades(outcome);
CREATE INDEX IF NOT EXISTS idx_trades_entry_at ON user_trades(entry_at DESC);

-- ============================================
-- MARKET SNAPSHOTS
-- Historical market data for backtesting
-- ============================================
CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  
  -- Snapshot data
  yes_price DECIMAL(5,4) NOT NULL,
  no_price DECIMAL(5,4) NOT NULL,
  volume_24h DECIMAL(15,2),
  open_interest DECIMAL(15,2),
  spread DECIMAL(5,4),
  
  -- Metadata
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_market_id ON market_snapshots(market_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_platform ON market_snapshots(platform);
CREATE INDEX IF NOT EXISTS idx_snapshots_snapshot_at ON market_snapshots(snapshot_at DESC);

-- Partition hint: Consider partitioning by snapshot_at for large datasets

-- ============================================
-- MODEL CALIBRATION
-- Track model performance for auto-calibration
-- ============================================
CREATE TABLE IF NOT EXISTS model_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  category TEXT,
  
  -- Calibration data
  predicted_bucket TEXT NOT NULL, -- e.g., '0.6-0.7'
  actual_frequency DECIMAL(5,4) NOT NULL,
  sample_count INTEGER NOT NULL,
  
  -- Time period
  calibration_date DATE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(model_name, category, predicted_bucket, calibration_date)
);

CREATE INDEX IF NOT EXISTS idx_calibration_model ON model_calibration(model_name);
CREATE INDEX IF NOT EXISTS idx_calibration_date ON model_calibration(calibration_date);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate Brier score
CREATE OR REPLACE FUNCTION calculate_brier_score(
  predicted_prob DECIMAL,
  actual_outcome TEXT
) RETURNS DECIMAL AS $$
BEGIN
  IF actual_outcome = 'YES' THEN
    RETURN POWER(1 - predicted_prob, 2);
  ELSE
    RETURN POWER(predicted_prob, 2);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update prediction outcome
CREATE OR REPLACE FUNCTION update_prediction_outcome(
  p_market_id TEXT,
  p_platform TEXT,
  p_outcome TEXT
) RETURNS VOID AS $$
DECLARE
  pred_record RECORD;
BEGIN
  FOR pred_record IN 
    SELECT id, predicted_probability 
    FROM predictions 
    WHERE market_id = p_market_id 
    AND platform = p_platform 
    AND settled = FALSE
  LOOP
    UPDATE predictions
    SET 
      actual_outcome = p_outcome,
      settled = TRUE,
      settled_at = NOW(),
      brier_score = calculate_brier_score(pred_record.predicted_probability, p_outcome),
      accuracy = CASE 
        WHEN (p_outcome = 'YES' AND side = 'YES') OR (p_outcome = 'NO' AND side = 'NO') THEN 1
        WHEN action = 'WAIT' THEN NULL
        ELSE 0
      END,
      updated_at = NOW()
    WHERE id = pred_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate performance metrics
CREATE OR REPLACE FUNCTION aggregate_performance(
  p_category TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  category TEXT,
  platform TEXT,
  total_predictions BIGINT,
  settled_predictions BIGINT,
  accuracy_rate DECIMAL,
  avg_edge DECIMAL,
  avg_brier_score DECIMAL,
  profitable_trades BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.category, 'all') as category,
    COALESCE(p.platform, 'all') as platform,
    COUNT(*) as total_predictions,
    COUNT(*) FILTER (WHERE p.settled = TRUE) as settled_predictions,
    AVG(p.accuracy) FILTER (WHERE p.accuracy IS NOT NULL) as accuracy_rate,
    AVG(p.edge) as avg_edge,
    AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) as avg_brier_score,
    COUNT(*) FILTER (WHERE p.profit_loss > 0) as profitable_trades
  FROM predictions p
  WHERE 
    (p_category IS NULL OR p.category = p_category)
    AND (p_platform IS NULL OR p.platform = p_platform)
    AND p.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY ROLLUP(p.category, p.platform);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Apply updated_at trigger to new tables
DROP TRIGGER IF EXISTS update_predictions_updated_at ON predictions;
CREATE TRIGGER update_predictions_updated_at
    BEFORE UPDATE ON predictions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_updated_at ON performance_metrics;
CREATE TRIGGER update_performance_updated_at
    BEFORE UPDATE ON performance_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trades_updated_at ON user_trades;
CREATE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON user_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

-- View for recent prediction performance
CREATE OR REPLACE VIEW v_recent_performance AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  category,
  platform,
  COUNT(*) as predictions,
  COUNT(*) FILTER (WHERE settled) as settled,
  AVG(accuracy) FILTER (WHERE accuracy IS NOT NULL) as accuracy,
  AVG(edge) as avg_edge,
  AVG(brier_score) FILTER (WHERE brier_score IS NOT NULL) as avg_brier
FROM predictions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), category, platform
ORDER BY date DESC;

-- View for model calibration
CREATE OR REPLACE VIEW v_model_calibration AS
SELECT
  model_name,
  predicted_bucket,
  AVG(actual_frequency) as avg_actual_frequency,
  SUM(sample_count) as total_samples,
  MAX(calibration_date) as last_calibrated
FROM model_calibration
GROUP BY model_name, predicted_bucket
ORDER BY model_name, predicted_bucket;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON predictions TO anon;
GRANT SELECT, INSERT, UPDATE ON performance_metrics TO anon;
GRANT SELECT, INSERT, UPDATE ON market_alerts TO anon;
GRANT SELECT, INSERT, UPDATE ON user_trades TO anon;
GRANT SELECT, INSERT ON market_snapshots TO anon;
GRANT SELECT, INSERT ON model_calibration TO anon;
GRANT SELECT ON v_recent_performance TO anon;
GRANT SELECT ON v_model_calibration TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
