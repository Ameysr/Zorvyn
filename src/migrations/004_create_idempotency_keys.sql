-- ============================================
-- Migration 004: Idempotency Keys Table
-- ============================================
-- Prevents duplicate operations from retries/timeouts.
-- Keys expire after 24 hours (cleaned up by cron/app logic).

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key             VARCHAR(255) PRIMARY KEY,
    user_id         UUID NOT NULL,
    method          VARCHAR(10) NOT NULL,
    path            VARCHAR(500) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'completed', 'failed')),
    response_code   INTEGER,
    response_body   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_user ON idempotency_keys(user_id);
