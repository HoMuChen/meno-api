/**
 * Person Model
 * MongoDB schema for managing people (clients, members, friends, speakers)
 */
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Person:
 *       type: object
 *       required:
 *         - name
 *         - userId
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated person ID
 *         name:
 *           type: string
 *           description: Person's full name
 *           minLength: 2
 *           maxLength: 100
 *         email:
 *           type: string
 *           format: email
 *           description: Person's email (optional)
 *         phone:
 *           type: string
 *           description: Person's phone number (optional)
 *           maxLength: 20
 *         company:
 *           type: string
 *           description: Company or organization
 *           maxLength: 100
 *         socialMedia:
 *           type: object
 *           properties:
 *             linkedin:
 *               type: string
 *               format: uri
 *               description: LinkedIn profile URL
 *             twitter:
 *               type: string
 *               format: uri
 *               description: Twitter profile URL
 *             facebook:
 *               type: string
 *               format: uri
 *               description: Facebook profile URL
 *             instagram:
 *               type: string
 *               format: uri
 *               description: Instagram profile URL
 *             github:
 *               type: string
 *               format: uri
 *               description: GitHub profile URL
 *         notes:
 *           type: string
 *           description: Additional notes about the person
 *           maxLength: 1000
 *         userId:
 *           type: string
 *           description: Owner user ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const personSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Person name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      default: null
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
      default: null
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
      default: null
    },
    socialMedia: {
      linkedin: {
        type: String,
        trim: true,
        maxlength: [200, 'LinkedIn URL cannot exceed 200 characters'],
        default: null
      },
      twitter: {
        type: String,
        trim: true,
        maxlength: [200, 'Twitter URL cannot exceed 200 characters'],
        default: null
      },
      facebook: {
        type: String,
        trim: true,
        maxlength: [200, 'Facebook URL cannot exceed 200 characters'],
        default: null
      },
      instagram: {
        type: String,
        trim: true,
        maxlength: [200, 'Instagram URL cannot exceed 200 characters'],
        default: null
      },
      github: {
        type: String,
        trim: true,
        maxlength: [200, 'GitHub URL cannot exceed 200 characters'],
        default: null
      }
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: ''
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
// Note: userId already covered by compound index below
personSchema.index({ userId: 1, createdAt: -1 });

// Instance method to get safe object
personSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Static method to get paginated people
personSchema.statics.findPaginated = async function (query, options = {}) {
  const { page = 1, limit = 10, sort = 'name' } = options;

  const people = await this.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    people,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const Person = mongoose.model('Person', personSchema);

module.exports = Person;
