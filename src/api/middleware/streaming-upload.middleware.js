/**
 * Streaming Upload Middleware
 * Custom Multer storage engine that streams directly to storage providers
 * without creating temporary files
 */
const multer = require('multer');
const path = require('path');
const logger = require('../../components/logging/logger');
const StorageFactory = require('../../core/storage/storage.factory');

/**
 * Custom Multer storage engine for streaming uploads
 */
class StreamingStorageEngine {
  constructor(storageProvider) {
    this.storageProvider = storageProvider;
  }

  /**
   * Handle file upload - called by Multer for each file
   * @param {Object} req - Express request object
   * @param {Object} file - Multer file object with stream
   * @param {Function} cb - Callback function
   */
  _handleFile(req, file, cb) {
    try {
      logger.info('Streaming upload: handling file', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        encoding: file.encoding
      });

      // Get project ID and user ID from request for path construction
      const projectId = req.body.projectId || req.params.projectId;
      const userId = req.user?._id;

      if (!projectId || !userId) {
        logger.error('Streaming upload: missing projectId or userId', {
          projectId,
          userId: userId?.toString()
        });
        return cb(new Error('Missing projectId or userId for upload'));
      }

      // Generate storage path
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext);
      const storagePath = `meetings/${projectId}/${timestamp}-${basename}${ext}`;

      logger.info('Streaming upload: starting stream to storage', {
        storagePath,
        projectId,
        userId: userId.toString()
      });

      // Stream directly to storage provider
      this.storageProvider
        .uploadStream(storagePath, file.stream, {
          contentType: file.mimetype,
          metadata: {
            projectId,
            userId: userId.toString(),
            originalName: file.originalname
          }
        })
        .then((result) => {
          logger.info('Streaming upload: completed successfully', {
            uri: result.uri,
            size: result.size,
            storagePath
          });

          // Return file info to Multer
          cb(null, {
            uri: result.uri,
            size: result.size,
            path: result.path, // For local storage compatibility
            storagePath: storagePath,
            mimetype: file.mimetype,
            originalname: file.originalname
          });
        })
        .catch((error) => {
          logger.error('Streaming upload: failed', {
            error: error.message,
            stack: error.stack,
            storagePath
          });
          cb(error);
        });
    } catch (error) {
      logger.error('Streaming upload: initialization failed', {
        error: error.message,
        stack: error.stack
      });
      cb(error);
    }
  }

  /**
   * Remove file - called by Multer on error to clean up
   * @param {Object} req - Express request object
   * @param {Object} file - Multer file object
   * @param {Function} cb - Callback function
   */
  _removeFile(req, file, cb) {
    // If upload failed and we have a URI, delete the file
    if (file.uri) {
      logger.info('Streaming upload: cleaning up failed upload', {
        uri: file.uri
      });

      this.storageProvider
        .delete(file.uri)
        .then(() => {
          logger.info('Streaming upload: cleanup successful', {
            uri: file.uri
          });
          cb(null);
        })
        .catch((error) => {
          logger.error('Streaming upload: cleanup failed', {
            error: error.message,
            uri: file.uri
          });
          cb(error);
        });
    } else {
      cb(null);
    }
  }
}

/**
 * File filter - only allow audio files
 */
const fileFilter = (req, file, cb) => {
  logger.info('Streaming upload: fileFilter check', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });

  const allowedMimeTypes = [
    // MP3
    'audio/mpeg',
    'audio/mp3',

    // M4A / AAC (multiple MIME types for cross-platform compatibility)
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac',
    'audio/mp4a-latm',

    // WAV
    'audio/wav',
    'audio/x-wav',
    'audio/wave',

    // WebM (audio and video containers for audio recordings)
    'audio/webm',
    'video/webm',

    // OGG
    'audio/ogg',
    'audio/vorbis',

    // FLAC (lossless)
    'audio/flac',
    'audio/x-flac'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    logger.info('Streaming upload: file type accepted', { mimetype: file.mimetype });
    cb(null, true);
  } else {
    logger.error('Streaming upload: invalid file type rejected', {
      mimetype: file.mimetype,
      originalname: file.originalname,
      allowedTypes: 'MP3, M4A, AAC, WAV, WebM, OGG, FLAC'
    });
    cb(new Error(`Invalid file type. Allowed types: MP3, M4A, AAC, WAV, WebM, OGG, FLAC`), false);
  }
};

/**
 * Create configured multer instance with streaming storage
 * @param {Object} storageProvider - Storage provider instance (Local or GCS)
 * @returns {Object} Configured multer instance
 */
function createStreamingUpload(storageProvider) {
  const storage = new StreamingStorageEngine(storageProvider);

  const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 104857600 // 100MB default
    }
  });

  return upload.single('audioFile');
}

/**
 * Error handling wrapper for streaming uploads
 * @param {Object} storageProvider - Storage provider instance
 * @returns {Function} Middleware function
 */
const handleStreamingUpload = (storageProvider) => {
  const uploadMiddleware = createStreamingUpload(storageProvider);

  return (req, res, next) => {
    logger.info('Streaming upload: starting file upload processing', {
      url: req.url,
      method: req.method,
      contentType: req.headers['content-type']
    });

    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        logger.error('Streaming upload: Multer error occurred', {
          errorCode: err.code,
          errorMessage: err.message,
          field: err.field,
          url: req.url
        });

        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxSize = (parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 104857600) / 1024 / 1024;
          logger.error('Streaming upload: File size limit exceeded', {
            maxSizeMB: maxSize,
            errorCode: err.code
          });
          return res.status(400).json({
            success: false,
            message: `File size exceeds maximum allowed size of ${maxSize}MB`
          });
        }

        logger.error('Streaming upload: Other Multer error', {
          errorCode: err.code,
          errorMessage: err.message
        });
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        // Custom errors (like file type or storage errors)
        logger.error('Streaming upload: Custom upload error', {
          errorMessage: err.message,
          errorStack: err.stack,
          url: req.url
        });

        if (!res.headersSent) {
          logger.info('Streaming upload: sending 400 error response');
          return res.status(400).json({
            success: false,
            message: err.message
          });
        } else {
          logger.warn('Streaming upload: headers already sent, cannot send error response');
        }
        return;
      }

      // Success - proceed to next middleware
      logger.info('Streaming upload: file upload successful', {
        filename: req.file ? req.file.originalname : 'no file',
        size: req.file ? req.file.size : 0,
        mimetype: req.file ? req.file.mimetype : 'unknown',
        uri: req.file ? req.file.uri : 'unknown'
      });
      next();
    });
  };
};

module.exports = {
  handleStreamingUpload,
  StreamingStorageEngine
};
