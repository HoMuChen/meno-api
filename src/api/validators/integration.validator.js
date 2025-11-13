const Joi = require('joi');

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    next();
  };
};

/**
 * Schema for updating integration settings
 */
const updateSettingsSchema = Joi.object({
  autoTranscribe: Joi.boolean().optional(),
  notifyOnComplete: Joi.boolean().optional(),
  defaultProjectId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid project ID format',
    }),
}).min(1).messages({
  'object.min': 'At least one setting must be provided',
});

/**
 * Schema for LINE webhook payload (basic validation)
 */
const lineWebhookSchema = Joi.object({
  destination: Joi.string().required(),
  events: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().required(),
        timestamp: Joi.number().required(),
        source: Joi.object({
          type: Joi.string().required(),
          userId: Joi.string().optional(),
          groupId: Joi.string().optional(),
          roomId: Joi.string().optional(),
        }).required(),
        replyToken: Joi.string().optional(),
        message: Joi.object().optional(),
        webhookEventId: Joi.string().optional(),
        deliveryContext: Joi.object().optional(),
      })
    )
    .required(),
});

module.exports = {
  validateUpdateSettings: validate(updateSettingsSchema),
  validateLineWebhook: validate(lineWebhookSchema),
};
