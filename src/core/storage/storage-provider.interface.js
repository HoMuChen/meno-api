/**
 * Storage Provider Interface
 * Abstract interface for file storage implementations
 * Supports local disk, cloud storage (GCS, S3), and future providers
 */

class StorageProvider {
  /**
   * Upload a file to storage
   * @param {string} path - Storage path/key for the file
   * @param {Buffer|Stream} data - File data to upload
   * @param {Object} options - Upload options (contentType, metadata, etc.)
   * @returns {Promise<Object>} Upload result with { uri, size, metadata }
   */
  async upload(path, data, options = {}) {
    throw new Error('upload() must be implemented by storage provider');
  }

  /**
   * Download a file from storage
   * @param {string} uri - Storage URI (e.g., local://path or gcs://bucket/path)
   * @returns {Promise<Buffer>} File data as buffer
   */
  async download(uri) {
    throw new Error('download() must be implemented by storage provider');
  }

  /**
   * Get a signed/public URL for file access
   * @param {string} uri - Storage URI
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
   * @returns {Promise<string>} Accessible URL
   */
  async getSignedUrl(uri, expiresIn = 3600) {
    throw new Error('getSignedUrl() must be implemented by storage provider');
  }

  /**
   * Delete a file from storage
   * @param {string} uri - Storage URI
   * @returns {Promise<boolean>} Success status
   */
  async delete(uri) {
    throw new Error('delete() must be implemented by storage provider');
  }

  /**
   * Check if file exists
   * @param {string} uri - Storage URI
   * @returns {Promise<boolean>} Existence status
   */
  async exists(uri) {
    throw new Error('exists() must be implemented by storage provider');
  }

  /**
   * Get file metadata
   * @param {string} uri - Storage URI
   * @returns {Promise<Object>} File metadata (size, contentType, createdAt, etc.)
   */
  async getMetadata(uri) {
    throw new Error('getMetadata() must be implemented by storage provider');
  }

  /**
   * Parse storage URI to extract provider and path
   * @param {string} uri - Storage URI (e.g., local://path or gcs://bucket/path)
   * @returns {Object} Parsed URI with { provider, bucket, path }
   */
  parseUri(uri) {
    const match = uri.match(/^(\w+):\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid storage URI format: ${uri}`);
    }

    return {
      provider: match[1],
      bucket: match[2],
      path: match[3]
    };
  }

  /**
   * Build storage URI from components
   * @param {string} provider - Provider name (local, gcs, s3, etc.)
   * @param {string} bucket - Bucket/container name
   * @param {string} path - File path within bucket
   * @returns {string} Complete storage URI
   */
  buildUri(provider, bucket, path) {
    return `${provider}://${bucket}/${path}`;
  }
}

module.exports = StorageProvider;
