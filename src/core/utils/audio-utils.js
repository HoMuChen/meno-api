/**
 * Audio Utilities
 * Helper functions for audio file metadata extraction using ffmpeg
 *
 * Supported Audio Formats:
 * - MP3 (audio/mpeg, audio/mp3) - MPEG Audio Layer III
 * - M4A/AAC (audio/mp4, audio/x-m4a, audio/m4a, audio/aac)
 * - WAV (audio/wav, audio/x-wav, audio/wave)
 * - WebM (audio/webm, video/webm)
 * - OGG (audio/ogg, audio/vorbis)
 * - FLAC (audio/flac, audio/x-flac)
 */
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

/**
 * Extract audio duration from file
 * @param {string} filePath - Path to audio file
 * @returns {Promise<number>} Duration in seconds
 */
async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Audio file not found: ${filePath}`));
    }

    // Set custom ffmpeg path if provided in environment
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    }
    if (process.env.FFPROBE_PATH) {
      ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to extract audio metadata: ${err.message}`));
      }

      if (!metadata || !metadata.format || !metadata.format.duration) {
        return reject(new Error('Audio duration not found in metadata'));
      }

      // Return duration rounded to 2 decimal places
      const duration = parseFloat(metadata.format.duration);

      // Handle invalid duration (NaN from browser-recorded audio)
      if (isNaN(duration)) {
        return resolve(null);
      }

      resolve(Math.round(duration * 100) / 100);
    });
  });
}

/**
 * Extract comprehensive audio metadata
 * @param {string} filePath - Path to audio file
 * @returns {Promise<Object>} Audio metadata object
 */
async function getAudioMetadata(filePath) {
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Audio file not found: ${filePath}`));
    }

    // Set custom ffmpeg path if provided in environment
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    }
    if (process.env.FFPROBE_PATH) {
      ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to extract audio metadata: ${err.message}`));
      }

      const format = metadata.format || {};
      const audioStream = (metadata.streams || []).find(s => s.codec_type === 'audio') || {};

      resolve({
        duration: format.duration ? Math.round(parseFloat(format.duration) * 100) / 100 : null,
        bitRate: format.bit_rate ? parseInt(format.bit_rate) : null,
        format: format.format_name || null,
        codec: audioStream.codec_name || null,
        sampleRate: audioStream.sample_rate ? parseInt(audioStream.sample_rate) : null,
        channels: audioStream.channels || null,
        size: format.size ? parseInt(format.size) : null
      });
    });
  });
}

/**
 * Extract audio duration from storage URI or file path
 * Supports both local file paths and storage URIs (gcs://, local://)
 *
 * Works with all supported audio formats including:
 * - MP3 (.mp3) - Full support via ffprobe
 * - M4A/AAC (.m4a, .aac)
 * - WAV (.wav)
 * - WebM (.webm)
 * - OGG (.ogg)
 * - FLAC (.flac)
 *
 * @param {string} filePathOrUri - Local file path or storage URI
 * @param {Object} storageProvider - Storage provider instance (optional, required for remote URIs)
 * @returns {Promise<number|null>} Duration in seconds or null if extraction fails
 */
async function getAudioDurationFromStorage(filePathOrUri, storageProvider = null) {
  const { withTempFile } = require('./temp-file-manager');

  // If it's a local file path, use existing method
  if (!filePathOrUri.includes('://')) {
    return getAudioDuration(filePathOrUri);
  }

  // Parse storage URI
  const uriMatch = filePathOrUri.match(/^(\w+):\/\//);
  if (!uriMatch) {
    throw new Error(`Invalid storage URI format: ${filePathOrUri}`);
  }

  const protocol = uriMatch[1];

  // Handle local:// URIs by extracting the local path
  if (protocol === 'local') {
    // local://bucket/path -> extract path after bucket
    const pathMatch = filePathOrUri.match(/^local:\/\/[^/]+\/(.+)$/);
    if (pathMatch) {
      const relativePath = pathMatch[1];
      // Construct full local path
      const basePath = process.env.LOCAL_STORAGE_PATH || './storage';
      const localPath = require('path').join(basePath, relativePath);
      return getAudioDuration(localPath);
    }
  }

  // Handle gcs:// URIs - download to temp and extract
  if (protocol === 'gcs') {
    if (!storageProvider || !storageProvider.downloadToTemp) {
      throw new Error('Storage provider with downloadToTemp method is required for GCS URIs');
    }

    let tempFilePath = null;

    try {
      // Download to temp location
      tempFilePath = await storageProvider.downloadToTemp(filePathOrUri);

      // Extract duration using temp file
      const duration = await withTempFile(tempFilePath, async (path) => {
        return getAudioDuration(path);
      });

      return duration;
    } catch (error) {
      // If temp file exists, it will be cleaned up by withTempFile
      throw new Error(`Failed to extract duration from GCS: ${error.message}`);
    }
  }

  throw new Error(`Unsupported storage protocol: ${protocol}`);
}

/**
 * Extract comprehensive audio metadata from storage URI or file path
 * Supports both local file paths and storage URIs (gcs://, local://)
 * @param {string} filePathOrUri - Local file path or storage URI
 * @param {Object} storageProvider - Storage provider instance (optional, required for remote URIs)
 * @returns {Promise<Object>} Audio metadata object
 */
async function getAudioMetadataFromStorage(filePathOrUri, storageProvider = null) {
  const { withTempFile } = require('./temp-file-manager');

  // If it's a local file path, use existing method
  if (!filePathOrUri.includes('://')) {
    return getAudioMetadata(filePathOrUri);
  }

  // Parse storage URI
  const uriMatch = filePathOrUri.match(/^(\w+):\/\//);
  if (!uriMatch) {
    throw new Error(`Invalid storage URI format: ${filePathOrUri}`);
  }

  const protocol = uriMatch[1];

  // Handle local:// URIs by extracting the local path
  if (protocol === 'local') {
    const pathMatch = filePathOrUri.match(/^local:\/\/[^/]+\/(.+)$/);
    if (pathMatch) {
      const relativePath = pathMatch[1];
      const basePath = process.env.LOCAL_STORAGE_PATH || './storage';
      const localPath = require('path').join(basePath, relativePath);
      return getAudioMetadata(localPath);
    }
  }

  // Handle gcs:// URIs - download to temp and extract
  if (protocol === 'gcs') {
    if (!storageProvider || !storageProvider.downloadToTemp) {
      throw new Error('Storage provider with downloadToTemp method is required for GCS URIs');
    }

    let tempFilePath = null;

    try {
      // Download to temp location
      tempFilePath = await storageProvider.downloadToTemp(filePathOrUri);

      // Extract metadata using temp file
      const metadata = await withTempFile(tempFilePath, async (path) => {
        return getAudioMetadata(path);
      });

      return metadata;
    } catch (error) {
      throw new Error(`Failed to extract metadata from GCS: ${error.message}`);
    }
  }

  throw new Error(`Unsupported storage protocol: ${protocol}`);
}

module.exports = {
  getAudioDuration,
  getAudioMetadata,
  getAudioDurationFromStorage,
  getAudioMetadataFromStorage
};
