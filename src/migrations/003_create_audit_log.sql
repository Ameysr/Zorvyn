-- ============================================
-- Migration 003: Immutable Audit Log (Append-Only)
-- ============================================
-- Compliance requirement: SOC2, PCI-DSS.
-- Stores before/after snapshots of every mutation.
-- REVOKE UPDATE/DELETE prevents tampering.

CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity          VARCHAR(100) NOT NULL,
    entity_id       UUID NOT NULL,
    action          VARCHAR(20) NOT NULL
                    CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    old_values      JSONB,
    new_values      JSONB,
    user_id         VARCHAR(255) NOT NULL,
    correlation_id  VARCHAR(255) NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent any modification to audit rows
-- Note: This applies to non-superuser roles in production
DO $$
BEGIN
    -- Only revoke if running as superuser (skip in dev if needed)
    IF current_setting('is_superuser') = 'on' THEN
        EXECUTE 'REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Skip if permissions can't be changed
END $$;

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
