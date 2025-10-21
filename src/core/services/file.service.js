/**
 * File Service
 * Core business logic for file operations
 */
const File = require('../../models/file.model');
const { NotFoundError } = require('../../utils/errors');

class FileService {
  constructor(logger, storageProvider) {
    this.logger = logger;
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

      this.logger.info('File uploaded', { fileId: fileDoc._id, path: result.path });
      return fileDoc;
    } catch (error) {
      this.logger.error('Failed to upload file', { error });
      throw error;
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

      this.logger.info('File retrieved', { fileId });
      return file;
    } catch (error) {
      this.logger.error('Failed to get file', { error, fileId });
      throw error;
    }
  }

  /**
   * Get all files with pagination
   */
  async getAllFiles(page = 1, limit = 10, uploadedBy = null) {
    try {
      const skip = (page - 1) * limit;
      const filter = uploadedBy ? { uploadedBy } : {};

      const [files, total] = await Promise.all([
        File.find(filter)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .populate('uploadedBy', 'name email'),
        File.countDocuments(filter)
      ]);

      this.logger.info('Files retrieved', { count: files.length, total });
      return { files, total, page, limit };
    } catch (error) {
      this.logger.error('Failed to get files', { error });
      throw error;
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

      this.logger.info('File downloaded', { fileId });
      return { file, data };
    } catch (error) {
      this.logger.error('Failed to download file', { error, fileId });
      throw error;
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

      this.logger.info('File deleted', { fileId });
      return file;
    } catch (error) {
      this.logger.error('Failed to delete file', { error, fileId });
      throw error;
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

      this.logger.info('File URL generated', { fileId });
      return { file, url };
    } catch (error) {
      this.logger.error('Failed to get file URL', { error, fileId });
      throw error;
    }
  }
}

module.exports = FileService;
