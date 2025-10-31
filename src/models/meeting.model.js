/**
 * Meeting Model
 * MongoDB schema for meeting data with audio file and transcription tracking
 */
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Meeting:
 *       type: object
 *       required:
 *         - title
 *         - projectId
 *         - audioFile
 *         - recordingType
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated meeting ID
 *         title:
 *           type: string
 *           description: Meeting title
 *           minLength: 2
 *           maxLength: 200
 *         description:
 *           type: string
 *           description: Meeting description
 *           maxLength: 1000
 *         summary:
 *           type: string
 *           description: AI-generated meeting summary with Overview, Key Points, Conclusion, and Action Items
 *         projectId:
 *           type: string
 *           description: Parent project ID
 *         audioFile:
 *           type: string
 *           description: Audio file path or URL
 *         duration:
 *           type: number
 *           description: Audio duration in seconds
 *         recordingType:
 *           type: string
 *           enum: [upload, direct]
 *           description: How the meeting was created
 *         transcriptionStatus:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *           description: Current transcription status
 *         transcriptionProgress:
 *           type: number
 *           description: Transcription progress (0-100)
 *         metadata:
 *           type: object
 *           properties:
 *             fileSize:
 *               type: number
 *             mimeType:
 *               type: string
 *             originalName:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Meeting title is required'],
      trim: true,
      minlength: [2, 'Meeting title must be at least 2 characters'],
      maxlength: [200, 'Meeting title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Meeting description cannot exceed 1000 characters'],
      default: null
    },
    summary: {
      type: String,
      trim: true,
      default: null
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required']
    },
    audioFile: {
      type: String,
      required: [true, 'Audio file is required']
    },
    duration: {
      type: Number,
      default: null,
      min: [0, 'Duration cannot be negative']
    },
    recordingType: {
      type: String,
      enum: {
        values: ['upload', 'direct'],
        message: 'Recording type must be either upload or direct'
      },
      required: [true, 'Recording type is required']
    },
    transcriptionStatus: {
      type: String,
      enum: {
        values: ['pending', 'processing', 'completed', 'failed'],
        message: 'Invalid transcription status'
      },
      default: 'pending'
    },
    transcriptionProgress: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100']
    },
    actionItemsStatus: {
      type: String,
      enum: {
        values: ['not_started', 'processing', 'completed', 'failed'],
        message: 'Invalid action items status'
      },
      default: 'not_started'
    },
    actionItemsProgress: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100']
    },
    metadata: {
      fileSize: {
        type: Number,
        min: [0, 'File size cannot be negative']
      },
      mimeType: {
        type: String,
        trim: true
      },
      originalName: {
        type: String,
        trim: true
      },
      transcription: {
        startedAt: {
          type: Date,
          default: null
        },
        completedAt: {
          type: Date,
          default: null
        },
        errorMessage: {
          type: String,
          default: null
        },
        processedSegments: {
          type: Number,
          default: 0,
          min: [0, 'Processed segments cannot be negative']
        },
        estimatedTotal: {
          type: Number,
          default: 0,
          min: [0, 'Estimated total cannot be negative']
        },
        lastChunkAt: {
          type: Date,
          default: null
        }
      },
      actionItems: {
        generatedAt: {
          type: Date,
          default: null
        },
        count: {
          type: Number,
          default: 0,
          min: [0, 'Count cannot be negative']
        },
        errorMessage: {
          type: String,
          default: null
        }
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
// Note: projectId already covered by compound index below
meetingSchema.index({ projectId: 1, createdAt: -1 });
meetingSchema.index({ transcriptionStatus: 1 });

// Virtual for transcriptions
meetingSchema.virtual('transcriptions', {
  ref: 'Transcription',
  localField: '_id',
  foreignField: 'meetingId'
});

// Instance method to get safe object
meetingSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Instance method to check ownership
meetingSchema.methods.isOwnedBy = function (userId) {
  if (!this.projectId || !this.projectId.userId) {
    return false;
  }
  return this.projectId.userId.toString() === userId.toString();
};

// Instance method to update transcription progress
meetingSchema.methods.updateTranscriptionProgress = async function (status, progress) {
  this.transcriptionStatus = status;
  this.transcriptionProgress = progress;
  await this.save();
};

// Static method to get meetings with pagination
meetingSchema.statics.findWithTranscriptionCount = async function (query, options = {}) {
  const { page = 1, limit = 10, sort = '-createdAt' } = options;

  const meetings = await this.aggregate([
    { $match: query },
    { $sort: this._parseSortString(sort) },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  ]);

  const total = await this.countDocuments(query);

  return {
    meetings,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Helper to parse sort string
meetingSchema.statics._parseSortString = function (sortStr) {
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

const Meeting = mongoose.model('Meeting', meetingSchema);

module.exports = Meeting;
