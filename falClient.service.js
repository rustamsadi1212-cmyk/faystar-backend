const axios = require('axios');

/**
 * Fal.ai Client Service
 * Handles communication with Fal.ai Pika API
 * Production-ready with retry logic and comprehensive error handling
 */
class FalClientService {
  constructor() {
    this.baseURL = 'https://fal.run';
    this.apiKey = process.env.FAL_KEY;
    this.timeout = 60000; // 60 seconds timeout
    this.maxRetries = 1; // 1 retry on network errors
    
    // Validate API key at initialization
    this._validateApiKey();
  }

  /**
   * Validate API key presence
   * @private
   */
  _validateApiKey() {
    if (!this.apiKey) {
      console.error('[FalClient] ❌ FAL_KEY not found in environment variables');
      throw new Error('FAL_KEY not configured');
    }
    
    if (typeof this.apiKey !== 'string' || this.apiKey.length < 10) {
      console.error('[FalClient] ❌ FAL_KEY format appears invalid');
      throw new Error('FAL_KEY format invalid');
    }
    
    console.log('[FalClient] ✅ API key validated at initialization');
  }

  /**
   * Generate video using Fal.ai Pika model
   * @param {Object} params - Video generation parameters
   * @param {string} params.prompt - Text prompt for video generation
   * @param {number} params.duration - Video duration in seconds (default: 5)
   * @param {string} params.aspectRatio - Aspect ratio (default: "16:9")
   * @returns {Promise<Object>} Generated video information
   */
  async generateVideo({ prompt, duration = 5, aspectRatio = "16:9" }) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[FalClient] 🎬 Starting video generation - RequestID: ${requestId}`);
    console.log(`[FalClient] 📝 Prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    console.log(`[FalClient] ⚙️  Settings: duration=${duration}s, aspectRatio=${aspectRatio}`);

    try {
      // Validate input parameters
      this._validateInput({ prompt, duration, aspectRatio });

      // Prepare request payload for Fal.ai Pika model
      const payload = {
        prompt: prompt.trim(),
        num_frames: Math.floor(duration * 24), // 24 fps
        aspect_ratio: aspectRatio,
        guidance_scale: 7.5,
        num_inference_steps: 50,
        negative_prompt: "low quality, worst quality, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
        seed: Math.floor(Math.random() * 1000000)
      };

      console.log(`[FalClient] 🚀 Making request to Fal.ai API...`);

      // Make request with retry logic
      const response = await this._makeRequestWithRetry('/fal-ai/pika-1.0', payload);
      
      const result = {
        success: true,
        requestId: requestId,
        videoUrl: response.data.video_url,
        estimatedTime: response.data.estimated_time || '30-60 seconds',
        duration: duration,
        aspectRatio: aspectRatio,
        prompt: prompt,
        createdAt: new Date().toISOString()
      };

      console.log(`[FalClient] ✅ Video generation completed - RequestID: ${requestId}`);
      console.log(`[FalClient] 📹 Video URL: ${result.videoUrl}`);
      
      return result;

    } catch (error) {
      console.error(`[FalClient] ❌ Video generation failed - RequestID: ${requestId}:`, error.message);
      
      // Handle different types of errors
      const errorResponse = this._handleError(error);
      
      return {
        success: false,
        requestId: requestId,
        error: errorResponse.message,
        errorType: errorResponse.type,
        details: errorResponse.details
      };
    }
  }

  /**
   * Make HTTP request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeRequestWithRetry(endpoint, data) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        console.log(`[FalClient] 📡 Attempt ${attempt}/${this.maxRetries + 1} to ${endpoint}`);
        
        const response = await axios({
          method: 'POST',
          url: `${this.baseURL}${endpoint}`,
          timeout: this.timeout,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'FayStar-Backend/1.0'
          },
          data: data
        });

        console.log(`[FalClient] ✅ Request successful on attempt ${attempt}`);
        return response;

      } catch (error) {
        lastError = error;
        
        // Don't retry on authentication or client errors
        if (error.response && (error.response.status === 401 || 
                               error.response.status === 403 || 
                               error.response.status === 402 || 
                               error.response.status === 429)) {
          console.log(`[FalClient] ❌ No retry for status ${error.response.status}`);
          throw error;
        }
        
        // Retry only on network errors or server errors
        if (attempt <= this.maxRetries) {
          console.log(`[FalClient] 🔄 Retrying in 2 seconds...`);
          await this._sleep(2000);
        }
      }
    }
    
    throw lastError;
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
            message: 'Invalid Fal.ai API key',
            details: errorData?.error || 'Authentication failed'
          };
          
        case 403:
          return {
            type: 'ACCESS_DENIED',
            message: 'Access denied - API key may be disabled',
            details: errorData?.error || 'Forbidden'
          };
          
        case 402:
          return {
            type: 'NO_CREDITS',
            message: 'No credits or billing required',
            details: errorData?.error || 'Payment required'
          };
          
        case 429:
          return {
            type: 'RATE_LIMITED',
            message: 'Rate limit exceeded - too many requests',
            details: errorData?.error || 'Too many requests'
          };
          
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: 'SERVER_ERROR',
            message: `Fal.ai server error (${statusCode})`,
            details: errorData?.error || 'Server error'
          };
          
        default:
          return {
            type: 'API_ERROR',
            message: `Fal.ai API error (${statusCode})`,
            details: errorData?.error || 'Unknown API error'
          };
      }
    } else if (error.code) {
      // Network or connection errors
      switch (error.code) {
        case 'ECONNABORTED':
          return {
            type: 'TIMEOUT',
            message: 'Request timeout - Fal.ai API not responding',
            details: `Timeout after ${this.timeout}ms`
          };
          
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          return {
            type: 'NETWORK_ERROR',
            message: 'Network error - unable to connect to Fal.ai',
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
   * @param {Object} params - Parameters to validate
   * @private
   */
  _validateInput({ prompt, duration, aspectRatio }) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required and must be a string');
    }

    if (prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    if (prompt.length > 1000) {
      throw new Error('Prompt must be less than 1000 characters');
    }

    if (duration !== undefined) {
      if (typeof duration !== 'number' || duration < 1 || duration > 20) {
        throw new Error('Duration must be a number between 1 and 20 seconds');
      }
    }

    if (aspectRatio !== undefined) {
      const validRatios = ['16:9', '9:16', '1:1', '4:3', '21:9'];
      if (!validRatios.includes(aspectRatio)) {
        throw new Error(`Invalid aspect ratio. Must be one of: ${validRatios.join(', ')}`);
      }
    }
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check service health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await axios({
        method: 'GET',
        url: `${this.baseURL}/health`,
        timeout: 5000,
        headers: {
          'User-Agent': 'FayStar-HealthCheck/1.0'
        }
      });

      return {
        status: 'healthy',
        falReachable: true,
        responseTime: response.headers['x-response-time'] || 'unknown'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        falReachable: false,
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
      maxRetries: this.maxRetries,
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0
    };
  }
}

module.exports = FalClientService;
