/**
 * Express Application Setup
 * Configures Express app with middleware, routes, and error handling
 */
const express = require('express');
const passport = require('passport');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./components/config/swagger');
const logger = require('./components/logging');
const StorageFactory = require('./core/storage/storage.factory');
const config = require('./components/config');
const configurePassport = require('./components/config/passport');
const createRoutes = require('./api/routes');
const createAuthRoutes = require('./api/routes/auth.routes');
const { errorHandler, notFound } = require('./api/middleware/errorHandler');
const requestLogger = require('./api/middleware/requestLogger');

// Import services and controllers
const { UserService, FileService, AuthService, AuthorizationService, PersonService } = require('./core/services');
const ProjectService = require('./core/services/project.service');
const MeetingService = require('./core/services/meeting.service');
const TranscriptionDataService = require('./core/services/transcription-data.service');
const TranscriptionServiceFactory = require('./core/services/transcription-service.factory');
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

/**
 * Create and configure Express app
 */
const createApp = () => {
  const app = express();

  // Initialize Passport
  configurePassport();

  // Initialize storage provider
  const storageProvider = StorageFactory.createProvider(logger, {
    provider: config.storage.provider,
    basePath: config.storage.localPath,
    bucket: config.storage.gcsBucket || 'user-files',
    keyFilename: config.storage.gcsKeyFile
  });

  logger.info('Storage provider initialized', { provider: config.storage.provider });

  // Initialize audio storage provider for meetings
  const audioStorageProvider = StorageFactory.createProvider(logger, {
    provider: process.env.STORAGE_PROVIDER || 'local',
    basePath: process.env.LOCAL_STORAGE_PATH || './storage',
    bucket: process.env.GCS_BUCKET_NAME || 'audio-files',
    // GCS configuration
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: process.env.GCS_KEYFILE_PATH
  });

  logger.info('Audio storage provider initialized', {
    provider: process.env.STORAGE_PROVIDER || 'local'
  });

  // Initialize services with dependencies
  const userService = new UserService(logger, storageProvider);
  const fileService = new FileService(logger, storageProvider);
  const authService = new AuthService(logger);
  const authorizationService = new AuthorizationService(logger);
  const personService = new PersonService(logger);

  // Initialize project service without meeting service (circular dependency)
  const projectService = new ProjectService(logger);

  // Initialize embedding service for semantic search
  const embeddingService = new EmbeddingService(logger);

  // Initialize transcription data service with embedding support
  const transcriptionDataService = new TranscriptionDataService(logger, embeddingService);

  // Initialize retrieval service (core search logic)
  const retrievalService = new RetrievalService(logger, embeddingService);

  // Initialize semantic search service (API-specific formatting)
  const semanticSearchService = new SemanticSearchService(
    logger,
    embeddingService,
    transcriptionDataService,
    retrievalService
  );

  // Initialize meeting service first (needed for transcription factory)
  const meetingService = new MeetingService(
    logger,
    fileService,
    projectService,
    null, // transcriptionService - will be set after factory initialization
    transcriptionDataService,
    audioStorageProvider,
    authorizationService
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

  // Initialize controllers with services
  const userController = new UserController(userService, logger);
  const fileController = new FileController(fileService, logger);
  const healthController = new HealthController(logger);
  const authController = new AuthController(authService, logger);
  const projectController = new ProjectController(projectService, logger);
  const meetingController = new MeetingController(meetingService, logger);
  const transcriptionController = new TranscriptionController(
    transcriptionDataService,
    semanticSearchService,
    projectService,
    logger
  );
  const personController = new PersonController(personService, logger);

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize Passport middleware
  app.use(passport.initialize());

  // Request logging
  app.use(requestLogger);

  // CORS (if needed)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }'
  }));

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

  // Auth routes (at root level)
  app.use('/auth', createAuthRoutes(authController));

  // API routes (at /api prefix) - pass audioStorageProvider for streaming uploads
  app.use(config.api.prefix, createRoutes({
    userController,
    fileController,
    healthController,
    projectController,
    meetingController,
    transcriptionController,
    personController
  }, audioStorageProvider));

  // Serve static files (for local storage)
  if (config.storage.provider === 'local') {
    app.use('/files', express.static(config.storage.localPath));
  }

  // 404 handler
  app.use(notFound);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
