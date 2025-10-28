/**
 * Configuration Component
 * Loads and validates environment variables using dotenv
 */
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/meno-api',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    localPath: process.env.LOCAL_STORAGE_PATH || './storage',
    gcsBucket: process.env.GCS_BUCKET_NAME,
    gcsKeyFile: process.env.GCS_KEYFILE_PATH
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs'
  },

  api: {
    prefix: '/api',
    version: 'v1'
  }
};

// Validation - fail fast if critical config missing
if (!config.mongodb.uri) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (config.storage.provider === 'gcs' && !config.storage.gcsBucket) {
  throw new Error('GCS_BUCKET_NAME is required when STORAGE_PROVIDER=gcs');
}

module.exports = config;
