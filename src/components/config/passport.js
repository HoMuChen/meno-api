/**
 * Passport Configuration
 * Configure authentication strategies
 */
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

/**
 * Configure Passport Google OAuth Strategy
 */
const configurePassport = () => {
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Pass the profile to the controller
          return done(null, profile);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  // Serialize user (not used with JWT, but required by passport)
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user (not used with JWT, but required by passport)
  passport.deserializeUser((user, done) => {
    done(null, user);
  });
};

module.exports = configurePassport;
