/**
 * Google Cloud Storage Provider
 * Implementation for Google Cloud Storage (GCS)
 *
 * Installation required: npm install @google-cloud/storage
 *
 * Configuration:
 * - GCS_PROJECT_ID: Google Cloud project ID
 * - GCS_KEYFILE_PATH: Path to service account key file
 * - GCS_BUCKET_NAME: Default bucket name
 */
const StorageProvider = require('./storage-provider.interface');

class GCSStorageProvider extends StorageProvider {
  constructor(logger, config = {}) {
    super();
    this.logger = logger;
    this.bucket = config.bucket || process.env.GCS_BUCKET_NAME;
    this.initialized = false;

    // Lazy initialization - only load GCS SDK when actually used
    this.storageClient = null;
    this.config = {
      projectId: config.projectId || process.env.GCS_PROJECT_ID,
      keyFilename: config.keyFilename || process.env.GCS_KEYFILE_PATH
    };
  }

  /**
   * Initialize GCS client (lazy loading)
   * @private
   */
  async _initializeClient() {
    if (this.initialized) return;

    try {
      // Dynamic import to avoid dependency if not using GCS
      const { Storage } = require('@google-cloud/storage');

      // Configure Storage client with explicit scopes for better permission control
      const storageConfig = {
        ...this.config,
        // Explicitly request storage scopes
        scopes: ['https://www.googleapis.com/auth/devstorage.read_write']
      };

      // Remove keyFilename if not provided to use Application Default Credentials
      if (!storageConfig.keyFilename) {
        delete storageConfig.keyFilename;
      }

      this.storageClient = new Storage(storageConfig);
      this.initialized = true;

      // Determine authentication method for logging
      const authMethod = this.config.keyFilename
        ? `Service Account Key (${this.config.keyFilename})`
        : 'Application Default Credentials (ADC)';

      this.logger.info('GCS storage provider initialized', {
        projectId: this.config.projectId,
        bucket: this.bucket,
        authMethod,
        scopes: storageConfig.scopes
      });

      // Verify access by testing bucket permissions
      await this._verifyBucketAccess();
    } catch (error) {
      this.logger.error('Failed to initialize GCS storage provider', {
        error: error.message,
        keyFilePath: this.config.keyFilename || 'none (using ADC)'
      });

      // Provide helpful error messages for common issues
      if (error.message.includes('scope')) {
        throw new Error(
          'GCS authorization failed: Insufficient scopes. ' +
            'On GCE, ensure instance has "storage-rw" or "cloud-platform" scope. ' +
            'With service account key, ensure it has "Storage Object Admin" role.'
        );
      }

      throw new Error(
        'GCS Storage not available. Install @google-cloud/storage: npm install @google-cloud/storage'
      );
    }
  }

  /**
   * Verify bucket access on initialization
   * @private
   */
  async _verifyBucketAccess() {
    try {
      const bucket = this.storageClient.bucket(this.bucket);
      const [exists] = await bucket.exists();

      if (!exists) {
        this.logger.warn('GCS bucket does not exist', { bucket: this.bucket });
        throw new Error(`Bucket "${this.bucket}" does not exist`);
      }

      // Test write permissions with a minimal metadata operation
      await bucket.getMetadata();

      this.logger.info('GCS bucket access verified', {
        bucket: this.bucket,
        permissions: 'read/write'
      });
    } catch (error) {
      this.logger.error('GCS bucket access verification failed', {
        error: error.message,
        bucket: this.bucket
      });

      // Provide specific guidance based on error type
      if (error.code === 403 || error.message.includes('scope')) {
        throw new Error(
          `GCS authorization error: Insufficient permissions for bucket "${this.bucket}". ` +
            'Ensure service account has "Storage Object Admin" role and instance has correct scopes.'
        );
      }

      throw error;
    }
  }

  /**
   * Upload file to GCS
   * @param {string} filePath - Path within bucket
   * @param {Buffer|string} data - File data or source file path
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URI
   */
  async upload(filePath, data, options = {}) {
    await this._initializeClient();

    try {
      const bucket = this.storageClient.bucket(this.bucket);
      const file = bucket.file(filePath);

      const uploadOptions = {
        metadata: {
          contentType: options.contentType || 'application/octet-stream',
          metadata: options.metadata || {}
        }
      };

      let fileSize;

      // Handle different data types
      if (typeof data === 'string') {
        // Data is a path to existing file
        await bucket.upload(data, {
          destination: filePath,
          ...uploadOptions
        });
        const [metadata] = await file.getMetadata();
        fileSize = parseInt(metadata.size);
      } else if (Buffer.isBuffer(data)) {
        // Data is a buffer
        await file.save(data, uploadOptions);
        fileSize = data.length;
      } else {
        throw new Error('Data must be a file path string or Buffer');
      }

      const uri = this.buildUri('gcs', this.bucket, filePath);

      this.logger.info('File uploaded to GCS', {
        uri,
        size: fileSize,
        bucket: this.bucket
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
      this.logger.error('GCS upload failed', {
        error: error.message,
        filePath,
        bucket: this.bucket
      });
      throw error;
    }
  }

  /**
   * Upload file from stream to GCS
   * @param {string} filePath - Path within bucket
   * @param {ReadableStream} readableStream - Readable stream source
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URI
   */
  async uploadStream(filePath, readableStream, options = {}) {
    await this._initializeClient();

    return new Promise((resolve, reject) => {
      try {
        const bucket = this.storageClient.bucket(this.bucket);
        const file = bucket.file(filePath);

        const writeStream = file.createWriteStream({
          metadata: {
            contentType: options.contentType || 'application/octet-stream',
            metadata: options.metadata || {}
          },
          resumable: false // Disable resumable for better performance with smaller files
        });

        let fileSize = 0;

        // Track bytes uploaded
        readableStream.on('data', (chunk) => {
          fileSize += chunk.length;
        });

        writeStream.on('finish', () => {
          const uri = this.buildUri('gcs', this.bucket, filePath);

          this.logger.info('Stream uploaded to GCS', {
            uri,
            size: fileSize,
            bucket: this.bucket
          });

          resolve({
            uri,
            size: fileSize,
            metadata: {
              contentType: options.contentType || 'application/octet-stream',
              uploadedAt: new Date()
            }
          });
        });

        writeStream.on('error', (error) => {
          this.logger.error('GCS stream upload failed', {
            error: error.message,
            filePath,
            bucket: this.bucket
          });
          reject(error);
        });

        readableStream.on('error', (error) => {
          this.logger.error('Read stream error during GCS upload', {
            error: error.message,
            filePath
          });
          reject(error);
        });

        // Pipe the streams
        readableStream.pipe(writeStream);
      } catch (error) {
        this.logger.error('GCS stream upload initialization failed', {
          error: error.message,
          filePath,
          bucket: this.bucket
        });
        reject(error);
      }
    });
  }

  /**
   * Download file from GCS
   * @param {string} uri - Storage URI (gcs://bucket/path)
   * @returns {Promise<Buffer>} File data
   */
  async download(uri) {
    await this._initializeClient();

    try {
      const { bucket: bucketName, path: filePath } = this.parseUri(uri);
      const bucket = this.storageClient.bucket(bucketName);
      const file = bucket.file(filePath);

      const [data] = await file.download();

      this.logger.info('File downloaded from GCS', {
        uri,
        size: data.length
      });

      return data;
    } catch (error) {
      this.logger.error('GCS download failed', {
        error: error.message,
        uri
      });
      throw new Error(`File not found: ${uri}`);
    }
  }

  /**
   * Get signed URL for temporary file access
   * @param {string} uri - Storage URI
   * @param {number} expiresIn - URL expiration time in seconds
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(uri, expiresIn = 3600) {
    await this._initializeClient();

    try {
      const { bucket: bucketName, path: filePath } = this.parseUri(uri);
      const bucket = this.storageClient.bucket(bucketName);
      const file = bucket.file(filePath);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000
      });

      this.logger.info('Signed URL generated for GCS file', {
        uri,
        expiresIn
      });

      return url;
    } catch (error) {
      this.logger.error('GCS signed URL generation failed', {
        error: error.message,
        uri
      });
      throw error;
    }
  }

  /**
   * Delete file from GCS
   * @param {string} uri - Storage URI
   * @returns {Promise<boolean>} Success status
   */
  async delete(uri) {
    await this._initializeClient();

    try {
      const { bucket: bucketName, path: filePath } = this.parseUri(uri);
      const bucket = this.storageClient.bucket(bucketName);
      const file = bucket.file(filePath);

      await file.delete();

      this.logger.info('File deleted from GCS', { uri });

      return true;
    } catch (error) {
      // If file doesn't exist, consider it deleted
      if (error.code === 404) {
        this.logger.warn('File already deleted or not found', { uri });
        return true;
      }

      this.logger.error('GCS deletion failed', {
        error: error.message,
        uri
      });
      throw error;
    }
  }

  /**
   * Check if file exists in GCS
   * @param {string} uri - Storage URI
   * @returns {Promise<boolean>} Existence status
   */
  async exists(uri) {
    await this._initializeClient();

    try {
      const { bucket: bucketName, path: filePath } = this.parseUri(uri);
      const bucket = this.storageClient.bucket(bucketName);
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      this.logger.error('GCS exists check failed', {
        error: error.message,
        uri
      });
      return false;
    }
  }

  /**
   * Get file metadata from GCS
   * @param {string} uri - Storage URI
   * @returns {Promise<Object>} File metadata
   */
  async getMetadata(uri) {
    await this._initializeClient();

    try {
      const { bucket: bucketName, path: filePath } = this.parseUri(uri);
      const bucket = this.storageClient.bucket(bucketName);
      const file = bucket.file(filePath);

      const [metadata] = await file.getMetadata();

      return {
        size: parseInt(metadata.size),
        createdAt: new Date(metadata.timeCreated),
        modifiedAt: new Date(metadata.updated),
        contentType: metadata.contentType
      };
    } catch (error) {
      this.logger.error('GCS metadata retrieval failed', {
        error: error.message,
        uri
      });
      throw new Error(`File not found: ${uri}`);
    }
  }
}

module.exports = GCSStorageProvider;
