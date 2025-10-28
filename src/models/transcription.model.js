/**
 * Transcription Model
 * MongoDB schema for transcription segments with speaker diarization
 */
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Transcription:
 *       type: object
 *       required:
 *         - meetingId
 *         - startTime
 *         - endTime
 *         - speaker
 *         - text
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated transcription ID
 *         meetingId:
 *           type: string
 *           description: Parent meeting ID
 *         startTime:
 *           type: number
 *           description: Start time in milliseconds from audio start
 *         endTime:
 *           type: number
 *           description: End time in milliseconds from audio start
 *         speaker:
 *           type: string
 *           description: Speaker identifier (e.g., "Speaker 1", "John Doe")
 *         text:
 *           type: string
 *           description: Transcribed text segment
 *           maxLength: 5000
 *         isEdited:
 *           type: boolean
 *           description: Whether the transcription was manually edited
 *         createdAt:
 *           type: string
 *           format: date-time
 */

const transcriptionSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: [true, 'Meeting ID is required'],
      index: true
    },
    startTime: {
      type: Number,
      required: [true, 'Start time is required'],
      min: [0, 'Start time cannot be negative']
    },
    endTime: {
      type: Number,
      required: [true, 'End time is required'],
      min: [0, 'End time cannot be negative'],
      validate: {
        validator: function (value) {
          return value > this.startTime;
        },
        message: 'End time must be greater than start time'
      }
    },
    speaker: {
      type: String,
      required: [true, 'Speaker is required'],
      trim: true,
      maxlength: [100, 'Speaker name cannot exceed 100 characters']
    },
    text: {
      type: String,
      required: [true, 'Transcription text is required'],
      trim: true,
      maxlength: [5000, 'Transcription text cannot exceed 5000 characters']
    },
    isEdited: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient querying
transcriptionSchema.index({ meetingId: 1, startTime: 1 });

// Virtual to calculate duration
transcriptionSchema.virtual('duration').get(function () {
  return this.endTime - this.startTime;
});

// Virtual to format start time as MM:SS.mmm
transcriptionSchema.virtual('startTimeFormatted').get(function () {
  return this._formatTime(this.startTime);
});

// Virtual to format end time as MM:SS.mmm
transcriptionSchema.virtual('endTimeFormatted').get(function () {
  return this._formatTime(this.endTime);
});

// Helper method to format time
transcriptionSchema.methods._formatTime = function (milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = milliseconds % 1000;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

// Instance method to get safe object
transcriptionSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Instance method to mark as edited
transcriptionSchema.methods.markAsEdited = async function () {
  this.isEdited = true;
  await this.save();
};

// Static method to get paginated transcriptions
transcriptionSchema.statics.findPaginated = async function (query, options = {}) {
  const { page = 1, limit = 50, sort = 'startTime' } = options;

  const transcriptions = await this.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    transcriptions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to bulk insert transcriptions
transcriptionSchema.statics.bulkInsert = async function (transcriptions) {
  return await this.insertMany(transcriptions, { ordered: false });
};

// Static method to get transcriptions by time range
transcriptionSchema.statics.findByTimeRange = async function (meetingId, startTime, endTime) {
  return await this.find({
    meetingId,
    $or: [
      {
        startTime: { $gte: startTime, $lte: endTime }
      },
      {
        endTime: { $gte: startTime, $lte: endTime }
      },
      {
        startTime: { $lte: startTime },
        endTime: { $gte: endTime }
      }
    ]
  }).sort('startTime');
};

const Transcription = mongoose.model('Transcription', transcriptionSchema);

module.exports = Transcription;
