/**
 * LINE Message Builder
 * Utilities for building LINE Flex Messages and other message types
 */

/**
 * Format duration from seconds to human-readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "2m 30s", "1h 15m")
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
}

/**
 * Build welcome message for new users
 * @param {string} userName - User's name
 * @returns {Object} LINE text message
 */
function buildWelcomeMessage(userName) {
  return {
    type: 'text',
    text: `👋 Welcome to Meno, ${userName}!\n\nTo get started, please link your Meno account:\n\n1. Log in to Meno web app\n2. Go to Settings → Integrations\n3. Click "Connect LINE"\n4. Send the 6-digit code here\n\nOnce linked, you can send audio messages to create meetings!`,
  };
}

/**
 * Build linking instructions message
 * @returns {Object} LINE text message
 */
function buildLinkingInstructions() {
  return {
    type: 'text',
    text: '🔗 To link your Meno account:\n\n1. Log in to your Meno account at the web app\n2. Navigate to Settings → Integrations\n3. Click "Connect LINE"\n4. Send the 6-digit code you receive here\n\nThe code will expire in 5 minutes.',
  };
}

/**
 * Build linking success message
 * @param {string} userEmail - Linked user's email
 * @returns {Object} LINE text message
 */
function buildLinkingSuccessMessage(userEmail) {
  return {
    type: 'text',
    text: `✅ Successfully linked to ${userEmail}!\n\nYou can now:\n• Send voice messages to create meetings\n• Upload audio files\n\nAll meetings will be automatically transcribed and saved to your Meno account.`,
  };
}

/**
 * Build meeting created Flex Message with web link button
 * @param {Object} meeting - Meeting object
 * @param {string} webAppUrl - Web app base URL
 * @returns {Object} LINE Flex Message
 */
function buildMeetingCreatedMessage(meeting, webAppUrl) {
  const projectId = meeting.projectId?._id || meeting.projectId;
  const meetingId = meeting._id || meeting.id;
  const meetingUrl = `${webAppUrl}/projects/${projectId}/meetings/${meetingId}`;

  return {
    type: 'flex',
    altText: '✓ Meeting created',
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '🎙️',
                size: 'xl',
                flex: 0,
              },
              {
                type: 'text',
                text: meeting.title || 'New Meeting',
                weight: 'bold',
                size: 'md',
                color: '#1a1a1a',
                margin: 'md',
                wrap: true,
                maxLines: 1,
              },
            ],
            paddingAll: '16px',
            paddingBottom: '8px',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'Processing',
                    size: 'xs',
                    color: '#94a3b8',
                    align: 'center',
                  },
                ],
                flex: 1,
                paddingAll: '10px',
                backgroundColor: '#f1f5f9',
                cornerRadius: '4px',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: formatDuration(meeting.duration),
                    size: 'xs',
                    color: '#64748b',
                    align: 'center',
                    weight: 'bold',
                  },
                ],
                flex: 1,
                paddingAll: '10px',
                backgroundColor: '#f8fafc',
                cornerRadius: '4px',
                action: {
                  type: 'uri',
                  uri: meetingUrl,
                },
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'View →',
                    size: 'xs',
                    color: '#ffffff',
                    align: 'center',
                    weight: 'bold',
                  },
                ],
                flex: 1,
                paddingAll: '10px',
                backgroundColor: '#1a1a1a',
                cornerRadius: '4px',
                action: {
                  type: 'uri',
                  uri: meetingUrl,
                },
              },
            ],
            spacing: 'sm',
            paddingAll: '16px',
            paddingTop: '8px',
          },
        ],
        paddingAll: '0px',
        spacing: 'none',
      },
    },
  };
}

/**
 * Build error message for various error scenarios
 * @param {string} errorType - Type of error
 * @param {Object} details - Additional error details
 * @returns {Object} LINE text message
 */
function buildErrorMessage(errorType, details = {}) {
  const errorMessages = {
    not_linked: `⚠️ Account Not Linked\n\nPlease link your Meno account first:\n\n1. Log in to Meno web app\n2. Go to Settings → Integrations\n3. Click "Connect LINE"\n4. Send the 6-digit code here`,

    usage_limit: `⚠️ Monthly Limit Reached\n\nYou've reached your monthly audio duration limit.\n\nTo continue using Meno:\n• Upgrade your plan in the web app\n• Wait for your limit to reset next month\n\nVisit: ${details.webAppUrl}/settings/billing`,

    invalid_token: `❌ Invalid Code\n\nThe code you entered is invalid or has expired.\n\nPlease:\n1. Get a new code from the web app\n2. Send it here within 5 minutes`,

    download_failed: `❌ Processing Failed\n\nWe couldn't process your audio file. This might be due to:\n• Network issues\n• Unsupported file format\n\nPlease try again or contact support if the issue persists.`,

    unsupported_type: `⚠️ Unsupported Content\n\nPlease send audio content only:\n• Voice messages\n• Audio files (MP3, M4A, WAV, etc.)\n\nImages, videos, and other file types are not supported.`,

    processing_error: `❌ Processing Error\n\n${details.message || 'An error occurred while processing your request.'}\n\nPlease try again later or contact support if the issue persists.`,

    default: `❌ Error\n\nAn unexpected error occurred. Please try again later.\n\nIf the problem persists, please contact support.`,
  };

  const message = errorMessages[errorType] || errorMessages.default;

  return {
    type: 'text',
    text: message,
  };
}

/**
 * Build transcription complete notification message
 * @param {Object} meeting - Meeting object
 * @param {string} webAppUrl - Web app base URL
 * @returns {Object} LINE Flex Message
 */
function buildTranscriptionCompleteMessage(meeting, webAppUrl) {
  const projectId = meeting.projectId?._id || meeting.projectId;
  const meetingId = meeting._id || meeting.id;
  const meetingUrl = `${webAppUrl}/projects/${projectId}/meetings/${meetingId}`;

  return {
    type: 'flex',
    altText: '✓ Transcription ready',
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '✓',
                size: 'xl',
                flex: 0,
                color: '#10b981',
              },
              {
                type: 'text',
                text: meeting.title || 'Your Meeting',
                weight: 'bold',
                size: 'md',
                color: '#1a1a1a',
                margin: 'md',
                wrap: true,
                maxLines: 1,
              },
            ],
            paddingAll: '16px',
            paddingBottom: '8px',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'Completed',
                    size: 'xs',
                    color: '#10b981',
                    align: 'center',
                    weight: 'bold',
                  },
                ],
                flex: 1,
                paddingAll: '10px',
                backgroundColor: '#f0fdf4',
                cornerRadius: '4px',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'Transcription',
                    size: 'xs',
                    color: '#64748b',
                    align: 'center',
                  },
                ],
                flex: 1,
                paddingAll: '10px',
                backgroundColor: '#f8fafc',
                cornerRadius: '4px',
                action: {
                  type: 'uri',
                  uri: meetingUrl,
                },
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'View →',
                    size: 'xs',
                    color: '#ffffff',
                    align: 'center',
                    weight: 'bold',
                  },
                ],
                flex: 1,
                paddingAll: '10px',
                backgroundColor: '#1a1a1a',
                cornerRadius: '4px',
                action: {
                  type: 'uri',
                  uri: meetingUrl,
                },
              },
            ],
            spacing: 'sm',
            paddingAll: '16px',
            paddingTop: '8px',
          },
        ],
        paddingAll: '0px',
        spacing: 'none',
      },
    },
  };
}

/**
 * Build help message
 * @returns {Object} LINE text message
 */
function buildHelpMessage() {
  return {
    type: 'text',
    text: `📖 How to Use Meno\n\n🎙️ Create Meetings:\n• Send voice messages\n• Upload audio files\n\n✨ Features:\n• Automatic transcription\n• AI-generated summaries\n• Action item extraction\n\n🔗 Manage Integration:\nVisit the web app to:\n• View all meetings\n• Update settings\n• Unlink account\n\n💬 Need help?\nContact support through the web app.`,
  };
}

module.exports = {
  formatDuration,
  buildWelcomeMessage,
  buildLinkingInstructions,
  buildLinkingSuccessMessage,
  buildMeetingCreatedMessage,
  buildErrorMessage,
  buildTranscriptionCompleteMessage,
  buildHelpMessage,
};
