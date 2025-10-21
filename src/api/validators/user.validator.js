/**
 * User Validation Schemas
 * Request validation using Joi
 */
const Joi = require('joi');

const createUserSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
    status: Joi.string().valid('active', 'inactive', 'suspended')
  })
};

const updateUserSchema = {
  params: Joi.object({
    id: Joi.string().required().messages({
      'any.required': 'User ID is required'
    })
  }),
  body: Joi.object({
    email: Joi.string().email().messages({
      'string.email': 'Please provide a valid email address'
    }),
    name: Joi.string().min(2).max(100).messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 100 characters'
    }),
    status: Joi.string().valid('active', 'inactive', 'suspended')
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

const getUserSchema = {
  params: Joi.object({
    id: Joi.string().required().messages({
      'any.required': 'User ID is required'
    })
  })
};

module.exports = {
  createUserSchema,
  updateUserSchema,
  getUserSchema
};
