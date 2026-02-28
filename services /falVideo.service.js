const axios = require('axios');

/**
 * Fal.ai Video Service
 * Handles video generation using Fal.ai Pika model API
 */
class FalVideoService {
  constructor() {
    this.baseURL = 'https://fal.run';
    this.apiKey = process.env.FAL_KEY;
    this.timeout = 60000; // 60 seconds timeout
    
    if (!this.apiKey) {
      console.warn('FAL_KEY environment variable not set');
    }
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
    try {
      // Validate input parameters
      this._validateInput({ prompt, duration, aspectRatio });

      // Prepare request payload for Fal.ai Pika model
      const payload = {
        model: 'pika-1.0',
        prompt: prompt.trim(),
        num_frames: Math.floor(duration * 24), // 24 fps
        aspect_ratio: aspectRatio,
        guidance_scale: 7.5,
        num_inference_steps: 50,
        negative_prompt: "low quality, worst quality, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
        seed: Math.floor(Math.random() * 1000000)
      };

      console.log(`[FalVideoService] Generating video with prompt: "${prompt.substring(0, 50)}..."`);
      
      // Make request to Fal.ai API
      const response = await this._makeRequest('/fal-ai/pika-1.0', payload);
      
      console.log(`[FalVideoService] Video generation completed. Request ID: ${response.data.request_id}`);
      
      return {
        success: true,
        videoUrl: response.data.video_url,
        requestId: response.data.request_id,
        estimatedTime: response.data.estimated_time || '30-60 seconds',
        duration: duration,
        aspectRatio: aspectRatio,
        prompt: prompt,
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[FalVideoService] Video generation failed:', error.message);
      
      // Handle different types of errors
      if (error.response) {
        // API response error
        const statusCode = error.response.status;
        const errorData = error.response.data;
        
        if (statusCode === 401) {
          throw new Error('Invalid Fal.ai API key');
        } else if (statusCode === 429) {
          throw new Error('Rate limit exceeded. Please try again later');
        } else if (statusCode === 400) {
          throw new Error(`Bad request: ${errorData.error || 'Invalid parameters'}`);
        } else if (statusCode >= 500) {
          throw new Error('Fal.ai server error. Please try again later');
        } else {
          throw new Error(`Fal.ai API error: ${errorData.error || 'Unknown error'}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Video generation may take longer than expected');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Network error. Unable to connect to Fal.ai');
      } else {
        throw new Error(`Video generation failed: ${error.message}`);
      }
    }
  }

  /**
   * Get video generation status
   * @param {string} requestId - Request ID from video generation
   * @returns {Promise<Object>} Video status information
   */
  async getVideoStatus(requestId) {
    try {
      if (!requestId) {
        throw new Error('Request ID is required');
      }

      const response = await this._makeRequest(`/fal-ai/pika-1.0/status/${requestId}`, null, 'GET');
      
      return {
        success: true,
        requestId: requestId,
        status: response.data.status, // 'processing', 'completed', 'failed'
        videoUrl: response.data.video_url,
        progress: response.data.progress || 0,
        estimatedTime: response.data.estimated_time,
        createdAt: response.data.created_at
      };

    } catch (error) {
      console.error(`[FalVideoService] Status check failed for request ${requestId}:`, error.message);
      throw new Error(`Failed to get video status: ${error.message}`);
    }
  }

  /**
   * Make HTTP request to Fal.ai API
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @param {string} method - HTTP method (default: POST)
   * @returns {Promise<Object>} API response
   */
  async _makeRequest(endpoint, data = null, method = 'POST') {
    const config = {
      method: method,
      url: `${this.baseURL}${endpoint}`,
      timeout: this.timeout,
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'FayStar-Backend/1.0'
      }
    };

    if (data && method === 'POST') {
      config.data = data;
    }

    const response = await axios(config);
    return response;
  }

  /**
   * Validate input parameters
   * @param {Object} params - Parameters to validate
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

    if (!this.apiKey) {
      throw new Error('Fal.ai API key not configured');
    }
  }

  /**
   * Check if Fal.ai service is available
   * @returns {Promise<boolean>} Service availability status
   */
  async checkServiceHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('[FalVideoService] Health check failed:', error.message);
      return false;
    }
  }
}

module.exports = FalVideoService;
