# API Endpoints Reference

## Main Server Endpoints (Port 8085)

### Authentication (`/api/v1/auth`)
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

### Users (`/api/v1/users`)
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

### Chamas (`/api/v1/chamas`)
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
| GET | `/:id/eligible-welfare-members` | Get eligible welfare members |
| GET | `/:id/eligible-savings-members` | Get eligible savings members |
| POST | `/:id/shares/offering/` | Create chama shares |
| GET | `/:id/shares/offerings` | List share offerings |
| POST | `/:id/dividends/` | Declare dividends |
| POST | `/:id/disbursements/individual` | Create individual disbursement |
| POST | `/:id/disbursements/bulk` | Create bulk disbursement |

### Wallets (`/api/v1/wallets`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List wallets |
| GET | `/balance` | Get wallet balance |
| GET | `/transactions` | Get user transactions |
| POST | `/transfer` | Transfer money |
| POST | `/deposit` | Deposit money |
| POST | `/withdraw` | Withdraw money |
| POST | `/registration-payment` | Pay registration fee |

### Sub-Wallets (`/api/v1/chamas/:id/subwallets`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get chama sub-wallets |
| GET | `/:type/transactions` | Get transactions by type |
| POST | `/:type/pay` | Pay to sub-wallet |
| POST | `/:type/withdraw` | Withdraw from sub-wallet |

### Loans (`/api/v1/loans`)
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
| POST | `/:id/loan-types` | Create loan type for chama |
| GET | `/:id/loan-types` | Get chama loan types |

### Welfare (`/api/v1/welfare`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List welfare requests |
| POST | `/` | Create welfare request |
| GET | `/:id` | Get welfare request |
| PUT | `/:id` | Update welfare request |
| DELETE | `/:id` | Delete welfare request |
| POST | `/:id/vote` | Vote on request |
| POST | `/contribute` | Contribute to welfare |
| GET | `/:id/contributions` | Get welfare contributions |

### Meetings (`/api/v1/meetings`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List meetings |
| POST | `/` | Create meeting |
| GET | `/:id` | Get meeting details |
| PUT | `/:id` | Update meeting |
| PATCH | `/:id` | Partial update meeting |
| DELETE | `/:id` | Delete meeting |
| POST | `/:id/join` | Join meeting |
| POST | `/:id/attendance` | Mark attendance |
| GET | `/:id/attendance` | Get meeting attendance |
| POST | `/:id/documents` | Upload documents |
| GET | `/:id/documents` | Get meeting documents |
| DELETE | `/:id/documents/:docId` | Delete document |
| POST | `/:id/minutes` | Save meeting minutes |
| GET | `/:id/minutes` | Get meeting minutes |

### Payments (`/api/v1/payments`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mpesa/stk` | Initiate M-Pesa STK push |
| GET | `/mpesa/status/:checkoutRequestId` | Check M-Pesa status |
| POST | `/bank-transfer` | Initiate bank transfer |

### Notifications (`/api/v1/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get notifications |
| GET | `/unread-count` | Get unread count |
| PUT | `/:id/read` | Mark as read |
| POST | `/read-all` | Mark all as read |
| DELETE | `/:id` | Delete notification |
| POST | `/system` | Send system notification |
| GET | `/preferences` | Get notification preferences |
| PUT | `/preferences` | Update notification preferences |
| GET | `/settings` | Get notification settings |
| PUT | `/settings` | Update notification settings |

### Polls (`/api/v1/chamas/:id/polls`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create poll |
| GET | `/` | Get chama polls |
| GET | `/active` | Get active polls |
| GET | `/results` | Get poll results |
| GET | `/:pollId` | Get poll details |
| POST | `/:pollId/vote` | Cast vote |
| POST | `/role-escalation` | Create role escalation poll |

### Votes (`/api/v1/chamas/:id/votes`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `` | Create vote |
| GET | `` | Get chama votes |
| GET | `/active` | Get active votes |
| GET | `/results` | Get vote results |
| POST | `/role-escalation` | Create role escalation vote |

### Reminders (`/api/v1/reminders`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create reminder |
| GET | `/` | Get user reminders |
| GET | `/:id` | Get specific reminder |
| PUT | `/:id` | Update reminder |
| DELETE | `/:id` | Delete reminder |
| POST | `/:id/toggle` | Toggle reminder active |

### Support (`/api/v1/support`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/requests` | Create support request |
| GET | `/requests` | Get support requests |
| PUT | `/requests/:id` | Update request |
| POST | `/test-request` | Create test request |

### Financial Reports (`/api/v1/chamas/:id/reports`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get financial reports |
| POST | `/` | Generate report |
| GET | `/:reportId/download` | Download report |

---

## Chat Service Endpoints (Port 8084) - Accessed via Main Server Proxy

All chat endpoints are proxied through `/api/v1/chat/*` on the main server.

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
| POST | `/rooms/:roomId/read` | Mark as read |
| DELETE | `/rooms/messages/:messageId` | Delete message |
| GET | `/rooms/:roomId/search` | Search messages |

---

## Meeting Service Endpoints (Port 8086) - Accessed via Main Server Proxy

All meeting endpoints are proxied through `/api/v1/online-meetings/*` on the main server.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/rooms` | Create meeting room |
| GET | `/api/v1/rooms/:roomID` | Get room details |
| POST | `/api/v1/rooms/:roomID/join` | Join room |
| POST | `/api/v1/rooms/:roomID/leave` | Leave room |
| POST | `/api/v1/rooms/:roomID/end` | End room (host only) |
| GET | `/api/v1/rooms/:roomID/participants` | Get participants |
| GET | `/api/v1/rooms/:roomID/signal` | WebRTC signaling WebSocket |
| GET | `/stats` | Get server statistics |

---

## APK Distribution Endpoints

### Public (no authentication required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/apk/latest` | Fetch the latest active APK version info (versionCode, versionName, releaseNotes, fileSize, downloadUrl, isMandatory) |
| GET | `/api/v1/apk/version-check?currentVersionCode=1&currentVersionName=1.0.0` | Version check endpoint for APK clients — returns `hasUpdate`, `updateType` (none/minor/major), and `latest` version info |
| GET | `/api/v1/apk/history` | List all APK versions (newest first) with metadata |
| GET | `/api/v1/apk/download/:version` | Download a specific APK by version name (e.g. `/apk/download/latest`). Serves binary APK file only — no source code is exposed |

### Protected (admin/publisher role required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/apk/upload` | Upload a new APK. Multipart form fields: `apk` (file), `versionCode` (int), `versionName` (string), `releaseNotes` (string), `isMandatory` (boolean) |
| DELETE | `/api/v1/apk/version/:id` | Delete an APK version by ID (removes DB row + file from disk, promotes next-latest if deleted version was `is_latest`) |

### Version Check Response Format

```json
{
  "success": true,
  "data": {
    "latestVersionCode": 42,
    "latestVersionName": "2.3.1",
    "versionCode": 42,
    "versionName": "2.3.1",
    "releaseNotes": "Bug fixes and performance improvements",
    "fileSize": 25678901,
    "downloadUrl": "/api/v1/apk/download/2.3.1",
    "isMandatory": false,
    "hasUpdate": true,
    "updateType": "minor"
  }
}
```

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS apk_versions (
    id SERIAL PRIMARY KEY,
    version_code INTEGER NOT NULL,
    version_name VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    release_notes TEXT DEFAULT '',
    is_mandatory BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_latest BOOLEAN DEFAULT FALSE,
    uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    upload_ip TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(version_code)
);
```