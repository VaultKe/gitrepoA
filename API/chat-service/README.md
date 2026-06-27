# Chat Service

Go microservice for private and group chat rooms with end-to-end encryption.

## Features

- Private and group chat rooms
- End-to-end encryption using ECDH + AES-GCM + HKDF
- WebSocket real-time messaging
- Redis pub/sub for multi-instance scaling
- PostgreSQL persistence
- File attachments

## Development

```bash
go mod tidy
go build ./...
./cmd/server/main.go
```

## Environment Variables

- `SERVER_PORT` - Server port (default: 8083)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_ADDR` - Redis address
- `REDIS_PASSWORD` - Redis password
- `JWT_SECRET` - Shared JWT secret
- `MAX_ROOM_CAPACITY` - Max room members (default: 150)
- `MESSAGE_RETENTION_DAYS` - Retention days (default: 30)
- `ENABLE_E2EE` - Enable encryption (default: true)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/rooms | Create room |
| GET | /api/v1/rooms | List rooms |
| GET | /api/v1/rooms/:roomId | Get room |
| POST | /api/v1/rooms/:roomId/join | Join room |
| POST | /api/v1/rooms/:roomId/leave | Leave room |
| GET | /api/v1/rooms/:roomId/messages | Get messages |
| POST | /api/v1/rooms/:roomId/messages | Send message |
| GET | /api/v1/rooms/:roomId/ws | WebSocket |
| POST | /api/v1/rooms/:roomId/read | Mark as read |
| DELETE | /api/v1/rooms/messages/:messageId | Delete message |
| GET | /api/v1/rooms/:roomId/search | Search messages |
| POST | /api/v1/rooms/:roomId/files | Upload file |

## Architecture

The service uses an **SFU-like approach** for WebSocket scaling:

- **Hub Pattern**: In-memory hub per instance manages WebSocket connections
- **Redis Pub/Sub**: Cross-instance message broadcasting via Redis channels
- **E2EE**: ECDH P-256 key exchange + HKDF-SHA256 key derivation + AES-GCM encryption
- **Private Rooms**: Deterministic ID via sorted user IDs + SHA256 hash
- **TURN/STUN**: Not included; external TURN servers handle WebRTC relay for voice/video
- **Scaling**: Horizontal scale with Redis; 50K rooms → shard by room ID prefix, use Redis clustering