-- PredictMax Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONVERSATIONS TABLE
-- Stores chat conversations between users and PredictMax
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- ============================================
-- MESSAGES TABLE
-- Stores individual messages in conversations
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster conversation message lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================
-- MARKETS CACHE TABLE
-- Cached market data from Kalshi, Polymarket, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS markets_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  market_id TEXT NOT NULL,
  ticker TEXT,
  question TEXT,
  category TEXT,
  end_date TIMESTAMPTZ,
  yes_price DECIMAL(10,4),
  no_price DECIMAL(10,4),
  volume DECIMAL(20,2),
  liquidity DECIMAL(20,2),
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, market_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_markets_cache_platform ON markets_cache(platform);
CREATE INDEX IF NOT EXISTS idx_markets_cache_category ON markets_cache(category);
CREATE INDEX IF NOT EXISTS idx_markets_cache_updated_at ON markets_cache(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_markets_cache_volume ON markets_cache(volume DESC);

-- ============================================
-- USER PREFERENCES TABLE (Optional)
-- Store user-specific settings and preferences
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  risk_profile TEXT DEFAULT 'moderate' CHECK (risk_profile IN ('conservative', 'moderate', 'aggressive')),
  preferred_categories TEXT[] DEFAULT '{}',
  liquidity_preference TEXT DEFAULT 'medium' CHECK (liquidity_preference IN ('high', 'medium', 'low')),
  time_horizon_days INTEGER DEFAULT 30,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- ============================================
-- WATCHLIST TABLE (Optional)
-- Markets that users are tracking
-- ============================================
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  market_id TEXT NOT NULL,
  notes TEXT,
  price_alert_above DECIMAL(10,4),
  price_alert_below DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, market_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Uncomment if using Supabase Auth
-- ============================================

-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view own conversations" ON conversations
--   FOR SELECT USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can create own conversations" ON conversations
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to conversations table
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_preferences table
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANT PERMISSIONS (for anon/authenticated roles)
-- ============================================

-- Grant access to anon role (for public API access)
GRANT SELECT, INSERT, UPDATE ON conversations TO anon;
GRANT SELECT, INSERT ON messages TO anon;
GRANT SELECT, INSERT, UPDATE ON markets_cache TO anon;
GRANT SELECT, INSERT, UPDATE ON user_preferences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON watchlist TO anon;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
