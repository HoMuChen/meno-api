# Meeting Notes App - Backend Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Service Layer](#service-layer)
6. [Data Flow](#data-flow)
7. [File Structure](#file-structure)
8. [Implementation Guide](#implementation-guide)

---

## System Overview

### Purpose
Backend API for a meeting notes application that allows users to:
- Organize meetings into projects
- Upload or record audio files
- Automatically transcribe meetings with speaker diarization
- View and edit transcriptions

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT-based with bcrypt
- **File Storage**: Local/Google Cloud Storage (abstracted)
- **Transcription**: Mock service (designed for easy integration with real services)

### Key Features
- ✅ User authentication (email/password, Google OAuth)
- ✅ Project-based organization
- ✅ Audio file upload and storage
- ✅ Asynchronous transcription processing
- ✅ Speaker diarization
- ✅ Editable transcriptions
- ✅ Status polling for transcription progress

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Client                         │
│              (React/Vue/Angular - Not in scope)                 │
└────────┬────────────────────────────────────────────────────────┘
         │
         │ HTTPS/REST API
         │
┌────────▼────────────────────────────────────────────────────────┐
│                      Express.js API Server                       │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Routes     │  │ Controllers  │  │  Validators  │         │
│  │              │  │              │  │              │         │
│  │ • Projects   │  │ • Projects   │  │ • Projects   │         │
│  │ • Meetings   │  │ • Meetings   │  │ • Meetings   │         │
│  │ • Trans.     │  │ • Trans.     │  │ • Trans.     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│  ┌─────────────────────────▼──────────────────────────┐         │
│  │           Middleware Layer                         │         │
│  │  • JWT Authentication                              │         │
│  │  • Error Handling                                  │         │
│  │  • Request Logging                                 │         │
│  │  • File Upload (Multer)                            │         │
│  └─────────────────────────┬──────────────────────────┘         │
│                            │                                     │
│  ┌─────────────────────────▼──────────────────────────┐         │
│  │              Service Layer                         │         │
│  │                                                     │         │
│  │  ┌──────────────────┐  ┌──────────────────┐       │         │
│  │  │ ProjectService   │  │ MeetingService   │       │         │
│  │  └──────────────────┘  └──────────────────┘       │         │
│  │                                                     │         │
│  │  ┌──────────────────┐  ┌──────────────────┐       │         │
│  │  │TranscriptionSvc  │  │ FileService      │       │         │
│  │  │(Mock/Real)       │  │ (Existing)       │       │         │
│  │  └──────────────────┘  └──────────────────┘       │         │
│  │                                                     │         │
│  │  ┌──────────────────────────────────────┐         │         │
│  │  │ TranscriptionDataService             │         │         │
│  │  │ (Database operations)                │         │         │
│  │  └──────────────────────────────────────┘         │         │
│  └─────────────────────────┬──────────────────────────┘         │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐  ┌──────▼──────┐  ┌────────▼──────────┐
│   MongoDB       │  │   Storage   │  │  Transcription    │
│                 │  │  (Local/GCS)│  │  Service (Mock)   │
│ • Users         │  │             │  │                   │
│ • Projects      │  │ • Audio     │  │  Future:          │
│ • Meetings      │  │   Files     │  │  • AssemblyAI     │
│ • Transcriptions│  │             │  │  • Google STT     │
│                 │  │             │  │  • Whisper API    │
└─────────────────┘  └─────────────┘  └───────────────────┘
```

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────────────┐
│      User        │
│                  │
│ _id              │
│ email            │
│ name             │
│ password         │
│ provider         │
│ googleId         │
│ status           │
└────────┬─────────┘
         │
         │ 1:N (owns)
         │
┌────────▼─────────┐
│    Project       │
│                  │
│ _id              │
│ name             │
│ description      │
│ userId           │───┐
│ createdAt        │   │ ObjectId ref
│ updatedAt        │   │
└────────┬─────────┘   │
         │             │
         │ 1:N         │
         │             │
┌────────▼─────────┐   │
│    Meeting       │   │
│                  │   │
│ _id              │   │
│ title            │   │
│ projectId        │───┘ ObjectId ref
│ audioFile        │
│ duration         │
│ recordingType    │
│ transcription    │
│   Status         │
│ transcription    │
│   Progress       │
│ createdAt        │
│ updatedAt        │
└────────┬─────────┘
         │
         │ 1:N
         │
┌────────▼─────────┐
│  Transcription   │
│                  │
│ _id              │
│ meetingId        │───┐ ObjectId ref
│ startTime        │   │
│ endTime          │   │
│ speaker          │   │
│ text             │   │
│ confidence       │   │
│ isEdited         │   │
│ createdAt        │   │
└──────────────────┘   │
```

### Model Specifications

#### Project Model
```javascript
{
  _id: ObjectId,
  name: String (required, 2-100 chars),
  description: String (optional, max 500 chars),
  userId: ObjectId (required, ref: 'User'),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

// Indexes:
// - userId: 1
// - createdAt: -1
```

#### Meeting Model
```javascript
{
  _id: ObjectId,
  title: String (required, 2-200 chars),
  projectId: ObjectId (required, ref: 'Project'),
  audioFile: String (required, file path/URL),
  duration: Number (seconds, auto-calculated),
  recordingType: String (enum: ['upload', 'direct'], required),
  transcriptionStatus: String (enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending'),
  transcriptionProgress: Number (0-100, default: 0),
  metadata: {
    fileSize: Number,
    mimeType: String,
    originalName: String
  },
  createdAt: Date (auto),
  updatedAt: Date (auto)
}

// Indexes:
// - projectId: 1
// - transcriptionStatus: 1
// - createdAt: -1
```

#### Transcription Model
```javascript
{
  _id: ObjectId,
  meetingId: ObjectId (required, ref: 'Meeting'),
  startTime: Number (required, milliseconds from start),
  endTime: Number (required, milliseconds from start),
  speaker: String (required, e.g., 'Speaker 1', 'Speaker 2'),
  text: String (required, transcribed text),
  confidence: Number (0-1, transcription confidence score),
  isEdited: Boolean (default: false, true if user modified),
  createdAt: Date (auto)
}

// Indexes:
// - meetingId: 1
// - startTime: 1
```

### Validation Rules

**Project**:
- Name: Required, 2-100 characters
- Description: Optional, max 500 characters
- User must be authenticated (userId auto-set from JWT)

**Meeting**:
- Title: Required, 2-200 characters
- Audio file: Required, valid audio format (mp3, wav, m4a, webm)
- Max file size: 100MB (configurable)
- Recording type: Must be 'upload' or 'direct'

**Transcription**:
- Start time < End time
- Text: Required, max 5000 characters per segment
- Speaker: Required
- Confidence: 0-1 if provided

---

## API Endpoints

### Authentication
All endpoints except `/auth/*` require JWT authentication via `Authorization: Bearer <token>` header.

### Projects API

#### Create Project
```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Q1 2024 Team Meetings",
  "description": "All team meetings for Q1"
}

Response: 201 Created
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "name": "Q1 2024 Team Meetings",
    "description": "All team meetings for Q1",
    "userId": "65f1a2b3c4d5e6f7g8h9i0j0",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### List Projects
```http
GET /api/projects?page=1&limit=10&sort=-createdAt
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": {
    "projects": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

#### Get Project
```http
GET /api/projects/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Q1 2024 Team Meetings",
    "description": "...",
    "userId": "...",
    "meetingsCount": 5,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### Update Project
```http
PUT /api/projects/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}

Response: 200 OK
```

#### Delete Project
```http
DELETE /api/projects/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "message": "Project and all associated meetings deleted"
}
```

### Meetings API

#### Create Meeting
```http
POST /api/projects/:projectId/meetings
Authorization: Bearer <token>
Content-Type: multipart/form-data

title: "Weekly Standup - Jan 15"
recordingType: "upload"
audioFile: [binary file data]

Response: 201 Created
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
    "title": "Weekly Standup - Jan 15",
    "projectId": "65f1a2b3c4d5e6f7g8h9i0j1",
    "audioFile": "/uploads/audio/65f1a2b3c4d5e6f7g8h9i0j2.mp3",
    "duration": null,
    "recordingType": "upload",
    "transcriptionStatus": "pending",
    "transcriptionProgress": 0,
    "metadata": {
      "fileSize": 5242880,
      "mimeType": "audio/mpeg",
      "originalName": "standup.mp3"
    },
    "createdAt": "2024-01-15T10:35:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

#### List Meetings
```http
GET /api/projects/:projectId/meetings?page=1&limit=10
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": {
    "meetings": [...],
    "pagination": {...}
  }
}
```

#### Get Meeting
```http
GET /api/meetings/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Weekly Standup - Jan 15",
    "projectId": "...",
    "audioFile": "...",
    "duration": 1847,
    "transcriptionStatus": "completed",
    "transcriptionProgress": 100,
    "transcriptionsCount": 45,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### Start Transcription
```http
POST /api/meetings/:id/transcribe
Authorization: Bearer <token>

Response: 202 Accepted
{
  "success": true,
  "message": "Transcription started",
  "data": {
    "meetingId": "...",
    "status": "processing",
    "progress": 0,
    "estimatedCompletionTime": "2024-01-15T10:45:00.000Z"
  }
}
```

#### Get Transcription Status
```http
GET /api/meetings/:id/status
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": {
    "status": "processing",
    "progress": 45,
    "transcriptionsCount": 20,
    "estimatedCompletionTime": "2024-01-15T10:42:00.000Z"
  }
}
```

#### Update Meeting
```http
PUT /api/meetings/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title"
}

Response: 200 OK
```

#### Delete Meeting
```http
DELETE /api/meetings/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "message": "Meeting and transcriptions deleted"
}
```

### Transcriptions API

#### Get Meeting Transcriptions
```http
GET /api/meetings/:meetingId/transcriptions?page=1&limit=50
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": {
    "transcriptions": [
      {
        "_id": "...",
        "meetingId": "...",
        "startTime": 0,
        "endTime": 3500,
        "speaker": "Speaker 1",
        "text": "Good morning everyone, let's start the standup.",
        "confidence": 0.95,
        "isEdited": false,
        "createdAt": "..."
      },
      {
        "_id": "...",
        "meetingId": "...",
        "startTime": 3500,
        "endTime": 8200,
        "speaker": "Speaker 2",
        "text": "I completed the user authentication feature yesterday.",
        "confidence": 0.92,
        "isEdited": false,
        "createdAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 45,
      "pages": 1
    }
  }
}
```

#### Update Transcription
```http
PUT /api/transcriptions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "speaker": "John Doe",
  "text": "Corrected transcription text"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "_id": "...",
    "meetingId": "...",
    "startTime": 0,
    "endTime": 3500,
    "speaker": "John Doe",
    "text": "Corrected transcription text",
    "confidence": 0.95,
    "isEdited": true,
    "createdAt": "..."
  }
}
```

---

## Service Layer

### Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                        │
│                                                          │
│  ┌───────────────────────────────────────────────┐     │
│  │          ProjectService                       │     │
│  │                                                │     │
│  │  • createProject(userId, data)                │     │
│  │  • getProjects(userId, pagination)            │     │
│  │  • getProjectById(id, userId)                 │     │
│  │  • updateProject(id, userId, data)            │     │
│  │  • deleteProject(id, userId)                  │     │
│  │  • verifyOwnership(id, userId)                │     │
│  └───────────────────────────────────────────────┘     │
│                                                          │
│  ┌───────────────────────────────────────────────┐     │
│  │          MeetingService                       │     │
│  │                                                │     │
│  │  • createMeeting(projectId, userId, data, file)│    │
│  │  • getMeetings(projectId, userId, pagination) │     │
│  │  • getMeetingById(id, userId)                 │     │
│  │  • updateMeeting(id, userId, data)            │     │
│  │  • deleteMeeting(id, userId)                  │     │
│  │  • startTranscription(id, userId)             │     │
│  │  • getTranscriptionStatus(id, userId)         │     │
│  └───────────────────────────────────────────────┘     │
│                                                          │
│  ┌───────────────────────────────────────────────┐     │
│  │      TranscriptionService (Interface)         │     │
│  │                                                │     │
│  │  • transcribeAudio(audioFilePath)             │     │
│  │  • Returns: Promise<TranscriptionResult[]>    │     │
│  │                                                │     │
│  │  Implementations:                              │     │
│  │  • MockTranscriptionService (current)          │     │
│  │  • AssemblyAIService (future)                  │     │
│  │  • GoogleSTTService (future)                   │     │
│  │  • WhisperAPIService (future)                  │     │
│  └───────────────────────────────────────────────┘     │
│                                                          │
│  ┌───────────────────────────────────────────────┐     │
│  │      TranscriptionDataService                 │     │
│  │                                                │     │
│  │  • saveTranscriptions(meetingId, segments)    │     │
│  │  • getTranscriptions(meetingId, pagination)   │     │
│  │  • updateTranscription(id, data)              │     │
│  │  • deleteByMeetingId(meetingId)               │     │
│  └───────────────────────────────────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Service Responsibilities

#### ProjectService
**Purpose**: Manage project CRUD operations and authorization

**Methods**:
- `createProject(userId, projectData)` - Create new project for user
- `getProjects(userId, options)` - Get paginated list with optional filters/sorting
- `getProjectById(projectId, userId)` - Get project with ownership verification
- `updateProject(projectId, userId, updates)` - Update project metadata
- `deleteProject(projectId, userId)` - Delete project and cascade to meetings
- `verifyOwnership(projectId, userId)` - Verify user owns project

**Dependencies**: Project model, logger

#### MeetingService
**Purpose**: Manage meetings, coordinate file upload and transcription

**Methods**:
- `createMeeting(projectId, userId, data, file)` - Create meeting with audio upload
- `getMeetings(projectId, userId, options)` - Get paginated meetings list
- `getMeetingById(meetingId, userId)` - Get meeting with authorization
- `updateMeeting(meetingId, userId, updates)` - Update meeting metadata
- `deleteMeeting(meetingId, userId)` - Delete meeting, audio, and transcriptions
- `startTranscription(meetingId, userId)` - Initiate async transcription
- `getTranscriptionStatus(meetingId, userId)` - Get current transcription progress

**Dependencies**: Meeting model, FileService, ProjectService, TranscriptionService, TranscriptionDataService, logger

#### TranscriptionService (Interface)
**Purpose**: Abstract interface for transcription providers

**Interface**:
```javascript
class TranscriptionService {
  async transcribeAudio(audioFilePath) {
    throw new Error('Must be implemented by subclass');
  }
}
```

**Mock Implementation**:
```javascript
class MockTranscriptionService extends TranscriptionService {
  async transcribeAudio(audioFilePath) {
    // Simulate processing delay
    // Return mock transcription segments with speaker diarization
    return [
      {
        startTime: 0,
        endTime: 3500,
        speaker: 'Speaker 1',
        text: 'Mock transcription text...',
        confidence: 0.95
      }
    ];
  }
}
```

**Future Implementations**: AssemblyAI, Google Speech-to-Text, OpenAI Whisper

#### TranscriptionDataService
**Purpose**: Database operations for transcription segments

**Methods**:
- `saveTranscriptions(meetingId, segments)` - Bulk insert transcription segments
- `getTranscriptions(meetingId, options)` - Get paginated transcriptions
- `getTranscriptionById(id)` - Get single transcription segment
- `updateTranscription(id, updates)` - Update segment (marks as edited)
- `deleteByMeetingId(meetingId)` - Delete all segments for meeting

**Dependencies**: Transcription model, logger

---

## Data Flow

### Flow 1: Create Project
```
User → POST /api/projects
  ↓
AuthMiddleware → Verify JWT
  ↓
ProjectController.create()
  ↓
ProjectService.createProject(userId, data)
  ↓
Validate → Create Project in DB
  ↓
Return Project ← 201 Created
```

### Flow 2: Upload Audio & Create Meeting
```
User → POST /api/projects/:projectId/meetings (multipart/form-data)
  ↓
AuthMiddleware → Verify JWT
  ↓
MulterMiddleware → Process file upload
  ↓
MeetingController.create()
  ↓
ProjectService.verifyOwnership(projectId, userId)
  ↓
FileService.saveFile(audioFile) → Storage (Local/GCS)
  ↓
MeetingService.createMeeting(...)
  ↓
Create Meeting in DB (status: 'pending')
  ↓
Return Meeting ← 201 Created
```

### Flow 3: Start Transcription (Async Processing)
```
User → POST /api/meetings/:id/transcribe
  ↓
AuthMiddleware → Verify JWT
  ↓
MeetingController.startTranscription()
  ↓
MeetingService.startTranscription(meetingId, userId)
  ↓
Verify ownership & check status
  ↓
Update Meeting (status: 'processing', progress: 0)
  ↓
Return 202 Accepted immediately
  ↓
[Async Background Process]
  ↓
TranscriptionService.transcribeAudio(audioFilePath)
  ↓
[Mock: Generate sample segments OR Real: Call external API]
  ↓
Receive transcription segments array
  ↓
TranscriptionDataService.saveTranscriptions(meetingId, segments)
  ↓
Update Meeting (status: 'completed', progress: 100)
  ↓
[Process complete]
```

### Flow 4: Poll Transcription Status
```
User → GET /api/meetings/:id/status (every 2-5 seconds)
  ↓
AuthMiddleware → Verify JWT
  ↓
MeetingController.getStatus()
  ↓
MeetingService.getTranscriptionStatus(meetingId, userId)
  ↓
Query Meeting for status & progress
  ↓
Return { status, progress, count } ← 200 OK
  ↓
[Frontend checks: if status === 'completed', stop polling]
```

### Flow 5: View Transcriptions
```
User → GET /api/meetings/:meetingId/transcriptions
  ↓
AuthMiddleware → Verify JWT
  ↓
TranscriptionController.list()
  ↓
Verify user owns meeting (via projectId → userId)
  ↓
TranscriptionDataService.getTranscriptions(meetingId, options)
  ↓
Query DB, order by startTime ASC
  ↓
Return paginated transcriptions ← 200 OK
```

### Flow 6: Edit Transcription
```
User → PUT /api/transcriptions/:id
  ↓
AuthMiddleware → Verify JWT
  ↓
TranscriptionController.update()
  ↓
Verify ownership (transcription → meeting → project → userId)
  ↓
TranscriptionDataService.updateTranscription(id, updates)
  ↓
Update text/speaker, set isEdited: true
  ↓
Return updated transcription ← 200 OK
```

---

## File Structure

```
meno-api/
├── src/
│   ├── models/
│   │   ├── user.model.js (existing)
│   │   ├── project.model.js (NEW)
│   │   ├── meeting.model.js (NEW)
│   │   └── transcription.model.js (NEW)
│   │
│   ├── core/
│   │   └── services/
│   │       ├── index.js (update exports)
│   │       ├── user.service.js (existing)
│   │       ├── file.service.js (existing)
│   │       ├── auth.service.js (existing)
│   │       ├── project.service.js (NEW)
│   │       ├── meeting.service.js (NEW)
│   │       ├── transcription.service.js (NEW - interface)
│   │       ├── mock-transcription.service.js (NEW)
│   │       └── transcription-data.service.js (NEW)
│   │
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── project.controller.js (NEW)
│   │   │   ├── meeting.controller.js (NEW)
│   │   │   └── transcription.controller.js (NEW)
│   │   │
│   │   ├── routes/
│   │   │   ├── index.js (update to include new routes)
│   │   │   ├── project.routes.js (NEW)
│   │   │   ├── meeting.routes.js (NEW)
│   │   │   └── transcription.routes.js (NEW)
│   │   │
│   │   ├── validators/
│   │   │   ├── project.validator.js (NEW)
│   │   │   ├── meeting.validator.js (NEW)
│   │   │   └── transcription.validator.js (NEW)
│   │   │
│   │   └── middleware/
│   │       ├── auth.middleware.js (existing)
│   │       └── upload.middleware.js (NEW - Multer config)
│   │
│   ├── components/
│   │   └── config/
│   │       └── multer.js (NEW - file upload config)
│   │
│   └── app.js (update to wire new services/controllers)
│
├── ARCHITECTURE.md (THIS FILE)
└── package.json (add multer dependency if not present)
```

---

## Implementation Guide

### Phase 1: Database Models (30 minutes)
1. Create `project.model.js`
2. Create `meeting.model.js`
3. Create `transcription.model.js`
4. Test model validations

### Phase 2: Service Layer (1.5 hours)
1. Create `project.service.js` - CRUD operations
2. Create `transcription.service.js` - Abstract interface
3. Create `mock-transcription.service.js` - Mock implementation
4. Create `transcription-data.service.js` - DB operations
5. Create `meeting.service.js` - Complex orchestration
6. Update `src/core/services/index.js` to export new services

### Phase 3: Controllers (1 hour)
1. Create `project.controller.js`
2. Create `meeting.controller.js`
3. Create `transcription.controller.js`

### Phase 4: Validators (30 minutes)
1. Create `project.validator.js` - Joi schemas
2. Create `meeting.validator.js` - Joi schemas
3. Create `transcription.validator.js` - Joi schemas

### Phase 5: Routes (30 minutes)
1. Create `project.routes.js`
2. Create `meeting.routes.js`
3. Create `transcription.routes.js`
4. Update `src/api/routes/index.js`

### Phase 6: Middleware & Config (20 minutes)
1. Create `upload.middleware.js` - Multer for audio files
2. Create `src/components/config/multer.js` - Multer config
3. Install multer: `npm install multer`

### Phase 7: Integration (30 minutes)
1. Update `src/app.js` - Wire services and controllers
2. Update Swagger documentation
3. Test all endpoints

### Phase 8: Testing (1 hour)
1. Test project CRUD
2. Test meeting creation with file upload
3. Test transcription flow end-to-end
4. Test authorization boundaries
5. Test cascade deletes

**Total Estimated Time**: ~5-6 hours

---

## Configuration

### Environment Variables
```env
# Audio File Upload
MAX_AUDIO_FILE_SIZE=104857600  # 100MB in bytes
ALLOWED_AUDIO_FORMATS=mp3,wav,m4a,webm

# Transcription (Mock settings)
MOCK_TRANSCRIPTION_ENABLED=true
MOCK_TRANSCRIPTION_DELAY=5000  # 5 seconds delay

# Future: Real transcription service
# TRANSCRIPTION_PROVIDER=assemblyai
# ASSEMBLYAI_API_KEY=your-key-here
```

### Multer Configuration
```javascript
// Audio file upload limits
{
  maxFileSize: process.env.MAX_AUDIO_FILE_SIZE || 104857600, // 100MB
  allowedFormats: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm']
}
```

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error"
    }
  ]
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

---

## Security Considerations

### Authorization
- All endpoints require JWT authentication
- Users can only access their own projects/meetings/transcriptions
- Cascade authorization: Meeting authorization checked via Project ownership
- Transcription authorization checked via Meeting → Project ownership

### File Upload Security
- Validate file MIME types (audio only)
- Limit file size (100MB default)
- Generate unique filenames (prevent overwrite attacks)
- Store files outside web root
- Sanitize original filenames

### Data Validation
- All inputs validated with Joi schemas
- SQL/NoSQL injection prevention via Mongoose
- XSS prevention via input sanitization
- Rate limiting on upload endpoints (future)

---

## Scalability Considerations

### Database
- Indexes on frequently queried fields (userId, projectId, meetingId)
- Pagination on all list endpoints
- Consider sharding by userId for horizontal scaling

### File Storage
- Abstract storage layer (local/GCS already implemented)
- CDN for audio file delivery (future)
- Signed URLs for secure file access

### Transcription Processing
- Currently synchronous mock (simple)
- Future: Job queue (Bull + Redis) for async processing
- Webhook support for long-running transcriptions
- Retry logic for failed transcriptions

### Caching
- Cache transcription results (future)
- Cache project/meeting metadata (Redis)
- Cache user sessions (already using JWT)

---

## Future Enhancements

### Phase 2 Features
1. **Real Transcription Service Integration**
   - AssemblyAI, Google STT, or Whisper API
   - Webhook support for status updates
   - Job queue for async processing

2. **Search Functionality**
   - Full-text search in transcriptions
   - Elasticsearch integration
   - Search by speaker, keywords, date range

3. **Export Features**
   - Export transcriptions (TXT, SRT, VTT, JSON)
   - PDF report generation
   - Audio file download with timestamps

4. **Collaboration**
   - Share projects/meetings with other users
   - Role-based access (viewer, editor, owner)
   - Comments on transcription segments

5. **Advanced Features**
   - AI-generated meeting summaries
   - Action items extraction
   - Sentiment analysis
   - Multi-language support

6. **Performance**
   - WebSocket for real-time updates
   - Background job processing
   - CDN for audio delivery
   - Caching layer

---

## Appendix

### Sample Mock Transcription Output
```javascript
[
  {
    startTime: 0,
    endTime: 3500,
    speaker: 'Speaker 1',
    text: 'Good morning everyone, let\'s start today\'s standup meeting.',
    confidence: 0.95
  },
  {
    startTime: 3500,
    endTime: 8200,
    speaker: 'Speaker 2',
    text: 'I completed the user authentication feature yesterday and deployed it to staging.',
    confidence: 0.92
  },
  {
    startTime: 8200,
    endTime: 12100,
    speaker: 'Speaker 1',
    text: 'Great work! Any blockers or issues we should discuss?',
    confidence: 0.96
  }
]
```

### Time Format
All timestamps are in **milliseconds** from the start of the audio file:
- `0` = 00:00.000
- `3500` = 00:03.500
- `60000` = 01:00.000

This allows for precise positioning and easy conversion to display formats (MM:SS.mmm or HH:MM:SS).

---

## Documentation Updates

After implementation, update:
1. Swagger/OpenAPI spec for new endpoints
2. Postman collection with example requests
3. README.md with setup instructions
4. CHANGELOG.md with version notes

---

**Last Updated**: 2025-01-22
**Version**: 1.0
**Status**: Design Complete - Ready for Implementation
