/**
 * Project Validators
 * Request validation schemas for project endpoints
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

const createProjectSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Project name must be at least 2 characters long',
      'string.max': 'Project name cannot exceed 100 characters',
      'any.required': 'Project name is required'
    }),
  description: Joi.string()
    .max(500)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    })
});

const updateProjectSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Project name must be at least 2 characters long',
      'string.max': 'Project name cannot exceed 100 characters'
    }),
  description: Joi.string()
    .max(500)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

module.exports = {
  validateCreateProject: validate(createProjectSchema),
  validateUpdateProject: validate(updateProjectSchema)
};
