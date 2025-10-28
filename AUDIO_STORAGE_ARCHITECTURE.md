# Audio File Storage Architecture

## Overview

This document describes the audio file storage architecture implemented for the Meeting system. The architecture provides a flexible, cloud-ready solution that abstracts storage mechanisms and enables seamless migration from local storage to cloud storage (Google Cloud Storage).

## Problem Statement

**Before**: The `meeting.audioFile` field stored local filesystem paths:
```
audioFile: "./storage/audio-1234567890-meeting.mp3"
```

**Issues**:
- Not portable or cloud-ready
- Users couldn't download files
- No abstraction between storage and data model
- Migration to cloud storage would break existing references

## Solution Architecture

### Storage Provider Pattern

We implemented the **Storage Provider Pattern** with three key components:

1. **Storage Provider Interface** - Abstract interface for all storage implementations
2. **Local Storage Provider** - Local filesystem implementation
3. **GCS Storage Provider** - Google Cloud Storage implementation (future-ready)
4. **Storage Factory** - Creates appropriate provider based on configuration

### Storage URI Format

Audio files are now stored using storage-agnostic URIs:

```
Format: {provider}://{bucket}/{path}

Examples:
- local://audio-files/meetings/60a7c1234567890abcdef/1234567890-meeting.mp3
- gcs://meno-audio-bucket/meetings/60a7c1234567890abcdef/1234567890-meeting.mp3
```

**Benefits**:
- ✅ Storage-agnostic: Switch providers with config change
- ✅ Explicit bucket/container organization
- ✅ Easy to parse and validate
- ✅ Supports multi-cloud strategies

## Architecture Components

### 1. Storage Provider Interface
**File**: `src/core/storage/storage-provider.interface.js`

Defines standard operations:
- `upload(path, data, options)` - Upload file to storage
- `download(uri)` - Download file from storage
- `getSignedUrl(uri, expiresIn)` - Get temporary access URL
- `delete(uri)` - Delete file from storage
- `exists(uri)` - Check file existence
- `getMetadata(uri)` - Get file metadata

### 2. Local Storage Provider
**File**: `src/core/storage/local-storage.provider.js`

**Features**:
- Stores files in local filesystem
- URI format: `local://bucket/path`
- Automatically creates directory structure
- Supports both file path and Buffer uploads
- Thread-safe file operations

**Configuration**:
```javascript
{
  provider: 'local',
  basePath: './storage',  // Base directory
  bucket: 'audio-files'   // Bucket name
}
```

**Physical File Structure**:
```
./storage/
└── audio-files/
    └── meetings/
        └── {projectId}/
            └── {timestamp}-{filename}.mp3
```

### 3. GCS Storage Provider
**File**: `src/core/storage/gcs-storage.provider.js`

**Features**:
- Google Cloud Storage implementation
- Lazy loading (only loads SDK when used)
- Signed URL generation for temporary access
- Full GCS SDK integration

**Configuration**:
```javascript
{
  provider: 'gcs',
  projectId: 'your-gcs-project',
  bucket: 'meno-audio-bucket',
  keyFilename: '/path/to/service-account-key.json'
}
```

**Prerequisites**:
```bash
npm install @google-cloud/storage
```

### 4. Storage Factory
**File**: `src/core/storage/storage.factory.js`

**Responsibilities**:
- Create storage provider instances
- Select provider based on configuration
- Provide fallback to local storage
- Environment-based configuration

**Usage**:
```javascript
const StorageFactory = require('./core/storage/storage.factory');

const provider = StorageFactory.createProvider(logger, {
  provider: 'local', // or 'gcs'
  basePath: './storage',
  bucket: 'audio-files'
});
```

## API Changes

### New Download Endpoint

**Endpoint**: `GET /api/projects/:projectId/meetings/:id/download`

**Description**: Download the original audio file for a meeting

**Response**:
- Headers: `Content-Type`, `Content-Disposition`, `Content-Length`
- Body: Binary audio file data

**Usage Example**:
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/projects/{projectId}/meetings/{meetingId}/download \
  -o meeting-audio.mp3
```

### Meeting Service Updates

**New Methods**:
- `downloadAudioFile(meetingId, userId)` - Download audio file
- `_getAudioFilePath(audioFileUri)` - Get local path for transcription

**Modified Methods**:
- `createMeeting()` - Now uploads via storage provider and stores URI
- `deleteMeeting()` - Now deletes via storage provider
- `_processTranscription()` - Now handles both local and cloud URIs

## Migration Guide

### For Existing Data

Run the migration script to convert existing file paths to URIs:

```bash
# Dry run (preview changes)
node scripts/migrate-audio-file-paths.js --dry-run

# Execute migration
node scripts/migrate-audio-file-paths.js

# Custom batch size
node scripts/migrate-audio-file-paths.js --batch-size=50
```

**Migration Process**:
1. Reads all meetings from database
2. Converts file paths to storage URIs
3. Moves files to new directory structure
4. Updates database with new URIs
5. Validates and reports results

### Environment Variables

```bash
# Storage Provider Selection
STORAGE_PROVIDER=local  # or 'gcs'

# Local Storage Configuration
LOCAL_STORAGE_PATH=./storage

# GCS Configuration (if using GCS)
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=meno-audio-bucket
GCS_KEYFILE_PATH=/path/to/service-account-key.json
```

## Migration to Google Cloud Storage

When ready to migrate to GCS:

### Step 1: Install Dependencies
```bash
npm install @google-cloud/storage
```

### Step 2: Configure GCS

**For Development (using service account key file):**
```bash
# Set environment variables
export STORAGE_PROVIDER=gcs
export GCS_PROJECT_ID=your-project-id
export GCS_BUCKET_NAME=meno-audio-bucket
export GCS_KEYFILE_PATH=/path/to/service-account-key.json
```

**For Production on GCE (using Application Default Credentials):**
```bash
# Set environment variables (no key file needed)
export STORAGE_PROVIDER=gcs
export GCS_PROJECT_ID=your-project-id
export GCS_BUCKET_NAME=meno-audio-bucket

# IMPORTANT: Ensure GCE instance has correct scopes and IAM roles
# See docs/GCS_GCE_SETUP.md for detailed instructions
```

**Required GCE Configuration:**
- Instance scope: `https://www.googleapis.com/auth/devstorage.read_write` or `cloud-platform`
- Service account role: `roles/storage.objectAdmin` (minimum)

### Step 3: Migrate Existing Files
```bash
# Optional: Upload existing files to GCS
gsutil -m cp -r ./storage/audio-files/* gs://meno-audio-bucket/
```

### Step 4: Update Database
```bash
# Run migration to update URIs from local:// to gcs://
# (You may need a custom script for this step)
```

### Troubleshooting

**Error: "Provided scope(s) are not authorized"**

This error occurs on GCE when the instance lacks proper storage scopes. See [docs/GCS_GCE_SETUP.md](docs/GCS_GCE_SETUP.md) for:
- Checking current instance configuration
- Updating instance scopes (requires restart)
- Verifying IAM roles
- Testing bucket access

### Step 5: Restart Application
```bash
npm start
```

## Usage Examples

### User Downloads Audio File

**Frontend Code**:
```javascript
async function downloadMeetingAudio(projectId, meetingId, token) {
  const response = await fetch(
    `/api/projects/${projectId}/meetings/${meetingId}/download`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meeting-audio.mp3';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
```

### Backend Usage (Programmatic)

```javascript
// Upload audio file
const uploadResult = await audioStorageProvider.upload(
  'meetings/project123/audio.mp3',
  '/tmp/uploaded-file.mp3',
  {
    contentType: 'audio/mpeg',
    metadata: { projectId: 'project123' }
  }
);
// Returns: { uri: 'local://audio-files/meetings/project123/audio.mp3', size: 12345 }

// Download audio file
const fileData = await audioStorageProvider.download(uploadResult.uri);

// Delete audio file
await audioStorageProvider.delete(uploadResult.uri);

// Check if file exists
const exists = await audioStorageProvider.exists(uploadResult.uri);

// Get metadata
const metadata = await audioStorageProvider.getMetadata(uploadResult.uri);
```

## Testing

### Manual Testing

1. **Create Meeting with Audio**:
```bash
curl -X POST http://localhost:3000/api/projects/{projectId}/meetings \
  -H "Authorization: Bearer {token}" \
  -F "audioFile=@/path/to/audio.mp3" \
  -F "title=Test Meeting"
```

2. **Verify URI in Database**:
```javascript
// Check meeting document
db.meetings.findOne({ _id: ObjectId("...") })
// Should see: audioFile: "local://audio-files/meetings/..."
```

3. **Download Audio File**:
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/projects/{projectId}/meetings/{meetingId}/download \
  -o downloaded-audio.mp3
```

4. **Verify File Downloaded Correctly**:
```bash
file downloaded-audio.mp3
# Should show: Audio file with MPEG ADTS, layer III...
```

## Supported Audio Formats

The system supports the following audio formats for upload and processing:

### Fully Supported Formats

| Format | Extension | MIME Types | Duration Extraction | Notes |
|--------|-----------|------------|---------------------|-------|
| **MP3** | `.mp3` | `audio/mpeg`, `audio/mp3` | ✅ Full support | Most common format, works on all storage providers |
| **M4A/AAC** | `.m4a`, `.aac` | `audio/mp4`, `audio/x-m4a`, `audio/m4a`, `audio/aac` | ✅ Full support | Apple/iOS native format |
| **WAV** | `.wav` | `audio/wav`, `audio/x-wav`, `audio/wave` | ✅ Full support | Uncompressed, larger file size |
| **WebM** | `.webm` | `audio/webm`, `video/webm` | ✅ Full support | Modern web format |
| **OGG** | `.ogg` | `audio/ogg`, `audio/vorbis` | ✅ Full support | Open source format |
| **FLAC** | `.flac` | `audio/flac`, `audio/x-flac` | ✅ Full support | Lossless compression |

### Audio Duration Extraction

The system automatically extracts audio duration using a **3-tier hybrid approach**:

#### Priority 1: Client-Provided Duration (Recommended)
```javascript
// Frontend extracts duration before upload
const audioElement = new Audio(URL.createObjectURL(file));
audioElement.onloadedmetadata = () => {
  formData.append('duration', audioElement.duration);
  // Upload with duration
};
```
**Benefits**: Fastest, no server overhead, works with all storage types

#### Priority 2: Local Storage Path Extraction
- For local storage: Uses file path directly with ffprobe
- **Performance**: Fast (~100-500ms)
- **Format Support**: All formats including MP3

#### Priority 3: GCS Storage URI Extraction
- For GCS storage: Downloads to temp, extracts, auto-cleanup
- **Performance**: Slower (~1-2 seconds due to download)
- **Format Support**: All formats including MP3

**Technical Details**:
- Uses **ffprobe** for metadata extraction (part of ffmpeg)
- Handles MP3 ID3 tags, M4A atoms, and all standard audio metadata
- Automatic temp file cleanup for GCS downloads
- Graceful fallback if extraction fails (duration = null)

## Benefits Summary

✅ **Cloud-Ready**: Easy migration to GCS with just configuration change
✅ **Abstracted Storage**: Business logic doesn't depend on storage implementation
✅ **Downloadable Files**: Users can download audio files via API
✅ **Backward Compatible**: Migration script handles existing data
✅ **Scalable**: Support for multiple storage providers
✅ **Future-Proof**: Add S3, Azure, or other providers easily
✅ **Clean Architecture**: Separation of concerns between storage and business logic
✅ **MP3 & All Major Formats**: Full support for MP3, M4A, WAV, WebM, OGG, FLAC

## Future Enhancements

1. **S3 Storage Provider** - Add AWS S3 support
2. **Azure Blob Storage Provider** - Add Azure support
3. **CDN Integration** - Serve files via CDN for better performance
4. **File Compression** - Compress audio files before storage
5. **Thumbnail Generation** - Generate waveform thumbnails
6. **Multi-Region Storage** - Store files in multiple regions
7. **Encryption at Rest** - Encrypt files before storage

## Troubleshooting

### Issue: Files not downloading
- Check storage provider configuration
- Verify file exists at URI location
- Check user permissions
- Review server logs for errors

### Issue: Migration script fails
- Run with `--dry-run` first
- Check database connection
- Verify file system permissions
- Review migration script logs

### Issue: GCS not working
- Verify @google-cloud/storage is installed
- Check GCS credentials and permissions
- Validate bucket exists and is accessible
- Review GCS service account permissions

## Support

For questions or issues, please contact the development team or create an issue in the project repository.
