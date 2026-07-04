# VaultKe API Backend Documentation

## Table of Contents
1. [Overview](#overview)
2. [Service 1: Main Server (API Gateway)](#service-1-main-server-api-gateway)
3. [Service 2: Chat Service](#service-2-chat-service)
4. [Service 3: Meeting Service](#service-3-meeting-service)
5. [Database Schema Reference](#database-schema-reference)
6. [Security Features](#security-features)
7. [Inter-Service Communication](#inter-service-communication)
8. [Deployment Configuration](#deployment-configuration)
9. [Monitoring & Observability](#monitoring--observability)
10. [API Versioning](#api-versioning)
11. [Error Handling](#error-handling)
12. [Related Documentation](#related-documentation)

## Overview

VaultKe is a comprehensive chama (investment group) management platform consisting of **3 microservices** working together to provide a complete API backend for group financial management, communication, and meetings.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                           API Gateway (main-server:8085)               │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐ │
│  │   Auth Layer     │    │   Route Layer    │    │  Proxy Layer     │ │
│  │  JWT Validation  │    │  All Endpoints   │    │  -> Meeting SVC  │ │
│  └──────────────────┘    └─────────┬──────────┘    └──────────────────┘ │
│                                   │                                    │
│                                   ▼                                    │
│                         ┌──────────────────┐                           │
│                         │  Proxy Layer     │                           │
│                         │  -> Chat Service │                           │
│                         └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Shared PostgreSQL Database                     │
│  Users | Chamas | Wallets | Transactions | Chat Rooms | Meetings       │
└─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                                               │
            ▼                                               ▼
┌───────────────────────────┐               ┌───────────────────────────┐
│   Chat Service (8084)       │               │   Meeting Service (8086)  │
│  WebSocket | Messages      │               │   WebRTC | Signaling      │
└───────────────────────────┘               └───────────────────────────┘
```

---

## Service 1: Main Server (API Gateway)

**Port:** 8085 | **Module:** `vaultke-backend` | **Framework:** Gin (Go)

The main server acts as the API gateway, handling authentication, core business logic, and proxying requests to the chat and meeting microservices.

### Architecture Layers

#### 1. Entry Point Layer (`main.go`)
- Application bootstrap
- Environment configuration loading
- Database initialization and migrations
- TLS 1.3 support with cipher suite restrictions
- Graceful shutdown with signal handling
- Service initialization (Auth, Email, Notification Scheduler)

#### 2. Configuration Layer (`config/config.go`)
Configuration loaded from environment variables:

| Category | Variables |
|----------|-----------|
| **Server** | `ENVIRONMENT`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRATION` |
| **M-Pesa** | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_INITIATOR_NAME`, `MPESA_INITIATOR_PASSWORD` |
| **Firebase** | `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_SERVER_KEY` |
| **Google Drive** | `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URL` |
| **Email (SMTP)** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` |
| **SMS (Africa's Talking)** | `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER` |
| **Redis** | `REDIS_URL`, `REDIS_PASSWORD` |
| **Microservices** | `MEETING_SERVICE_URL`, `CHAT_SERVICE_URL` |

#### 3. Security Layer (`internal/middleware/`)

##### Authentication Middleware (`auth.go`)
- JWT token validation with HMAC-SHA256
- Token claims extraction (userID, userRole, userEmail)
- Role-based access control (`RequireRole`, `RequireRoles`)
- Chama membership validation (`RequireChamaMembership`, `RequireChamaChatAccess`)

##### Security Middleware (`security.go`)
| Feature | Implementation |
|---------|---------------|
| Request Size Limit | 10MB max |
| Rate Limiting | Per-IP rate limiters (configurable, 10000 req/min default) |
| Content-Type Validation | JSON, multipart/form-data, x-www-form-urlencoded |
| Security Headers | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, CSP |
| Input Validation | Query parameter injection detection, length limits |
| File Upload Security | Type validation, size limits (5MB), dangerous extension blocking |
| Auth Rate Limiting | Stricter limits for auth endpoints (500 req/min) |

##### CORS Middleware (`cors.go`)
- Configurable allowed origins
- Credentials support
- Preflight handling

#### 4. Database Layer (`database/`)

##### Connection Management
- PostgreSQL with connection pooling (25 max open/idle connections)
- Connection lifetime: 5 minutes
- Automatic migration on startup

##### Migration Modules
| Migration File | Tables Created |
|---------------|---------------|
| `core.go` | users, devices, signal_identity_keys, signal_pre_keys, signal_signed_pre_keys, signal_sessions, signal_messages, e2ee_key_bundles, e2ee_sessions, refresh_tokens |
| `chamas.go` | chamas, chama_members, subscription_payments, service_fee_payments, chama_invitations |
| `wallets.go` | wallets, transactions |
| `loans.go` | loans, loan_payments, guarantors, loan_types |
| `welfare.go` | welfare_requests, welfare_contributions |
| `merry_go_round.go` | merry_go_rounds, mgr_cycles |
| `shares_dividends.go` | shares, dividends, share_offerings |
| `chat.go` | chat_rooms, chat_messages, chat_room_members |
| `meetings.go` | meeting_rooms, meeting_participants, webrtc_sessions, room_chat_messages |
| `polls_votes.go` | polls, poll_options, votes |
| `notifications.go` | notifications, notification_preferences, notification_settings |
| `learning.go` | learning_categories, learning_courses, user_course_progress |
| `disbursements.go` | disbursement_batches, disbursement_items, transparency_logs |
| `reminders.go` | reminders |

### Data Models

#### User Model
```go
type User struct {
    ID                  string     // UUID
    Email               string     // Unique
    Phone               string     // Unique
    FirstName, LastName string
    PasswordHash        string
    Avatar              *string
    Role                UserRole   // user, admin
    Status              UserStatus // pending, active, suspended, verified
    IsEmailVerified     bool
    IsPhoneVerified     bool
    Language, Theme     string
    County, Town         *string
    Latitude, Longitude  *float64
    BusinessType        *string
    BusinessDescription  *string
    Bio, Occupation      *string
    DateOfBirth, Gender  *string
    IDNumber             *string
    Rating               float64
    TotalRatings         int
    RegistrationFeePaid bool
    CreatedAt, UpdatedAt time.Time
}
```

#### Chama Model
```go
type Chama struct {
    ID                    string        // UUID
    Name, Description   string
    Category              ChamaCategory // chama, contribution
    Type                  ChamaType     // investment, savings, business, welfare, merry-go-round, emergency, medical, education, community, personal
    Status                ChamaStatus
    County, Town          string
    Latitude, Longitude   *float64
    ContributionAmount    float64
    ContributionFrequency string
    TargetAmount, TargetDeadline *float64, *time.Time
    MaxMembers, CurrentMembers   *int, int
    TotalFunds                   float64
    IsPublic, RequiresApproval  bool
    Rules                       []string
    MeetingSchedule             *MeetingSchedule
    MonthlySubscriptionFee     float64
    ChatRoomID                 *string
    CreatedBy                    string
    CreatedAt, UpdatedAt         time.Time
}
```

#### Wallet & Transaction Models
```go
type Wallet struct {
    ID              string
    Type            WalletType    // personal, chama, business
    OwnerID         string
    SubWalletType   ChamaWalletType // main, savings, welfare, merry_go_round, loan, shares, dividends, contribution
    ChamaID         *string
    Balance         float64
    Currency        string
    IsActive, IsLocked bool
    DailyLimit, MonthlyLimit *float64
    CreatedAt, UpdatedAt time.Time
}

type Transaction struct {
    ID            string
    FromWalletID, ToWalletID *string
    Type          TransactionType // deposit, withdrawal, transfer, contribution, loan, loan_repayment, purchase, refund, fee
    Status        TransactionStatus // pending, completed, failed, cancelled, processing
    Amount        float64
    Currency      string
    Description   *string
    Reference     *string
    PaymentMethod PaymentMethod // mpesa, bank_transfer, cash, wallet_transfer
    Fees          float64
    InitiatedBy   string
    RecipientID   *string
    ChamaID       string
    Metadata      map[string]interface{}
    RequiresApproval bool
    ApprovalDeadline *time.Time
    CreatedAt, UpdatedAt time.Time
}
```

### API Endpoints

#### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | User registration with validation |
| POST | `/login` | User login, returns JWT + refresh token |
| POST | `/logout` | Invalidate session |
| POST | `/refresh` | Refresh access token with rotation |
| POST | `/verify-email` | Email verification |
| POST | `/verify-phone` | Phone verification |
| POST | `/forgot-password` | Initiate password reset |
| POST | `/reset-password` | Complete password reset |
| POST | `/send-email-verification` | Resend verification email |
| POST | `/verify-email-code` | Verify email with code |
| POST | `/check-email-verification-status` | Check verification status |
| POST | `/send-onboarding-totp` | Send TOTP for onboarding |
| POST | `/verify-onboarding-totp` | Verify TOTP for onboarding |

#### Users (`/api/v1/users`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all users (admin) |
| GET | `/:id` | Get user by ID |
| GET | `/admin/all` | Get all users (admin) |
| GET | `/admin/statistics` | Platform statistics |
| GET | `/admin/analytics` | System analytics |
| GET | `/profile` | Get current user profile |
| PUT | `/profile` | Update profile |
| POST | `/avatar` | Upload avatar |
| DELETE | `/:id` | Delete user |
| POST | `/onboard` | Complete onboarding |

#### Chamas (`/api/v1/chamas`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List chamas |
| POST | `/` | Create chama |
| GET | `/my` | Get user's chamas |
| GET | `/:id` | Get chama details |
| PUT | `/:id` | Update chama |
| DELETE | `/:id` | Delete chama |
| GET | `/:id/members` | Get chama members |
| POST | `/:id/invite` | Send invitation |
| GET | `/invitations` | Get user invitations |
| POST | `/:id/invitations/:id/respond` | Respond to invitation |
| GET | `/:id/transactions` | Get chama transactions |
| GET | `/:id/statistics` | Get chama statistics |
| GET | `/:id/eligible-loan-members` | Get eligible loan members |

#### Wallets (`/api/v1/wallets`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List wallets |
| GET | `/balance` | Get wallet balance |
| GET | `/transactions` | Get user transactions |
| POST | `/transfer` | Transfer money |
| POST | `/deposit` | Deposit money |
| POST | `/withdraw` | Withdraw money |
| POST | `/registration-payment` | Pay registration fee |

#### Sub-Wallets (`/api/v1/chamas/:id/subwallets`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get chama sub-wallets |
| GET | `/:type/transactions` | Get transactions by type |
| POST | `/:type/pay` | Pay to sub-wallet |
| POST | `/:type/withdraw` | Withdraw from sub-wallet |

#### Loans (`/api/v1/loans`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List loan applications |
| POST | `/apply` | Apply for loan |
| GET | `/:id` | Get loan details |
| PUT | `/:id` | Update loan application |
| POST | `/:id/approve` | Approve loan |
| POST | `/:id/reject` | Reject loan |
| POST | `/:id/disburse` | Disburse loan funds |
| POST | `/:id/guarantor-response` | Respond to guarantor request |
| GET | `/guarantor-requests` | Get guarantor requests |

#### Welfare (`/api/v1/welfare`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List welfare requests |
| POST | `/` | Create welfare request |
| GET | `/:id` | Get welfare request |
| PUT | `/:id` | Update welfare request |
| POST | `/:id/vote` | Vote on request |
| POST | `/contribute` | Contribute to welfare |

#### Meetings (`/api/v1/meetings`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List meetings |
| POST | `/` | Create meeting |
| GET | `/:id` | Get meeting details |
| PUT | `/:id` | Update meeting |
| DELETE | `/:id` | Delete meeting |
| POST | `/:id/join` | Join meeting |
| POST | `/:id/attendance` | Mark attendance |
| GET | `/:id/documents` | Get meeting documents |
| POST | `/:id/documents` | Upload documents |

#### Chat (`/api/v1/chat`)
Proxied to Chat Service (see Service 2 documentation)

#### Payments (`/api/v1/payments`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mpesa/stk` | Initiate M-Pesa STK push |
| GET | `/mpesa/status/:id` | Check M-Pesa status |
| POST | `/bank-transfer` | Initiate bank transfer |

#### Notifications (`/api/v1/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get notifications |
| GET | `/unread-count` | Get unread count |
| PUT | `/:id/read` | Mark as read |
| DELETE | `/:id` | Delete notification |
| POST | `/system` | Send system notification |

#### Learning (`/api/v1/learning`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories` | List categories |
| GET | `/courses` | List courses |
| POST | `/courses/:id/start` | Start course |
| POST | `/courses/:id/submit-quiz` | Submit quiz |
| admin: POST | `/categories` | Create category |
| admin: POST | `/courses` | Create course |

### Services Layer (`internal/services/`)

| Service | Purpose | Key Functions |
|---------|---------|---------------|
| `auth_service.go` | Authentication | JWT generation/validation, refresh token rotation, session management |
| `mpesa_service.go` | Payments | STK Push, B2C transfers, callback processing |
| `wallet_service.go` | Wallet Management | Create/update wallets, process transactions, balance management |
| `user_service.go` | User Management | Profile operations, search, statistics |
| `chama_core_service.go` | Chama Operations | Create/update chamas, member management |
| `chama_member_service.go` | Member Operations | Join/leave chamas, role management |
| `loan_service.go` | Loan Management | Applications, approvals, disbursement |
| `disbursement_service.go` | Disbursement Processing | Batch processing, transparency logs |
| `welfare_contribution_handlers.go` | Welfare System | Requests, contributions, voting |
| `polling_service.go` | Polls/Votes | Poll creation, voting, results |
| `notification_service.go` | Notifications | Push notifications, preferences |
| `email_service.go` | Email | SMTP integration, templates |
| `google_drive_service.go` | Cloud Backup | Google Drive integration, backup/restore |
| `reminder_service.go` | Reminders | Creation, scheduling, updates |
| `calendar.go` | Calendar | Google Calendar integration |
| `scheduler.go` | Job Scheduling | Cron-like job management |
| `clamav.go` | Antivirus | File scanning integration |

### API Handlers Layer (`internal/api/`)

| Handler File | Endpoints Covered |
|-------------|-------------------|
| `auth_core_handlers.go` | Register, login, logout |
| `auth_password_handlers.go` | Forgot/reset password |
| `auth_verification_handlers.go` | Email/phone verification |
| `user_read_handlers.go` | Profile, user details |
| `user_write_handlers.go` | Profile updates |
| `user_settings_handlers.go` | Preferences, privacy, security |
| `user_admin_handlers.go` | Admin user operations |
| `user_search_handlers.go` | User search functionality |
| `chama_core_handlers.go` | Chama CRUD operations |
| `chama_members_handlers.go` | Member management |
| `chama_financial_handlers.go` | Financial operations |
| `chama_eligible_handlers.go` | Eligibility checks |
| `chama_export_handlers.go` | Export functionality |
| `chama_communication_handlers.go` | Invitations, communications |
| `wallet_read_handlers.go` | Wallet queries |
| `wallet_write_handlers.go` | Wallet transactions |
| `transaction_handlers.go` | Transaction processing |
| `mpesa_handlers.go` | M-Pesa callbacks |
| `notification_core_handlers.go` | Notification CRUD |
| `notification_fetchers_handlers.go` | Notification retrieval |
| `notification_preferences_handlers.go` | Notification settings |
| `polls_handlers.go` | Poll management |
| `vote_handlers.go` | Voting system |
| `loan_application_handlers.go` | Loan applications |
| `loan_guarantor_handlers.go` | Guarantor operations |
| `loan_type_handlers.go` | Loan product management |
| `disbursement_handlers.go` | Disbursement processing |
| `welfare_crud_handlers.go` | Welfare requests |
| `welfare_contribution_handlers.go` | Welfare contributions |
| `reminder_handlers.go` | Reminders |
| `learning_handlers.go` | Learning content |
| `learning_admin_handlers.go` | Admin learning controls |
| `learning_upload_handlers.go` | Content uploads |
| `financial_reports_handlers.go` | Financial reports |
| `meeting_crud_handlers.go` | Meeting CRUD |
| `meeting_documents_handlers.go` | Meeting documents |
| `support_handlers.go` | Support requests |
| `security_handlers.go` | File scanning |
| `account_handlers.go` | Account-level operations |

### Utilities Layer (`internal/utils/`)

| Utility File | Purpose |
|-------------|---------|
| `helpers.go` | Common helper functions, EAT timezone support |
| `encryption.go` | AES-GCM encryption/decryption for sensitive data |
| `validation.go` | Input validation, SQL injection/XSS detection |
| `masking.go` | Phone number/email masking for privacy |
| `email_assets.go` | Email template assets |

### M-Pesa Integration Service (`mpesa_service.go`)
- Sandboxed production environment support
- OAuth token management
- STK Push for payments
- B2C for withdrawals
- Callback processing with transaction verification
- Security credential encryption (production uses RSA with M-Pesa public key)

---

## Service 2: Chat Service

**Port:** 8084 | **Module:** `vaultke-chat-service` | **Framework:** Gin (Go)

Handles real-time communication with WebSocket support and E2EE capabilities.

### Architecture Layers

#### 1. WebSocket Hub (`internal/websocket/hub.go`)
Centralized message broadcasting system:
- Client registration/unregistration
- Room-based messaging
- Ping/pong keep-alive (30-second interval)
- Concurrent-safe operations with `sync.RWMutex`

#### 2. Message Types
```go
const (
    MessageTypeText  MessageType = "text"
    MessageTypeImage MessageType = "image"
    MessageTypeFile  MessageType = "file"
    MessageTypeAudio MessageType = "audio"
)
```

#### 3. Authentication Middleware (`internal/middleware/auth.go`)
- JWT validation for WebSocket connections
- `X-User-ID` header fallback for internal proxy connections

#### 4. Message Flow
```
Client Connect → /rooms/:id/ws (WebSocket)
    ↓
    Message (JSON) → ReadPump
    ↓
    [join_room, mark_read, message, send_message]
    ↓
    Write to DB & Broadcast to Room Members
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rooms` | Create chat room |
| GET | `/rooms` | List user's rooms |
| GET | `/rooms/:roomId` | Get room + messages |
| POST | `/rooms/:roomId/join` | Join room |
| POST | `/rooms/:roomId/leave` | Leave room |
| GET | `/rooms/:roomId/messages` | Get paginated messages |
| POST | `/rooms/:roomId/messages` | Send message |
| GET | `/rooms/:roomId/ws` | WebSocket endpoint |
| POST | `/rooms/:roomId/read` | Mark messages as read |
| DELETE | `/rooms/messages/:messageId` | Delete message |
| GET | `/rooms/:roomId/search` | Search messages |
| POST | `/rooms/:roomId/files` | Upload file |

### End-to-End Encryption (`internal/e2ee/crypto.go`)
- Signal Protocol integration
- Key bundle generation
- Pre-key management
- Session establishment

### Redis Integration
- Session caching
- Presence status
- Message pub/sub for scalability

### Chat Service Configuration
| Environment Variable | Default | Description |
|-------------------|----------|-------------|
| `SERVER_PORT` | 8084 | Chat service port |
| `REDIS_ADDR` | localhost:6379 | Redis server address |
| `REDIS_PASSWORD` | (empty) | Redis password |
| `REDIS_DB` | 0 | Redis database number |
| `MAX_ROOM_CAPACITY` | 150 | Max participants per room |
| `MESSAGE_RETENTION_DAYS` | 30 | Days to retain messages |
| `ENABLE_E2EE` | true | Enable end-to-end encryption |

---

## Service 3: Meeting Service

**Port:** 8086 | **Module:** `vaultke-meeting-service` | **Framework:** Gin (Go)

Manages virtual meetings with WebRTC and signaling capabilities.

### Architecture Layers

#### 1. WebRTC SFU Manager (`internal/webrtc/sfu.go`)
Selective Forwarding Unit implementation:
- Peer connection management
- ICE candidate handling
- STUN/TURN server configuration
- Video codecs: VP8, VP9, H264
- Audio codec: Opus

#### 2. Signaling Hub (`internal/signaling/hub.go`)
WebSocket-based signaling for WebRTC:
- Offer/answer exchange
- ICE candidate relay
- Room participant tracking

#### 3. Room Manager (`internal/room/manager.go`)
- Room lifecycle (create, join, leave, end)
- Participant management
- Auto-cleanup of stale rooms (24-hour threshold)
- Database persistence

#### 4. Middleware
- JWT authentication for API endpoints
- Host-only access for room termination (`RequireHost()`)

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/rooms` | Create meeting room |
| GET | `/api/v1/rooms/:roomID` | Get room + participants |
| POST | `/api/v1/rooms/:roomID/join` | Join room |
| POST | `/api/v1/rooms/:roomID/leave` | Leave room |
| POST | `/api/v1/rooms/:roomID/end` | End room (host only) |
| GET | `/api/v1/rooms/:roomID/participants` | Get participants |
| PUT | `/api/v1/rooms/:roomID/participants` | Update participant state |
| GET | `/api/v1/rooms/:roomID/signal` | WebRTC signaling WebSocket |
| GET | `/stats` | Get server statistics |

### WebRTC Signaling Flow
```
Client A → POST /rooms (create) → Room created
    ↓
Client A → GET /rooms/:id/signal → WebSocket connect, send offer
    ↓
Meeting Service → SFU Manager → Process offer, create answer
    ↓
Client B → GET /rooms/:id/signal → WebSocket connect, receive answer
    ↓
Both clients exchange ICE candidates via signaling WebSocket
```

### Signaling Hub (`internal/signaling/hub.go`)
- Client registration/unregistration
- Room-based broadcast messaging
- User-specific message delivery
- Concurrent-safe operations with `sync.RWMutex`

### Meeting Configuration
| Environment Variable | Default | Description |
|-------------------|----------|-------------|
| `SERVER_PORT` | 8082 | Meeting service port |
| `STUN_SERVER1` | stun:stun.l.google.com:19302 | Primary STUN server |
| `STUN_SERVER2` | (empty) | Secondary STUN server |
| `TURN_SERVERS` | (empty) | TURN servers for NAT traversal |
| `MAX_ROOM_CAPACITY` | 150 | Max participants per room |
| `MAX_CONCURRENT_ROOMS` | 50000 | Max concurrent rooms |
| `ENABLE_RECORDING` | false | Enable meeting recording |
| `RECORDING_STORAGE_PATH` | /tmp/recordings | Recording storage location |

---

## Database Schema Reference

### Core Tables

#### Users
```sql
users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name, last_name, avatar
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'pending',
    is_email_verified, is_phone_verified BOOLEAN,
    language, theme, county, town
    latitude, longitude REAL
    business_type, business_description
    rating REAL, total_ratings INTEGER
    id_number TEXT,
    bio, occupation, date_of_birth, gender
    registration_fee_paid BOOLEAN
)
```

#### Chamas
```sql
chamas (
    id TEXT PRIMARY KEY,
    name, description TEXT,
    category TEXT DEFAULT 'chama',
    type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    avatar, county, town
    latitude, longitude REAL
    contribution_amount REAL,
    contribution_frequency TEXT
    target_amount REAL, target_deadline TIMESTAMP
    max_members INTEGER, current_members INTEGER
    total_funds REAL DEFAULT 0
    is_public, requires_approval BOOLEAN
    rules TEXT, -- JSON
    payment_method, till_number, paybill_business_number
    created_by TEXT REFERENCES users(id)
    chat_room_id TEXT REFERENCES chat_rooms(id)
)
```

#### Wallets
```sql
wallets (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- personal, chama, business
    owner_id TEXT, -- user or chama
    chama_id TEXT REFERENCES chamas(id),
    subwallet_type TEXT, -- savings, welfare, etc.
    balance REAL,
    currency TEXT,
    is_active, is_locked BOOLEAN,
    daily_limit, monthly_limit REAL
)
```

#### Transactions
```sql
transactions (
    id TEXT PRIMARY KEY,
    from_wallet_id, to_wallet_id TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    amount REAL,
    currency TEXT,
    description TEXT,
    reference TEXT,
    payment_method TEXT,
    fees REAL,
    initiated_by TEXT,
    recipient_id TEXT,
    chama_id TEXT REFERENCES chamas(id),
    metadata JSONB,
    requires_approval BOOLEAN
)
```

#### Chat Rooms
```sql
chat_rooms (
    id TEXT PRIMARY KEY,
    chama_id TEXT REFERENCES chamas(id),
    name TEXT,
    type TEXT, -- chama, group, private
    created_by TEXT,
    is_active BOOLEAN,
    last_message_at TIMESTAMP
)

chat_room_members (
    id TEXT PRIMARY KEY,
    room_id, user_id TEXT REFERENCES users(id),
    role TEXT, -- admin, moderator, member
    joined_at TIMESTAMP,
    is_active BOOLEAN
)

chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES chat_rooms(id),
    sender_id TEXT REFERENCES users(id),
    content TEXT,
    type TEXT,
    metadata JSONB,
    image_url TEXT,
    is_deleted BOOLEAN,
    reply_to_id TEXT REFERENCES chat_messages(id)
)
```

#### Meeting Rooms
```sql
meeting_rooms (
    id TEXT PRIMARY KEY,
    chama_id TEXT REFERENCES chamas(id),
    name TEXT,
    type TEXT, -- physical, virtual
    status TEXT, -- waiting, active, ended
    max_participants INTEGER,
    created_by TEXT,
    recording_enabled BOOLEAN
)

meeting_participants (
    id TEXT PRIMARY KEY,
    room_id, user_id TEXT,
    display_name TEXT,
    role TEXT, -- host, co_host, participant, guest
    is_muted, is_video_on, is_screen_sharing BOOLEAN
)
```

---

## Security Features

### Authentication & Authorization
1. **JWT-based Authentication**
   - HMAC-SHA256 signing
   - 24-hour access token expiration
   - 30-day refresh token with rotation
   - In-memory token blacklist for immediate revocation

2. **Role-Based Access Control**
   - System roles: `user`, `admin`
   - Chama roles: `chairperson`, `treasurer`, `secretary`, `member`, `assistant`

3. **Session Management**
   - Multiple device session tracking
   - Device binding via User-Agent hash
   - Logout all devices capability
   - Token theft detection (revoked token triggers full session revocation)

### Data Protection
1. **E2E Encryption**
   - Signal Protocol implementation
   - Key bundles stored encrypted
   - Session-based message encryption

2. **Payment Security**
   - M-Pesa callback verification
   - Transaction reference validation
   - Amount matching on callbacks

3. **Input Sanitization**
   - SQL injection pattern blocking
   - XSS pattern detection
   - Dangerous file extension blocking

4. **Transport Security**
   - TLS 1.3 minimum
   - AES-256-GCM-SHA384, AES-128-GCM-SHA256, ChaCha20-Poly1305 cipher suites
   - X25519, P-256 curves preferred

---

## Inter-Service Communication

### Proxy Pattern (Main Server)
The main server acts as a reverse proxy for chat and meeting services:

```
┌──────────────────────────────────────────────────────────────────┐
│  Main Server (8085) - Single Entry Point                          │
│                                                                  │
│  /chat/*  →  Proxy to Chat Service (8084)                       │
│  /online-meetings/*  →  Proxy to Meeting Service (8086)          │
│                                                                  │
│  Authentication passed via X-User-ID header                       │
└──────────────────────────────────────────────────────────────────┘
```

### Shared Database
All services share a PostgreSQL database for:
- User authentication state
- Chama membership
- Wallet synchronization
- Chat room metadata
- Meeting room state

---

## Deployment Configuration

### Environment Variables (`.env`)
```bash
# Database
DATABASE_URL=postgres://user:pass@host:5432/vaultke?sslmode=disable

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=86400

# M-Pesa
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_PASSKEY=your-passkey
MPESA_SHORTCODE=123456
MPESA_CALLBACK_URL=https://api.example.com/api/v1/payments/mpesa/callback

# Microservices
MEETING_SERVICE_URL=http://localhost:8086
CHAT_SERVICE_URL=http://localhost:8084

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# CORS
ALLOW_ALL_ORIGINS=true
```

### Docker Configuration
Each service includes a `Dockerfile`:
- Multi-stage builds
- Alpine-based images
- Non-root user execution
- Health check endpoints

---

## Monitoring & Observability

### Health Checks
- `/health` endpoint on all services
- Database connection verification
- Redis connectivity (chat/meeting services)

### Logging
- Structured request logging
- Slow request detection (>5s)
- Memory monitoring middleware

### Metrics
- Configurable via `ENABLE_METRICS`
- Prometheus-compatible endpoint on port 9090

---

## API Versioning

All endpoints use API versioning prefix: `/api/v1/`

| Service | Base URL | Versioned Endpoints |
|---------|----------|-------------------|
| Main Server | `http://host:8085` | `/api/v1/*` |
| Chat Service | `http://host:8084` | `/rooms/*` (proxied) |
| Meeting Service | `http://host:8086` | `/api/v1/*` (proxied) |

---

## Error Handling

Standard error response format:
```json
{
    "success": false,
    "error": "Error message"
}
```

HTTP Status Codes:
- 400: Bad request / validation error
- 401: Unauthorized / invalid token
- 403: Forbidden / insufficient permissions
- 404: Resource not found
- 429: Rate limit exceeded
- 500: Internal server error
- 502: Bad gateway (proxy error)

---

## Related Documentation

- `API/main-server/docs/SECURITY.md` - Security protocols
- `API/main-server/docs/REMINDERS_API.md` - Reminder system
- `API/main-server/SUPABASE_SETUP.md` - Supabase integration
- `README.md` in each service directory