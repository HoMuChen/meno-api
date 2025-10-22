/**
 * User Model
 * MongoDB schema for user data
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated user ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email (unique)
 *         name:
 *           type: string
 *           description: User full name
 *         password:
 *           type: string
 *           format: password
 *           description: User password (only for email/password auth)
 *         provider:
 *           type: string
 *           enum: [email, google]
 *           description: Authentication provider
 *         googleId:
 *           type: string
 *           description: Google OAuth ID
 *         avatar:
 *           type: string
 *           description: Avatar file path
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *           description: User account status
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    password: {
      type: String,
      required: function() {
        return this.provider === 'email';
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Don't include password in queries by default
    },
    provider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email'
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true // Allows multiple null values
    },
    avatar: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it's new or modified
  if (!this.isModified('password')) {
    return next();
  }

  // Only hash if password exists (not for OAuth users)
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get safe user object (without sensitive data)
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.password;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
