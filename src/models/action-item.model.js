/**
 * Action Item Model
 * MongoDB schema for meeting action items with optional person assignment
 */
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     ActionItem:
 *       type: object
 *       required:
 *         - meetingId
 *         - userId
 *         - task
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated action item ID
 *         meetingId:
 *           type: string
 *           description: Parent meeting ID
 *         userId:
 *           type: string
 *           description: User ID who owns the meeting (denormalized for efficient querying)
 *         personId:
 *           type: string
 *           description: Optional person ID if assignee was matched to a person
 *         task:
 *           type: string
 *           description: Description of the action item
 *           maxLength: 500
 *         assignee:
 *           type: string
 *           description: Assignee name as extracted by LLM (may not match personId)
 *           maxLength: 100
 *         dueDate:
 *           type: string
 *           format: date-time
 *           description: Due date or deadline as ISO 8601 datetime
 *         context:
 *           type: string
 *           description: Additional context or related discussion point
 *           maxLength: 500
 *         status:
 *           type: string
 *           enum: [pending, in_progress, completed]
 *           description: Current status of the action item
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const actionItemSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: [true, 'Meeting ID is required'],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    personId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
      index: true
    },
    task: {
      type: String,
      required: [true, 'Task description is required'],
      trim: true,
      maxlength: [500, 'Task description cannot exceed 500 characters']
    },
    assignee: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, 'Assignee name cannot exceed 100 characters']
    },
    dueDate: {
      type: Date,
      default: null
    },
    context: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'Context cannot exceed 500 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'in_progress', 'completed'],
        message: '{VALUE} is not a valid status'
      },
      default: 'pending'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for efficient querying
actionItemSchema.index({ meetingId: 1, createdAt: -1 });
actionItemSchema.index({ personId: 1, createdAt: -1 });
actionItemSchema.index({ userId: 1, createdAt: -1 });

// Virtual to check if action item is assigned
actionItemSchema.virtual('isAssigned').get(function () {
  return !!this.personId;
});

// Virtual to check if action item is overdue (requires due date parsing - placeholder)
actionItemSchema.virtual('hasAssignee').get(function () {
  return !!this.assignee;
});

// Instance method to get safe object
actionItemSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Instance method to mark as completed
actionItemSchema.methods.markAsCompleted = async function () {
  this.status = 'completed';
  await this.save();
};

// Instance method to mark as in progress
actionItemSchema.methods.markAsInProgress = async function () {
  this.status = 'in_progress';
  await this.save();
};

// Static method to get paginated action items
actionItemSchema.statics.findPaginated = async function (query, options = {}) {
  const { page = 1, limit = 50, sort = 'createdAt', sortOrder = -1, populate = true } = options;

  let queryBuilder = this.find(query);

  // Conditionally populate personId and meetingId
  if (populate) {
    queryBuilder = queryBuilder
      .populate('personId', 'name email company')
      .populate('meetingId', 'title projectId');
  }

  const actionItems = await queryBuilder
    .sort({ [sort]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    actionItems,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to bulk insert action items
actionItemSchema.statics.bulkInsert = async function (actionItems) {
  return await this.insertMany(actionItems, { ordered: false });
};

// Static method to get action items by status
actionItemSchema.statics.findByStatus = async function (meetingId, status) {
  return await this.find({ meetingId, status }).sort('createdAt').lean();
};

// Static method to count action items by status for a meeting
actionItemSchema.statics.countByStatus = async function (meetingId) {
  const result = await this.aggregate([
    { $match: { meetingId: mongoose.Types.ObjectId(meetingId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  return result.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, { pending: 0, in_progress: 0, completed: 0 });
};

const ActionItem = mongoose.model('ActionItem', actionItemSchema);

module.exports = ActionItem;
