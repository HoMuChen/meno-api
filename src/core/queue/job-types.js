/**
 * Job type definitions and schemas for the queue system
 *
 * This module defines all available job types and their data schemas.
 * When adding a new job type:
 * 1. Add constant to JOB_TYPES
 * 2. Define schema in JOB_SCHEMAS
 * 3. Create processor in worker/processors/
 * 4. Register in worker/index.js
 */

const JOB_TYPES = {
  TRANSCRIPTION: 'transcription',
  TRANSCRIPTION_LARGE: 'transcription-large', // For meetings > 40 minutes
  // Future job types can be added here:
  // EMBEDDING: 'embedding',
  // ACTION_ITEMS: 'action-items',
  // MEETING_SUMMARY: 'meeting-summary',
};

const JOB_SCHEMAS = {
  [JOB_TYPES.TRANSCRIPTION]: {
    meetingId: {
      type: 'string',
      required: true,
      description: 'MongoDB ObjectId of the meeting to transcribe',
    },
    audioUri: {
      type: 'string',
      required: true,
      description: 'Storage URI of the audio file (e.g., gcs://bucket/path or local://path)',
    },
    options: {
      type: 'object',
      required: false,
      description: 'Additional transcription options',
      schema: {
        language: {
          type: 'string',
          required: false,
          description: 'Language code for transcription (e.g., en, es, fr)',
        },
        speakerDetection: {
          type: 'boolean',
          required: false,
          default: true,
          description: 'Enable speaker detection',
        },
      },
    },
  },
  // Same schema for large transcriptions (same work, different queue)
  [JOB_TYPES.TRANSCRIPTION_LARGE]: {
    meetingId: {
      type: 'string',
      required: true,
      description: 'MongoDB ObjectId of the meeting to transcribe',
    },
    audioUri: {
      type: 'string',
      required: true,
      description: 'Storage URI of the audio file (e.g., gcs://bucket/path or local://path)',
    },
    options: {
      type: 'object',
      required: false,
      description: 'Additional transcription options',
      schema: {
        language: {
          type: 'string',
          required: false,
          description: 'Language code for transcription (e.g., en, es, fr)',
        },
        speakerDetection: {
          type: 'boolean',
          required: false,
          default: true,
          description: 'Enable speaker detection',
        },
      },
    },
  },
};

const QUEUE_NAMES = {
  [JOB_TYPES.TRANSCRIPTION]: 'transcription-queue',
  [JOB_TYPES.TRANSCRIPTION_LARGE]: 'transcription-large-queue',
  // Future: [JOB_TYPES.EMBEDDING]: 'embedding-queue',
};

module.exports = {
  JOB_TYPES,
  JOB_SCHEMAS,
  QUEUE_NAMES,
};
