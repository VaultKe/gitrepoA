# Meeting Data Structure - Backend API Requirements

This document outlines the complete data structure that the meeting system expects from the backend API, based on what the PhysicalMeetingScreen saves and what the MeetingSummaryScreen displays.

## 1. Meeting Entity Structure

### Core Meeting Object
```json
{
  "id": "uuid",
  "chamaId": "uuid",
  "chamaName": "string",
  "title": "string",
  "description": "string",
  "scheduledAt": "ISO 8601 datetime",
  "duration": "number (minutes)",
  "location": "string",
  "meetingType": "physical|virtual|hybrid",
  "status": "scheduled|in_progress|completed|cancelled",
  "conductedAt": "ISO 8601 datetime (when completed)",
  "attendeeCount": "number",
  "createdBy": "uuid (user_id)",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

## 2. Meeting Attendance Structure

### Attendance Record
```json
{
  "id": "uuid",
  "meetingId": "uuid",
  "userId": "uuid",
  "userName": "string",
  "attendanceType": "physical|virtual",
  "isPresent": "boolean",
  "markedAt": "ISO 8601 datetime",
  "markedBy": "uuid (user_id who marked attendance)"
}
```

## 3. Meeting Minutes Structure

### Minutes Object
```json
{
  "id": "uuid",
  "meetingId": "uuid",
  "content": "string (markdown/text)",
  "status": "draft|approved|published",
  "authorRole": "chairperson|secretary|treasurer",
  "takenBy": "string (name of person who took minutes)",
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

## 4. Meeting Documents Structure

### Document Object
```json
{
  "id": "uuid",
  "meetingId": "uuid",
  "name": "string",
  "size": "number (bytes)",
  "documentType": "financial_report|proposal|member_list|agenda|other",
  "uploadedAt": "ISO 8601 datetime",
  "uploadedBy": "uuid (user_id)",
  "fileUrl": "string (download URL)",
  "mimeType": "string"
}
```

## 5. API Endpoints Required

### Meeting Endpoints
- `GET /meetings?chamaId={id}` - Get all meetings for a chama
- `GET /meetings/{id}` - Get specific meeting details
- `POST /meetings` - Create new meeting
- `PATCH /meetings/{id}` - Update meeting (status, conductedAt, etc.)
- `DELETE /meetings/{id}` - Delete meeting

### Attendance Endpoints
- `GET /meetings/{id}/attendance` - Get attendance for a meeting
- `POST /meetings/{id}/attendance` - Mark/update attendance
- `PUT /meetings/{id}/attendance` - Bulk update attendance

### Minutes Endpoints
- `GET /meetings/{id}/minutes` - Get meeting minutes
- `POST /meetings/{id}/minutes` - Create meeting minutes
- `PUT /meetings/{id}/minutes` - Update meeting minutes

### Documents Endpoints
- `GET /meetings/{id}/documents` - Get meeting documents
- `POST /meetings/{id}/documents` - Upload meeting document
- `DELETE /meetings/{id}/documents/{docId}` - Delete document

## 6. What PhysicalMeetingScreen Saves

### Attendance Data
```javascript
// For each member
{
  userId: "uuid",
  attendanceType: "physical",
  isPresent: boolean
}
```

### Meeting Minutes
```javascript
{
  content: "string (meeting notes)",
  status: "draft",
  meetingId: "uuid",
  authorRole: "chairperson|secretary|treasurer"
}
```

### Meeting Status Update
```javascript
{
  status: "completed",
  conductedAt: "ISO datetime",
  attendeeCount: number
}
```

## 7. Expected Response Formats

### Success Response
```json
{
  "success": true,
  "data": {}, // The requested data
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 8. User Roles and Permissions

### Who Can View Meeting Data
- **All Chama Members**: Can view meeting details, attendance, minutes, documents
- **Chairperson**: Full access to all meeting data
- **Secretary**: Can take minutes, mark attendance, upload documents
- **Treasurer**: Can mark attendance, view financial documents

### Who Can Mark Attendance
- **Chairperson**: Full attendance management
- **Treasurer**: Can mark attendance
- **Secretary**: Can mark attendance

### Who Can Take Minutes
- **Secretary**: Primary role for taking minutes
- **Chairperson**: Can also take minutes
- **Treasurer**: Can contribute to minutes

## 9. Data Validation Rules

### Meeting Creation
- Title: Required, max 200 characters
- Description: Optional, max 1000 characters
- ScheduledAt: Required, must be future date
- Duration: Required, 15-480 minutes
- Location: Required for physical meetings

### Attendance
- UserId: Must be valid chama member
- AttendanceType: Must match meeting type
- IsPresent: Boolean required

### Minutes
- Content: Required, max 10000 characters
- Status: Must be valid status
- AuthorRole: Must be authorized role
