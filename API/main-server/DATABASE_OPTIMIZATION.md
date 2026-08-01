# Database Optimization Guide

This document describes the database schema, indexing strategy, and scalability features of the VaultKe backend.

## Database Technology

- **PostgreSQL** via **Neon** (serverless, hosted on AWS us-east-1)
- Driver: `github.com/lib/pq` (v1.11.2)
- Connection pooling configured in `database/database.go` and `cmd/init_server.go`

## Connection Pool Settings

| Setting | Value | Purpose |
|---|---|---|
| MaxOpenConns | 100 | Maximum concurrent connections |
| MaxIdleConns | 25 | Idle connections kept ready |
| ConnMaxLifetime | 10 min | Max lifetime of a connection |
| ConnMaxIdleTime | 5 min | Max time a connection can sit idle |

## Schema Flexibility

- All string fields use `TEXT` type (no length constraints)
- JSON data stored as `TEXT` for opaque payloads; `JSONB` for queryable metadata
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` used throughout for idempotent schema evolution
- `CHECK` constraints used for enum-like field validation without rigid PostgreSQL enums

## JSONB Columns (Queryable)

The following columns store JSONB data and support GIN indexing for efficient querying:

| Table | Column | Content |
|---|---|---|
| chat_messages | image_urls | JSON array of image URLs |

TEXT columns that contain JSON (to be migrated to JSONB):
- `chamas.rules` — JSON array of chama rules
- `notifications.data` — notification payload JSON
- `transactions.metadata` — transaction metadata JSON
- `chat_messages.metadata` — message metadata JSON

The `MigrateJSONBConversions` function in `database/migrations/indexes_missing.go` handles safe conversion of these columns with GIN index creation.

## Indexing Strategy

### Missing Indexes Added (via `MigrateMissingIndexes`)

New indexes were added to support common query patterns:

| Table | Column(s) | Purpose |
|---|---|---|
| users | role, status, is_email_verified, is_phone_verified, created_at | User lookup and filtering |
| chamas | status, category, type, created_by | Chama discovery and filtering |
| chama_members | role, is_active | Membership role checks |
| transactions | status, type, payment_method, created_at | Transaction filtering |
| wallets | currency, is_active | Wallet filtering |
| loans | status, type, borrower_id, approval_stage | Loan tracking |
| notifications | user_id+is_read+status, created_at | Unread notification queries |
| chama_invitations | status+expires_at | Invitation management |
| loan_types | status, created_by | Loan type lookup |
| loan_approval_otps | expires_at, verified | OTP expiration cleanup |
| loan_payments | paid_at | Payment history |
| loan_fines | status | Fine tracking |
| disbursements | metadata | Disbursement queries |
| merry_go_round_payments | metadata | Payment tracking |
| chat_messages | sender_id+created_at | Message history |
| chat_room_members | user_id+is_active | Room membership checks |

### Existing Indexes

- Composite indexes for common query patterns (e.g., `transactions(chama_id, type, status, created_at DESC)`)
- Partial indexes for active/undeleted records
- Consistent naming convention (`idx_{table}_{columns}`)

## Scalability Features

### Monitoring

- **Slow query logging** — configurable via `ENABLE_SLOW_QUERY_LOG` and `SLOW_QUERY_THRESHOLD_MS` env vars (default: log queries > 1000ms)
- **Metrics endpoint** — enabled by default on port 9090
- **Request duration logging** — requests exceeding the slow query threshold are logged with `🚨 SLOW REQUEST` prefix

### Backup

- Backup configuration enabled by default (`BACKUP_ENABLED=true`)
- Backup interval: 24 hours (configurable via `BACKUP_INTERVAL`)
- Backup path: `./backups`

### Caching

- **In-memory LRU cache** — 10,000 items max, 5-minute default TTL
- **Cache middleware** — caches GET responses with 60-second TTL
- **Redis-ready interface** — the `Cache` interface in `internal/services/cache.go` can be swapped for a Redis backend when the `go-redis` dependency is added

## Migration System

The migration system uses a `migrations` tracking table and runs migrations sequentially. Each migration is idempotent with `CREATE INDEX IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS`.

### Migration Order

1. `misc.go` — extension setup
2. `core.go` — core tables (users, devices, Signal, E2EE)
3. `chamas.go` — chama tables + indexes
4. `wallets.go` — wallet/transaction tables + indexes
5. `loans.go` — loan tables + indexes
6. `welfare.go` — welfare tables
7. `merry_go_round.go` — merry-go-round tables
8. `merry_go_round_payments.go` — payment tables
9. `shares_dividends.go` — shares/dividends tables
10. `chat.go` — chat tables + indexes
11. `indexes_chat_perf.go` — chat performance indexes
12. `meetings.go` — meeting tables
13. `polls_votes.go` — poll/vote tables
14. `notifications.go` — notification tables + indexes
15. `disbursements.go` — disbursement tables
16. `reminders.go` — reminder tables
17. `registry.go` — (migration tracking)
18. `indexes_perf.go` — statistics indexes
19. **`indexes_missing.go`** — missing indexes + JSONB conversion (NEW)

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_METRICS` | `true` | Enable Prometheus metrics endpoint |
| `METRICS_PORT` | `9090` | Port for metrics endpoint |
| `ENABLE_SLOW_QUERY_LOG` | `true` | Enable slow query logging |
| `SLOW_QUERY_THRESHOLD_MS` | `1000` | Slow query threshold in milliseconds |
| `BACKUP_ENABLED` | `true` | Enable database backup |
| `BACKUP_INTERVAL` | `24` | Backup interval in hours |
| `BACKUP_PATH` | `./backups` | Backup storage path |

## Future Improvements

1. **Redis caching** — Add `go-redis/v9` dependency and swap `InMemoryCache` for `RedisCache` in production
2. **Read replicas** — Configure a read replica for the Neon database to separate read and write workloads
3. **Table partitioning** — Partition large tables (`transactions`, `chat_messages`, `notifications`) by date range
4. **Connection pooling proxy** — Add pgBouncer for connection pooling when scaling to multiple API instances
5. **Query result caching** — Add `EXPLAIN ANALYZE` monitoring to identify missing indexes for new query patterns
