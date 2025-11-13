/**
 * Express Application Setup
 * Configures Express app with middleware, routes, and error handling
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./components/config/swagger');
const logger = require('./components/logging');
const StorageFactory = require('./core/storage/storage.factory');
const config = require('./components/config');
const configurePassport = require('./components/config/passport');
const createRoutes = require('./api/routes');
const createAuthRoutes = require('./api/routes/auth.routes');
const createLineWebhookRoutes = require('./api/routes/line-webhook.routes');
const { errorHandler, notFound } = require('./api/middleware/errorHandler');
const requestLogger = require('./api/middleware/requestLogger');

// Import services and controllers
const { UserService, FileService, AuthService, AuthorizationService, PersonService, IntegrationService, LineService, LineWebhookService } = require('./core/services');
const ProjectService = require('./core/services/project.service');
const MeetingService = require('./core/services/meeting.service');
const TranscriptionDataService = require('./core/services/transcription-data.service');
const TranscriptionServiceFactory = require('./core/services/transcription-service.factory');
const ActionItemService = require('./core/services/action-item.service');
const EmbeddingService = require('./core/services/embedding.service');
const RetrievalService = require('./core/services/retrieval.service');
const SemanticSearchService = require('./core/services/semantic-search.service');
const UserController = require('./api/controllers/user.controller');
const FileController = require('./api/controllers/file.controller');
const HealthController = require('./api/controllers/health.controller');
const AuthController = require('./api/controllers/auth.controller');
const ProjectController = require('./api/controllers/project.controller');
const MeetingController = require('./api/controllers/meeting.controller');
const TranscriptionController = require('./api/controllers/transcription.controller');
const PersonController = require('./api/controllers/person.controller');
const IntegrationController = require('./api/controllers/integration.controller');
const LineWebhookController = require('./api/controllers/line-webhook.controller');

/**
 * Create and configure Express app
 */
const createApp = () => {
  const app = express();

  logger.info('Initializing Express application...');

  // Initialize Passport
  logger.info('Configuring authentication with Passport...');
  configurePassport();
  logger.info('✅ Passport configured successfully');

  // Initialize storage provider
  logger.info('Initializing storage providers...');
  const storageProvider = StorageFactory.createProvider(logger, {
    provider: config.storage.provider,
    basePath: config.storage.localPath,
    bucket: config.storage.gcsBucket || 'user-files',
    keyFilename: config.storage.gcsKeyFile
  });

  logger.info('✅ User files storage provider initialized', {
    provider: config.storage.provider,
    bucket: config.storage.provider === 'gcs' ? (config.storage.gcsBucket || 'user-files') : 'N/A',
    basePath: config.storage.provider === 'local' ? config.storage.localPath : 'N/A'
  });

  // Initialize audio storage provider for meetings
  const audioStorageProvider = StorageFactory.createProvider(logger, {
    provider: process.env.STORAGE_PROVIDER || 'local',
    basePath: process.env.LOCAL_STORAGE_PATH || './storage',
    bucket: process.env.GCS_BUCKET_NAME || 'audio-files',
    // GCS configuration
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: process.env.GCS_KEYFILE_PATH
  });

  logger.info('✅ Audio storage provider initialized', {
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucket: process.env.STORAGE_PROVIDER === 'gcs' ? (process.env.GCS_BUCKET_NAME || 'audio-files') : 'N/A',
    basePath: process.env.STORAGE_PROVIDER === 'local' ? (process.env.LOCAL_STORAGE_PATH || './storage') : 'N/A'
  });

  // Initialize services with dependencies
  logger.info('Initializing core services...');

  const userService = new UserService(logger, storageProvider);
  const fileService = new FileService(logger, storageProvider);
  const authService = new AuthService(logger);
  const authorizationService = new AuthorizationService(logger);
  const personService = new PersonService(logger);

  logger.info('✅ Core services initialized (User, File, Auth, Authorization, Person)');

  // Initialize project service without meeting service (circular dependency)
  const projectService = new ProjectService(logger);
  logger.info('✅ Project service initialized');

  // Initialize embedding service for semantic search
  logger.info('Initializing AI/ML services...');
  const embeddingService = new EmbeddingService(logger);

  // Initialize retrieval service (core search logic)
  const retrievalService = new RetrievalService(logger, embeddingService);

  // Initialize transcription data service with embedding and retrieval support
  const transcriptionDataService = new TranscriptionDataService(logger, embeddingService, retrievalService);

  // Initialize semantic search service (API-specific formatting)
  const semanticSearchService = new SemanticSearchService(
    logger,
    embeddingService,
    transcriptionDataService,
    retrievalService
  );

  logger.info('✅ AI/ML services initialized (Embedding, Retrieval, Semantic Search)');

  // Initialize action item service
  const actionItemService = new ActionItemService(logger);
  logger.info('✅ Action item service initialized');

  // Initialize meeting service first (needed for transcription factory)
  logger.info('Initializing meeting and transcription services...');
  const meetingService = new MeetingService(
    logger,
    fileService,
    projectService,
    null, // transcriptionService - will be set after factory initialization
    transcriptionDataService,
    audioStorageProvider,
    authorizationService,
    actionItemService
  );

  // Initialize transcription service using factory
  const transcriptionService = TranscriptionServiceFactory.getInstance(
    logger,
    transcriptionDataService,
    meetingService
  );

  // Set the transcription service on meeting service
  meetingService.transcriptionService = transcriptionService;

  // Set the meeting service on project service (for cascade deletion)
  projectService.meetingService = meetingService;

  logger.info('✅ Meeting and transcription services initialized');

  // Initialize integration services
  logger.info('Initializing integration services...');
  const integrationService = new IntegrationService(logger, projectService);
  const lineService = new LineService(logger);
  const lineWebhookService = new LineWebhookService(
    logger,
    lineService,
    integrationService,
    meetingService,
    audioStorageProvider,
    fileService
  );
  logger.info('✅ Integration services initialized (Integration, LINE, LINE Webhook)');

  // Initialize controllers with services
  logger.info('Initializing API controllers...');

  const userController = new UserController(userService, logger);
  const fileController = new FileController(fileService, logger);
  const healthController = new HealthController(logger);
  const authController = new AuthController(authService, logger);
  const projectController = new ProjectController(projectService, logger);
  const meetingController = new MeetingController(meetingService, actionItemService, logger);
  const transcriptionController = new TranscriptionController(
    transcriptionDataService,
    semanticSearchService,
    projectService,
    logger
  );
  const personController = new PersonController(personService, transcriptionDataService, logger);
  const integrationController = new IntegrationController(logger, integrationService);
  const lineWebhookController = new LineWebhookController(logger, lineWebhookService);

  logger.info('✅ API controllers initialized (10 controllers ready)');

  // Basic middleware
  logger.info('Configuring Express middleware...');
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Initialize Passport middleware
  app.use(passport.initialize());

  // Request logging
  app.use(requestLogger);

  // CORS Configuration
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Build allowed origins list
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3001',
      'http://localhost:3000'
    ].filter(Boolean);

    // Add custom allowed origins from environment variable
    if (process.env.ALLOWED_ORIGINS) {
      const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
      allowedOrigins.push(...customOrigins);
    }

    // Check if origin is allowed
    let allowOrigin = '*'; // Default for development

    if (origin) {
      // Check for exact match
      if (allowedOrigins.includes(origin)) {
        allowOrigin = origin;
      }
      // Check for Chrome extension (starts with chrome-extension://)
      else if (origin.startsWith('chrome-extension://')) {
        allowOrigin = origin;
        logger.debug('Chrome extension request allowed', { origin });
      }
      // Check for localhost with different ports (development)
      else if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        allowOrigin = origin;
      }
      // In production, log rejected origins
      else if (config.env === 'production') {
        logger.warn('CORS: Origin not allowed', { origin, allowedOrigins });
      }
    }

    res.header('Access-Control-Allow-Origin', allowOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  logger.info('✅ Middleware configured (JSON, URL-encoded, Passport, CORS, Request Logger)');

  // Swagger documentation
  logger.info('Setting up Swagger documentation...');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }'
  }));
  logger.info('✅ Swagger documentation available at /api-docs');

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Meno API Server',
      version: '1.0.0',
      documentation: '/api-docs',
      health: '/api/health',
      auth: '/auth'
    });
  });

  // LINE webhook routes (public, at root level)
  logger.info('Mounting LINE webhook routes at /webhooks/line');
  app.use('/webhooks/line', createLineWebhookRoutes(lineWebhookController));

  // Auth routes (at root level)
  logger.info('Mounting authentication routes at /auth');
  app.use('/auth', createAuthRoutes(authController));

  // API routes (at /api prefix) - pass audioStorageProvider for streaming uploads
  logger.info(`Mounting API routes at ${config.api.prefix}`);
  app.use(config.api.prefix, createRoutes({
    userController,
    fileController,
    healthController,
    projectController,
    meetingController,
    transcriptionController,
    personController,
    integrationController
  }, audioStorageProvider));

  logger.info('✅ Routes mounted successfully');

  // Serve static files (for local storage)
  if (config.storage.provider === 'local') {
    logger.info(`Serving static files from ${config.storage.localPath} at /files`);
    app.use('/files', express.static(config.storage.localPath));
  }

  // 404 handler
  app.use(notFound);

  // Global error handler (must be last)
  app.use(errorHandler);

  logger.info('✅ Error handlers registered');
  logger.info('Express application initialization complete');

  return app;
};

module.exports = createApp;
