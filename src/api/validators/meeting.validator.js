/**
 * Meeting Validators
 * Request validation schemas for meeting endpoints
 */
const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

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
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

/**
 * Validate audio file upload
 */
const validateAudioFile = (req, res, next) => {
  if (!req.file) {
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

    // WebM
    'audio/webm',

    // OGG
    'audio/ogg',
    'audio/vorbis',

    // FLAC (lossless)
    'audio/flac',
    'audio/x-flac'
  ];

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid audio format. Allowed formats: MP3, M4A, AAC, WAV, WebM, OGG, FLAC'
    });
  }

  const maxSize = parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 104857600; // 100MB default

  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
    });
  }

  next();
};

module.exports = {
  validateCreateMeeting: validate(createMeetingSchema),
  validateUpdateMeeting: validate(updateMeetingSchema),
  validateAudioFile
};
