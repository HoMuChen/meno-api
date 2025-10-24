/**
 * Passport Configuration
 * Configure authentication strategies
 */
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const logger = require('../logging');

/**
 * Sanitize token for logging (show first/last 10 chars only)
 */
const sanitizeToken = (token) => {
  if (!token) return 'null';
  if (token.length <= 20) return '***';
  return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
};

/**
 * Configure Passport Google OAuth Strategy
 */
const configurePassport = () => {
  logger.debug('Configuring Google OAuth Strategy', {
    clientID: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'NOT_SET',
    clientSecretConfigured: !!process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
  });

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          logger.debug('Google OAuth callback received', {
            accessToken: sanitizeToken(accessToken),
            refreshToken: refreshToken ? 'present' : 'null',
            profileId: profile.id,
            profileProvider: profile.provider,
            displayName: profile.displayName,
            emailsCount: profile.emails?.length || 0,
            primaryEmail: profile.emails?.[0]?.value || 'none',
            photosCount: profile.photos?.length || 0
          });

          // Pass the profile to the controller
          return done(null, profile);
        } catch (error) {
          logger.error('Google OAuth strategy error', {
            error: error.message,
            stack: error.stack,
            profileId: profile?.id
          });
          return done(error, null);
        }
      }
    )
  );

  // Serialize user (not used with JWT, but required by passport)
  passport.serializeUser((user, done) => {
    logger.debug('Serializing user', { userId: user.id || user._id });
    done(null, user);
  });

  // Deserialize user (not used with JWT, but required by passport)
  passport.deserializeUser((user, done) => {
    logger.debug('Deserializing user', { userId: user.id || user._id });
    done(null, user);
  });

  logger.info('Google OAuth Strategy configured successfully');
};

module.exports = configurePassport;
