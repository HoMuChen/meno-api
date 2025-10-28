/**
 * Temporary File Manager
 * Utility for safe temporary file management with automatic cleanup
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Track temporary files for cleanup
const tempFiles = new Set();

/**
 * Delete a temporary file safely
 * @param {string} filePath - Path to temporary file
 * @returns {Promise<boolean>} Success status
 */
async function deleteTempFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return true; // Already deleted or doesn't exist
  }

  try {
    await fs.promises.unlink(filePath);
    tempFiles.delete(filePath);
    return true;
  } catch (error) {
    // Ignore errors for non-existent files
    if (error.code === 'ENOENT') {
      tempFiles.delete(filePath);
      return true;
    }
    console.error('Failed to delete temp file:', {
      filePath,
      error: error.message
    });
    return false;
  }
}

/**
 * Delete a temporary file synchronously (for cleanup handlers)
 * @param {string} filePath - Path to temporary file
 * @returns {boolean} Success status
 */
function deleteTempFileSync(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return true;
  }

  try {
    fs.unlinkSync(filePath);
    tempFiles.delete(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      tempFiles.delete(filePath);
      return true;
    }
    console.error('Failed to delete temp file synchronously:', {
      filePath,
      error: error.message
    });
    return false;
  }
}

/**
 * Register a temporary file for cleanup tracking
 * @param {string} filePath - Path to temporary file
 */
function registerTempFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    tempFiles.add(filePath);
  }
}

/**
 * Clean up all tracked temporary files
 */
function cleanupAllTempFiles() {
  const files = Array.from(tempFiles);
  let cleaned = 0;
  let failed = 0;

  for (const filePath of files) {
    if (deleteTempFileSync(filePath)) {
      cleaned++;
    } else {
      failed++;
    }
  }

  if (cleaned > 0 || failed > 0) {
    console.log('Temp file cleanup:', { cleaned, failed, total: files.length });
  }
}

/**
 * Execute a function with a temporary file, ensuring cleanup afterward
 * @param {string} tempFilePath - Path to temporary file
 * @param {Function} fn - Function to execute with temp file
 * @returns {Promise<any>} Result from function
 */
async function withTempFile(tempFilePath, fn) {
  registerTempFile(tempFilePath);

  try {
    const result = await fn(tempFilePath);
    return result;
  } finally {
    // Always cleanup, even if function throws
    await deleteTempFile(tempFilePath);
  }
}

/**
 * Generate a unique temporary file path
 * @param {string} prefix - Prefix for temp file name
 * @param {string} extension - File extension (with dot, e.g., '.m4a')
 * @returns {string} Temporary file path
 */
function generateTempPath(prefix = 'temp', extension = '') {
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const fileName = `${prefix}-${timestamp}-${random}${extension}`;
  return path.join(tempDir, fileName);
}

// Register cleanup handlers
let cleanupHandlersRegistered = false;

function registerCleanupHandlers() {
  if (cleanupHandlersRegistered) return;

  // Clean up temp files on process exit
  process.on('exit', () => {
    cleanupAllTempFiles();
  });

  // Clean up on uncaught exception
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception, cleaning up temp files:', error.message);
    cleanupAllTempFiles();
  });

  // Clean up on unhandled promise rejection
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection, cleaning up temp files:', reason);
    cleanupAllTempFiles();
  });

  // Clean up on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\nSIGINT received, cleaning up temp files...');
    cleanupAllTempFiles();
    process.exit(0);
  });

  // Clean up on SIGTERM
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, cleaning up temp files...');
    cleanupAllTempFiles();
    process.exit(0);
  });

  cleanupHandlersRegistered = true;
}

// Auto-register cleanup handlers
registerCleanupHandlers();

module.exports = {
  deleteTempFile,
  deleteTempFileSync,
  registerTempFile,
  cleanupAllTempFiles,
  withTempFile,
  generateTempPath
};
