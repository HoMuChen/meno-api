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
    options: {}
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    localPath: process.env.LOCAL_STORAGE_PATH || './storage',
    gcsBucket: process.env.GCS_BUCKET_NAME,
    gcsKeyFile: process.env.GCS_KEYFILE_PATH
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY || '7d',
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
    frontendUrl: process.env.FRONTEND_URL
  },

  transcription: {
    provider: process.env.TRANSCRIPTION_PROVIDER || 'mock',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiTranscriptionModel: process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-1.5-pro',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    autoStart: process.env.AUTO_START_TRANSCRIPTION === 'true'
  },

  embedding: {
    provider: process.env.EMBEDDING_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS, 10) || 1536,
    vectorSearchEnabled: process.env.VECTOR_SEARCH_ENABLED !== 'false'
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
