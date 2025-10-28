/**
 * Storage Factory
 * Creates appropriate storage provider based on configuration
 *
 * Environment Variables:
 * - STORAGE_PROVIDER: 'local' or 'gcs' (default: 'local')
 * - LOCAL_STORAGE_PATH: Path for local storage (default: './storage')
 * - GCS_PROJECT_ID: Google Cloud project ID
 * - GCS_BUCKET_NAME: GCS bucket name
 * - GCS_KEYFILE_PATH: Path to GCS service account key
 */
const LocalStorageProvider = require('./local-storage.provider');
const GCSStorageProvider = require('./gcs-storage.provider');

class StorageFactory {
  /**
   * Create storage provider instance
   * @param {Object} logger - Logger instance
   * @param {Object} config - Storage configuration
   * @returns {StorageProvider} Storage provider instance
   */
  static createProvider(logger, config = {}) {
    const provider = config.provider || process.env.STORAGE_PROVIDER || 'local';

    logger.info('Creating storage provider', { provider });

    switch (provider.toLowerCase()) {
      case 'local':
        return new LocalStorageProvider(logger, {
          basePath: config.basePath || process.env.LOCAL_STORAGE_PATH,
          bucket: config.bucket || 'audio-files'
        });

      case 'gcs':
        return new GCSStorageProvider(logger, {
          projectId: config.projectId || process.env.GCS_PROJECT_ID,
          bucket: config.bucket || process.env.GCS_BUCKET_NAME,
          keyFilename: config.keyFilename || process.env.GCS_KEYFILE_PATH
        });

      default:
        logger.warn(`Unknown storage provider: ${provider}, falling back to local`);
        return new LocalStorageProvider(logger, {
          basePath: config.basePath || process.env.LOCAL_STORAGE_PATH,
          bucket: config.bucket || 'audio-files'
        });
    }
  }

  /**
   * Get storage provider from URI
   * @param {string} uri - Storage URI (e.g., local://bucket/path or gcs://bucket/path)
   * @param {Object} logger - Logger instance
   * @param {Object} config - Storage configuration
   * @returns {StorageProvider} Appropriate storage provider for the URI
   */
  static getProviderForUri(uri, logger, config = {}) {
    const match = uri.match(/^(\w+):\/\//);
    if (!match) {
      throw new Error(`Invalid storage URI format: ${uri}`);
    }

    const provider = match[1];

    return StorageFactory.createProvider(logger, {
      ...config,
      provider
    });
  }
}

module.exports = StorageFactory;
