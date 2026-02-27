const express = require('express');
const ElevenLabsService = require('../services/elevenLabs.service');
const router = express.Router();

// Initialize ElevenLabs Service
let elevenLabsService = null;

try {
  elevenLabsService = new ElevenLabsService();
  console.log('[TestRoute] ✅ ElevenLabs service initialized successfully');
} catch (error) {
  console.error('[TestRoute] ❌ Failed to initialize ElevenLabs service:', error.message);
  elevenLabsService = null;
}

/**
 * POST /api/test/tts
 * Test endpoint without authentication for quick testing
 */
router.post('/tts', async (req, res) => {
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[TestRoute] 🎤 Test TTS request - RequestID: ${requestId}`);
  
  try {
    const { text, voiceId = '21m00Tcm4TlvDq8ikWAM' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string',
        requestId: requestId
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Text must be less than 5000 characters',
        requestId: requestId
      });
    }

    if (!elevenLabsService) {
      return res.status(503).json({
        success: false,
        error: 'ElevenLabs service not available',
        requestId: requestId
      });
    }

    console.log(`[TestRoute] 🚀 Starting speech synthesis - RequestID: ${requestId}`);

    // Generate speech
    const result = await elevenLabsService.generateSpeech(text, voiceId);

    if (result.success) {
      console.log(`[TestRoute] ✅ Speech synthesis completed - RequestID: ${requestId}`);
      
      res.status(200).json({
        success: true,
        audioBase64: result.audioBase64,
        message: 'Audio generated successfully',
        requestId: requestId,
        metadata: {
          audioFormat: result.audioFormat,
          audioSize: result.audioSize,
          duration: result.duration,
          voiceId: result.voiceId,
          createdAt: result.createdAt
        }
      });
    } else {
      console.log(`[TestRoute] ❌ Speech synthesis failed - RequestID: ${requestId}, Error: ${result.errorType}`);
      
      res.status(500).json({
        success: false,
        error: result.error,
        errorType: result.errorType,
        details: result.details,
        requestId: requestId
      });
    }

  } catch (error) {
    console.error(`[TestRoute] 💥 Unexpected error - RequestID: ${requestId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      errorType: 'SYSTEM_ERROR',
      message: 'An unexpected error occurred while processing your request',
      requestId: requestId
    });
  }
});

module.exports = router;
