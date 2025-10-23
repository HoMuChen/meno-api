/**
 * Audio Utilities
 * Helper functions for audio file metadata extraction using ffmpeg
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

module.exports = {
  getAudioDuration,
  getAudioMetadata
};
