/**
 * Storage Provider Interface
 * Abstract interface for blob storage implementations
 *
 * All storage providers must implement these methods:
 * - upload: Store a file
 * - download: Retrieve a file
 * - delete: Remove a file
 * - exists: Check if file exists
 * - getUrl: Get accessible URL for file
 */

class IStorageProvider {
  /**
   * Upload a file to storage
   * @param {string} path - File path/key in storage
   * @param {Buffer|Stream} data - File data to upload
   * @param {Object} metadata - Optional metadata (contentType, etc.)
   * @returns {Promise<{url: string, size: number, path: string}>}
   */
  async upload(path, data, metadata = {}) {
    throw new Error('Method upload() must be implemented by storage provider');
  }

  /**
   * Download a file from storage
   * @param {string} path - File path/key in storage
   * @returns {Promise<Buffer>} File data as buffer
   */
  async download(path) {
    throw new Error('Method download() must be implemented by storage provider');
  }

  /**
   * Delete a file from storage
   * @param {string} path - File path/key in storage
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async delete(path) {
    throw new Error('Method delete() must be implemented by storage provider');
  }

  /**
   * Check if file exists in storage
   * @param {string} path - File path/key in storage
   * @returns {Promise<boolean>} True if file exists
   */
  async exists(path) {
    throw new Error('Method exists() must be implemented by storage provider');
  }

  /**
   * Get URL for accessing the file
   * @param {string} path - File path/key in storage
   * @param {number} expiresIn - URL expiration time in seconds (for signed URLs)
   * @returns {Promise<string>} Accessible URL
   */
  async getUrl(path, expiresIn = 3600) {
    throw new Error('Method getUrl() must be implemented by storage provider');
  }

  /**
   * Get file metadata
   * @param {string} path - File path/key in storage
   * @returns {Promise<{size: number, contentType: string, lastModified: Date}>}
   */
  async getMetadata(path) {
    throw new Error('Method getMetadata() must be implemented by storage provider');
  }
}

module.exports = IStorageProvider;
