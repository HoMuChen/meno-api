# API Documentation

This directory contains the OpenAPI specification for the Meno API.

## Files

- **`openapi.yaml`** - Complete OpenAPI 3.0 specification in YAML format

## Usage

### For Frontend Developers

The `openapi.yaml` file contains the complete API specification including:

- **23 documented endpoints** across 7 categories:
  - Health - Server health monitoring
  - Auth - Email/password login, Google OAuth
  - Users - User profile management
  - Files - File upload/download
  - Projects - Project CRUD operations
  - Meetings - Meeting management with audio upload
  - Transcriptions - Transcription viewing and editing

- **Authentication**: All API endpoints (except auth and health) require JWT Bearer token
- **Request/Response schemas**: Complete TypeScript-ready schemas
- **Validation rules**: Min/max lengths, required fields, file size limits

### Using with Claude Code (Frontend)

Share this file with your frontend Claude Code instance. It can use it to:

1. **Generate TypeScript types**:
   ```typescript
   interface Project {
     _id: string;
     name: string;
     description?: string;
     userId: string;
     createdAt: string;
     updatedAt: string;
     meetingsCount: number;
   }
   ```

2. **Create API client functions**:
   ```typescript
   async function getProjects(page = 1, limit = 10): Promise<ProjectsResponse> {
     const response = await fetch(`/api/projects?page=${page}&limit=${limit}`, {
       headers: { 'Authorization': `Bearer ${token}` }
     });
     return response.json();
   }
   ```

3. **Build forms with validation**:
   - Project name: 2-100 characters
   - Meeting title: 2-200 characters
   - Audio file: Max 100MB, formats: MP3, WAV, M4A, WebM, OGG

### Code Generation Tools

You can also use standard OpenAPI tools:

```bash
# Generate TypeScript client
npx openapi-generator-cli generate -i docs/openapi.yaml -g typescript-fetch -o src/api

# Generate TypeScript types only
npx openapi-typescript docs/openapi.yaml --output src/types/api.ts
```

## Keeping the Spec Updated

### Auto-Generate After Code Changes

Whenever you modify API endpoints, run:

```bash
npm run generate:openapi
```

This will regenerate `openapi.yaml` from your current Swagger annotations.

### What Triggers an Update?

Update the spec when you:
- Add/remove endpoints
- Change request/response schemas
- Modify validation rules
- Update authentication requirements
- Add new tags/categories

### Commit the Updated Spec

After regenerating:

```bash
git add docs/openapi.yaml
git commit -m "docs(api): update OpenAPI spec for [your changes]"
```

## API Endpoint Summary

### Authentication
- `POST /auth/signup` - Email/password registration
- `POST /auth/login` - Email/password login
- `GET /auth/google` - Google OAuth login
- `GET /auth/google/callback` - Google OAuth callback

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects (paginated)
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `GET /api/projects/{id}/stats` - Get project statistics

### Meetings
- `POST /api/projects/{projectId}/meetings` - Create meeting (with audio upload)
- `GET /api/projects/{projectId}/meetings` - List meetings
- `GET /api/projects/{projectId}/meetings/{id}` - Get meeting details
- `PUT /api/projects/{projectId}/meetings/{id}` - Update meeting
- `DELETE /api/projects/{projectId}/meetings/{id}` - Delete meeting
- `POST /api/projects/{projectId}/meetings/{id}/transcribe` - Start transcription
- `GET /api/projects/{projectId}/meetings/{id}/status` - Get transcription status

### Transcriptions
- `GET /api/meetings/{meetingId}/transcriptions` - List transcriptions
- `GET /api/meetings/{meetingId}/transcriptions/{id}` - Get transcription
- `PUT /api/meetings/{meetingId}/transcriptions/{id}` - Update transcription
- `GET /api/meetings/{meetingId}/transcriptions/search` - Search transcriptions
- `GET /api/meetings/{meetingId}/transcriptions/speaker/{speaker}` - Filter by speaker

### Users & Files
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update profile
- `POST /api/files` - Upload file
- `GET /api/files/{id}` - Download file
- `DELETE /api/files/{id}` - Delete file

## Server URL

Default development server: `http://localhost:6001`

Update the `servers` section in `openapi.yaml` for production deployment.
