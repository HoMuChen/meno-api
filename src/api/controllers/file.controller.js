/**
 * File Controller
 * HTTP handlers for file-related endpoints
 */
const { success, created, paginated } = require('../../utils/responses');
const { BadRequestError } = require('../../utils/errors');

class FileController {
  constructor(fileService, logger) {
    this.fileService = fileService;
    this.logger = logger;
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
  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const uploadedBy = req.user?.id || null; // If authentication is implemented
      const file = await this.fileService.uploadFile(req.file, uploadedBy);

      return created(res, file, 'File uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

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
  async getAllFiles(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const uploadedBy = req.query.uploadedBy || null;

      const result = await this.fileService.getAllFiles(page, limit, uploadedBy);

      return paginated(res, result.files, page, limit, result.total);
    } catch (error) {
      next(error);
    }
  }

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
  async getFileById(req, res, next) {
    try {
      const file = await this.fileService.getFileById(req.params.id);
      return success(res, file, 'File retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

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
  async downloadFile(req, res, next) {
    try {
      const { file, data } = await this.fileService.downloadFile(req.params.id);

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.send(data);
    } catch (error) {
      next(error);
    }
  }

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
  async deleteFile(req, res, next) {
    try {
      await this.fileService.deleteFile(req.params.id);
      return success(res, null, 'File deleted successfully');
    } catch (error) {
      next(error);
    }
  }

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
  async getFileUrl(req, res, next) {
    try {
      const expiresIn = parseInt(req.query.expiresIn) || 3600;
      const result = await this.fileService.getFileUrl(req.params.id, expiresIn);

      return success(res, { url: result.url }, 'File URL generated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = FileController;
