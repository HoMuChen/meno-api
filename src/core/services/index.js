/**
 * Core Services Export
 */
const UserService = require('./user.service');
const FileService = require('./file.service');
const AuthService = require('./auth.service');
const ProjectService = require('./project.service');
const MeetingService = require('./meeting.service');
const TranscriptionService = require('./transcription.service');
const MockTranscriptionService = require('./mock-transcription.service');
const TranscriptionDataService = require('./transcription-data.service');

module.exports = {
  UserService,
  FileService,
  AuthService,
  ProjectService,
  MeetingService,
  TranscriptionService,
  MockTranscriptionService,
  TranscriptionDataService
};
