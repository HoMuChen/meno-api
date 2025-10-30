/**
 * Transcription Validators
 * Request validation schemas for transcription endpoints
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

const updateTranscriptionSchema = Joi.object({
  speaker: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Speaker name cannot exceed 100 characters'
    }),
  text: Joi.string()
    .max(5000)
    .optional()
    .messages({
      'string.max': 'Transcription text cannot exceed 5000 characters'
    })
}).min(1).messages({
  'object.min': 'At least one field (speaker or text) must be provided for update'
});

/**
 * Validate search query parameter
 */
const validateSearchQuery = (req, res, next) => {
  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Search query (q) is required and cannot be empty'
    });
  }

  if (q.length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Search query cannot exceed 200 characters'
    });
  }

  next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer'
      });
    }
  }

  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }
  }

  next();
};

const bulkAssignSpeakerSchema = Joi.object({
  personId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Person ID must be a valid MongoDB ObjectId',
      'any.required': 'Person ID is required'
    })
});

const bulkReassignPersonSchema = Joi.object({
  newPersonId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'New person ID must be a valid MongoDB ObjectId',
      'any.required': 'New person ID is required'
    })
});

module.exports = {
  validateUpdateTranscription: validate(updateTranscriptionSchema),
  validateSearchQuery,
  validatePagination,
  validateBulkAssignSpeaker: validate(bulkAssignSpeakerSchema),
  validateBulkReassignPerson: validate(bulkReassignPersonSchema)
};
