/**
 * Swagger/OpenAPI Configuration
 * Auto-generates API documentation from JSDoc comments
 */
const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./index');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Meno API',
      version: '1.0.0',
      description: 'RESTful API built with Express, MongoDB, and clean architecture principles. This API provides endpoints for authentication (email/password and Google OAuth), user management, and file storage with support for multiple storage providers (local and Google Cloud Storage).',
      contact: {
        name: 'API Support'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Root server (for Auth endpoints)'
      },
      {
        url: `http://localhost:${config.port}${config.api.prefix}`,
        description: 'API server (for Users, Files, Health)'
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints'
      },
      {
        name: 'Auth',
        description: 'Authentication endpoints (signup, login, OAuth)'
      },
      {
        name: 'Users',
        description: 'User management endpoints'
      },
      {
        name: 'Files',
        description: 'File storage and management endpoints'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authorization header using the Bearer scheme'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message describing what went wrong',
              example: 'An error occurred'
            },
            error: {
              type: 'object',
              description: 'Detailed error information',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code',
                  example: 'VALIDATION_ERROR'
                },
                details: {
                  type: 'object',
                  description: 'Additional error details',
                  additionalProperties: true
                }
              }
            }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Validation failed'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Field that failed validation',
                    example: 'email'
                  },
                  message: {
                    type: 'string',
                    description: 'Validation error message',
                    example: 'Email is required'
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  // Path to API documentation comments
  apis: [
    './src/api/routes/*.js',
    './src/api/controllers/*.js',
    './src/models/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
