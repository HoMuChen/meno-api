/**
 * Core Services Export
 */
const UserService = require('./user.service');
const FileService = require('./file.service');
const AuthService = require('./auth.service');

module.exports = {
  UserService,
  FileService,
  AuthService
};
