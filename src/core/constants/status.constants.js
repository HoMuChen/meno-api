/**
 * Status Constants
 * Centralized status values for consistency across the application
 */

/**
 * User account status values
 */
const UserStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended'
};

/**
 * Transcription processing status values
 */
const TranscriptionStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Meeting status values
 */
const MeetingStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

/**
 * File upload status values
 */
const FileStatus = {
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed'
};

/**
 * Authentication provider types
 */
const AuthProvider = {
  EMAIL: 'email',
  GOOGLE: 'google'
};

module.exports = {
  UserStatus,
  TranscriptionStatus,
  MeetingStatus,
  FileStatus,
  AuthProvider
};
