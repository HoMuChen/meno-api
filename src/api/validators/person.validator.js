/**
 * Person Validators
 * Request validation schemas for person endpoints
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

const socialMediaSchema = Joi.object({
  linkedin: Joi.string()
    .uri()
    .max(200)
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'LinkedIn must be a valid URL',
      'string.max': 'LinkedIn URL cannot exceed 200 characters'
    }),
  twitter: Joi.string()
    .uri()
    .max(200)
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'Twitter must be a valid URL',
      'string.max': 'Twitter URL cannot exceed 200 characters'
    }),
  facebook: Joi.string()
    .uri()
    .max(200)
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'Facebook must be a valid URL',
      'string.max': 'Facebook URL cannot exceed 200 characters'
    }),
  instagram: Joi.string()
    .uri()
    .max(200)
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'Instagram must be a valid URL',
      'string.max': 'Instagram URL cannot exceed 200 characters'
    }),
  github: Joi.string()
    .uri()
    .max(200)
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'GitHub must be a valid URL',
      'string.max': 'GitHub URL cannot exceed 200 characters'
    })
});

const createPersonSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .email()
    .max(100)
    .allow(null, '')
    .optional()
    .messages({
      'string.email': 'Please provide a valid email',
      'string.max': 'Email cannot exceed 100 characters'
    }),
  phone: Joi.string()
    .max(20)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': 'Phone number cannot exceed 20 characters'
    }),
  company: Joi.string()
    .max(100)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': 'Company name cannot exceed 100 characters'
    }),
  socialMedia: socialMediaSchema.optional(),
  notes: Joi.string()
    .max(1000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
});

const updatePersonSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 100 characters'
    }),
  email: Joi.string()
    .email()
    .max(100)
    .allow(null, '')
    .optional()
    .messages({
      'string.email': 'Please provide a valid email',
      'string.max': 'Email cannot exceed 100 characters'
    }),
  phone: Joi.string()
    .max(20)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': 'Phone number cannot exceed 20 characters'
    }),
  company: Joi.string()
    .max(100)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': 'Company name cannot exceed 100 characters'
    }),
  socialMedia: socialMediaSchema.optional(),
  notes: Joi.string()
    .max(1000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

module.exports = {
  validateCreatePerson: validate(createPersonSchema),
  validateUpdatePerson: validate(updatePersonSchema)
};
