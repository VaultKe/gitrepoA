# VaultKe API Backend Documentation

## Table of Contents
1. [Overview](#overview)
2. [Service 1: Main Server (API Gateway)](#service-1-main-server-api-gateway)
3. [Service 2: Chat Service](#service-2-chat-service)
4. [Service 3: Meeting Service](#service-3-meeting-service)
5. [Service 4: React Native Mobile Client](#service-4-react-native-mobile-client)
6. [Overall System Architecture (Including Mobile)](#overall-system-architecture-including-mobile)
7. [Database Schema Reference](#database-schema-reference)
8. [Database Simulation & Data Flow Diagrams](#database-simulation--data-flow-diagrams)
9. [Security Features](#security-features)
10. [Inter-Service Communication](#inter-service-communication)
11. [Mobile User Flow Diagrams](#mobile-user-flow-diagrams)
12. [Deployment Configuration](#deployment-configuration)
13. [Monitoring & Observability](#monitoring--observability)
14. [API Versioning](#api-versioning)
15. [Error Handling](#error-handling)
16. [Related Documentation](#related-documentation)

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

---

## Service 4: React Native Mobile Client

**Framework:** React Native (Expo / bare workflow) | **Language:** TypeScript | **State Management:** Zustand / Redux Toolkit | **Navigation:** React Navigation v6 / v7 | **Networking:** Axios / React Query (TanStack Query) | **Storage:** MMKV / SQLite | **Realtime:** Socket.io-client / WebSocket | **Push:** Expo Notifications / Firebase Cloud Messaging | **Maps:** React Native Maps

The VaultKe mobile client is a cross-platform React Native application targeting Android and iOS. It consumes the Main Server API (8085), establishes direct WebSocket connections to Chat Service (8084), and creates signaling tunnels to Meeting Service (8086) for WebRTC media. Offline-first capabilities ensure users can perform critical read/write operations while disconnected and sync when connectivity returns.

---

## Overall System Architecture (Including Mobile)

```
                                                                                          
        ┌────────────────────────────────────────────────────────────────────────────┐  
        │                         API Gateway (main-server:8085)                       │  
        │  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐        │  
        │  │   Auth Layer     │    │   Route Layer    │    │  Proxy Layer     │        │  
        │  │  JWT Validation  │    │  All Endpoints   │    │  -> Meeting SVC  │        │  
        │  └──────────────────┘    └─────────┬──────────┘    └──────────────────┘        │  
        │                                   │                                           │  
        │                                   ▼                                           │  
        │                         ┌──────────────────┐                                   │  
        │                         │  Proxy Layer     │                                   │  
        │                         │  -> Chat Service │                                   │  
        │                         └──────────────────┘                                   │  
        └────────────────────────────────────────────────────────────────────────────┘  
                                          │                                           
                                          │ HTTPS / REST                               
                                          ▼                                           
                            ┌─────────────────────────┐                             
                            │    React Native Mobile  │                             
                            │    Client (iOS / Android)│                            
                            │  ┌────────────────────┐ │                             
                            │  │ Navigation Layer   │ │                             
                            │  │ (React Navigation) │ │                             
                            │  └───────┬────────────┘ │                             
                            │          │              │                             
                            │  ┌───────▼────────────┐ │                             
                            │  │   Feature Modules  │ │                             
                            │  │ Auth / Chamas /    │ │                             
                            │  │ Wallets / Chat /   │ │                             
                            │  │ Meetings / Loans   │ │                             
                            │  │ Welfare / Learning │ │                             
                            │  └───────┬────────────┘ │                             
                            │          │              │                             
                            │  ┌───────▼────────────┐ │                             
                            │  │   State + API      │ │                             
                            │  │   (React Query &   │ │                             
                            │  │   Zustand Stores)  │ │                             
                            │  └───────┬────────────┘ │                             
                            │          │              │                             
                            │  ┌───────▼────────────┐ │                             
                            │  │   Offline/Sync     │ │                             
                            │  │   (MMKV/SQLite)    │ │                             
                            │  └────────────────────┘ │                             
                            └─────────────────────────┘                             
                                          │                                           
                                          │ WebSocket /                               
                                          │ Signaling                                  
                ┌─────────────────────────┼─────────────────────────┐                
                │                         │                         │                
                ▼                         ▼                         ▼                
    ┌───────────────────────┐ ┌──────────────────────────┐ ┌───────────────────────┐  
    │   Chat Service (8084) │ │   Meeting Service (8086)  │ │   Push Notification   │  
    │  WebSocket | Messages │ │   WebRTC | Signaling      │ │   (FCM / APNs + Expo) │  
    └───────────────────────┘ └──────────────────────────┘ └───────────────────────┘  
                                          
                                          ▲                    
                                          │                    
        ┌─────────────────────────────────┼─────────────────────────────────┐      
        │                                 │                                 │      
        ▼                                 ▼                                 ▼      
    ┌─────────────────────────┐ ┌──────────────────────────┐ ┌───────────────────────┐  
    │                         │ │                          │ │                       │  
    │  Shared PostgreSQL      │ │   Redis (Sessions/       │ │                       │  
    │  Database               │ │   Presence/Queue)        │ │   External Integrations│  
    │                         │ │                          │ │   (M-Pesa / Drive /    │  
    │                         │ │                          │ │   Email / SMS)         │  
    │                         │ │                          │ │                       │  
    └─────────────────────────┘ └──────────────────────────┘ └───────────────────────┘  
```

---

## Mobile Architecture Layers

### Layer 1: Presentation Layer (UI Shell)
```
[PLACEHOLDER: Attach screenshots/Screen_Architecture_Map.png]

src/
├── navigation/
│   ├── AppNavigator.tsx           // Root stack + conditional authflow
│   ├── AuthNavigator.tsx          // Login / Register / Onboarding / TOTP
│   ├── MainNavigator.tsx          // Tab navigator (Home | Chamas | Messages | Meetings | Profile)
│   ├── ChamaStack.tsx             // Detail screens stack for a specific chama
│   ├── ModalNavigator.tsx         // Bottom sheets (Payments, Apply Loan, etc.)
│   └── linking.ts                 // Deep linking configuration (Universal Links / App Links)
├── screens/
│   ├── auth/
│   │   ├── SplashScreen.tsx
│   │   ├── PhoneLoginScreen.tsx
│   │   ├── VerifyOTPScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── TOTPVerifyScreen.tsx
│   │   └── OnboardingWizard.tsx   // Multi-step profile completion
│   ├── home/
│   │   ├── HomeScreen.tsx
│   │   ├── DashboardWidgets.tsx   // Financial summary cards
│   │   └── RecentActivityFeed.tsx
│   ├── chamas/
│   │   ├── ChamaListScreen.tsx
│   │   ├── CreateChamaScreen.tsx
│   │   ├── ChamaDetailScreen.tsx
│   │   ├── MembersScreen.tsx
│   │   ├── LoansScreen.tsx
│   │   ├── WelfareScreen.tsx
│   │   ├── SubWalletsScreen.tsx
│   │   ├── TransactionsScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── wallets/
│   │   ├── WalletOverview.tsx
│   │   ├── WalletTransferScreen.tsx
│   │   ├── MpesaSTKPush.tsx        // STK push confirmation UI
│   │   └── TransactionHistory.tsx
│   ├── chat/
│   │   ├── ChatListScreen.tsx
│   │   ├── ChatRoomScreen.tsx
│   │   └── MessageBubble.tsx
│   ├── meetings/
│   │   ├── MeetingListScreen.tsx
│   │   ├── PreJoinScreen.tsx
│   │   ├── ActiveMeetingScreen.tsx  // WebRTC local/remote views
│   │   └── MeetingChatSidebar.tsx
│   ├── loans/
│   │   ├── ApplyLoanScreen.tsx
│   │   ├── LoanDetailScreen.tsx
│   │   └── GuarantorRequestScreen.tsx
│   ├── welfare/
│   │   ├── WelfareRequestsScreen.tsx
│   │   ├── CreateWelfareRequest.tsx
│   │   └── ContributeScreen.tsx
│   ├── learning/
│   │   ├── CoursesScreen.tsx
│   │   ├── CourseDetailScreen.tsx
│   │   └── QuizScreen.tsx
│   ├── notifications/
│   │   ├── NotificationListScreen.tsx
│   │   └── NotificationPreferences.tsx
│   └── profile/
│       ├── ProfileScreen.tsx
│       ├── SettingsScreen.tsx
│       └── SecurityScreen.tsx
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Skeleton.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── Touchable.tsx
│   ├── chama/
│   │   ├── ChamaCard.tsx
│   │   ├── MemberRow.tsx
│   │   ├── TransactionRow.tsx
│   │   └── ContributionChart.tsx
│   ├── chat/
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   └── AttachmentPreview.tsx
│   ├── meetings/
│   │   ├── ParticipantTile.tsx
│   │   ├── ControlBar.tsx
│   │   └── FullScreenVideo.tsx
│   └── forms/
│       ├── PhoneInput.tsx
│       ├── AmountInput.tsx
│       └── DatePicker.tsx
└── theme/
    ├── colors.ts
    ├── typography.ts
    ├── spacing.ts
    └── index.ts
```

**Key Principle:** Each screen is a thin UI layer. Most UI state is derived from React Query cache + Zustand stores. Screens compose reusable components and trigger actions defined in feature hooks.

---

### Layer 2: State Management & Data Layer
```
[PLACEHOLDER: Attach screenshots/StateManagement_Architecture.png]

src/
├── api/
│   ├── client.ts                 // Axios instance with interceptors
│   ├── auth.ts                   // Auth endpoints
│   ├── users.ts                  // User endpoints
│   ├── chamas.ts                 // Chama CRUD + members
│   ├── wallets.ts                // Wallets, transactions, transfers
│   ├── loans.ts                  // Loan operations
│   ├── welfare.ts                // Welfare endpoints
│   ├── meetings.ts               // Meeting endpoints
│   ├── chat.ts                   // Chat REST endpoints
│   ├── payments.ts               // M-Pesa callbacks (read)
│   ├── notifications.ts          // Notifications
│   ├── learning.ts               // Learning endpoints
│   └── upload.ts                 // File uploads (avatars, docs)
├── stores/
│   ├── authStore.ts              // User session, tokens, onboarding status
│   ├── chamaStore.ts             // Active chama context, current chama id
│   ├── walletStore.ts            // Default wallet, currency, limits
│   ├── chatStore.ts              // Active room, unread counts
│   ├── meetingStore.ts           // Active meeting, media states
│   ├── uiStore.ts                // Theme (light/dark), language, modals
│   └── offlineQueue.ts           // Pending mutations when offline
├── hooks/
│   ├── useAuth.ts
│   ├── useChamas.ts
│   ├── useWallets.ts
│   ├── useLoans.ts
│   ├── useChat.ts
│   ├── useMeetings.ts
│   ├── useWebRTC.ts
│   ├── useNotifications.ts
│   ├── useOfflineSync.ts
│   └── usePerms.ts               // Generate optimized permission selectors
├── sockets/
│   ├── chatSocket.ts             // Chat service WS wrapper
│   ├── meetingSocket.ts          // Signaling WS wrapper
│   └── socketRegistry.ts         // Connection pool, keep-alive, reconnection
├── services/
│   ├── storage.ts                // MMKV wrapper
│   ├── biometrics.ts             // Biometric auth (secure storage)
│   ├── location.ts               // GPS for map views
│   ├── camera.ts                 // Avatar capture
│   ├── pushNotifications.ts      // FCM/APNs token registration
│   ├── deepLinking.ts            // Incoming invite links / deeplinks
│   └── analytics.ts              // Event tracking (Firebase / Mixpanel)
└── utils/
    ├── constants.ts
    ├── validators.ts             // Client-side validation mirrors backend
    ├── formatters.ts             // Currency, dates (EAT), phone numbers
    ├── permissions.ts            // Platform permission wrappers
    ├── errorHandlers.ts          // Map backend error codes to UX messages
    └── offlineHelpers.ts         // Retry queues, delta sync
```

---

### Layer 3: Offline-First & Synchronization Strategy
```
[PLACEHOLDER: Attach screenshots/OfflineSync_Architecture.png]

┌──────────────────────────┐     Online      ┌──────────────────────────┐
│       Mobile Device       │ <-------------> │      API Gateway         │
│  ┌────────────────────┐   │   HTTPS/WS      │      (8085)              │
│  │                    │   │                 │                          │
│  │  Local First DB    │   │                 │                          │
│  │  (MMKV / SQLite)   │   │                 │                          │
│  │                    │   │                 │                          │
│  │  ┌──────────────┐  │   │                 │                          │
│  │  │ Read Cache    │  │   │                 │                          │
│  │  │ (Hot)         │  │   │                 │                          │
│  │  └──────┬───────┘  │   │                 │                          │
│  │         │          │   │                 │                          │
│  │  ┌──────▼───────┐  │   │                 │                          │
│  │  │ Query Store  │  │   │                 │                          │
│  │  │ (TanStack    │  │   │                 │                          │
│  │  │  Query)      │  │   │                 │                          │
│  │  └──────┬───────┘  │   │                 │                          │
│  │         │          │   │                 │                          │
│  │  ┌──────▼───────┐  │   │                 │                          │
│  │  │ Mutation     │  │   │                 │                          │
│  │  │ Queue +       │  │   │                 │                          │
│  │  │ Optimistic   │  │   │                 │                          │
│  │  │ Update       │  │   │                 │                          │
│  │  └──────────────┘  │   │                 │                          │
│  └────────────────────┘   │                 │                          │
│         ▲                 │                 │                          │
│         │ Background Sync │                 │                          │
│         │ (NetInfo +      │                 │                          │
│         │  task handlers) │                 │                          │
└─────────┼─────────────────┘                 └──────────────────────────┘
          │
          │ Sync direction on reconnect
          │ - POST conflict_resolution strategy
          │ - last_updated_at timestamps
          │ - server is source of truth for financials
```

**Sync Rules:**
1. Read-While-Offline: Load from local cache immediately, then revalidate via `stale-while-revalidate` when online.
2. Write-While-Offline: Store mutation in queue. When connectivity resumes, flush queue sequentially. Update UI optimistically but rollback on failure.
3. Conflict Resolution: Last-write-wins for non-financial data (profile, preferences). Financial data requires explicit confirmation or revert with audit entry.
4. Delta Sync: Transfer only changed fields using `updated_since` filter to minimize payload.

---

## Mobile Data Flow Diagrams

### 4.1 Authentication & Onboarding Flow
```
[PLACEHOLDER: Attach screenshots/Auth_Flow_Diagram.png]

User opens App
    ↓
Check Token (MMKV)
    ├── Valid & not expired  → MainTabs
    └── Invalid/missing      → AuthFlow
                                ├── Phone Input
                                │     ↓
                                │   POST /api/v1/auth/send-email-verification
                                │   (dedicated for OTP/TOTP)
                                │     ↓
                                │   VerifyOTP / TOTPVerify
                                │     ↓
                                │   POST /api/v1/auth/login
                                │     ↓
                                │   Store tokens (secure enclave / Keychain)
                                │     ↓
                                ├── Onboarding Wizard (if incomplete)
                                │     ├── Profile Step
                                │     ├── KYC Step (ID upload)
                                │     ├── Preferences (Language, Theme)
                                │     └── Permissions (Notifications, Location)
                                │         ↓
                                │       Mark onboarding complete
                                ↓
                          MainTabs → Dashboard
```

### 4.2 Wallet Transaction Flow (M-Pesa STK Push)
```
[PLACEHOLDER: Attach screenshots/Wallet_Transaction_Flow.png]

User taps "Deposit / Pay Contribution"
    ↓
Select Wallet (personal / chama / subwallet)
    ↓
Enter Amount + Reference
    ↓
POST /api/v1/wallets/deposit  { amount, wallet_id, description }
    ↓
Backend creates Transaction (status: pending) + STK push request
    ↓
M-Pesa sends push prompt to user phone
    ↓
User enters PIN on device
    ↓
M-Pesa callback → Backend updates transaction status
    ↓
Mobile Client polls /api/v1/payments/mpesa/status/:id
    OR
WebSocket / SSE notification from backend
    ↓
Transaction cache invalidation
    ↓
UI updates balance + transaction history
```

### 4.3 Chat Flow (WebSocket)
```
[PLACEHOLDER: Attach screenshots/Chat_WebSocket_Flow.png]

User opens ChatRoomScreen
    ↓
API: POST /rooms/:id/join (REST via API Gateway)
    ↓
WS: Connect to wss://<gateway>/rooms/:id/ws  (proxied to Chat Service:8084)
    ↓
Hub registers client, sends room_state event
    ↓
Incoming Message Event:
    ├── Persist to SQLite (local history)
    ├── Update React Query cache
    ├── Update unread counters in Zustand
    └── Trigger local notification if app backgrounded
    ↓
Sending Message:
    └── Mark pending → Optimistic UI insert → WS emit → Acknowledge → Remove pending flag
```

### 4.4 Meeting / WebRTC Flow
```
[PLACEHOLDER: Attach screenshots/Meeting_WebRTC_Flow.png]

User opens MeetingDetailScreen
    ↓
API: GET /api/v1/rooms/:id  (via Main Server)
    ↓
User taps "Join Meeting"
    ↓
Request device permissions (camera, mic, screen capture)
    ↓
Connect signaling WebSocket to wss://<gateway>/online-meetings/:id/signal
    (proxied to Meeting Service:8086)
    ↓
SFU answers create Offer → Set local description → ICE candidates exchange
    ↓
PeerConnection established:
    ├── Local stream attached to <Video /> (muted local preview)
    ├── Remote streams attached to <RTCView /> (active speaker layout)
    └── DataChannel for meeting chat (backup)
    ↓
During call:
    ├── Mute / Video Toggle → via signaling WS control message
    ├── Screen Share → replace video track with display media
    └── Leave → close peer connections, remove from DB
```

### 4.5 Loan Application Flow
```
[PLACEHOLDER: Attach screenshots/Loan_Application_Flow.png]

User taps "Apply for Loan"
    ↓
LoanAmountInput + TermSelector + PurposeInput + GuarantorSelector
    ↓
POST /api/v1/loans/apply
    ↓
Backend validates eligibility (chama membership, credit score, guarantors)
    ↓
Status: pending / approved / rejected
    ↓
Push Notification + In-app alert
    ↓
If approved:
    ├── POST /api/v1/loans/:id/approve (admin)
    ├── POST /api/v1/loans/:id/disburse
    │     Transfers funds to user wallet
    └── UI reflects new balance + loan schedule
```

---

## Mobile User Flow Diagrams

### A. First Launch User Flow
```
[PLACEHOLDER: Attach screenshots/UserFlow_FirstLaunch.png]

┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐
│ Splash  │ -> │ Select   │ -> │ Enter   │ -> │ Verify    │ -> │ Complete  │
│ Screen  │    │ Language │    │ Phone # │    │ OTP/TOTP  │    │ Onboarding│
└─────────┘    └──────────┘    └──────────┘    └───────────┘    └───────────┘
                                                                 │
                                                      ┌────────────┼────────────┐
                                                      ▼            ▼            ▼
                                                ┌─────────┐ ┌─────────┐ ┌─────────┐
                                                │ Profile │ │ KYC /   │ │ Permissions
                                                │ Details │ │ ID Upload│ │ (Push,  │
                                                └─────────┘ └─────────┘ │ Location│
                                                              └─────────┘ └─────────┘
                                                                       │
                                                                       ▼
                                                                 ┌─────────┐
                                                                 │ Home    │
                                                                 │ Dashboard│
                                                                 └─────────┘
```

### B. Chama Creation & Onboarding Flow
```
[PLACEHOLDER: Attach screenshots/UserFlow_ChamaCreation.png]

┌──────────┐     ┌───────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│ Dashboard│  -> │ "Create   │  -> │ Basic Info │  -> │ Add Members│  -> │ Setup     │
│ Tab      │     │ Chama"    │     │ (Name,Type)│     │ (Invite /  │     │ Contributions│
│          │     │           │     └────────────┘     │  Contacts)│     │ & Wallet  │
└──────────┘     └───────────┘                       └────────────┘     └────────────┘
                                                                                  │
                                                                          ┌────────────┐
                                                                          │ Set Rules, │
                                                                          │ Schedule  │
                                                                          └────────────┘
                                                                                  │
                                                                                  ▼
                                                                            ┌────────────┐
                                                                            │ Chama Live │
                                                                            │ Dashboard  │
                                                                            └────────────┘
```

### C. Financial Activity Flow
```
[PLACEHOLDER: Attach screenshots/UserFlow_FinancialActivity.png]

┌──────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ Wallet   │    │ Deposit /  │    │ Contribute │    │ Withdraw  /│    │ Transaction │
│ Dashboard│ -> │ Pay Bills  │ -> │ to Welfare │ -> │ Loan Repay │ -> │ History    │
│          │    │ (M-Pesa)   │    │ / Savings  │    │            │    │ & Receipts │
└──────────┘    └────────────┘    └────────────┘    └────────────┘    └────────────┘
        ▲               │                │                   │                  │
        │               ▼                ▼                   ▼                  │
        │         STK Prompt     Guarantor Accept     Disbursement Alert  Receipt PDF│
        │               │                │                   │                  │
        │               └────────────────┴───────────────────┘                  │
        │                                    │                                     │
        │                                    ▼                                     │
        │                              ┌────────────┐                              │
        └────────────────────────────────│ Ledger &   │◄─────────────────────────────│
                                          │ Reconciliation│
                                          └────────────┘
```

### D. Meeting Lifecycle Flow
```
[PLACEHOLDER: Attach screenshots/UserFlow_MeetingLifecycle.png]

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Meetings │ -> │ Schedule │ -> │ Pre-Join │ -> │ Active   │ -> │ Post     │
│ Tab      │    │ New      │    │ (Check   │    │ Call     │    │ Meeting  │
│          │    │ Meeting  │    │ Device   │    │ (WebRTC) │    │ Minutes  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                     │               │                  │
                                     ▼               ▼                  ▼
                                Audio/Video   Screen Share      Attendance Marked
                                Permission    / Recording      Action Items Created
                                Check
```

### E. Profile Settings & Security Flow
```
[PLACEHOLDER: Attach screenshots/UserFlow_Settings.png]

Profile Tab -> Settings Icon
    ↓
├── Account Settings
│     ├── Edit Profile (name, phone, email, bio)
│     ├── Change Password (current + new + confirm)
│     └── Delete Account (confirmation modal)
├── Security Settings
│     ├── Enable Biometric Login
│     ├── View Active Sessions
│     └── Notification Preferences (push, email, SMS)
├── Preferences
│     ├── Language (en / sw)
│     ├── Theme (light / dark / system)
│     └── Privacy (profile visibility, data sharing)
└── Support
      ├── FAQs
      ├── Contact Support (form)
      └── Report Bug
```

---

## Database Simulation & Conceptual Diagrams

### A. Core Entity Relationship (Mobile App Perspective)
```
[PLACEHOLDER: Attach screenshots/ER_Diagram_Mobile.png]

┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   User      │1       * │   Chama     │1       * │  Chama_Member│
│             │─────────>│             │─────────>│              │
│ - id        │          │ - id        │          │ - id         │
│ - email     │          │ - name      │          │ - chama_id   │
│ - phone     │          │ - type      │          │ - user_id    │
│ - role      │          │ - status    │          │ - role       │
│ - onboarded │          │ - funds     │          │ - joined_at  │
└─────────────┘          └─────────────┘          └─────────────┘
       │                        │                        │
       │ 1                     │ *                      │ *
       │                       │                        │
       ▼                       ▼                        ▼
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│  Wallet     │1       * │ Sub_Wallet  │1       * │ Transaction │
│             │─────────>│             │─────────>│             │
│ - id        │          │ - id        │          │ - id        │
│ - type      │          │ - chama_id  │          │ - wallet_id │
│ - balance   │          │ - type      │          │ - amount    │
│ - owner_id  │          │ - balance   │          │ - type      │
└─────────────┘          └─────────────┘          │ - status    │
       ▲                        ▲                 │ - ref       │
       │ *                      │ *               └─────────────┘
       │                        │
┌─────────────┐          ┌─────────────┐
│ Transaction │          │  Loan       │
│             │          │             │
│ - initiated │          │ - id        │
│   by user   │          │ - amount    │
│ - chama_id  │          │ - status    │
└─────────────┘          └─────────────┘
       ▲                        ▲
       │                        │
┌─────────────┐          ┌─────────────┐
│  Loan_Payment│         │ Guarantor   │
│             │          │             │
│ - id        │          │ - id        │
│ - loan_id   │          │ - user_id   │
│ - amount    │          │ - status    │
└─────────────┘          └─────────────┘

┌─────────────┐          ┌─────────────┐
│Meeting_Room │1       * │Meeting_     │
│             │─────────>│Participant  │
│ - id        │          │             │
│ - type      │          │ - user_id   │
│ - status    │          │ - role      │
└─────────────┘          └─────────────┘

┌─────────────┐          ┌─────────────┐
│Chat_Room    │1       * │Chat_Message│
│             │─────────>│             │
│ - id        │          │ - room_id   │
│ - type      │          │ - sender_id │
│ - chama_id  │          │ - content   │
└─────────────┘          │ - type     │
       ▲                 │ - read_at  │
       │ *               └─────────────┘
       │
┌─────────────┐
│Chat_Room_   │
│Member       │
│             │
│ - room_id   │
│ - user_id   │
│ - role      │
│ - joined_at │
└─────────────┘
```

### B. Mobile Offline Queue Data Model (Local SQLite / MMKV)
```
[PLACEHOLDER: Attach screenshots/OfflineQueue_Schema.png]

CREATE TABLE offline_queue (
    id TEXT PRIMARY KEY,
    mutation_type TEXT NOT NULL,   -- 'create','update','delete'
    entity TEXT NOT NULL,           -- 'loan','welfare','transaction','message'
    payload TEXT NOT NULL,          -- JSON
    created_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    status TEXT DEFAULT 'pending'   -- pending, processing, completed, failed
);

CREATE TABLE local_chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT,
    temp_id TEXT,                   -- UUID assigned before server ACK
    content TEXT,
    type TEXT,
    sender_id TEXT,
    created_at TIMESTAMP,
    sync_status TEXT DEFAULT 'pending' -- pending, sent, failed
);

CREATE TABLE cached_chamas (
    chama_id TEXT PRIMARY KEY,
    data TEXT,
    last_synced TIMESTAMP
);
```

---

## Additional Missing Data Flow Diagrams

### C. Quote / Debit / Credit Money Flow (End-to-End)
```
[PLACEHOLDER: Attach screenshots/MoneyFlow_EndToEnd.png]

Mobile Client                           Backend                                  External
     │                                       │                                       │
     │  1. Intent (deposit / transfer /       │                                       │
     │     loan disbursement / welfare)       │                                       │
     │───────────────────────────────────────>│                                       │
     │                                       │  2. Validate balance, limits,           │
     │                                       │     membership, KYC                     │
     │                                       │───────────────────────────────────────> │  M-Pesa / Bank
     │                                       │     3. Initiate STK Push / B2C          │
     │                                       │<─────────────────────────────────────── │  Callback URL
     │  4. Status: pending (optimistic)       │                                       │
     │<───────────────────────────────────────│                                       │
     │                                       │  5. Process callback, credit/debit      │
     │                                       │     wallets atomically                  │
     │                                       │  6. Emit Transaction(id, status=done)   │
     │  6. Webhook / WS event / Poll           │<───────────────────────────────────────│
     │<───────────────────────────────────────│                                       │
     │  7. Update local cache + UI            │                                       │
     │  8. Trigger notification                │                                       │
```

**Atomicity Rules:**
- Debit + Credit wrapped in database transaction.
- If credit fails, debit is rolled back automatically.
- All financial mutations emit `TransactionStatus.completed` only after wallet balances reflect delta.

### D. Real-time Notification Pipeline
```
[PLACEHOLDER: Attach screenshots/Notification_Pipeline.png]

External Event (M-Pesa callback, New Message, Meeting starting)
         │
         ▼
   Backend Event Emitter
         │
    ┌────┴────────────────────────┐
    │                             │
    ▼                             ▼
Push Notification               In-app Notification WS
(FCM / APNs via Expo)          (WebSocket broadcast to user device)
    │                             │
    ▼                             ▼
OS tray / lock screen          UI badge / toast sound
    │                             │
    └───────────┬─────────────────┘
                ▼
         Inbox stored locally + remote DB
```

### E. Media Upload & Storage Flow
```
[PLACEHOLDER: Attach screenshots/MediaUpload_Flow.png]

User selects file (camera / gallery / document)
    → Client compresses / resizes
    → POST /api/v1/upload  (multipart/form-data)
        → Virus scan (ClamAV)
        → Encrypt if sensitive
        → Upload to cloud store (e.g., S3-compatible or Google Drive integration)
        → Return signed URL + metadata
    → UI displays inline
    → On failure: retry queue with exponential backoff
```

### F. Deep Link & Invitation Flow
```
[PLACEHOLDER: Attach screenshots/DeepLink_Flow.png]

Invitation Link:
    vaultke://chama/invite/{token}
        │
        ▼
    App opens via linking.ts handler
        │
        ▼
    Check auth state
        ├── Authenticated → Verify token → Join chama → Navigate to ChamaDetail
        └── Not authenticated → Navigate to Register → Onboarding → Back to Join flow
```

### G. Webhook / Callback Ingestion Flow
```
[PLACEHOLDER: Attach screenshots/Webhook_Callback_Flow.png]

M-Pesa / Bank / External Provider
         │
         │ HTTPS POST callback to /api/v1/payments/mpesa/callback
         ▼
    API Gateway
         │
         ├── Verify signature (shared secret / TLS)
         ├── Parse payload (transaction_id, status, amount)
         ├── Fetch transaction by idempotency key
         ├── Update status + amount in transactions table
         ├── If success:
         │     ├── Credit receiving wallet
         │     ├── Debit source wallet (if not already)
         │     ├── Emit ws event to mobile clients (balance update)
         │     └── Audit log entry
         └── Return 200 OK to provider
```

---

## Additional Backend Data Flow Diagrams (Added)

### Notification Service Data Flow
```
[PLACEHOLDER: Attach screenshots/NotificationService_DataFlow.png]

Mobile App / Admin UI                API Gateway:8085                PostgreSQL / Redis
       │                                     │                            │
       │   POST /notifications/system        │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Create notification        │
       │                                     │ Read preferences           │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { id, status: queued }            │                            │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   WS /push event                    │                            │
       │   (real-time in-app)               │                            │
       │                                     │                            │
       │   [External Push via FCM/APNs]     │                            │
       │<───────────────────────────────────>│                            │
       │                                     │                            │
       │   User opens notification           │                            │
       │   PUT /notifications/:id/read       │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Mark as read               │
       │<────────────────────────────────────│                            │
```

### Disbursement / Transparency Log Flow
```
[PLACEHOLDER: Attach screenshots/Disbursement_DataFlow.png]

Admin / System                         API Gateway:8085                PostgreSQL
       │                                     │                            │
       │   POST /disbursement-batches        │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Create batch               │
       │                                     │ Validate items             │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { batch_id, status: pending }     │                            │
       │                                     │                            │
       │   POST /disbursement-batches/:id/execute │                       │
       │────────────────────────────────────>│                            │
       │                                     │ For each item:             │
       │                                     │   - Create transaction     │
       │                                     │   - Credit wallet          │
       │                                     │   - Write transparency log │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { status: completed }             │                            │
       │                                     │                            │
       │   GET /disbursement-batches/:id     │                            │
       │────────────────────────────────────>│                            │
       │<────────────────────────────────────│                            │
       │   { items[], logs[] }               │                            │
```

### Learning / Course Enrollment Flow
```
[PLACEHOLDER: Attach screenshots/Learning_DataFlow.png]

Mobile / Admin                         API Gateway:8085                PostgreSQL
       │                                     │                            │
       │   GET /learning/courses             │                            │
       │────────────────────────────────────>│                            │
       │<────────────────────────────────────│                            │
       │   { categories[], courses[] }       │                            │
       │                                     │                            │
       │   POST /learning/courses/:id/start  │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Create user_course_progress│
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { progress_id, enrolled_at }      │                            │
       │                                     │                            │
       │   POST /learning/courses/:id/submit-quiz                       │
       │────────────────────────────────────>│                            │
       │                                     │ Grade quiz                 │
       │                                     │ Update progress            │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { score, passed, next_lesson }    │                            │
```

### Reminder / Scheduling Flow
```
[PLACEHOLDER: Attach screenshots/Reminder_DataFlow.png]

Mobile / Admin                         API Gateway:8085                PostgreSQL / Scheduler
       │                                     │                            │
       │   POST /reminders                   │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Validate chama             │
       │                                     │ Schedule Job               │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { reminder_id, scheduled_at }     │                            │
       │                                     │                            │
       │   [Scheduler fires at scheduled_at] │                            │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   Push + In-app notification        │                            │
       │                                     │                            │
       │   PUT /reminders/:id/complete       │                            │
       │────────────────────────────────────>│                            │
       │<────────────────────────────────────│                            │
```

### Onboarding / KYC Document Flow
```
[PLACEHOLDER: Attach screenshots/KYC_Onboarding_Flow.png]

Mobile App                              API Gateway:8085                PostgreSQL / External
       │                                     │                            │
       │   Select ID Document                │                            │
       │   (Camera / Gallery)                │                            │
       │   Compress & Encrypt                │                            │
       │                                     │                            │
       │   POST /api/v1/users/avatar         │                            │
       │   OR /api/v1/upload                 │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Virus scan                 │
       │                                     │ Store encrypted            │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { url, secure_token }             │                            │
       │                                     │                            │
       │   PUT /api/v1/users/profile         │                            │
       │   { id_number, id_url, ... }        │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Update user                │
       │                                     │ Mark verification pending  │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { status: pending_verification }  │                            │
       │                                     │                            │
       │   [Admin review]                     │                            │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   Push: Verification Complete       │                            │
```

### Map / Location-Based Discovery Flow
```
[PLACEHOLDER: Attach screenshots/LocationDiscovery_Flow.png]

Mobile App                              API Gateway:8085                PostgreSQL
       │                                     │                            │
       │   Request location permission       │                            │
       │   Get GPS coordinates                │                            │
       │                                     │                            │
       │   GET /api/v1/chamas?lat=&lng=&radius=                      │
       │────────────────────────────────────>│                            │
       │                                     │ Geospatial query           │
       │                                     │ Filter by distance         │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { chamas[], distance }            │                            │
       │                                     │                            │
       │   Display on React Native Maps      │                            │
       │   Clustering for density            │                            │
       │                                     │                            │
       │   Tap chama pin                     │                            │
       │   Navigate to ChamaDetail           │                            │
```

### Admin Analytics Export Flow
```
[PLACEHOLDER: Attach screenshots/AdminAnalytics_Flow.png]

Admin Portal (Web / Mobile)             API Gateway:8085                PostgreSQL / S3
       │                                     │                            │
       │   GET /api/v1/users/admin/statistics                         │
       │────────────────────────────────────>│                            │
       │<────────────────────────────────────│                            │
       │   { users, chamas, transactions }   │                            │
       │                                     │                            │
       │   POST /api/v1/chamas/:id/export    │                            │
       │   (CSV / PDF / Excel)               │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Query transactions         │
       │                                     │ Generate file              │
       │                                     │ Upload to cloud            │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { download_url, expires_at }      │                            │
```

---

## Mobile Testing Strategy

### Unit & Integration Tests
- Jest for components and hooks
- React Native Testing Library for UI
- MSW (Mock Service Worker) for API mocking
- Hooks tested in isolation with dependency injection for sockets/stores

### E2E Tests
- Detox (preferred for RN) or Maestro
- Suggested flows:
  - Onboarding → Create Chama → Add Member → Contribute → View Balance
  - Login → Chat → Send Message → Receive Notification → Reply
  - Login → Schedule Meeting → Join → Screen Share → Leave → View Minutes

### Performance Budgets
- Cold Start: < 2 seconds on mid-range devices
- First Meaningful Paint: < 1.5s
- Screen transition: 60 fps
- Chat message roundtrip: < 500ms when online
- Offline write-to-queue latency: < 100ms

---

## Security Hardening on Mobile

| Concern | Implementation |
|---------|----------------|
| Token Storage | iOS Keychain + Android EncryptedSharedPreferences / Expo SecureStore |
| Biometric Auth | Optional app unlock (face/touch) before showing sensitive tabs |
| Screenshot Protection | `FLAG_SECURE` on Android, private recording on iOS |
| Certificate Pinning | Pin API gateway TLS certs to prevent MITM |
| Sensitive Data Masking | Auto-detect & mask phone numbers, amounts in logs/screenshots |
| Jailbreak/Root Detection | Block sensitive features on compromised devices |
| Code Obfuscation | ProGuard / Hermes bytecode + stripping debug symbols in production |
| Push Token Rotation | Auto-refresh FCM/APNs tokens on app start |

---

## Mobile Deployment & Release

### iOS
- Target: iOS 13+ (or 14+ if using visionOS-ready code)
- Capabilities: Push Notifications, Associated Domains (Universal Links), Background Modes (audio, voip, fetch)
- Distribution: App Store / TestFlight

### Android
- Target: SDK 24+ (Android 7.0)
- Permissions: CAMERA, RECORD_AUDIO, POST_NOTIFICATIONS (Android 13+), ACCESS_FINE_LOCATION, READ_EXTERNAL_STORAGE
- Distribution: Google Play, APK direct, or Firebase App Distribution

### CI/CD
- GitHub Actions / Bitrise / EAS Build (Expo Application Services)
- Steps:
  1. Lint + Unit Tests
  2. Build iOS (simulator + archive)
  3. Build Android (debug + release AAB)
  4. Run Detox E2E on Firebase Test Lab / Bitrise
  5. Upload artifacts to TestFlight / Play Store internal track

---

## Monitoring & Observability (Mobile)

### App Performance
- React Native Performance Monitor (Flipper / Hermes tracing)
- Firebase Performance Monitoring for startup, screen load, API latency
- Sentry for crash reporting with breadcrumbs for network/DB events

### Business Analytics
- Event tracking:
  - `screen_view` + screen name + params
  - `chama_created`, `contribution_paid`, `loan_applied`, `meeting_joined`
  - `error_occurred` with code + stack (sampling)
- Funnels:
  - Onboarding completion rate
  - Payment success rate (STK push confirmation)
  - Meeting join success rate
- Cohorts:
  - Active chama members vs. inactive users
  - Platform engagement by region / language

---

## Accessibility & Internationalization

### i18n
- i18next / expo-localization
- Supported: English (en), Swahili (sw)
- RTL support preparation (future: Arabic)
- Currency formatting per locale (KES default)

### Accessibility
- Accessibility labels on all interactive elements
- Dynamic type support (font scaling)
- Color contrast ratios meeting WCAG AA
- TalkBack / VoiceOver compatibility
- Alternative text for media uploads

---

## Future Architecture Enhancements

1. **Expo Application Services (EAS)** - OTA updates, build hosting, submit automation
2. **Hermes Engine** - Default JS engine for startup time optimization
3. **FlashList** - Replace FlatList for large transaction/chat scroll performance
4. **Reanimated 3** - Gesture-driven transitions and meeting controls
5. **Skia** - Custom charts for financial analytics (transaction trends, chama growth)
6. **Contact Sync** - Native address book mapping to user IDs (privacy-preserving hash)
7. **Widgets** - iOS/Android home widgets for quick balance / upcoming meetings
8. **Watch/Companion Support** - Companion apps for quick approval workflows

---

## API Client Configuration (Mobile Specific)

```typescript
// src/api/client.ts
import axios from 'axios';
import { store } from '../stores';
import { refreshToken } from './auth';

export const api = axios.create({
  baseURL: __DEV__ ? 'http://localhost:8085' : 'https://api.vaultke.com/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Device-Type': 'mobile',
  },
});

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const newToken = await refreshToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        store.getState().auth.reset();
      }
    }
    return Promise.reject(error);
  },
);
```

```typescript
// src/sockets/chatSocket.ts
import { io, Socket } from 'socket.io-client';

const CHAT_URL = __DEV__
  ? 'http://localhost:8084'
  : 'https://api.vaultke.com';

export let chatSocket: Socket | null = null;

export const connectChatSocket = (token: string) => {
  if (chatSocket?.connected) return chatSocket;
  chatSocket = io(`${CHAT_URL}/rooms`, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  chatSocket.on('connect', () => console.log('Chat WS connected'));
  chatSocket.on('connect_error', (err) => console.warn('Chat WS error', err));
  chatSocket.on('message', (payload) => handleIncomingMessage(payload));
  chatSocket.on('room_state', (state) => updateRoomState(state));

  return chatSocket;
};
```

---

## Mobile Data Flow Summary Matrix

| Feature               | Source        | Transport         | Cache            | Sync Strategy                      |
|-----------------------|---------------|-------------------|------------------|------------------------------------|
| Auth / Profile        | Backend REST  | Axios + Interceptors | MMKV       | Immediate, revalidate on focus     |
| Chamas / Members      | Backend REST  | TanStack Query     | SQLite + React Query cache | staleWhileRevalidate (5 min) |
| Wallets / Transactions| Backend REST  | TanStack Query + WS | SQLite       | Real-time via WS, fallback polling |
| Chat Messages         | Chat WS       | Socket.io-client   | SQLite           | Optimistic + WS ACK               |
| Meeting Signaling     | Meeting WS    | Socket.io-client   | In-memory only   | Ephemeral, no offline support      |
| Notifications         | FCM / APNs    | Expo Notifications | MMKV             | Delivered by platform, ack via REST|
| Loan / Welfare Queue  | Backend REST  | Offline Queue      | SQLite           | Flush sequential on reconnect      |

---

## Simulated Backend Data Flow (From Mobile to Database)

```
[Mobile App]
   │
   │ HTTPS POST /api/v1/chamas
   │ Headers: Authorization: Bearer <jwt>
   │ Body: { name, type, contribution_amount, ... }
   ▼
[API Gateway:8085]
   │
   ├── Middleware: Auth (validate JWT -> user_id, role)
   ├── Middleware: Security (rate limit, size, content-type)
   │
   ├── Handler: chama_core_handlers.go
   │     ├── Validate input (chama type, limits)
   │     ├── Begin DB Transaction
   │     ├── Insert chamas row
   │     ├── Insert chama_members (creator as admin)
   │     ├── Create wallet for chama (type: chama)
   │     ├── Create chat_room tied to chama_id
   │     ├── Commit DB Transaction
   │     └── Return 201 Created { chama, chat_room_id }
   │
   ▼
[PostgreSQL]
   chamas
   chama_members
   wallets
   chat_rooms
```

---

## Backend Data Flow Diagrams (Added)

### Chat Service Data Flow
```
[PLACEHOLDER: Attach screenshots/ChatService_DataFlow.png]

Api Gateway                        Chat Service:8084                  PostgreSQL
     │                                     │                               │
     │  Proxy /chat/*                      │                               │
     │────────────────────────────────────>│                               │
     │                                     │  Auth Middleware              │
     │                                     │  Validate X-User-ID/jwt       │
     │                                     │                               │
     │                                     │  HTTP Handlers                 │
     │                                     │  - Create Room                │
     │                                     │  - List Messages              │
     │                                     │  - Send Message               │
     │                                     │                               │
     │                                     │  WS Handlers                   │
     │                                     │  - /rooms/:id/ws              │
     │                                     │    - join_room                │
     │                                     │    - send_message             │
     │                                     │    - mark_read                │
     │                                     │                               │
     │                                     │  Write to:                    │
     │                                     │  1. chat_rooms                │
     │                                     │  2. chat_messages             │
     │                                     │  3. chat_room_members         │
     │                                     │                               │
     │                                     │  Broadcast to room via Hub    │
     │                                     │──────────────────────────────>│
     │                                     │  Redis (presence / pubsub)    │
     │                                     │<──────────────────────────────│
     │                                     │                               │
     │<────────────────────────────────────│                               │
```

### Meeting Service Data Flow
```
[PLACEHOLDER: Attach screenshots/MeetingService_DataFlow.png]

Api Gateway                       Meeting Service:8086                PostgreSQL
     │                                     │                               │
     │  Proxy /online-meetings/*           │                               │
     │────────────────────────────────────>│                               │
     │                                     │  HTTP Handlers                │
     │                                     │  - Create Room                │
     │                                     │  - Join/Leave                 │
     │                                     │  - Participants               │
     │                                     │                               │
     │                                     │  Signaling WS:                │
     │                                     │  - /rooms/:id/signal          │
     │                                     │    - offer/answer exchange    │
     │                                     │    - ICE candidate relay      │
     │                                     │                               │
     │                                     │  SFU Manager                  │
     │                                     │  - Peer connections           │
     │                                     │  - Track negotiation          │
     │                                     │                               │
     │                                     │  Write to:                    │
     │                                     │  1. meeting_rooms             │
     │                                     │  2. meeting_participants      │
     │                                     │  3. webrtc_sessions           │
     │<────────────────────────────────────│                               │
```

### Loan Service Data Flow
```
[PLACEHOLDER: Attach screenshots/LoanService_DataFlow.png]

Mobile / Admin UI                     API Gateway:8085                 PostgreSQL
       │                                     │                            │
       │   POST /loans/apply                 │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Validate eligibility        │
       │                                     │ - chama membership           │
       │                                     │ - credit score               │
       │                                     │ - guarantors                 │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { id, status: pending }           │                            │
       │                                     │                            │
       │   POST /loans/:id/approve           │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Update loan_status          │
       │                                     │ Create loan_payments rows   │
       │                                     │ Emit notification           │
       │<────────────────────────────────────│                            │
       │                                     │                            │
       │   POST /loans/:id/disburse          │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Transfer: ChamaWallet       │
       │                                     │         -> UserWallet       │
       │                                     │ Create transaction          │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { status: disbursed }             │                            │
```

### Welfare Service Data Flow
```
[PLACEHOLDER: Attach screenshots/WelfareService_DataFlow.png]

Member / Admin                        API Gateway:8085                PostgreSQL
       │                                     │                            │
       │   POST /welfare                     │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Create welfare_request      │
       │                                     │ Link chama + member         │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { id, status: pending_vote }      │                            │
       │                                     │                            │
       │   POST /welfare/:id/vote            │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Validate member voting      │
       │                                     │ Update welfare_contributions │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { status: approved, votes }       │                            │
       │                                     │                            │
       │   POST /welfare/contribute           │                            │
       │────────────────────────────────────>│                            │
       │                                     │ Debit wallet               │
       │                                     │ Credit welfare subwallet   │
       │                                     │                            │
       │<────────────────────────────────────│                            │
       │   { contribution_id, amount }       │                            │
```

---
