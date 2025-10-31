/**
 * Meeting Validators
 * Request validation schemas for meeting endpoints
 */
const Joi = require('joi');
const logger = require('../../components/logging/logger');

const validate = (schema) => {
  return (req, res, next) => {
    logger.info('Meeting validator: validating request body', {
      url: req.url,
      method: req.method,
      body: req.body,
      hasFile: !!req.file,
      fileName: req.file ? req.file.originalname : 'no file'
    });

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.error('Meeting validator: validation failed', {
        url: req.url,
        body: req.body,
        validationErrors: errors,
        errorCount: errors.length
      });

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    logger.info('Meeting validator: validation passed', {
      url: req.url,
      body: req.body
    });

    next();
  };
};

const createMeetingSchema = Joi.object({
  title: Joi.string()
    .min(2)
    .max(200)
    .required()
    .messages({
      'string.min': 'Meeting title must be at least 2 characters long',
      'string.max': 'Meeting title cannot exceed 200 characters',
      'any.required': 'Meeting title is required'
    }),
  recordingType: Joi.string()
    .valid('upload', 'direct')
    .default('upload')
    .messages({
      'any.only': 'Recording type must be either "upload" or "direct"'
    }),
  duration: Joi.number()
    .positive()
    .optional()
    .messages({
      'number.base': 'Duration must be a number',
      'number.positive': 'Duration must be a positive number'
    })
});

const updateMeetingSchema = Joi.object({
  title: Joi.string()
    .min(2)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Meeting title must be at least 2 characters long',
      'string.max': 'Meeting title cannot exceed 200 characters'
    }),
  projectId: Joi.string()
    .optional()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid project ID format. Must be a valid MongoDB ObjectId'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

/**
 * Validate audio file upload
 */
const validateAudioFile = (req, res, next) => {
  logger.info('Audio file validator: checking file', {
    url: req.url,
    hasFile: !!req.file,
    fileName: req.file ? req.file.originalname : 'no file'
  });

  if (!req.file) {
    logger.error('Audio file validator: no file provided', {
      url: req.url
    });
    return res.status(400).json({
      success: false,
      message: 'Audio file is required'
    });
  }

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

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    logger.error('Audio file validator: invalid mime type', {
      url: req.url,
      mimetype: req.file.mimetype,
      fileName: req.file.originalname
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid audio format. Allowed formats: MP3, M4A, AAC, WAV, WebM, OGG, FLAC'
    });
  }

  const maxSize = parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 104857600; // 100MB default

  if (req.file.size > maxSize) {
    logger.error('Audio file validator: file size exceeds limit', {
      url: req.url,
      fileSize: req.file.size,
      maxSize: maxSize,
      fileName: req.file.originalname
    });
    return res.status(400).json({
      success: false,
      message: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
    });
  }

  logger.info('Audio file validator: file validation passed', {
    url: req.url,
    mimetype: req.file.mimetype,
    size: req.file.size,
    fileName: req.file.originalname
  });

  next();
};

module.exports = {
  validateCreateMeeting: validate(createMeetingSchema),
  validateUpdateMeeting: validate(updateMeetingSchema),
  validateAudioFile
};
