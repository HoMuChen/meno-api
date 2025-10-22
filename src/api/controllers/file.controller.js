/**
 * File Controller
 * HTTP handlers for file-related endpoints
 */
const BaseController = require('./base.controller');
const { BadRequestError } = require('../../utils/errors');

class FileController extends BaseController {
  constructor(fileService, logger) {
    super(fileService, logger);
    this.fileService = fileService;
  }

  /**
   * @swagger
   * /api/files:
   *   post:
   *     summary: Upload a file
   *     tags: [Files]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       201:
   *         description: File uploaded successfully
   */
  uploadFile = this.asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    const uploadedBy = this.getUserId(req);
    const file = await this.fileService.uploadFile(req.file, uploadedBy);
    return this.sendCreated(res, file, 'File uploaded successfully');
  });

  /**
   * @swagger
   * /api/files:
   *   get:
   *     summary: Get all files
   *     tags: [Files]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *     responses:
   *       200:
   *         description: List of files
   */
  getAllFiles = this.asyncHandler(async (req, res) => {
    const { page, limit } = this.getPaginationParams(req);
    const uploadedBy = req.query.uploadedBy || null;
    const result = await this.fileService.getAllFiles(page, limit, uploadedBy);
    return this.sendPaginated(res, result.files, page, limit, result.total);
  });

  /**
   * @swagger
   * /api/files/{id}:
   *   get:
   *     summary: Get file by ID
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: File details
   */
  getFileById = this.asyncHandler(async (req, res) => {
    const file = await this.fileService.getFileById(req.params.id);
    return this.sendSuccess(res, file, 'File retrieved successfully');
  });

  /**
   * @swagger
   * /api/files/{id}/download:
   *   get:
   *     summary: Download file
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: File download
   */
  downloadFile = this.asyncHandler(async (req, res) => {
    const { file, data } = await this.fileService.downloadFile(req.params.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(data);
  });

  /**
   * @swagger
   * /api/files/{id}:
   *   delete:
   *     summary: Delete file
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: File deleted
   */
  deleteFile = this.asyncHandler(async (req, res) => {
    await this.fileService.deleteFile(req.params.id);
    return this.sendSuccess(res, null, 'File deleted successfully');
  });

  /**
   * @swagger
   * /api/files/{id}/url:
   *   get:
   *     summary: Get file URL
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: expiresIn
   *         schema:
   *           type: integer
   *           default: 3600
   *     responses:
   *       200:
   *         description: File URL
   */
  getFileUrl = this.asyncHandler(async (req, res) => {
    const expiresIn = parseInt(req.query.expiresIn) || 3600;
    const result = await this.fileService.getFileUrl(req.params.id, expiresIn);
    return this.sendSuccess(res, { url: result.url }, 'File URL generated successfully');
  });
}

module.exports = FileController;
