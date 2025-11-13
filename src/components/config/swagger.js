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
        description: 'Development server'
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
      },
      {
        name: 'Projects',
        description: 'Project management endpoints for organizing meetings'
      },
      {
        name: 'Meetings',
        description: 'Meeting management endpoints with audio upload and transcription'
      },
      {
        name: 'Transcriptions',
        description: 'Transcription management endpoints for viewing and editing meeting transcripts'
      },
      {
        name: 'Integrations',
        description: 'Integration management endpoints for connecting external services (LINE, Telegram, etc.)'
      },
      {
        name: 'Webhooks',
        description: 'Webhook endpoints for receiving events from external services'
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
        },
        Integration: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Integration ID',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              description: 'User ID',
              example: '507f191e810c19729de860ea'
            },
            provider: {
              type: 'string',
              enum: ['line', 'telegram', 'whatsapp'],
              description: 'Integration provider',
              example: 'line'
            },
            providerId: {
              type: 'string',
              description: 'External provider user ID (e.g., LINE user ID)',
              example: 'U1234567890abcdef'
            },
            providerData: {
              type: 'object',
              properties: {
                displayName: {
                  type: 'string',
                  description: 'User display name from provider',
                  example: 'John Doe'
                },
                pictureUrl: {
                  type: 'string',
                  description: 'Profile picture URL from provider',
                  example: 'https://profile.line-scdn.net/...'
                },
                statusMessage: {
                  type: 'string',
                  description: 'User status message from provider'
                },
                language: {
                  type: 'string',
                  description: 'User language preference',
                  example: 'en'
                }
              }
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'revoked'],
              description: 'Integration status',
              example: 'active'
            },
            defaultProjectId: {
              type: 'string',
              description: 'Default project ID for meetings created via this integration',
              example: '507f1f77bcf86cd799439011'
            },
            settings: {
              type: 'object',
              properties: {
                autoTranscribe: {
                  type: 'boolean',
                  description: 'Automatically start transcription for uploaded audio',
                  example: true
                },
                notifyOnComplete: {
                  type: 'boolean',
                  description: 'Send notification when transcription completes',
                  example: false
                }
              }
            },
            isActive: {
              type: 'boolean',
              description: 'Whether integration is currently active',
              example: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Integration creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Integration last update timestamp'
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
