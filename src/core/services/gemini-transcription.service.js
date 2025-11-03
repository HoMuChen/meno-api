/**
 * Gemini Transcription Service
 * Google Gemini 2.5 Pro implementation with streaming API for long audio files
 * Handles real-time progress updates and incremental segment saving
 */
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TranscriptionService = require('./transcription.service');

class GeminiTranscriptionService extends TranscriptionService {
  constructor(logger, transcriptionDataService, meetingService) {
    super(logger);
    this.transcriptionDataService = transcriptionDataService;
    this.meetingService = meetingService;

    // Configuration
    this.apiKey = process.env.GEMINI_API_KEY;

    // Separate models for different operations
    // Transcription model: needs audio processing capabilities (e.g., gemini-2.5-pro, gemini-1.5-pro)
    // LLM model: text-only processing for summaries, analysis, etc. (can use faster/cheaper models like gemini-1.5-flash)
    this.transcriptionModel = process.env.GEMINI_TRANSCRIPTION_MODEL
      || process.env.GEMINI_MODEL
      || 'gemini-2.5-pro';

    this.model = process.env.GEMINI_MODEL
      || 'gemini-1.5-flash';

    this.streamTimeout = parseInt(process.env.GEMINI_STREAM_TIMEOUT) || 300000; // 5 min
    this.chunkStallTimeout = parseInt(process.env.GEMINI_CHUNK_STALL_TIMEOUT) || 30000; // 30s
    this.averageSegmentDuration = parseInt(process.env.AVERAGE_SEGMENT_DURATION) || 5000; // 5s

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    // Initialize Gemini client
    this.genAI = new GoogleGenerativeAI(this.apiKey);

    // Log model configuration
    logger.info('Gemini service initialized with models', {
      transcriptionModel: this.transcriptionModel,
      model: this.model
    });
  }

  /**
   * Transcribe audio file using Gemini streaming API
   * Processes long audio files without timeout by streaming results
   * @param {string} audioFilePath - Path to audio file
   * @param {string} meetingId - Meeting ID for progress tracking
   * @param {Object} options - Transcription options
   * @returns {Promise<Array>} Array of transcription segments
   */
  async transcribeAudio(audioFilePath, meetingId, options = {}) {
    try {
      this.logger.info('Starting Gemini transcription', {
        audioFilePath,
        meetingId,
        model: this.transcriptionModel
      });

      // Update status to processing
      await this._updateMeetingStatus(meetingId, 'processing', 0);

      // Get audio file info
      const audioBuffer = fs.readFileSync(audioFilePath);
      const mimeType = this._detectMimeType(audioFilePath);

      // Calculate estimated total segments for progress
      const meeting = await this.meetingService.getMeetingById(meetingId);
      const estimatedTotal = this._calculateEstimatedSegments(meeting.duration);

      // Calculate audio duration in milliseconds for LLM context
      const durationMs = meeting.duration ? Math.round(meeting.duration * 1000) : null;

      await this._updateTranscriptionMetadata(meetingId, {
        startedAt: new Date(),
        audioDuration: meeting.duration, // in seconds
        audioDurationMs: durationMs, // in milliseconds
        estimatedTotal,
        processedSegments: 0
      });

      // Initialize Gemini model for transcription (requires audio processing capabilities)
      const model = this.genAI.getGenerativeModel({ model: this.transcriptionModel });
      const durationInfo = durationMs
        ? `\n\n** AUDIO DURATION: ${meeting.duration} seconds (${durationMs} milliseconds) **`
        : '';

      // Prepare streaming request with newline-delimited JSON format for true incremental processing
      const prompt = `Transcribe this audio file with speaker diarization and timestamps.${durationInfo}

CRITICAL: Return the transcription as NEWLINE-DELIMITED JSON where EACH LINE is a separate JSON object.

Each line must be a complete, valid JSON object with these fields:
- startTime: start timestamp in milliseconds
- endTime: end timestamp in milliseconds
- speaker: speaker identifier (e.g., "SPEAKER_01", "SPEAKER_02")
- text: the transcribed text

IMPORTANT TIMESTAMP REQUIREMENTS:${durationMs ? `
- All startTime values MUST be between 0 and ${durationMs} milliseconds
- All endTime values MUST be between 0 and ${durationMs} milliseconds
- Timestamps MUST progress chronologically (each segment starts at or after the previous segment ends)
- Expected approximately ${estimatedTotal} segments total
- Ensure timestamps are accurately distributed across the entire audio duration` : `
- Timestamps must progress chronologically
- Ensure accurate timestamp distribution`}

IMPORTANT FORMAT REQUIREMENTS:
- Output ONE JSON object per line
- NO array brackets [ ]
- NO commas between objects
- Each line is a standalone valid JSON object
- Separate objects with newlines only

Example correct format:
{"startTime":0,"endTime":3000,"speaker":"SPEAKER_01","text":"Hello everyone"}
{"startTime":3000,"endTime":6000,"speaker":"SPEAKER_02","text":"Hi there"}
{"startTime":6000,"endTime":9000,"speaker":"SPEAKER_01","text":"Let's begin"}

Do NOT use array format. Each line must be parseable independently.`;

      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: audioBuffer.toString('base64')
          }
        }
      ];

      // Start streaming
      const result = await model.generateContentStream({ contents: [{ role: 'user', parts }] });

      const segments = [];
      let processedSegments = 0;
      let lineBuffer = ''; // Buffer for incomplete lines between chunks
      let segmentBuffer = null; // Buffer for merging consecutive same-speaker segments
      let lastEndTime = 0; // Track last segment's end time for monotonic validation
      let lastChunkTime = Date.now();

      // Set up stall detection
      const stallCheckInterval = setInterval(() => {
        const elapsed = Date.now() - lastChunkTime;
        if (elapsed > this.chunkStallTimeout) {
          this.logger.warn('Stream stalled', {
            meetingId,
            elapsedMs: elapsed,
            processedSegments
          });
        }
      }, this.chunkStallTimeout);

      // Process streaming chunks with line-by-line parsing for true incremental processing
      for await (const chunk of result.stream) {
        lastChunkTime = Date.now();

        const chunkText = chunk.text();
        if (!chunkText) continue;

        // Parse with buffer management (handles incomplete lines across chunks)
        const { segments: parsedSegments, buffer: newBuffer } =
          this._parseStreamingChunks(chunkText, lineBuffer);

        lineBuffer = newBuffer; // Update buffer with incomplete line for next chunk

        if (parsedSegments.length > 0) {
          this.logger.debug('Parsed segments from chunk', {
            meetingId,
            segmentCount: parsedSegments.length,
            bufferSize: lineBuffer.length
          });

          // Process new segments with speaker merging and timestamp validation
          for (const rawSegment of parsedSegments) {
            const segment = this._mapGeminiSegment(rawSegment, durationMs, lastEndTime);
            segments.push(segment);
            lastEndTime = segment.endTime; // Update for next iteration

            // Merge consecutive segments with same speaker
            if (!segmentBuffer) {
              // First segment - initialize buffer
              segmentBuffer = { ...segment };
            } else if (segmentBuffer.speaker === segment.speaker &&
                       (segment.endTime - segmentBuffer.startTime) <= 30000) {
              // Same speaker AND duration < 30s - merge by extending endTime and appending text
              segmentBuffer.endTime = segment.endTime;
              segmentBuffer.text = segmentBuffer.text + ' ' + segment.text;
            } else {
              // Different speaker OR duration >= 30s - flush buffer and start new one
              try {
                await this.transcriptionDataService.saveTranscriptions(meetingId, [segmentBuffer]);
                processedSegments++;

                // Update progress in real-time
                const progress = Math.min(95, Math.floor((processedSegments / estimatedTotal) * 100));
                await this._updateMeetingProgress(meetingId, progress, processedSegments);

                const flushReason = segmentBuffer.speaker !== segment.speaker ? 'speaker_change' : 'duration_limit';
                this.logger.debug('Merged segment saved', {
                  meetingId,
                  segmentIndex: processedSegments,
                  progress,
                  speaker: segmentBuffer.speaker,
                  duration: segmentBuffer.endTime - segmentBuffer.startTime,
                  reason: flushReason,
                  textPreview: segmentBuffer.text.substring(0, 50)
                });
              } catch (saveError) {
                this.logger.error('Error saving merged segment', {
                  error: saveError.message,
                  meetingId,
                  segmentIndex: processedSegments
                });
              }

              // Start new buffer with current segment
              segmentBuffer = { ...segment };
            }
          }
        }

        await this._updateTranscriptionMetadata(meetingId, {
          lastChunkAt: new Date()
        });
      }

      // Process any remaining buffered content after stream ends
      if (lineBuffer.trim()) {
        this.logger.info('Processing remaining buffered content', {
          meetingId,
          bufferSize: lineBuffer.length
        });

        // Add final newline to trigger parsing of last line
        const { segments: finalSegments } = this._parseStreamingChunks('\n', lineBuffer);

        if (finalSegments.length > 0) {
          for (const rawSegment of finalSegments) {
            const segment = this._mapGeminiSegment(rawSegment, durationMs, lastEndTime);
            segments.push(segment);
            lastEndTime = segment.endTime; // Update for next iteration

            // Apply same merging logic to final segments
            if (!segmentBuffer) {
              segmentBuffer = { ...segment };
            } else if (segmentBuffer.speaker === segment.speaker &&
                       (segment.endTime - segmentBuffer.startTime) <= 30000) {
              segmentBuffer.endTime = segment.endTime;
              segmentBuffer.text = segmentBuffer.text + ' ' + segment.text;
            } else {
              try {
                await this.transcriptionDataService.saveTranscriptions(meetingId, [segmentBuffer]);
                processedSegments++;

                const progress = Math.min(95, Math.floor((processedSegments / estimatedTotal) * 100));
                await this._updateMeetingProgress(meetingId, progress, processedSegments);

                const flushReason = segmentBuffer.speaker !== segment.speaker ? 'speaker_change' : 'duration_limit';
                this.logger.debug('Final merged segment saved', {
                  meetingId,
                  segmentIndex: processedSegments,
                  speaker: segmentBuffer.speaker,
                  duration: segmentBuffer.endTime - segmentBuffer.startTime,
                  reason: flushReason
                });
              } catch (saveError) {
                this.logger.error('Error saving final merged segment', {
                  error: saveError.message,
                  meetingId,
                  segmentIndex: processedSegments
                });
              }

              segmentBuffer = { ...segment };
            }
          }
        }
      }

      // Flush the final segmentBuffer if it exists
      if (segmentBuffer) {
        try {
          await this.transcriptionDataService.saveTranscriptions(meetingId, [segmentBuffer]);
          processedSegments++;

          this.logger.info('Final segment buffer flushed', {
            meetingId,
            speaker: segmentBuffer.speaker,
            duration: segmentBuffer.endTime - segmentBuffer.startTime,
            reason: 'final_flush'
          });
        } catch (saveError) {
          this.logger.error('Error flushing final segment buffer', {
            error: saveError.message,
            meetingId
          });
        }
      }

      clearInterval(stallCheckInterval);

      // Generate title and description from transcription
      this.logger.info('Generating meeting title and description from transcription', { meetingId });
      try {
        const summary = await this.generateTitleAndDescription(meetingId);

        // Update meeting with generated title and description
        const meetingDoc = await this.meetingService._getMeetingByIdInternal(meetingId);
        meetingDoc.title = summary.title;
        meetingDoc.description = summary.description;
        await meetingDoc.save();

        this.logger.info('Meeting updated with auto-generated title and description', {
          meetingId,
          title: summary.title,
          hasDescription: !!summary.description
        });
      } catch (summaryError) {
        // Log but don't fail transcription if summary generation fails
        this.logger.warn('Failed to generate title/description, continuing with transcription completion', {
          meetingId,
          error: summaryError.message
        });
      }

      // Finalize
      await this._updateMeetingStatus(meetingId, 'completed', 100);
      await this._updateTranscriptionMetadata(meetingId, {
        completedAt: new Date()
      });

      this.logger.info('Gemini transcription completed', {
        meetingId,
        segmentsCount: segments.length,
        processedSegments
      });

      return segments;

    } catch (error) {
      this.logger.error('Gemini transcription error', {
        error: error.message,
        stack: error.stack,
        meetingId,
        audioFilePath
      });

      // Update status to failed
      await this._updateMeetingStatus(meetingId, 'failed', 0, error.message);

      throw error;
    }
  }

  /**
   * Parse streaming chunks line-by-line for incremental processing
   * Handles newline-delimited JSON format where each line is a complete segment
   * @param {string} text - New text chunk from stream
   * @param {string} buffer - Buffered incomplete line from previous chunk
   * @returns {Object} { segments: Array, buffer: string }
   */
  _parseStreamingChunks(text, buffer = '') {
    try {
      // Combine buffer with new text
      const fullText = buffer + text;

      // Split by newlines to get individual JSON objects
      const lines = fullText.split('\n');

      // Keep last line as buffer (might be incomplete/partial)
      const incompleteLineBuffer = lines.pop() || '';

      // Parse each complete line as JSON
      const segments = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue; // Skip empty lines

        // Remove markdown code blocks if present
        let cleaned = trimmed.replace(/```json\n?/g, '').replace(/```\n?$/g, '');

        // Handle potential array format (fallback for backward compatibility)
        if (cleaned.startsWith('[')) {
          // Try parsing as array
          try {
            const arrayParsed = JSON.parse(cleaned);
            if (Array.isArray(arrayParsed)) {
              segments.push(...arrayParsed);
              continue;
            }
          } catch (e) {
            // Not a valid array, try as single object
          }
        }

        // Remove trailing commas or array brackets (in case of mixed format)
        cleaned = cleaned.replace(/,\s*$/, '').replace(/^\[|\]$/g, '');

        try {
          const segment = JSON.parse(cleaned);
          if (segment && typeof segment === 'object' && !Array.isArray(segment)) {
            segments.push(segment);
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse line as JSON', {
            line: cleaned.substring(0, 100),
            error: parseError.message
          });
          // Continue processing other lines
        }
      }

      return { segments, buffer: incompleteLineBuffer };
    } catch (error) {
      this.logger.error('Error parsing streaming chunks', {
        error: error.message,
        stack: error.stack
      });
      // Return empty segments but preserve text in buffer for next attempt
      return { segments: [], buffer: buffer + text };
    }
  }

  /**
   * Map Gemini segment format to application format with timestamp validation
   * @param {Object} geminiSegment - Segment from Gemini API
   * @param {number} durationMs - Audio duration in milliseconds (optional, for validation)
   * @param {number} lastEndTime - End time of previous segment (optional, for monotonic validation)
   * @returns {Object} Mapped segment
   */
  _mapGeminiSegment(geminiSegment, durationMs = null, lastEndTime = null) {
    let startTime = geminiSegment.startTime || 0;
    let endTime = geminiSegment.endTime || 0;

    // Validate and correct timestamps if duration is provided
    if (durationMs !== null && durationMs > 0) {
      const originalStart = startTime;
      const originalEnd = endTime;

      // Cap startTime at duration
      if (startTime > durationMs) {
        this.logger.warn('Segment startTime exceeds audio duration, capping to duration', {
          originalStart: startTime,
          cappedStart: durationMs,
          duration: durationMs,
          text: geminiSegment.text?.substring(0, 50)
        });
        startTime = durationMs;
      }

      // Cap endTime at duration
      if (endTime > durationMs) {
        this.logger.warn('Segment endTime exceeds audio duration, capping to duration', {
          originalEnd: endTime,
          cappedEnd: durationMs,
          duration: durationMs,
          text: geminiSegment.text?.substring(0, 50)
        });
        endTime = durationMs;
      }

      // Ensure endTime > startTime
      if (endTime <= startTime) {
        this.logger.warn('Invalid segment: endTime <= startTime, adjusting', {
          startTime,
          endTime,
          text: geminiSegment.text?.substring(0, 50)
        });
        // Set a minimum 1-second segment duration
        endTime = Math.min(startTime + 1000, durationMs);
      }

      // Validate monotonic progression if lastEndTime provided
      if (lastEndTime !== null && startTime < lastEndTime) {
        this.logger.warn('Segment startTime before previous endTime, adjusting', {
          originalStart: startTime,
          adjustedStart: lastEndTime,
          lastEndTime,
          text: geminiSegment.text?.substring(0, 50)
        });
        startTime = lastEndTime;
        // Ensure endTime is still after adjusted startTime
        if (endTime <= startTime) {
          endTime = Math.min(startTime + 1000, durationMs);
        }
      }
    }

    return {
      startTime,
      endTime,
      speaker: this._mapSpeakerLabel(geminiSegment.speaker),
      text: geminiSegment.text || ''
    };
  }

  /**
   * Map Gemini speaker labels to app format
   * @param {string} speakerLabel - Gemini speaker label (e.g., "SPEAKER_01")
   * @returns {string} Mapped speaker name (e.g., "Speaker 1")
   */
  _mapSpeakerLabel(speakerLabel) {
    if (!speakerLabel) return 'Unknown Speaker';

    // Convert SPEAKER_01 → Speaker 1
    const match = speakerLabel.match(/SPEAKER[_\s](\d+)/i);
    if (match) {
      return `Speaker ${parseInt(match[1])}`;
    }

    return speakerLabel;
  }

  /**
   * Calculate estimated number of segments based on audio duration
   * @param {number} durationSeconds - Audio duration in seconds
   * @returns {number} Estimated segment count
   */
  _calculateEstimatedSegments(durationSeconds) {
    if (!durationSeconds) return 100; // Default fallback

    const durationMs = durationSeconds * 1000;
    return Math.ceil(durationMs / this.averageSegmentDuration);
  }

  /**
   * Detect MIME type from file extension
   * @param {string} filePath - Audio file path
   * @returns {string} MIME type
   */
  _detectMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();

    const mimeTypes = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'wave': 'audio/wav',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'webm': 'audio/webm',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac'
    };

    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * Update meeting status and progress
   * @param {string} meetingId - Meeting ID
   * @param {string} status - New status
   * @param {number} progress - Progress percentage
   * @param {string} errorMessage - Optional error message
   */
  async _updateMeetingStatus(meetingId, status, progress, errorMessage = null) {
    try {
      const meeting = await this.meetingService.getMeetingById(meetingId);
      meeting.transcriptionStatus = status;
      meeting.transcriptionProgress = progress;

      if (errorMessage) {
        meeting.metadata = meeting.metadata || {};
        meeting.metadata.transcription = meeting.metadata.transcription || {};
        meeting.metadata.transcription.errorMessage = errorMessage;
      }

      await meeting.save();
    } catch (error) {
      this.logger.error('Error updating meeting status', {
        error: error.message,
        meetingId
      });
    }
  }

  /**
   * Update meeting progress
   * @param {string} meetingId - Meeting ID
   * @param {number} progress - Progress percentage
   * @param {number} processedSegments - Number of processed segments
   */
  async _updateMeetingProgress(meetingId, progress, processedSegments) {
    try {
      const meeting = await this.meetingService.getMeetingById(meetingId);
      meeting.transcriptionProgress = progress;

      meeting.metadata = meeting.metadata || {};
      meeting.metadata.transcription = meeting.metadata.transcription || {};
      meeting.metadata.transcription.processedSegments = processedSegments;

      await meeting.save();
    } catch (error) {
      this.logger.error('Error updating meeting progress', {
        error: error.message,
        meetingId
      });
    }
  }

  /**
   * Update transcription metadata
   * @param {string} meetingId - Meeting ID
   * @param {Object} updates - Metadata updates
   */
  async _updateTranscriptionMetadata(meetingId, updates) {
    try {
      const meeting = await this.meetingService.getMeetingById(meetingId);

      meeting.metadata = meeting.metadata || {};
      meeting.metadata.transcription = meeting.metadata.transcription || {};

      Object.assign(meeting.metadata.transcription, updates);

      await meeting.save();
    } catch (error) {
      this.logger.error('Error updating transcription metadata', {
        error: error.message,
        meetingId
      });
    }
  }

  /**
   * Generate meeting title and description from transcription
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object>} Generated title and description
   */
  async generateTitleAndDescription(meetingId) {
    try {
      this.logger.info('Generating meeting title and description', {
        meetingId,
        model: this.model
      });

      // Get all transcription segments
      const transcriptionData = await this.transcriptionDataService.getTranscriptions(meetingId, {
        page: 1,
        limit: 1000,
        sort: 'startTime'
      });

      if (!transcriptionData.transcriptions || transcriptionData.transcriptions.length === 0) {
        throw new Error('No transcriptions found for meeting');
      }

      // Combine all transcription text
      const fullTranscript = transcriptionData.transcriptions
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      // Use Gemini to generate title and description (text-only processing)
      const model = this.genAI.getGenerativeModel({ model: this.model });

      const prompt = `Based on this meeting transcript, generate a concise title and description.

IMPORTANT: Generate the title and description in the SAME LANGUAGE as the transcript text. If the transcript is in Chinese, respond in Chinese. If it's in English, respond in English, etc.

Transcript:
${fullTranscript.substring(0, 10000)} ${fullTranscript.length > 10000 ? '...(truncated)' : ''}

Return ONLY a JSON object with this exact structure:
{
  "title": "A short, descriptive title (max 100 characters) - MUST be in the same language as the transcript",
  "description": "A brief summary of the key topics and outcomes (max 500 characters) - MUST be in the same language as the transcript"
}

Do not include any markdown formatting or code blocks, just the JSON object.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      let cleanText = text.trim();
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const summary = JSON.parse(cleanText);

      this.logger.info('Meeting title and description generated', {
        meetingId,
        title: summary.title,
        descriptionLength: summary.description?.length || 0
      });

      return {
        title: summary.title || 'Untitled Meeting',
        description: summary.description || ''
      };
    } catch (error) {
      this.logger.error('Error generating meeting title and description', {
        error: error.message,
        stack: error.stack,
        meetingId
      });

      // Return fallback values
      return {
        title: 'Meeting',
        description: ''
      };
    }
  }

  /**
   * Generate meeting title and description with streaming
   * @param {string} meetingId - Meeting ID
   * @returns {AsyncGenerator} Async generator yielding text chunks
   */
  async* generateSummaryStream(meetingId) {
    try {
      this.logger.info('Generating meeting summary with streaming', {
        meetingId,
        model: this.model
      });

      // Get all transcription segments
      const transcriptionData = await this.transcriptionDataService.getTranscriptions(meetingId, {
        page: 1,
        limit: 1000,
        sort: 'startTime'
      });

      if (!transcriptionData.transcriptions || transcriptionData.transcriptions.length === 0) {
        throw new Error('No transcriptions found for meeting');
      }

      // Combine all transcription text
      const fullTranscript = transcriptionData.transcriptions
        .map(t => `${t.speaker}: ${t.text}`)
        .join('\n');

      // Use Gemini to generate summary with streaming (text-only processing)
      const model = this.genAI.getGenerativeModel({ model: this.model });

      const prompt = `**CRITICAL REQUIREMENTS:**
1. You MUST generate the entire summary in the EXACT SAME LANGUAGE as the transcript below
2. You MUST format the output as MARKDOWN TEXT ONLY

**Language Requirement:**
For example:
- If the transcript is in Chinese (中文), write the ENTIRE summary in Chinese (中文)
- If the transcript is in English, write the ENTIRE summary in English
- If the transcript is in Spanish, write the ENTIRE summary in Spanish
- And so on for any other language

**DO NOT translate the transcript language. Use the SAME language for ALL sections.**

**Format Requirement:**
You MUST use MARKDOWN format with proper headings (##), bullet points (-), and text formatting.
DO NOT use JSON, code blocks, or any other format.

Transcript:
${fullTranscript.substring(0, 10000)} ${fullTranscript.length > 10000 ? '...(truncated)' : ''}

Based on this meeting transcript, generate a comprehensive summary in MARKDOWN FORMAT using the SAME LANGUAGE as the transcript above.

Generate a structured markdown summary with the following sections (section headers in same language as transcript):

## Overview
A brief 2-3 sentence overview of what was discussed in the meeting.

## Key Points
- List the main topics and decisions made
- Include important discussion points
- Highlight any agreements or consensus reached

## Conclusion
Summarize the final outcomes and what was agreed upon.

## Action Items
- List specific tasks that need to be done
- Include who is responsible (if mentioned)
- Note any deadlines or priorities (if mentioned)

**REMINDERS:**
- Write the ENTIRE summary (including all section content) in the SAME LANGUAGE as the transcript above
- Use MARKDOWN FORMAT ONLY (## for headings, - for bullet points)
- Return ONLY the markdown text - NO code blocks, NO JSON, NO other formatting`;

      const result = await model.generateContentStream(prompt);

      // Stream chunks as they arrive
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }

      this.logger.info('Meeting summary streaming completed', { meetingId });
    } catch (error) {
      this.logger.error('Error generating meeting summary stream', {
        error: error.message,
        stack: error.stack,
        meetingId
      });
      throw error;
    }
  }

  /**
   * Generate action items from meeting transcription using LLM
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Array>} Array of action items (without meetingId/personId set)
   */
  async generateActionItems(meetingId) {
    try {
      this.logger.info('Generating action items', {
        meetingId,
        model: this.model
      });

      // Get meeting details for context (including createdAt)
      const meeting = await this.meetingService.getMeetingById(meetingId);
      const meetingDateTime = meeting.createdAt || new Date();
      const usedFallback = !meeting.createdAt;

      this.logger.info('Meeting datetime for action items context', {
        meetingId,
        createdAt: meeting.createdAt,
        meetingDateTimeISO: meetingDateTime.toISOString(),
        usedFallback,
        currentDateTimeISO: new Date().toISOString()
      });

      // Get all transcription segments
      const transcriptionData = await this.transcriptionDataService.getTranscriptions(meetingId, {
        page: 1,
        limit: 1000,
        sort: 'startTime'
      });

      if (!transcriptionData.transcriptions || transcriptionData.transcriptions.length === 0) {
        throw new Error('No transcriptions found for meeting');
      }

      // Get Transcription model to populate personId
      const Transcription = require('../../models/transcription.model');
      const transcriptionsWithPeople = await Transcription.find({
        _id: { $in: transcriptionData.transcriptions.map(t => t._id) }
      }).populate('personId', 'name');

      // Extract unique people from transcriptions (only those with personId)
      const peopleInTranscript = [...new Set(
        transcriptionsWithPeople
          .filter(t => t.personId && t.personId.name)
          .map(t => t.personId.name)
      )];

      // Build transcript using personId.name first, fallback to speaker field
      const fullTranscript = transcriptionsWithPeople
        .map(t => {
          const speakerName = t.personId?.name || t.speaker;
          return `${speakerName}: ${t.text}`;
        })
        .join('\n');

      // Use Gemini to extract action items (text-only processing)
      const model = this.genAI.getGenerativeModel({ model: this.model });

      const prompt = `Based on this meeting transcript, extract action items.

**CRITICAL: This meeting occurred on ${meetingDateTime.toISOString()}**

When calculating due dates, you MUST use ${meetingDateTime.toISOString()} as your reference point, NOT the current date/time.

IMPORTANT: Generate the action items in the SAME LANGUAGE as the transcript text.

${peopleInTranscript.length > 0 ? `Available People (for assignee matching):
${peopleInTranscript.map(name => `- ${name}`).join('\n')}
` : ''}
Transcript:
${fullTranscript.substring(0, 15000)} ${fullTranscript.length > 15000 ? '...(truncated)' : ''}

Return ONLY a JSON array with this exact structure:
[
  {
    "task": "Brief description of the action item - in same language as transcript",
    "assignee": "Person responsible (use name from Available People list if mentioned, otherwise null)",
    "dueDate": "ISO 8601 datetime string (e.g., '2024-01-15T09:00:00.000Z') if deadline mentioned, otherwise null",
    "context": "Brief context or related discussion point (optional)"
  }
]

Guidelines:
- Only include explicit action items or clear commitments
- Include implicit tasks if strongly indicated by the discussion
- Match assignee to Available People list when possible
- **CRITICAL FOR dueDate**: Calculate all relative dates from the MEETING DATE (${meetingDateTime.toISOString()}), NOT from today
- Examples of date calculation (assuming meeting date is ${meetingDateTime.toISOString()}):
  * "by next week" = 7 days AFTER the meeting date
  * "in 3 days" = 3 days AFTER the meeting date
  * "by Friday" = the Friday AFTER the meeting date
  * "tomorrow" = 1 day AFTER the meeting date
- For dueDate: If no specific deadline is mentioned, set to null
- Prioritize based on discussion urgency
- Return empty array [] if no action items found
- DO NOT include markdown formatting or code blocks
- MUST use the same language as the transcript for all text fields
- Return valid JSON only`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      let cleanText = text.trim();
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const actionItems = JSON.parse(cleanText);

      this.logger.info('Action items generated', {
        meetingId,
        count: Array.isArray(actionItems) ? actionItems.length : 0
      });

      return Array.isArray(actionItems) ? actionItems : [];
    } catch (error) {
      this.logger.error('Error generating action items', {
        error: error.message,
        stack: error.stack,
        meetingId
      });

      // Return empty array on error
      return [];
    }
  }

  /**
   * Estimate transcription time based on audio duration
   * @param {number} audioDuration - Audio duration in seconds
   * @returns {number} Estimated time in seconds
   */
  estimateTranscriptionTime(audioDuration) {
    // Gemini typically processes at ~0.08x speed (1 hour audio = ~5 minutes)
    return Math.ceil(audioDuration * 0.08);
  }
}

module.exports = GeminiTranscriptionService;
