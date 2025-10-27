/**
 * File Upload Middleware
 * Multer configuration for audio file uploads
 */
const multer = require('multer');
const path = require('path');
const logger = require('../../components/logging/logger');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use configured storage path or default
    const uploadPath = process.env.LOCAL_STORAGE_PATH || './storage';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `audio-${uniqueSuffix}-${basename}${ext}`);
  }
});

// File filter - only allow audio files
const fileFilter = (req, file, cb) => {
  logger.info('Upload middleware: fileFilter check', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
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
    logger.info('Upload middleware: file type accepted', { mimetype: file.mimetype });
    cb(null, true);
  } else {
    logger.error('Upload middleware: invalid file type rejected', {
      mimetype: file.mimetype,
      originalname: file.originalname,
      allowedTypes: 'MP3, M4A, AAC, WAV, WebM, OGG, FLAC'
    });
    cb(new Error(`Invalid file type. Allowed types: MP3, M4A, AAC, WAV, WebM, OGG, FLAC`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 104857600 // 100MB default
  }
});

// Single audio file upload
const uploadAudio = upload.single('audioFile');

// Error handling wrapper
const handleUpload = (req, res, next) => {
  logger.info('Upload middleware: starting file upload processing', {
    url: req.url,
    method: req.method,
    contentType: req.headers['content-type']
  });

  uploadAudio(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      logger.error('Upload middleware: Multer error occurred', {
        errorCode: err.code,
        errorMessage: err.message,
        field: err.field,
        url: req.url
      });

      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxSize = (parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 104857600) / 1024 / 1024;
        logger.error('Upload middleware: File size limit exceeded', {
          maxSizeMB: maxSize,
          errorCode: err.code
        });
        return res.status(400).json({
          success: false,
          message: `File size exceeds maximum allowed size of ${maxSize}MB`
        });
      }

      logger.error('Upload middleware: Other Multer error', {
        errorCode: err.code,
        errorMessage: err.message
      });
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      // Custom errors (like file type)
      logger.error('Upload middleware: Custom upload error', {
        errorMessage: err.message,
        errorStack: err.stack,
        url: req.url
      });

      // Ensure response hasn't been sent already
      if (!res.headersSent) {
        logger.info('Upload middleware: sending 400 error response');
        return res.status(400).json({
          success: false,
          message: err.message
        });
      } else {
        logger.warn('Upload middleware: headers already sent, cannot send error response');
      }
      return;
    }

    // Success - proceed to next middleware
    logger.info('Upload middleware: file upload successful', {
      filename: req.file ? req.file.filename : 'no file',
      size: req.file ? req.file.size : 0,
      mimetype: req.file ? req.file.mimetype : 'unknown'
    });
    next();
  });
};

module.exports = {
  uploadAudio: handleUpload
};
