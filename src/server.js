/**
 * Server Entry Point
 * Starts the HTTP server and initializes database connection
 */
const createApp = require('./app');
const config = require('./components/config');
const logger = require('./components/logging');
const { connectDB } = require('./components/database');

/**
 * Start server
 */
const start = async () => {
  try {
    logger.info('Starting Meno API Server...', {
      environment: config.env,
      port: config.port
    });

    // Connect to MongoDB
    await connectDB();

    // Create Express app
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info('Server started successfully', {
        port: config.port,
        environment: config.env,
        documentation: `http://localhost:${config.port}/api-docs`,
        health: `http://localhost:${config.port}/api/health`
      });

      console.log('\n🚀 Meno API Server is running!');
      console.log(`📝 API Documentation: http://localhost:${config.port}/api-docs`);
      console.log(`💚 Health Check: http://localhost:${config.port}/api/health`);
      console.log(`🌍 Environment: ${config.env}`);
      console.log(`📦 Storage Provider: ${config.storage.provider}\n`);
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
