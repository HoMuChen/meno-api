const line = require('@line/bot-sdk');

/**
 * LINE Signature Verification Middleware
 * Verifies the signature of LINE webhook requests
 */
const verifyLineSignature = (req, res, next) => {
  const signature = req.headers['x-line-signature'];

  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Missing X-Line-Signature header',
    });
  }

  try {
    // Get raw body as string
    const body = JSON.stringify(req.body);

    // Verify signature
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    if (!channelSecret) {
      console.error('LINE_CHANNEL_SECRET environment variable is not set');
      return res.status(500).json({
        success: false,
        message: 'LINE integration not configured',
      });
    }

    const isValid = line.validateSignature(body, channelSecret, signature);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid LINE signature',
      });
    }

    // Signature is valid, proceed
    next();
  } catch (error) {
    console.error('LINE signature verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Signature verification failed',
    });
  }
};

module.exports = verifyLineSignature;
