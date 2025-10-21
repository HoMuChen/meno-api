/**
 * Request Validation Middleware
 * Validates request body/params/query using Joi schemas
 */
const { ValidationError } = require('../../utils/errors');

/**
 * Validate request using Joi schema
 * @param {Object} schema - Joi schema object with body/params/query
 */
const validate = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false, // Return all errors
      allowUnknown: true, // Allow unknown keys
      stripUnknown: true // Remove unknown keys
    };

    const toValidate = {};

    if (schema.body) {
      toValidate.body = req.body;
    }

    if (schema.params) {
      toValidate.params = req.params;
    }

    if (schema.query) {
      toValidate.query = req.query;
    }

    const schemas = {
      body: schema.body,
      params: schema.params,
      query: schema.query
    };

    const errors = [];

    // Validate each part
    Object.keys(schemas).forEach((key) => {
      if (schemas[key]) {
        const { error, value } = schemas[key].validate(toValidate[key], validationOptions);

        if (error) {
          error.details.forEach((detail) => {
            errors.push(detail.message);
          });
        } else {
          // Update request with validated values
          req[key] = value;
        }
      }
    });

    if (errors.length > 0) {
      return next(new ValidationError('Validation failed', errors));
    }

    next();
  };
};

module.exports = validate;
