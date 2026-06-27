# Vaultke Meeting Service

Go microservice for custom WebRTC video conferencing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Meeting Service                           │
├─────────────────────────────────────────────────────────────┤
│  HTTP API (Gin)      WebSocket (Signaling)                  │
│  ┌────────────────┐   ┌──────────────────────────────┐      │
│  │ /api/v1/rooms  │◄──►│      Signaling Hub           │      │
│  │ /api/v1/stats  │   │  - Room clients map          │      │
│  │ /health        │   │  - Broadcast channels        │      │
│  └────────────────┘   └──────────────────────────────┘      │
│           │                                                 │
│           ▼                                                 │
│  ┌────────────────┐                                        │
│  │ Meeting Handler │                                        │
│  │ - CreateRoom    │                                        │
│  │ - JoinRoom      │                                        │
│  │ - WebRTCSignal  │                                        │
│  └────────────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌────────────────┐   ┌──────────────────┐                 │
│  │ Room Manager   │───│ SFU Manager      │                 │
│  │ - rooms map    │   │ - Peer connections│                │
│  │ - participants │   │ - ICE/STUN/TURN  │                 │
│  │ - DB persistence│  └──────────────────┘                 │
│  └────────────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌────────────────┐                                        │
│  │ PostgreSQL     │   ┌──────────────────┐                 │
│  │ (rooms, etc)   │   │ Redis (presence) │                 │
│  └────────────────┘   └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Setup

```bash
cd meeting-service
go mod tidy
go build ./...
```

## Running

```bash
# Copy env file
cp configs/config.example.env .env
# Edit .env with your values
go run cmd/server/main.go
```

## Database Schema

```sql
CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    chama_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    max_participants INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    recording_enabled BOOLEAN DEFAULT FALSE
);

CREATE TABLE participants (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE,
    is_video_on BOOLEAN DEFAULT FALSE,
    is_screen_sharing BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP NOT NULL,
    left_at TIMESTAMP
);

CREATE TABLE room_chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT,
    created_at TIMESTAMP NOT NULL
);
```

## Scaling Notes

- Run periodic cleanup for stale rooms (24h threshold)
- Max 50K concurrent rooms in memory
- Max 150 participants per room
- Horizontal scaling requires Redis pub/sub for signaling sync
- Consider media server (SFU) for >10 participants per room