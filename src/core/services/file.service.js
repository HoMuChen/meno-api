/**
 * File Service
 * Core business logic for file operations
 */
const BaseService = require('./base.service');
const File = require('../../models/file.model');
const { NotFoundError } = require('../../utils/errors');

class FileService extends BaseService {
  constructor(logger, storageProvider) {
    super(logger);
    this.storage = storageProvider;
  }

  /**
   * Upload file
   */
  async uploadFile(file, uploadedBy = null) {
    try {
      // Generate unique path
      const timestamp = Date.now();
      const path = `files/${timestamp}-${file.originalname}`;

      // Upload to storage
      const result = await this.storage.upload(path, file.buffer, {
        contentType: file.mimetype
      });

      // Save metadata to database
      const fileDoc = await File.create({
        filename: file.originalname,
        path: result.path,
        url: result.url,
        size: result.size,
        mimeType: file.mimetype,
        uploadedBy
      });

      this.logSuccess('File uploaded', { fileId: fileDoc._id, path: result.path });
      return fileDoc;
    } catch (error) {
      this.logAndThrow(error, 'Upload file', { filename: file.originalname });
    }
  }

  /**
   * Get file by ID
   */
  async getFileById(fileId) {
    try {
      const file = await File.findById(fileId).populate('uploadedBy', 'name email');

      if (!file) {
        throw new NotFoundError(`File not found with ID: ${fileId}`);
      }

      this.logSuccess('File retrieved', { fileId });
      return file;
    } catch (error) {
      this.logAndThrow(error, 'Get file by ID', { fileId });
    }
  }

  /**
   * Get all files with pagination
   */
  async getAllFiles(page = 1, limit = 10, uploadedBy = null) {
    try {
      const { skip, limit: parsedLimit } = this.getPaginationParams(page, limit);
      const filter = uploadedBy ? { uploadedBy } : {};

      const [files, total] = await Promise.all([
        File.find(filter)
          .skip(skip)
          .limit(parsedLimit)
          .sort({ createdAt: -1 })
          .populate('uploadedBy', 'name email'),
        File.countDocuments(filter)
      ]);

      this.logSuccess('Files retrieved', { count: files.length, total });
      return { files, total, page: parseInt(page), limit: parsedLimit };
    } catch (error) {
      this.logAndThrow(error, 'Get all files', { page, limit, uploadedBy });
    }
  }

  /**
   * Download file
   */
  async downloadFile(fileId) {
    try {
      const file = await File.findById(fileId);

      if (!file) {
        throw new NotFoundError(`File not found with ID: ${fileId}`);
      }

      const data = await this.storage.download(file.path);

      this.logSuccess('File downloaded', { fileId });
      return { file, data };
    } catch (error) {
      this.logAndThrow(error, 'Download file', { fileId });
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId) {
    try {
      const file = await File.findById(fileId);

      if (!file) {
        throw new NotFoundError(`File not found with ID: ${fileId}`);
      }

      // Delete from storage
      await this.storage.delete(file.path);

      // Delete from database
      await file.deleteOne();

      this.logSuccess('File deleted', { fileId });
      return file;
    } catch (error) {
      this.logAndThrow(error, 'Delete file', { fileId });
    }
  }

  /**
   * Get file URL
   */
  async getFileUrl(fileId, expiresIn = 3600) {
    try {
      const file = await File.findById(fileId);

      if (!file) {
        throw new NotFoundError(`File not found with ID: ${fileId}`);
      }

      const url = await this.storage.getUrl(file.path, expiresIn);

      this.logSuccess('File URL generated', { fileId });
      return { file, url };
    } catch (error) {
      this.logAndThrow(error, 'Get file URL', { fileId });
    }
  }
}

module.exports = FileService;
