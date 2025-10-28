/**
 * Local Storage Provider
 * Implementation for local file system storage
 */
const StorageProvider = require('./storage-provider.interface');
const fs = require('fs').promises;
const path = require('path');

class LocalStorageProvider extends StorageProvider {
  constructor(logger, config = {}) {
    super();
    this.logger = logger;
    this.basePath = config.basePath || process.env.LOCAL_STORAGE_PATH || './storage';
    this.bucket = config.bucket || 'audio-files';
  }

  /**
   * Upload file to local storage
   * @param {string} filePath - Relative path within bucket
   * @param {Buffer|string} data - File data or source file path
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URI
   */
  async upload(filePath, data, options = {}) {
    try {
      const fullPath = path.join(this.basePath, this.bucket, filePath);
      const directory = path.dirname(fullPath);

      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      let fileSize;

      // Handle different data types
      if (typeof data === 'string') {
        // Data is a path to existing file - copy it
        await fs.copyFile(data, fullPath);
        const stats = await fs.stat(fullPath);
        fileSize = stats.size;
      } else if (Buffer.isBuffer(data)) {
        // Data is a buffer - write it
        await fs.writeFile(fullPath, data);
        fileSize = data.length;
      } else {
        throw new Error('Data must be a file path string or Buffer');
      }

      const uri = this.buildUri('local', this.bucket, filePath);

      this.logger.info('File uploaded to local storage', {
        uri,
        size: fileSize,
        path: fullPath
      });

      return {
        uri,
        size: fileSize,
        metadata: {
          contentType: options.contentType || 'application/octet-stream',
          uploadedAt: new Date()
        }
      };
    } catch (error) {
      this.logger.error('Local storage upload failed', {
        error: error.message,
        filePath
      });
      throw error;
    }
  }

  /**
   * Upload file from stream to local storage
   * @param {string} filePath - Relative path within bucket
   * @param {ReadableStream} readableStream - Readable stream source
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URI
   */
  async uploadStream(filePath, readableStream, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const fullPath = path.join(this.basePath, this.bucket, filePath);
        const directory = path.dirname(fullPath);

        // Ensure directory exists synchronously to avoid race conditions
        require('fs').mkdirSync(directory, { recursive: true });

        const writeStream = require('fs').createWriteStream(fullPath);
        let fileSize = 0;

        // Track bytes written
        writeStream.on('pipe', () => {
          this.logger.info('Stream upload started', { filePath });
        });

        readableStream.on('data', (chunk) => {
          fileSize += chunk.length;
        });

        writeStream.on('finish', () => {
          const uri = this.buildUri('local', this.bucket, filePath);

          this.logger.info('Stream uploaded to local storage', {
            uri,
            size: fileSize,
            path: fullPath
          });

          resolve({
            uri,
            size: fileSize,
            path: fullPath,
            metadata: {
              contentType: options.contentType || 'application/octet-stream',
              uploadedAt: new Date()
            }
          });
        });

        writeStream.on('error', (error) => {
          this.logger.error('Local storage stream upload failed', {
            error: error.message,
            filePath
          });
          reject(error);
        });

        readableStream.on('error', (error) => {
          this.logger.error('Read stream error during upload', {
            error: error.message,
            filePath
          });
          reject(error);
        });

        // Pipe the streams
        readableStream.pipe(writeStream);
      } catch (error) {
        this.logger.error('Local storage stream upload initialization failed', {
          error: error.message,
          filePath
        });
        reject(error);
      }
    });
  }

  /**
   * Download file from local storage
   * @param {string} uri - Storage URI (local://bucket/path)
   * @returns {Promise<Buffer>} File data
   */
  async download(uri) {
    try {
      const { bucket, path: filePath } = this.parseUri(uri);
      const fullPath = path.join(this.basePath, bucket, filePath);

      const data = await fs.readFile(fullPath);

      this.logger.info('File downloaded from local storage', {
        uri,
        size: data.length
      });

      return data;
    } catch (error) {
      this.logger.error('Local storage download failed', {
        error: error.message,
        uri
      });
      throw new Error(`File not found: ${uri}`);
    }
  }

  /**
   * Get signed URL (for local storage, returns file path)
   * @param {string} uri - Storage URI
   * @param {number} expiresIn - Not used for local storage
   * @returns {Promise<string>} Local file path
   */
  async getSignedUrl(uri, expiresIn = 3600) {
    try {
      const { bucket, path: filePath } = this.parseUri(uri);
      const fullPath = path.join(this.basePath, bucket, filePath);

      // Check if file exists
      await fs.access(fullPath);

      // For local storage, we return the URI itself
      // The actual file download is handled by the download endpoint
      return uri;
    } catch (error) {
      this.logger.error('Local storage URL generation failed', {
        error: error.message,
        uri
      });
      throw new Error(`File not found: ${uri}`);
    }
  }

  /**
   * Delete file from local storage
   * @param {string} uri - Storage URI
   * @returns {Promise<boolean>} Success status
   */
  async delete(uri) {
    try {
      const { bucket, path: filePath } = this.parseUri(uri);
      const fullPath = path.join(this.basePath, bucket, filePath);

      await fs.unlink(fullPath);

      this.logger.info('File deleted from local storage', { uri });

      return true;
    } catch (error) {
      // If file doesn't exist, consider it deleted
      if (error.code === 'ENOENT') {
        this.logger.warn('File already deleted or not found', { uri });
        return true;
      }

      this.logger.error('Local storage deletion failed', {
        error: error.message,
        uri
      });
      throw error;
    }
  }

  /**
   * Check if file exists in local storage
   * @param {string} uri - Storage URI
   * @returns {Promise<boolean>} Existence status
   */
  async exists(uri) {
    try {
      const { bucket, path: filePath } = this.parseUri(uri);
      const fullPath = path.join(this.basePath, bucket, filePath);

      await fs.access(fullPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata from local storage
   * @param {string} uri - Storage URI
   * @returns {Promise<Object>} File metadata
   */
  async getMetadata(uri) {
    try {
      const { bucket, path: filePath } = this.parseUri(uri);
      const fullPath = path.join(this.basePath, bucket, filePath);

      const stats = await fs.stat(fullPath);

      return {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        contentType: 'application/octet-stream' // Could be enhanced with mime-type detection
      };
    } catch (error) {
      this.logger.error('Local storage metadata retrieval failed', {
        error: error.message,
        uri
      });
      throw new Error(`File not found: ${uri}`);
    }
  }

  /**
   * Get absolute file path from URI (helper for internal use)
   * @param {string} uri - Storage URI
   * @returns {string} Absolute file path
   */
  getAbsolutePath(uri) {
    const { bucket, path: filePath } = this.parseUri(uri);
    return path.join(this.basePath, bucket, filePath);
  }
}

module.exports = LocalStorageProvider;
