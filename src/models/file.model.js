/**
 * File Model
 * MongoDB schema for file metadata
 */
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     File:
 *       type: object
 *       required:
 *         - filename
 *         - path
 *         - size
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated file ID
 *         filename:
 *           type: string
 *           description: Original filename
 *         path:
 *           type: string
 *           description: Storage path
 *         url:
 *           type: string
 *           description: Accessible URL
 *         size:
 *           type: number
 *           description: File size in bytes
 *         mimeType:
 *           type: string
 *           description: MIME type
 *         uploadedBy:
 *           type: string
 *           description: User ID who uploaded the file
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const fileSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true
    },
    path: {
      type: String,
      required: [true, 'File path is required'],
      unique: true
    },
    url: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size must be positive']
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream'
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    metadata: {
      type: Map,
      of: String,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
fileSchema.index({ path: 1 });
fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ createdAt: -1 });

// Virtual for human-readable size
fileSchema.virtual('sizeFormatted').get(function () {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
});

const File = mongoose.model('File', fileSchema);

module.exports = File;
