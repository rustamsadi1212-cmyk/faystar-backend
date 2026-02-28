const express = require('express');
const { body, validationResult } = require('express-validator');
const FalClientService = require('../services/falClient.service');
const router = express.Router();

// Initialize Fal.ai Client Service
let falClient = null;

// Initialize service with error handling
try {
  falClient = new FalClientService();
  console.log('[VideoRoute] ✅ Fal.ai client initialized successfully');
} catch (error) {
  console.error('[VideoRoute] ❌ Failed to initialize Fal.ai client:', error.message);
  falClient = null;
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
 * POST /api/video/generate
 * Generate video using Fal.ai Pika model
 * 
 * Request Body:
 * {
 *   "prompt": "A beautiful sunset over mountains",
 *   "duration": 5,
 *   "aspectRatio": "16:9"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "requestId": "req_123456789",
 *   "videoUrl": "https://...",
 *   "estimatedTime": "30-60 seconds"
 * }
 */
router.post('/generate', [
  body('prompt')
    .notEmpty()
    .withMessage('Prompt is required')
    .isString()
    .withMessage('Prompt must be a string')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Prompt must be between 1 and 1000 characters')
    .trim(),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Duration must be an integer between 1 and 20 seconds'),
  body('aspectRatio')
    .optional()
    .isIn(['16:9', '9:16', '1:1', '4:3', '21:9'])
    .withMessage('Invalid aspect ratio. Must be one of: 16:9, 9:16, 1:1, 4:3, 21:9')
], verifyToken, async (req, res) => {
  const requestId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user.userId;
  
  console.log(`[VideoRoute] 🎬 Video generation request - RequestID: ${requestId}`);
  console.log(`[VideoRoute] 👤 User ID: ${userId}`);
  console.log(`[VideoRoute] 📝 Prompt: "${req.body.prompt?.substring(0, 50)}${req.body.prompt?.length > 50 ? '...' : ''}"`);

  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`[VideoRoute] ❌ Validation failed - RequestID: ${requestId}`);
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

    // Check if Fal.ai client is initialized
    if (!falClient) {
      console.log(`[VideoRoute] ❌ Fal.ai client not initialized - RequestID: ${requestId}`);
      return res.status(503).json({
        success: false,
        error: 'Fal.ai service not available',
        errorType: 'SERVICE_UNAVAILABLE',
        message: 'Video generation service is not properly configured',
        requestId: requestId
      });
    }

    const { prompt, duration = 5, aspectRatio = "16:9" } = req.body;

    // Check FAL_KEY availability
    if (!process.env.FAL_KEY) {
      console.log(`[VideoRoute] ❌ FAL_KEY missing - RequestID: ${requestId}`);
      return res.status(500).json({
        success: false,
        error: 'FAL_KEY not configured',
        errorType: 'MISSING_API_KEY',
        message: 'Fal.ai API key is not configured on the server',
        requestId: requestId
      });
    }

    console.log(`[VideoRoute] 🚀 Starting video generation - RequestID: ${requestId}`);

    // Generate video
    const result = await falClient.generateVideo({
      prompt: prompt,
      duration: duration,
      aspectRatio: aspectRatio
    });

    if (result.success) {
      console.log(`[VideoRoute] ✅ Video generation completed - RequestID: ${requestId}`);
      
      // Success response
      res.status(200).json({
        success: true,
        data: {
          requestId: result.requestId,
          videoUrl: result.videoUrl,
          estimatedTime: result.estimatedTime,
          duration: result.duration,
          aspectRatio: result.aspectRatio,
          prompt: result.prompt,
          createdAt: result.createdAt
        },
        message: 'Video generation completed successfully',
        requestId: requestId
      });
    } else {
      console.log(`[VideoRoute] ❌ Video generation failed - RequestID: ${requestId}, Error: ${result.errorType}`);
      
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
    console.error(`[VideoRoute] 💥 Unexpected error - RequestID: ${requestId}:`, error.message);
    
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
 * GET /api/video/health
 * Check Fal.ai service health
 * 
 * Response:
 * {
 *   "success": true,
 *   "status": "healthy",
 *   "falReachable": true,
 *   "serviceConfig": {...}
 * }
 */
router.get('/health', async (req, res) => {
  const requestId = `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[VideoRoute] 🔍 Health check - RequestID: ${requestId}`);
  
  try {
    const healthResult = {
      success: true,
      requestId: requestId,
      timestamp: new Date().toISOString(),
      service: {
        name: 'Fal.ai Video Generation',
        status: 'unknown',
        falReachable: false,
        hasApiKey: !!process.env.FAL_KEY,
        clientInitialized: !!falClient
      }
    };

    // Check if client is initialized
    if (!falClient) {
      healthResult.service.status = 'unavailable';
      healthResult.service.message = 'Fal.ai client not initialized';
      return res.status(503).json(healthResult);
    }

    // Check Fal.ai service health
    const falHealth = await falClient.checkHealth();
    healthResult.service.status = falHealth.status;
    healthResult.service.falReachable = falHealth.falReachable;
    healthResult.service.responseTime = falHealth.responseTime;
    healthResult.service.config = falClient.getConfig();

    const statusCode = healthResult.service.status === 'healthy' ? 200 : 503;
    
    console.log(`[VideoRoute] ${healthResult.service.status === 'healthy' ? '✅' : '❌'} Health check completed - RequestID: ${requestId}`);
    
    res.status(statusCode).json(healthResult);

  } catch (error) {
    console.error(`[VideoRoute] 💥 Health check failed - RequestID: ${requestId}:`, error.message);
    
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
 * GET /api/video/config
 * Get service configuration (for debugging)
 * 
 * Response:
 * {
 *   "success": true,
 *   "config": {...}
 * }
 */
router.get('/config', verifyToken, async (req, res) => {
  const requestId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    if (!falClient) {
      return res.status(503).json({
        success: false,
        error: 'Service not available',
        errorType: 'SERVICE_UNAVAILABLE',
        requestId: requestId
      });
    }

    const config = falClient.getConfig();
    
    // Remove sensitive information
    const safeConfig = {
      ...config,
      hasApiKey: config.hasApiKey,
      apiKeyLength: config.apiKeyLength,
      // Don't include actual API key
    };

    res.status(200).json({
      success: true,
      data: safeConfig,
      requestId: requestId
    });

  } catch (error) {
    console.error(`[VideoRoute] 💥 Config check failed - RequestID: ${requestId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration',
      errorType: 'SYSTEM_ERROR',
      requestId: requestId
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
    case 'NO_CREDITS':
      return 402; // Payment required
    case 'RATE_LIMITED':
      return 429; // Too many requests
    case 'ACCESS_DENIED':
      return 403; // Forbidden
    case 'TIMEOUT':
    case 'NETWORK_ERROR':
    case 'SERVER_ERROR':
      return 503; // Service unavailable
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
      return 'The Fal.ai API key is invalid. Please contact support.';
    case 'MISSING_API_KEY':
      return 'Fal.ai API key is not configured. Please contact support.';
    case 'NO_CREDITS':
      return 'Your Fal.ai account has insufficient credits. Please check your billing.';
    case 'RATE_LIMITED':
      return 'Too many video generation requests. Please wait and try again later.';
    case 'ACCESS_DENIED':
      return 'Access to Fal.ai service is denied. Please contact support.';
    case 'TIMEOUT':
      return 'Video generation is taking too long. Please try again.';
    case 'NETWORK_ERROR':
      return 'Network connection to Fal.ai failed. Please check your internet connection.';
    case 'SERVER_ERROR':
      return 'Fal.ai service is temporarily unavailable. Please try again later.';
    case 'VALIDATION_ERROR':
      return 'Invalid request parameters. Please check your input.';
    default:
      return 'An error occurred while generating your video. Please try again.';
  }
}

module.exports = router;
