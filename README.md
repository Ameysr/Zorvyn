# Zorvyn Finance Backend

**Enterprise-grade Financial Data Processing & Access Control API**

A compliance-first backend system built with Node.js (TypeScript), PostgreSQL, and Redis. Designed around the same architectural principles used at companies like Stripe, Razorpay, and Goldman Sachs — where precision, auditability, and resilience are non-negotiable.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL and Redis connection strings

# 3. Run database migrations
npm run migrate

# 4. Seed demo data (3 users + 100 financial records)
npm run seed

# 5. Start development server
npm run dev

# Server runs at http://localhost:3000
# Swagger UI at http://localhost:3000/api/docs
# Health probe at http://localhost:3000/health
# Readiness probe at http://localhost:3000/ready
```

### Demo Credentials

| Role | Email | Password | Department | Permissions |
|------|-------|----------|------------|------------|
| Admin | `admin@zorvyn.io` | `Password123!` | headquarters | Full CRUD + User Management |
| Analyst | `analyst@zorvyn.io` | `Password123!` | finance | CRUD + Dashboard Analytics |
| Viewer | `viewer@zorvyn.io` | `Password123!` | marketing | Read-only (own department) |

---

## Architecture

```
+-----------------------------------------------------+
|                    Express.js                        |
|  +----------+----------+----------+--------------+   |
|  | Helmet   | CORS     | Rate     | Correlation  |   |
|  | (CSP)    | (Origin) | Limiter  | ID Tracer    |   |
|  +----------+----------+----------+--------------+   |
|  +----------+----------+----------+--------------+   |
|  | JWT Auth | RBAC     | Scope    | Idempotency  |   |
|  | Verify   | Guard    | Filter   | Layer        |   |
|  +----------+----------+----------+--------------+   |
|  +----------------------------------------------+    |
|  |       Route -> Service -> Repository          |    |
|  |       (with atomic transactions)              |    |
|  +----------------------------------------------+    |
|  +----------+--------------------------------+       |
|  | Audit    |  Structured Logger (Pino)      |       |
|  | Trail    |  + AsyncLocalStorage Tracing   |       |
|  +----------+--------------------------------+       |
+------------+----------------------------+------------+
             |                            |
     +-------v-------+          +--------v--------+
     |  PostgreSQL    |          |     Redis       |
     |  (Neon Cloud)  |          |  (Redis Cloud)  |
     |  NUMERIC(19,4) |          |  Idempotency    |
     |  Audit Log     |          |  Rate Limiting  |
     |  REVOKE perms  |          |  Caching        |
     +----------------+          +-----------------+
```

### Project Structure

```
zorvyn-finance-backend/
├── .github/workflows/     # CI/CD pipeline (GitHub Actions)
│   └── ci.yml             # Lint, build, test, security audit
├── src/
│   ├── config/            # Database, Redis, and environment configuration
│   │   ├── database.ts    # PostgreSQL pool + migration runner
│   │   ├── redis.ts       # Redis client with retry strategy
│   │   └── env.ts         # Joi-validated environment variables
│   ├── middleware/        # Request pipeline (8 middleware layers)
│   │   ├── correlationId.ts   # End-to-end request tracing
│   │   ├── authenticate.ts    # JWT verification
│   │   ├── authorize.ts       # Role-based access control
│   │   ├── scopeFilter.ts     # Row-level department isolation
│   │   ├── idempotency.ts     # Duplicate request prevention
│   │   ├── rateLimiter.ts     # Redis-backed rate limiting
│   │   ├── requestLogger.ts   # Structured request/response logging
│   │   └── errorHandler.ts    # Global error handler with AppError
│   ├── modules/           # Domain modules (controller -> service -> SQL)
│   │   ├── auth/          # Register, Login, Refresh, Me, Logout
│   │   ├── users/         # User management (admin only)
│   │   ├── financial-records/  # CRUD + filtering + CSV export
│   │   ├── dashboard/     # Analytics with Redis caching (60s TTL)
│   │   └── audit/         # Audit log viewer (admin only)
│   ├── shared/            # Cross-cutting utilities
│   │   ├── logger.ts      # Pino logger with correlation ID injection
│   │   ├── transaction.ts # withTransaction() wrapper
│   │   ├── money.ts       # Precision money handling (decimal.js)
│   │   ├── audit.service.ts # Immutable audit trail writer
│   │   └── apiResponse.ts # Standardized API response helper
│   ├── migrations/        # Versioned SQL migration files
│   ├── app.ts             # Express application assembly
│   └── server.ts          # Entry point + graceful shutdown
├── tests/                 # Integration test suite (Jest + Supertest)
├── scripts/               # Migration runner + seed data generator
├── Dockerfile             # Multi-stage build (builder + production)
├── docker-compose.yml     # Local dev: API + PostgreSQL + Redis
├── openapi.yaml           # OpenAPI 3.0 contract specification
└── .env.example           # Environment template
```

---

## Key Features

### 1. End-to-End Request Tracing (Correlation IDs)

Every request is tagged with an `X-Correlation-ID` (UUID v4). If the client sends one, we echo it back; otherwise, we generate it. This ID is injected into every log line via `AsyncLocalStorage`, enabling cross-layer debugging without passing context manually.

```
Request -> Middleware -> Service -> SQL -> Response
    |          |          |       |        |
 [corr-id] [corr-id] [corr-id] [corr-id] [corr-id]  <- same ID everywhere
```

### 2. Atomic Financial Mutations with Auto-Rollback

Every `POST`, `PUT`, and `DELETE` that touches financial data is wrapped in `withTransaction()`. If the primary operation, audit log write, or idempotency check fails — the entire transaction rolls back. No partial state ever reaches the database.

```typescript
await withTransaction(async (client) => {
  const record = await createRecord(client, data);   // Step 1: Insert
  await auditService.log(client, { ... });            // Step 2: Audit
  // If Step 2 fails -> Step 1 auto-rolls back
  return record;
});
```

### 3. Network-Resilient Idempotency Layer

Clients can send an `X-Idempotency-Key` header. The first request is processed normally and its response is cached in Redis (24h TTL). Duplicate requests with the same key return the cached response — preventing double charges, duplicate entries, or data corruption in lossy networks.

Redis serves as the primary store; PostgreSQL's `idempotency_keys` table provides a durable fallback if Redis is temporarily unavailable.

### 4. Row-Level Department Scoping

Non-admin users can only see data from their own department. This is enforced at the middleware layer — a `scopeFilter` automatically injects a `WHERE department = $user_dept` clause into every query. This means:

- A `viewer` in Marketing sees **only** Marketing records
- An `analyst` in Finance sees **only** Finance records
- An `admin` sees **everything** (scope filter is bypassed)

### 5. Immutable Audit Trail

Every mutation is recorded in an append-only `audit_log` table with JSONB diff snapshots. The table has `REVOKE UPDATE, DELETE` permissions — even database admins cannot modify or delete audit entries once written. Each log entry captures:

- Who (user_id)
- What (entity_type + entity_id)
- When (timestamp)
- Action (CREATE / UPDATE / DELETE)
- Changes (JSONB before/after diff)

### 6. Precision Money Handling

Financial amounts are stored as `NUMERIC(19,4)` in PostgreSQL (supports values up to 999 trillion with 4 decimal places). All arithmetic uses `decimal.js` — JavaScript's native `Number` type is rejected to prevent floating-point rounding errors.

```
  JavaScript:  0.1 + 0.2 = 0.30000000000000004  <- WRONG
  decimal.js:  0.1 + 0.2 = 0.3                   <- CORRECT
```

### 7. Graceful Shutdown

On `SIGTERM` or `SIGINT`, the server:
1. Stops accepting new connections
2. Waits up to 30 seconds for in-flight requests to complete
3. Closes the PostgreSQL connection pool
4. Closes the Redis connection
5. Exits cleanly

### 8. Health and Readiness Probes

- `GET /health` — Returns `200` if the process is alive (liveness probe)
- `GET /ready` — Returns `200` only if both PostgreSQL and Redis are connected (readiness probe)

### 9. Dashboard Caching (Redis)

Dashboard aggregation queries (summary, category breakdown, trends) are cached in Redis with a 60-second TTL. The cache is automatically invalidated on every financial record mutation (create, update, delete), so analytics are always consistent with the underlying data.

- Cache HIT: served from Redis in <1ms
- Cache MISS: fetched from PostgreSQL, then cached
- If Redis is unavailable: falls through to database (fail-open pattern)

### 10. CSV Export

`GET /api/v1/records/export` generates a downloadable CSV file of all visible financial records (respecting department scoping). Supports the same filters as the list endpoint (`?type=income&date_from=2026-01-01`). Outputs RFC 4180-compliant CSV with proper `Content-Disposition` headers.

### 11. Audit Log Viewer

The immutable audit trail is exposed via API for admin users:

- `GET /api/v1/audit-logs` — Paginated list of all mutations with user details
- `GET /api/v1/audit-logs/:entityId` — Full change history for a specific record

Supports filtering by `entity`, `action`, and `user_id`.

### 12. Security Hardening

- **Helmet** — CSP, HSTS, XSS Protection, frameguard
- **CORS** — Origin-restricted in production, permissive in development
- **Rate Limiting** — Redis-backed, 100 requests per 15 minutes per IP
- **JWT** — Short-lived access tokens (15min) + rotating refresh tokens
- **bcrypt** — 12-round password hashing
- **Input Validation** — Joi schemas on all endpoints

---

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Register a new user |
| POST | `/api/v1/auth/login` | Public | Login and receive tokens |
| POST | `/api/v1/auth/refresh` | Public | Refresh access token (with rotation) |
| GET | `/api/v1/auth/me` | Bearer | Get current user profile |
| POST | `/api/v1/auth/logout` | Bearer | Revoke refresh token |

### Users (Admin Only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/users` | Admin | List all users |
| GET | `/api/v1/users/:id` | Admin | Get user by ID |
| PATCH | `/api/v1/users/:id/role` | Admin | Update user role |

### Financial Records

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/records` | Bearer | List records (paginated, filtered, scoped) |
| GET | `/api/v1/records/export` | Admin/Analyst | Download records as CSV |
| GET | `/api/v1/records/:id` | Bearer | Get single record |
| POST | `/api/v1/records` | Admin/Analyst | Create a record (idempotent) |
| PUT | `/api/v1/records/:id` | Admin/Analyst | Update a record |
| DELETE | `/api/v1/records/:id` | Admin | Soft-delete a record |

**Filters:** `?type=income&category=salary&date_from=2026-01-01&date_to=2026-12-31&page=1&limit=20`

### Dashboard (Redis-cached, 60s TTL)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/dashboard/summary` | Admin/Analyst | Total income, expenses, net balance |
| GET | `/api/v1/dashboard/category-breakdown` | Admin/Analyst | Amounts grouped by category |
| GET | `/api/v1/dashboard/trends` | Admin/Analyst | Monthly income/expense trends |
| GET | `/api/v1/dashboard/recent-activity` | Bearer | Recent records with creator names |

### Audit Logs (Admin Only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/audit-logs` | Admin | List all audit entries (paginated) |
| GET | `/api/v1/audit-logs/:entityId` | Admin | Full change history for a record |

**Audit Filters:** `?entity=financial_record&action=UPDATE&user_id=<uuid>&page=1&limit=20`

---

## Testing

Integration tests use **Jest + Supertest** against the live API with real PostgreSQL and Redis connections.

```bash
# Run all tests
npm test

# Run with verbose output
npm run test:verbose
```

### Test Coverage

| Suite | Tests | What it validates |
|-------|-------|-------------------|
| `health.test.ts` | 4 | Health/readiness probes, correlation ID propagation, 404 handler |
| `auth.test.ts` | 8 | Registration, login, token refresh with rotation, protected routes |
| `rbac-scope.test.ts` | 10 | Role permissions, department scope isolation, cross-dept access denial |
| `records.test.ts` | 9 | CRUD lifecycle, precision money, filtering, pagination, soft-delete |
| `dashboard.test.ts` | 5 | Summary aggregation, analyst scope, category breakdown, trends |
| `idempotency.test.ts` | 4 | Duplicate prevention, cached responses, different-key creation |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js | Event-driven, non-blocking I/O for high-concurrency APIs |
| Language | TypeScript | Compile-time type safety, better IDE support, catch bugs early |
| Framework | Express.js | Minimal, composable, industry-standard |
| Database | PostgreSQL (Neon) | ACID compliance, NUMERIC precision, JSONB for audit diffs |
| Cache | Redis (Cloud) | Dashboard caching, idempotency lookups, rate limiting |
| Auth | JWT + bcrypt | Stateless authentication with secure password hashing |
| Validation | Joi | Declarative schema validation with detailed error messages |
| Logging | Pino | Structured JSON logging, 30x faster than Winston |
| Money | decimal.js | Arbitrary-precision arithmetic, prevents rounding errors |
| API Docs | OpenAPI 3.0 + Swagger UI | Contract-first design, interactive documentation |
| Testing | Jest + Supertest | Integration tests against real infrastructure |
| CI/CD | GitHub Actions | Automated lint, build, test, and security audit on push |
| Containers | Docker + Compose | One-command local dev: API + PostgreSQL + Redis |

---

## Architecture Decision Records (ADRs)

### ADR-001: Raw SQL over ORM

**Decision:** Use raw parameterized SQL queries via `pg` instead of an ORM like Prisma or TypeORM.

**Rationale:**
- Full control over query performance and optimization
- No magic — every SQL statement is explicit and auditable
- ORMs can hide important performance characteristics (N+1 queries, unnecessary JOINs)
- Financial systems benefit from precise control over transactions and locking
- Easier to reason about NUMERIC precision behavior

**Trade-off:** More boilerplate, but significantly more transparency and control.

### ADR-002: AsyncLocalStorage for Correlation IDs

**Decision:** Use Node.js `AsyncLocalStorage` API instead of passing context through function parameters.

**Rationale:**
- Avoids polluting every function signature with a `context` parameter
- Automatically propagates through async/await chains, timers, and event emitters
- The same pattern used by OpenTelemetry and Datadog APM
- Zero performance overhead per Node.js documentation

### ADR-003: NUMERIC(19,4) + decimal.js for Money

**Decision:** Store all monetary values as `NUMERIC(19,4)` in PostgreSQL and use `decimal.js` for JavaScript calculations.

**Rationale:**
- JavaScript's `Number` type uses IEEE 754 double-precision floats — infamous for `0.1 + 0.2 != 0.3`
- In financial systems, even a $0.01 rounding error can compound into material discrepancies during settlement
- `NUMERIC(19,4)` supports values up to `999,999,999,999,999.9999` — sufficient for any enterprise
- `decimal.js` provides arbitrary-precision arithmetic in JavaScript

### ADR-004: Redis Primary + PostgreSQL Fallback for Idempotency

**Decision:** Use Redis as the primary idempotency store with PostgreSQL as a durable fallback.

**Rationale:**
- Redis provides sub-millisecond lookups — critical for low-latency duplicate detection
- If Redis is temporarily unavailable, the fallback checks PostgreSQL's `idempotency_keys` table
- This "fail-open" pattern maintains availability even during infrastructure degradation
- 24-hour TTL in Redis prevents unbounded memory growth

### ADR-005: Middleware-Level Scope Filtering

**Decision:** Implement department scoping as Express middleware rather than at the query level.

**Rationale:**
- Centralizes the scoping logic — impossible to forget adding `WHERE department = ?` in a new endpoint
- Developers of new modules get scope isolation for free
- Admin bypass is handled in one place, not scattered across services
- Follows the principle of "security by default, opt-out by privilege"

### ADR-006: Append-Only Audit with REVOKE Permissions

**Decision:** Create the `audit_log` table with `REVOKE UPDATE, DELETE` at the database level.

**Rationale:**
- Application-level "don't delete" policies can be bypassed by bugs or direct database access
- `REVOKE` enforces immutability at the PostgreSQL permission layer — even superusers with app credentials cannot tamper with audit history
- This meets SOX/PCI compliance requirements for financial audit trails
- JSONB diffs capture before/after state for full reconstruction

---

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Redis
REDIS_URL=redis://user:pass@host:port

# Authentication
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

---

## Deployment

### Production Build

```bash
npm run build        # Compile TypeScript -> dist/
npm start            # Run compiled JavaScript
```

### Docker (Local Development)

```bash
docker compose up    # Starts API + PostgreSQL 16 + Redis 7
```

The Dockerfile uses a multi-stage build: the builder stage compiles TypeScript, and the production stage runs only the compiled JavaScript with a non-root user.

### Cloud-Native

The system is configured for zero-install deployment:
- **Database:** Neon (serverless PostgreSQL)
- **Cache:** Redis Cloud (managed Redis)
- **App:** Deploy to Render, Railway, or any Node.js host

Health probes at `/health` and `/ready` are compatible with Kubernetes liveness/readiness configurations.

### CI/CD

Every push to `main` or `develop` triggers the GitHub Actions pipeline:

1. **Lint and Build** — TypeScript type check + production build
2. **Integration Tests** — Full 49-test suite against real infrastructure
3. **Security Audit** — `npm audit` for known dependency vulnerabilities

---

## License

MIT License — see [LICENSE](LICENSE) for details.
