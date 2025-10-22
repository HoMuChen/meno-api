/**
 * File Upload Middleware
 * Multer configuration for audio file uploads
 */
const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use configured storage path or default
    const uploadPath = process.env.LOCAL_STORAGE_PATH || './storage';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `audio-${uniqueSuffix}-${basename}${ext}`);
  }
});

// File filter - only allow audio files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/mpeg',      // MP3
    'audio/wav',       // WAV
    'audio/mp4',       // M4A
    'audio/webm',      // WebM
    'audio/ogg'        // OGG
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 104857600 // 100MB default
  }
});

// Single audio file upload
const uploadAudio = upload.single('audioFile');

// Error handling wrapper
const handleUpload = (req, res, next) => {
  uploadAudio(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `File size exceeds maximum allowed size of ${(parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 104857600) / 1024 / 1024}MB`
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      // Custom errors (like file type)
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    // Success - proceed to next middleware
    next();
  });
};

module.exports = {
  uploadAudio: handleUpload
};
