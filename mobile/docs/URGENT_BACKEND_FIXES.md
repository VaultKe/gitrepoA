# URGENT: Backend Database Schema Fix Required

## Critical Error Occurring

```
sql: Scan error on column index 8, name "notes": converting NULL to string is unsupported
```

This error is preventing attendance loading and causing the 500 Internal Server Error.

## Root Cause

Your Go backend is trying to scan a NULL database value into a string field. The "notes" column in your attendance table allows NULL values, but your Go struct expects a string.

## Immediate Fix Required

### Option 1: Update Go Struct (Recommended)

Update your attendance struct to handle NULL values:

```go
package models

import (
    "database/sql"
    "time"
)

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
    Notes          string    `json:"notes" db:"notes"` // ❌ This causes the error
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
    Notes          sql.NullString `json:"notes" db:"notes"` // ✅ This handles NULL values
}
```

### Option 2: Update Database Schema (Alternative)

If you prefer to keep string fields, update your database to not allow NULL:

```sql
-- Update existing NULL values to empty string
UPDATE meeting_attendance SET notes = '' WHERE notes IS NULL;

-- Alter column to NOT NULL with default
ALTER TABLE meeting_attendance 
ALTER COLUMN notes SET DEFAULT '',
ALTER COLUMN notes SET NOT NULL;
```

## Additional Required Fixes

### 1. Add Missing PATCH Endpoint

Your backend is missing the PATCH endpoint for updating meetings:

```go
// Add this to your router
router.HandleFunc("/api/v1/meetings/{id}", UpdateMeeting).Methods("PATCH")

// Add this handler function
func UpdateMeeting(w http.ResponseWriter, r *http.Request) {
    meetingID := mux.Vars(r)["id"]
    
    var updateData struct {
        Status        string    `json:"status"`
        ConductedAt   time.Time `json:"conductedAt"`
        AttendeeCount int       `json:"attendeeCount"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }
    
    query := `UPDATE meetings 
              SET status = $1, conducted_at = $2, attendee_count = $3, updated_at = NOW() 
              WHERE id = $4`
    
    _, err := db.Exec(query, updateData.Status, updateData.ConductedAt, updateData.AttendeeCount, meetingID)
    if err != nil {
        log.Printf("Failed to update meeting: %v", err)
        http.Error(w, "Failed to update meeting", http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "success": true,
        "message": "Meeting updated successfully",
    })
}
```

### 2. Ensure CORS is Properly Configured

```go
import "github.com/rs/cors"

// Add CORS middleware
c := cors.New(cors.Options{
    AllowedOrigins: []string{"http://dqtl6f-ip-41-139-130-223.tunnelmole.net"},
    AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
    AllowedHeaders: []string{"*"},
})

handler := c.Handler(router)
log.Fatal(http.ListenAndServe(":8080", handler))
```

## Testing the Fix

### 1. Test Attendance Endpoint
```bash
curl "http://localhost:8080/api/v1/meetings/meeting-1753546745491881159/attendance"
```

Should return JSON without the scanning error.

### 2. Test PATCH Endpoint
```bash
curl -X PATCH "http://localhost:8080/api/v1/meetings/meeting-1753546745491881159" \
     -H "Content-Type: application/json" \
     -d '{"status":"completed","conductedAt":"2024-01-15T14:30:00Z","attendeeCount":5}'
```

Should return success response.

## Expected Database Schema

Your attendance table should look like this:

```sql
CREATE TABLE meeting_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id),
    user_id UUID NOT NULL,
    user_name VARCHAR(255),
    attendance_type VARCHAR(20) CHECK (attendance_type IN ('physical', 'virtual')),
    is_present BOOLEAN NOT NULL DEFAULT false,
    marked_at TIMESTAMP DEFAULT NOW(),
    marked_by UUID,
    notes TEXT -- This can be NULL, but Go struct must handle it properly
);
```

## Priority Order

1. **HIGHEST**: Fix the Go struct to use `sql.NullString` for notes field
2. **HIGH**: Add the missing PATCH endpoint for meeting updates
3. **MEDIUM**: Verify CORS configuration
4. **LOW**: Update database schema if you prefer non-nullable fields

## Verification

After implementing the fixes:

1. Restart your backend server
2. Try marking attendance in the app
3. Check that no 500 errors occur
4. Verify attendance is saved and can be retrieved

The frontend has been updated to handle these backend issues gracefully, but the backend fixes are required for full functionality.
