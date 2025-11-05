/**
 * Authentication Routes
 * Define routes for authentication endpoints
 */
const express = require('express');
const passport = require('passport');
const { validateSignup, validateLogin, validateGoogleToken } = require('../validators/auth.validator');
const { authenticate } = require('../middleware/auth.middleware');

const createAuthRoutes = (authController) => {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   name: Auth
   *   description: Authentication endpoints
   */

  /**
   * @swagger
   * components:
   *   securitySchemes:
   *     bearerAuth:
   *       type: http
   *       scheme: bearer
   *       bearerFormat: JWT
   */

  // Email/Password Authentication
  router.post('/signup', validateSignup, authController.signup);
  router.post('/login', validateLogin, authController.login);

  // Get current user profile (protected route)
  router.get('/me', authenticate, authController.getProfile);

  // Google OAuth routes
  router.get(
    '/google',
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false
    })
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', {
      session: false,
      failureRedirect: '/auth/google/failure'
    }),
    authController.googleCallback
  );

  router.get('/google/failure', authController.googleFailure);

  // Chrome Extension OAuth token exchange
  router.post('/google/token', validateGoogleToken, authController.googleTokenExchange);

  return router;
};

module.exports = createAuthRoutes;
