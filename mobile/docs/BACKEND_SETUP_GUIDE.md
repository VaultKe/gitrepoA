# Backend Setup Guide for Meeting System

This guide explains how to set up the backend API to work with the meeting system and resolve CORS issues.

## Current Error Analysis

### Error 1: Database Schema Issue
```
sql: Scan error on column index 8, name "notes": converting NULL to string is unsupported
```
**Fix**: The attendance table has a "notes" column that allows NULL but your Go code is trying to scan it into a string. Use `sql.NullString` instead.

### Error 2: Missing PATCH Endpoint
```
PATCH http://localhost:8080/api/v1/meetings/meeting-1753546745491881159 404 (Not Found)
```
**Fix**: Implement the PATCH endpoint for updating meeting status.

### Error 3: CORS Policy (if still occurring)
```
Access to fetch at 'http://localhost:8080/api/v1/meetings?chamaId=...' from origin 'http://dqtl6f-ip-41-139-130-223.tunnelmole.net'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Immediate Fixes Required

### 1. Fix Database Schema Issue (Go Backend)

The error indicates your Go struct is trying to scan a NULL value into a string. Update your attendance struct:

```go
// Before (causing the error)
type Attendance struct {
    ID             string    `json:"id" db:"id"`
    MeetingID      string    `json:"meetingId" db:"meeting_id"`
    UserID         string    `json:"userId" db:"user_id"`
    UserName       string    `json:"userName" db:"user_name"`
    AttendanceType string    `json:"attendanceType" db:"attendance_type"`
    IsPresent      bool      `json:"isPresent" db:"is_present"`
    MarkedAt       time.Time `json:"markedAt" db:"marked_at"`
    MarkedBy       string    `json:"markedBy" db:"marked_by"`
    Notes          string    `json:"notes" db:"notes"` // This causes the error
}

// After (fixed)
type Attendance struct {
    ID             string         `json:"id" db:"id"`
    MeetingID      string         `json:"meetingId" db:"meeting_id"`
    UserID         string         `json:"userId" db:"user_id"`
    UserName       string         `json:"userName" db:"user_name"`
    AttendanceType string         `json:"attendanceType" db:"attendance_type"`
    IsPresent      bool           `json:"isPresent" db:"is_present"`
    MarkedAt       time.Time      `json:"markedAt" db:"marked_at"`
    MarkedBy       string         `json:"markedBy" db:"marked_by"`
    Notes          sql.NullString `json:"notes" db:"notes"` // Use sql.NullString for nullable fields
}
```

### 2. Add Missing PATCH Endpoint

Add this endpoint to handle meeting status updates:

```go
// PATCH /api/v1/meetings/{id}
func UpdateMeeting(w http.ResponseWriter, r *http.Request) {
    meetingID := mux.Vars(r)["id"]

    var updateData struct {
        Status       string    `json:"status"`
        ConductedAt  time.Time `json:"conductedAt"`
        AttendeeCount int      `json:"attendeeCount"`
    }

    if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }

    query := `UPDATE meetings SET status = $1, conducted_at = $2, attendee_count = $3, updated_at = NOW() WHERE id = $4`
    _, err := db.Exec(query, updateData.Status, updateData.ConductedAt, updateData.AttendeeCount, meetingID)

    if err != nil {
        http.Error(w, "Failed to update meeting", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "success": true,
        "message": "Meeting updated successfully",
    })
}

// Add this route to your router
router.HandleFunc("/api/v1/meetings/{id}", UpdateMeeting).Methods("PATCH")
```

## Required Backend Configuration

### 3. CORS Configuration

Your backend needs to allow requests from `http://dqtl6f-ip-41-139-130-223.tunnelmole.net`. Add these headers:

```javascript
// Express.js example
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://dqtl6f-ip-41-139-130-223.tunnelmole.net');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
```

### 2. Required API Endpoints

Based on the meeting system requirements, implement these endpoints:

#### Meeting Management
```
GET    /api/v1/meetings?chamaId={id}           - List meetings for chama
GET    /api/v1/meetings/{id}                   - Get meeting details
POST   /api/v1/meetings                        - Create meeting
PATCH  /api/v1/meetings/{id}                   - Update meeting
DELETE /api/v1/meetings/{id}                   - Delete meeting
```

#### Attendance Management
```
GET    /api/v1/meetings/{id}/attendance        - Get attendance records
POST   /api/v1/meetings/{id}/attendance        - Mark attendance
PUT    /api/v1/meetings/{id}/attendance        - Update attendance
```

#### Meeting Minutes
```
GET    /api/v1/meetings/{id}/minutes           - Get meeting minutes
POST   /api/v1/meetings/{id}/minutes           - Create minutes
PUT    /api/v1/meetings/{id}/minutes           - Update minutes
```

#### Meeting Documents
```
GET    /api/v1/meetings/{id}/documents         - Get documents
POST   /api/v1/meetings/{id}/documents         - Upload document
DELETE /api/v1/meetings/{id}/documents/{docId} - Delete document
```

### 3. Database Schema

#### Meetings Table
```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY,
  chama_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL, -- minutes
  location VARCHAR(255),
  meeting_type VARCHAR(20) CHECK (meeting_type IN ('physical', 'virtual', 'hybrid')),
  status VARCHAR(20) CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  conducted_at TIMESTAMP,
  attendee_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Meeting Attendance Table
```sql
CREATE TABLE meeting_attendance (
  id UUID PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  user_id UUID NOT NULL,
  user_name VARCHAR(255),
  attendance_type VARCHAR(20) CHECK (attendance_type IN ('physical', 'virtual')),
  is_present BOOLEAN NOT NULL,
  marked_at TIMESTAMP DEFAULT NOW(),
  marked_by UUID
);
```

#### Meeting Minutes Table
```sql
CREATE TABLE meeting_minutes (
  id UUID PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  content TEXT NOT NULL,
  status VARCHAR(20) CHECK (status IN ('draft', 'approved', 'published')),
  author_role VARCHAR(50),
  taken_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Meeting Documents Table
```sql
CREATE TABLE meeting_documents (
  id UUID PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  name VARCHAR(255) NOT NULL,
  size BIGINT NOT NULL,
  document_type VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID NOT NULL,
  file_url VARCHAR(500),
  mime_type VARCHAR(100)
);
```

## Quick Backend Setup (Node.js/Express)

### 1. Install Dependencies
```bash
npm install express cors uuid
```

### 2. Basic Server Setup
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

// CORS configuration
app.use(cors({
  origin: 'http://dqtl6f-ip-41-139-130-223.tunnelmole.net',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Test endpoint
app.get('/api/v1/meetings', (req, res) => {
  const { chamaId } = req.query;
  
  // Return sample data for testing
  res.json({
    success: true,
    data: [
      {
        id: 'sample-meeting-1',
        chamaId: chamaId,
        title: 'Monthly Financial Review',
        description: 'Review of monthly contributions and investments',
        scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 90,
        location: 'Community Center',
        meetingType: 'physical',
        status: 'completed',
        attendeeCount: 15,
        conductedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  });
});

app.listen(8080, () => {
  console.log('Backend server running on http://localhost:8080');
});
```

## Testing the Connection

### 1. Start Backend Server
```bash
node server.js
```

### 2. Test API Endpoint
```bash
curl "http://localhost:8080/api/v1/meetings?chamaId=test-id"
```

### 3. Check CORS Headers
```bash
curl -H "Origin: http://dqtl6f-ip-41-139-130-223.tunnelmole.net" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8080/api/v1/meetings
```

## Common Issues and Solutions

### Issue 1: CORS Still Blocked
- Ensure backend server is running on port 8080
- Check that CORS middleware is properly configured
- Verify the origin URL matches exactly

### Issue 2: 404 Not Found
- Ensure all required endpoints are implemented
- Check the API base URL configuration
- Verify route paths match the expected format

### Issue 3: Data Format Mismatch
- Follow the data structure documented in MEETING_DATA_STRUCTURE.md
- Ensure response format matches expected structure
- Include proper success/error response format

## Next Steps

1. **Implement the backend** using the provided schema and endpoints
2. **Configure CORS** properly for your environment
3. **Test each endpoint** individually before testing the full app
4. **Add authentication** and authorization as needed
5. **Implement proper error handling** and validation

The meeting system is designed to work seamlessly once the backend API is properly configured and running.
