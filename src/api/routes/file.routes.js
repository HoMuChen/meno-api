/**
 * File Routes
 * URL routing for file endpoints
 */
const express = require('express');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

/**
 * @swagger
 * tags:
 *   name: Files
 *   description: File storage and management endpoints
 */

const createFileRoutes = (fileController) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/files:
   *   post:
   *     summary: Upload a file
   *     description: Upload a file to the storage provider (max 50MB)
   *     tags: [Files]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: File to upload (max 50MB)
   *               uploadedBy:
   *                 type: string
   *                 description: User ID who is uploading the file
   *                 example: 507f1f77bcf86cd799439011
   *     responses:
   *       201:
   *         description: File uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/File'
   *       400:
   *         description: No file provided or validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       413:
   *         description: File too large (max 50MB)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/', upload.single('file'), fileController.uploadFile.bind(fileController));

  /**
   * @swagger
   * /api/files:
   *   get:
   *     summary: Get all files
   *     description: Retrieve a list of all files in the system
   *     tags: [Files]
   *     responses:
   *       200:
   *         description: List of files retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/File'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/', fileController.getAllFiles.bind(fileController));

  /**
   * @swagger
   * /api/files/{id}:
   *   get:
   *     summary: Get file metadata by ID
   *     description: Retrieve file metadata by file ID
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: File ID (MongoDB ObjectId)
   *         example: 507f1f77bcf86cd799439011
   *     responses:
   *       200:
   *         description: File metadata retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/File'
   *       400:
   *         description: Invalid file ID format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: File not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/:id', fileController.getFileById.bind(fileController));

  /**
   * @swagger
   * /api/files/{id}/download:
   *   get:
   *     summary: Download file
   *     description: Download a file by its ID
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: File ID (MongoDB ObjectId)
   *         example: 507f1f77bcf86cd799439011
   *     responses:
   *       200:
   *         description: File downloaded successfully
   *         content:
   *           application/octet-stream:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: Invalid file ID format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: File not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/:id/download', fileController.downloadFile.bind(fileController));

  /**
   * @swagger
   * /api/files/{id}/url:
   *   get:
   *     summary: Get file URL
   *     description: Get the accessible URL for a file
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: File ID (MongoDB ObjectId)
   *         example: 507f1f77bcf86cd799439011
   *     responses:
   *       200:
   *         description: File URL retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     url:
   *                       type: string
   *                       description: Accessible file URL
   *                       example: http://localhost:3000/files/1234567890.png
   *       400:
   *         description: Invalid file ID format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: File not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/:id/url', fileController.getFileUrl.bind(fileController));

  /**
   * @swagger
   * /api/files/{id}:
   *   delete:
   *     summary: Delete file
   *     description: Delete a file from storage and database
   *     tags: [Files]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: File ID (MongoDB ObjectId)
   *         example: 507f1f77bcf86cd799439011
   *     responses:
   *       200:
   *         description: File deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: File deleted successfully
   *       400:
   *         description: Invalid file ID format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: File not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.delete('/:id', fileController.deleteFile.bind(fileController));

  return router;
};

module.exports = createFileRoutes;
