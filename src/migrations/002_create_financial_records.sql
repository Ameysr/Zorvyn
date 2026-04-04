-- ============================================
-- Migration 002: Financial Records Table
-- ============================================
-- All monetary amounts stored as NUMERIC(19,4) — never floats.
-- Department field enables row-level data scoping.

CREATE TABLE IF NOT EXISTS financial_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount          NUMERIC(19, 4) NOT NULL,
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('income', 'expense', 'transfer')),
    category        VARCHAR(100) NOT NULL,
    description     TEXT,
    date            DATE NOT NULL,
    department      VARCHAR(100) NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Performance indexes (partial — exclude soft-deleted)
CREATE INDEX IF NOT EXISTS idx_records_department ON financial_records(department) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_records_type ON financial_records(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_records_category ON financial_records(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_records_date ON financial_records(date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_records_created_by ON financial_records(created_by);
CREATE INDEX IF NOT EXISTS idx_records_type_date ON financial_records(type, date) WHERE deleted_at IS NULL;
