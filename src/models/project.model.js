/**
 * Project Model
 * MongoDB schema for project data
 */
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Project:
 *       type: object
 *       required:
 *         - name
 *         - userId
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated project ID
 *         name:
 *           type: string
 *           description: Project name
 *           minLength: 2
 *           maxLength: 100
 *         description:
 *           type: string
 *           description: Project description
 *           maxLength: 500
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

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [100, 'Project name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: ''
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient querying
projectSchema.index({ userId: 1, createdAt: -1 });

// Virtual for meetings count
projectSchema.virtual('meetings', {
  ref: 'Meeting',
  localField: '_id',
  foreignField: 'projectId'
});

// Instance method to get safe object
projectSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Static method to get projects with meeting count
projectSchema.statics.findWithMeetingCount = async function (query, options = {}) {
  const { page = 1, limit = 10, sort = '-createdAt' } = options;

  const projects = await this.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'meetings',
        localField: '_id',
        foreignField: 'projectId',
        as: 'meetingsData'
      }
    },
    {
      $addFields: {
        meetingsCount: { $size: '$meetingsData' }
      }
    },
    {
      $project: {
        meetingsData: 0
      }
    },
    { $sort: this._parseSortString(sort) },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  ]);

  const total = await this.countDocuments(query);

  return {
    projects,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Helper to parse sort string
projectSchema.statics._parseSortString = function (sortStr) {
  const sort = {};
  const fields = sortStr.split(' ');

  fields.forEach(field => {
    if (field.startsWith('-')) {
      sort[field.substring(1)] = -1;
    } else {
      sort[field] = 1;
    }
  });

  return sort;
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
