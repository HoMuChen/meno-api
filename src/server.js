/**
 * Server Entry Point
 * Starts the HTTP server and initializes database connection
 */
const createApp = require('./app');
const config = require('./components/config');
const logger = require('./components/logging');
const { connectDB } = require('./components/database');

/**
 * Utility function to mask sensitive values
 * Shows first 4 and last 4 characters, masks the rest
 */
const maskSecret = (secret) => {
  if (!secret) return 'Not configured';
  if (secret.length <= 8) return '****';
  return `${secret.substring(0, 4)}${'*'.repeat(secret.length - 8)}${secret.substring(secret.length - 4)}`;
};

/**
 * Start server
 */
const start = async () => {
  try {
    // Log startup banner
    logger.info('========================================');
    logger.info('🚀 Starting Meno API Server...');
    logger.info('========================================');

    // Log environment configuration
    logger.info('Environment Configuration:', {
      nodeEnv: config.env,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    });

    // Log server configuration
    logger.info('Server Configuration:', {
      port: config.port,
      apiPrefix: config.api.prefix,
      apiVersion: config.api.version
    });

    // Log database configuration (mask sensitive data)
    const dbUri = config.mongodb.uri;
    const maskedUri = dbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    logger.info('Database Configuration:', {
      uri: maskedUri,
      driver: 'MongoDB',
      mongooseVersion: require('mongoose').version
    });

    // Log storage configuration
    logger.info('Storage Configuration:', {
      provider: config.storage.provider,
      localPath: config.storage.provider === 'local' ? config.storage.localPath : 'N/A',
      gcsBucket: config.storage.provider === 'gcs' ? config.storage.gcsBucket : 'N/A'
    });

    // Log authentication configuration
    logger.info('Authentication Configuration:', {
      jwtSecret: maskSecret(config.auth.jwtSecret),
      jwtExpiry: config.auth.jwtExpiry,
      googleOAuth: config.auth.googleClientId ? 'Enabled' : 'Disabled',
      googleClientId: maskSecret(config.auth.googleClientId),
      frontendUrl: config.auth.frontendUrl || 'Not configured'
    });

    // Log transcription service configuration
    logger.info('Transcription Service Configuration:', {
      provider: config.transcription.provider,
      geminiApiKey: maskSecret(config.transcription.geminiApiKey),
      transcriptionModel: config.transcription.geminiTranscriptionModel,
      llmModel: config.transcription.geminiModel,
      autoStart: config.transcription.autoStart
    });

    // Log embedding service configuration
    logger.info('Embedding Service Configuration:', {
      provider: config.embedding.provider,
      openaiApiKey: maskSecret(config.embedding.openaiApiKey),
      model: config.embedding.model,
      dimensions: config.embedding.dimensions,
      vectorSearchEnabled: config.embedding.vectorSearchEnabled
    });

    // Log logging configuration
    logger.info('Logging Configuration:', {
      level: config.logging.level,
      directory: config.logging.dir
    });

    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDB();

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info('========================================');
      logger.info('✅ Server started successfully');
      logger.info('========================================');

      logger.info('Server Details:', {
        port: config.port,
        environment: config.env,
        host: 'localhost',
        baseUrl: `http://localhost:${config.port}`
      });

      logger.info('API Endpoints:', {
        root: `http://localhost:${config.port}/`,
        api: `http://localhost:${config.port}${config.api.prefix}`,
        documentation: `http://localhost:${config.port}/api-docs`,
        health: `http://localhost:${config.port}/api/health`,
        auth: `http://localhost:${config.port}/auth`
      });

      logger.info('Service Status:', {
        database: 'Connected',
        storage: config.storage.provider,
        authentication: 'Enabled',
        cors: 'Enabled'
      });

      console.log('\n🚀 Meno API Server is running!');
      console.log(`📍 Port: ${config.port}`);
      console.log(`🌍 Environment: ${config.env}`);
      console.log(`📝 API Documentation: http://localhost:${config.port}/api-docs`);
      console.log(`💚 Health Check: http://localhost:${config.port}/api/health`);
      console.log(`🔐 Auth Endpoints: http://localhost:${config.port}/auth`);
      console.log(`📦 Storage Provider: ${config.storage.provider}`);
      console.log(`🗄️  Database: MongoDB (${maskedUri})`);
      console.log(`📋 Logging: ${config.logging.level} → ${config.logging.dir}`);
      console.log('\n🔑 API Keys & Credentials:');
      console.log(`   JWT Secret: ${maskSecret(config.auth.jwtSecret)}`);
      console.log(`   Google OAuth: ${config.auth.googleClientId ? 'Enabled (' + maskSecret(config.auth.googleClientId) + ')' : 'Disabled'}`);
      console.log(`   Gemini API: ${maskSecret(config.transcription.geminiApiKey)} (${config.transcription.provider})`);
      console.log(`   OpenAI API: ${maskSecret(config.embedding.openaiApiKey)} (${config.embedding.provider})`);
      console.log('');
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        // Close database connection (handled by database component)
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
start();
