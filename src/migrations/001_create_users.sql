-- ============================================
-- Migration 001: Users Table
-- ============================================
-- Users with role-based access and department scoping.
-- Department field enables implicit row-level data isolation.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('viewer', 'analyst', 'admin')),
    department      VARCHAR(100) NOT NULL DEFAULT 'general',
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE deleted_at IS NULL;
