const axios = require('axios');

/**
 * ElevenLabs Text-to-Speech Service
 * Isolated service for voice synthesis
 */
class ElevenLabsService {
  constructor() {
    this.baseURL = 'https://api.elevenlabs.io/v1';
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.timeout = 60000; // 60 seconds
    
    // Validate API key at initialization
    this._validateApiKey();
  }

  /**
   * Validate API key presence
   * @private
   */
  _validateApiKey() {
    if (!this.apiKey) {
      console.error('[ElevenLabs] ❌ ELEVENLABS_API_KEY not found in environment variables');
      console.log('[ElevenLabs] ⚠️  ElevenLabs service will be disabled until API key is configured');
      // Don't throw error, just disable service
      this.disabled = true;
      return;
    }
    
    if (typeof this.apiKey !== 'string' || this.apiKey.length < 10) {
      console.error('[ElevenLabs] ❌ ELEVENLABS_API_KEY format appears invalid');
      console.log('[ElevenLabs] ⚠️  ElevenLabs service will be disabled until API key is corrected');
      this.disabled = true;
      return;
    }
    
    console.log('[ElevenLabs] ✅ API key validated successfully');
    this.disabled = false;
  }

  /**
 * Generate speech from text
 * @param {string} text - Text to synthesize
 * @param {string} voiceId - Voice ID (optional, defaults to Rachel)
 * @param {number} stability - Voice stability (0.0-1.0, optional, defaults to 0.5)
 * @param {number} similarity - Voice similarity boost (0.0-1.0, optional, defaults to 0.8)
 * @returns {Promise<Object>} Generated audio data
 */
  async generateSpeech(text, voiceId = '21m00Tcm4TlvDq8ikWAM', stability = 0.5, similarity = 0.8) {
    const requestId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[ElevenLabs] 🎤 Starting speech synthesis - RequestID: ${requestId}`);
    console.log(`[ElevenLabs] 📝 Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    console.log(`[ElevenLabs] 🗣️  Voice ID: ${voiceId}`);

    // Check if service is disabled
    if (this.disabled) {
      console.log(`[ElevenLabs] ❌ Service disabled - RequestID: ${requestId}`);
      return {
        success: false,
        error: 'ElevenLabs service is disabled - API key not configured',
        errorType: 'SERVICE_DISABLED',
        requestId: requestId
      };
    }

    try {
      // Validate input
      this._validateInput(text, voiceId);

      // Validate voice ID
      if (!voiceId || typeof voiceId !== 'string') {
        console.log(`[ElevenLabs] ❌ Invalid voice ID - RequestID: ${requestId}, VoiceID: ${voiceId}`);
        return {
          success: false,
          error: 'Invalid voice ID provided',
          errorType: 'INVALID_VOICE_ID',
          requestId: requestId
        };
      }

      // Use default voice ID if invalid
      const validVoiceId = voiceId.trim() || '21m00Tcm4TlvDq8ikWAM';
      console.log(`[ElevenLabs] ✅ Using voice ID: ${validVoiceId} - RequestID: ${requestId}`);

      // Prepare request payload
      const payload = {
        text: text.trim(),
        voice_id: validVoiceId,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: stability,
          similarity_boost: similarity,
          style: 0.0,
          use_speaker_boost: true
        }
      };

      console.log(`[ElevenLabs] 🚀 Making request to ElevenLabs API...`);

      // Make request to ElevenLabs API
      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/text-to-speech/${validVoiceId}`,
        timeout: this.timeout,
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'FayStar-Backend/1.0',
          'Accept': 'audio/mpeg'
        },
        data: payload,
        responseType: 'arraybuffer'
      });

      // Convert audio data to base64 for JSON response
      const audioBuffer = Buffer.from(response.data);
      const audioBase64 = audioBuffer.toString('base64');
      
      const result = {
        success: true,
        requestId: requestId,
        audioBase64: audioBase64,
        audioFormat: 'audio/mpeg',
        audioSize: audioBuffer.length,
        duration: this._estimateAudioDuration(text),
        text: text,
        voiceId: voiceId,
        createdAt: new Date().toISOString()
      };

      console.log(`[ElevenLabs] ✅ Speech synthesis completed - RequestID: ${requestId}`);
      console.log(`[ElevenLabs] 🎵 Audio size: ${result.audioSize} bytes, Estimated duration: ${result.duration}s`);
      
      return result;

    } catch (error) {
      console.error(`[ElevenLabs] ❌ Speech synthesis failed - RequestID: ${requestId}:`, error.message);
      
      // Handle different error types
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        switch (status) {
          case 401:
            return {
              success: false,
              error: 'Invalid ElevenLabs API key',
              errorType: 'INVALID_API_KEY',
              details: errorData,
              requestId: requestId
            };
            
          case 404:
            return {
              success: false,
              error: 'Invalid voice ID or ElevenLabs API endpoint',
              errorType: 'INVALID_VOICE_OR_URL',
              details: errorData,
              requestId: requestId
            };
            
          case 429:
            return {
              success: false,
              error: 'Rate limit exceeded - too many requests to ElevenLabs',
              errorType: 'RATE_LIMITED',
              details: errorData,
              requestId: requestId
            };
            
          case 400:
            return {
              success: false,
              error: 'Bad request - invalid parameters',
              errorType: 'BAD_REQUEST',
              details: errorData,
              requestId: requestId
            };
            
          case 402:
            return {
              success: false,
              error: 'Payment required - insufficient ElevenLabs credits',
              errorType: 'PAYMENT_REQUIRED',
              details: errorData,
              requestId: requestId
            };
            
          case 500:
          case 502:
          case 503:
          case 504:
            return {
              success: false,
              error: `ElevenLabs server error (${status})`,
              errorType: 'SERVER_ERROR',
              details: errorData,
              requestId: requestId
            };
            
          default:
            return {
              success: false,
              error: `ElevenLabs API error (${status})`,
              errorType: 'API_ERROR',
              details: errorData,
              requestId: requestId
            };
        }
      } else if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Request timeout - ElevenLabs API not responding',
          errorType: 'TIMEOUT',
          requestId: requestId
        };
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Network error - unable to connect to ElevenLabs',
          errorType: 'NETWORK_ERROR',
          requestId: requestId
        };
      } else {
        return {
          success: false,
          error: 'Unexpected error during speech synthesis',
          errorType: 'UNKNOWN_ERROR',
          details: error.message,
          requestId: requestId
        };
      }
    }
  }

  /**
   * Handle and categorize errors
   * @param {Error} error - The error to handle
   * @returns {Object} Categorized error information
   * @private
   */
  _handleError(error) {
    if (error.response) {
      // API response error
      const statusCode = error.response.status;
      const errorData = error.response.data;
      
      switch (statusCode) {
        case 401:
          return {
            type: 'INVALID_API_KEY',
            message: 'Invalid ElevenLabs API key',
            details: errorData?.detail || 'Authentication failed'
          };
          
        case 403:
          return {
            type: 'ACCESS_DENIED',
            message: 'Access denied - API key may be disabled',
            details: errorData?.detail || 'Forbidden'
          };
          
        case 429:
          return {
            type: 'RATE_LIMITED',
            message: 'Rate limit exceeded - too many requests',
            details: errorData?.detail || 'Too many requests'
          };
          
        case 400:
          return {
            type: 'BAD_REQUEST',
            message: 'Invalid request parameters',
            details: errorData?.detail || 'Bad request'
          };
          
        case 402:
          return {
            type: 'PAYMENT_REQUIRED',
            message: 'Payment required - insufficient credits',
            details: errorData?.detail || 'Payment required'
          };
          
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: 'SERVER_ERROR',
            message: `ElevenLabs server error (${statusCode})`,
            details: errorData?.detail || 'Server error'
          };
          
        default:
          return {
            type: 'API_ERROR',
            message: `ElevenLabs API error (${statusCode})`,
            details: errorData?.detail || 'Unknown API error'
          };
      }
    } else if (error.code) {
      // Network or connection errors
      switch (error.code) {
        case 'ECONNABORTED':
          return {
            type: 'TIMEOUT',
            message: 'Request timeout - ElevenLabs API not responding',
            details: `Timeout after ${this.timeout}ms`
          };
          
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          return {
            type: 'NETWORK_ERROR',
            message: 'Network error - unable to connect to ElevenLabs',
            details: error.code
          };
          
        default:
          return {
            type: 'NETWORK_ERROR',
            message: `Network error: ${error.message}`,
            details: error.code
          };
      }
    } else {
      // Other errors
      return {
        type: 'UNKNOWN_ERROR',
        message: `Unexpected error: ${error.message}`,
        details: error.stack
      };
    }
  }

  /**
   * Validate input parameters
   * @param {string} text - Text to validate
   * @param {string} voiceId - Voice ID to validate
   * @private
   */
  _validateInput(text, voiceId) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text is required and must be a string');
    }

    if (text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    if (text.length > 5000) {
      throw new Error('Text must be less than 5000 characters');
    }

    if (!voiceId || typeof voiceId !== 'string') {
      throw new Error('Voice ID is required and must be a string');
    }

    if (voiceId.length < 10) {
      throw new Error('Invalid voice ID format');
    }
  }

  /**
   * Estimate audio duration based on text length
   * @param {string} text - Input text
   * @returns {number} Estimated duration in seconds
   * @private
   */
  _estimateAudioDuration(text) {
    // Average reading speed: ~150 words per minute
    // Average word length: ~5 characters
    const wordsPerMinute = 150;
    const avgWordLength = 5;
    const wordCount = text.length / avgWordLength;
    return Math.ceil(wordCount / wordsPerMinute * 60);
  }

  /**
   * Check service health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await axios({
        method: 'GET',
        url: `${this.baseURL}/voices`,
        timeout: 5000,
        headers: {
          'xi-api-key': this.apiKey,
          'User-Agent': 'FayStar-HealthCheck/1.0'
        }
      });

      return {
        status: 'healthy',
        elevenLabsReachable: true,
        responseTime: response.headers['x-response-time'] || 'unknown'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        elevenLabsReachable: false,
        error: error.message
      };
    }
  }

  /**
   * Get service configuration
   * @returns {Object} Service configuration
   */
  getConfig() {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout,
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0
    };
  }
}

module.exports = ElevenLabsService;
