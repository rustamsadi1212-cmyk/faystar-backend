const express = require('express');
const { body, validationResult } = require('express-validator');
const ElevenLabsService = require('../services/elevenLabs.service');
const router = express.Router();

// Initialize ElevenLabs Service
let elevenLabsService = null;

// Initialize service with error handling
try {
  elevenLabsService = new ElevenLabsService();
  console.log('[AudioRoute] ✅ ElevenLabs service initialized successfully');
} catch (error) {
  console.error('[AudioRoute] ❌ Failed to initialize ElevenLabs service:', error.message);
  elevenLabsService = null;
}

// Middleware to verify JWT token (reused from existing AI routes)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token required',
      errorType: 'AUTHENTICATION_ERROR'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      errorType: 'AUTHENTICATION_ERROR'
    });
  }
};

/**
 * POST /api/audio/tts
 * Generate speech from text using ElevenLabs
 * 
 * Request Body:
 * {
 *   "text": "Hello, this is a test message",
 *   "voiceId": "21m00Tcm4TlvDq8ikWAM" // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "audioBase64": "base64-encoded-audio",
 *   "message": "Audio generated successfully"
 * }
 */
router.post('/tts', [
  body('text')
    .notEmpty()
    .withMessage('Text is required')
    .isString()
    .withMessage('Text must be a string')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Text must be between 1 and 5000 characters')
    .trim(),
  body('voiceId')
    .optional()
    .isString()
    .withMessage('Voice ID must be a string')
    .isLength({ min: 10 })
    .withMessage('Invalid voice ID format')
], verifyToken, async (req, res) => {
  const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user.userId;
  
  console.log(`[AudioRoute] 🎤 TTS request - RequestID: ${requestId}`);
  console.log(`[AudioRoute] 👤 User ID: ${userId}`);
  console.log(`[AudioRoute] 📝 Text: "${req.body.text?.substring(0, 50)}${req.body.text?.length > 50 ? '...' : ''}"`);

  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`[AudioRoute] ❌ Validation failed - RequestID: ${requestId}`);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errorType: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({
          field: err.param,
          message: err.msg,
          value: err.value
        })),
        requestId: requestId
      });
    }

    // Check if ElevenLabs service is initialized
    if (!elevenLabsService) {
      console.log(`[AudioRoute] ❌ ElevenLabs service not initialized - RequestID: ${requestId}`);
      return res.status(503).json({
        success: false,
        error: 'ElevenLabs service not available',
        errorType: 'SERVICE_UNAVAILABLE',
        message: 'Text-to-speech service is not properly configured',
        requestId: requestId
      });
    }

    const { text, voiceId = '21m00Tcm4TlvDq8ikWAM', stability, similarity } = req.body;

    // Validate and normalize stability parameter (0-100 to 0.0-1.0)
    let normalizedStability = 0.5; // default
    if (stability !== undefined) {
      if (typeof stability === 'number') {
        if (stability > 1) {
          // If > 1, assume it's 0-100 range, convert to 0.0-1.0
          normalizedStability = Math.min(Math.max(stability / 100, 0), 1);
        } else {
          // Already in 0.0-1.0 range, just clamp it
          normalizedStability = Math.min(Math.max(stability, 0), 1);
        }
      }
    }

    // Validate and normalize similarity parameter (0-100 to 0.0-1.0)
    let normalizedSimilarity = 0.8; // default
    if (similarity !== undefined) {
      if (typeof similarity === 'number') {
        if (similarity > 1) {
          // If > 1, assume it's 0-100 range, convert to 0.0-1.0
          normalizedSimilarity = Math.min(Math.max(similarity / 100, 0), 1);
        } else {
          // Already in 0.0-1.0 range, just clamp it
          normalizedSimilarity = Math.min(Math.max(similarity, 0), 1);
        }
      }
    }

    console.log(`[AudioRoute] 🎛️ Voice settings - Stability: ${normalizedStability} (${(normalizedStability * 100).toFixed(0)}%), Similarity: ${normalizedSimilarity} (${(normalizedSimilarity * 100).toFixed(0)}%)`);

    // Check ELEVENLABS_API_KEY availability
    if (!process.env.ELEVENLABS_API_KEY) {
      console.log(`[AudioRoute] ❌ ELEVENLABS_API_KEY missing - RequestID: ${requestId}`);
      return res.status(500).json({
        success: false,
        error: 'ELEVENLABS_API_KEY not configured',
        errorType: 'MISSING_API_KEY',
        message: 'ElevenLabs API key is not configured on the server',
        requestId: requestId
      });
    }

    console.log(`[AudioRoute] 🚀 Starting speech synthesis - RequestID: ${requestId}`);

    // Generate speech
    const result = await elevenLabsService.generateSpeech(text, voiceId, normalizedStability, normalizedSimilarity);

    if (result.success) {
      console.log(`[AudioRoute] ✅ Speech synthesis completed - RequestID: ${requestId}`);
      
      // Success response
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
      console.log(`[AudioRoute] ❌ Speech synthesis failed - RequestID: ${requestId}, Error: ${result.errorType}`);
      
      // Handle different error types with appropriate HTTP status codes
      const statusCode = _getStatusCodeForError(result.errorType);
      
      res.status(statusCode).json({
        success: false,
        error: result.error,
        errorType: result.errorType,
        details: result.details,
        requestId: requestId,
        message: _getUserFriendlyMessage(result.errorType)
      });
    }

  } catch (error) {
    console.error(`[AudioRoute] 💥 Unexpected error - RequestID: ${requestId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      errorType: 'SYSTEM_ERROR',
      message: 'An unexpected error occurred while processing your request',
      requestId: requestId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/audio/voices
 * Get available voices for ElevenLabs TTS
 */
router.get('/voices', async (req, res) => {
  const requestId = `voices_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[AudioRoute] 🔍 Fetching voices - RequestID: ${requestId}`);

  try {
    // Mock voices response for now (real implementation would call ElevenLabs API)
    const voices = [
      {
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        gender: 'Female',
        accent: 'American',
        description: 'Warm and friendly voice'
      },
      {
        voice_id: '29vD33N1CtxCmqQRPOWJk',
        name: 'Drew',
        gender: 'Male',
        accent: 'American',
        description: 'Clear and professional voice'
      },
      {
        voice_id: '2EiwWnXKFv4wCm4uuee0',
        name: 'Clyde',
        gender: 'Male',
        accent: 'British',
        description: 'Deep and authoritative voice'
      },
      {
        voice_id: 'AZnzlk1XxtOvL2T1GwJk',
        name: 'Domi',
        gender: 'Female',
        accent: 'American',
        description: 'Energetic and youthful voice'
      },
      {
        voice_id: 'EXAVITGu4L4Kuyx24Lxk',
        name: 'Bella',
        gender: 'Female',
        accent: 'American',
        description: 'Gentle and caring voice'
      }
    ];

    console.log(`[AudioRoute] ✅ Voices loaded - RequestID: ${requestId}, Count: ${voices.length}`);

    res.status(200).json({
      success: true,
      voices: voices,
      count: voices.length,
      requestId: requestId
    });

  } catch (error) {
    console.error(`[AudioRoute] 💥 Error fetching voices - RequestID: ${requestId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch voices',
      errorType: 'SYSTEM_ERROR',
      message: 'An unexpected error occurred while fetching voices',
      requestId: requestId
    });
  }
});

/**
 * GET /api/audio/health
 * Check ElevenLabs service health
 * 
 * Response:
 * {
 *   "success": true,
 *   "status": "healthy",
 *   "elevenLabsReachable": true
 * }
 */
router.get('/health', async (req, res) => {
  const requestId = `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[AudioRoute] 🔍 Health check - RequestID: ${requestId}`);
  
  try {
    const healthResult = {
      success: true,
      requestId: requestId,
      timestamp: new Date().toISOString(),
      service: {
        name: 'ElevenLabs Text-to-Speech',
        status: 'unknown',
        elevenLabsReachable: false,
        hasApiKey: !!process.env.ELEVENLABS_API_KEY,
        serviceInitialized: !!elevenLabsService
      }
    };

    // Check if service is initialized
    if (!elevenLabsService) {
      healthResult.service.status = 'unavailable';
      healthResult.service.message = 'ElevenLabs service not initialized';
      return res.status(503).json(healthResult);
    }

    // Check ElevenLabs service health
    const elHealth = await elevenLabsService.checkHealth();
    healthResult.service.status = elHealth.status;
    healthResult.service.elevenLabsReachable = elHealth.elevenLabsReachable;
    healthResult.service.responseTime = elHealth.responseTime;
    healthResult.service.config = elevenLabsService.getConfig();

    const statusCode = healthResult.service.status === 'healthy' ? 200 : 503;
    
    console.log(`[AudioRoute] ${healthResult.service.status === 'healthy' ? '✅' : '❌'} Health check completed - RequestID: ${requestId}`);
    
    res.status(statusCode).json(healthResult);

  } catch (error) {
    console.error(`[AudioRoute] 💥 Health check failed - RequestID: ${requestId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      errorType: 'SYSTEM_ERROR',
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get appropriate HTTP status code for error type
 * @param {string} errorType - Error type
 * @returns {number} HTTP status code
 * @private
 */
function _getStatusCodeForError(errorType) {
  switch (errorType) {
    case 'INVALID_API_KEY':
    case 'MISSING_API_KEY':
      return 500; // Server configuration error
    case 'PAYMENT_REQUIRED':
      return 402; // Payment required
    case 'RATE_LIMITED':
      return 429; // Too many requests
    case 'ACCESS_DENIED':
      return 403; // Forbidden
    case 'TIMEOUT':
    case 'NETWORK_ERROR':
    case 'SERVER_ERROR':
      return 503; // Service unavailable
    case 'BAD_REQUEST':
    case 'VALIDATION_ERROR':
      return 400; // Bad request
    default:
      return 500; // Internal server error
  }
}

/**
 * Get user-friendly message for error type
 * @param {string} errorType - Error type
 * @returns {string} User-friendly message
 * @private
 */
function _getUserFriendlyMessage(errorType) {
  switch (errorType) {
    case 'INVALID_API_KEY':
      return 'The ElevenLabs API key is invalid. Please contact support.';
    case 'MISSING_API_KEY':
      return 'ElevenLabs API key is not configured. Please contact support.';
    case 'PAYMENT_REQUIRED':
      return 'Your ElevenLabs account has insufficient credits. Please check your billing.';
    case 'RATE_LIMITED':
      return 'Too many speech synthesis requests. Please wait and try again later.';
    case 'ACCESS_DENIED':
      return 'Access to ElevenLabs service is denied. Please contact support.';
    case 'TIMEOUT':
      return 'Speech synthesis is taking too long. Please try again.';
    case 'NETWORK_ERROR':
      return 'Network connection to ElevenLabs failed. Please check your internet connection.';
    case 'SERVER_ERROR':
      return 'ElevenLabs service is temporarily unavailable. Please try again later.';
    case 'BAD_REQUEST':
    case 'VALIDATION_ERROR':
      return 'Invalid request parameters. Please check your input.';
    default:
      return 'An error occurred while generating speech. Please try again.';
  }
}

module.exports = router;
