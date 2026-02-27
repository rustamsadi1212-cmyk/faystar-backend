const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token required'
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
      error: 'Invalid token'
    });
  }
};

// AI Chat endpoint
router.post('/chat', [
  body('message').notEmpty().trim(),
  body('conversationHistory').optional().isArray(),
  body('model').optional().isIn(['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'])
], verifyToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { message, conversationHistory = [], model = 'gpt-3.5-turbo' } = req.body;
    const userId = req.user.userId;

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'AI service not configured'
      });
    }

    // Prepare messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant for the FayStar app. Provide helpful, concise, and accurate responses.'
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model,
        messages,
        max_tokens: 1000,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const aiResponse = response.data.choices[0].message.content;

      res.status(200).json({
        success: true,
        data: {
          response: aiResponse,
          model,
          usage: response.data.usage,
          timestamp: new Date().toISOString()
        }
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // Fallback response
      const fallbackResponses = [
        "I'm sorry, I'm having trouble connecting to my AI services right now. Please try again later.",
        "I apologize, but I'm experiencing technical difficulties. Please try your request again.",
        "Due to high demand, I'm unable to process your request at the moment. Please try again shortly."
      ];

      res.status(200).json({
        success: true,
        data: {
          response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
          model: 'fallback',
          isFallback: true,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process AI chat request',
      message: error.message
    });
  }
});

// Voice generation endpoint
router.post('/voice', [
  body('text').notEmpty().trim(),
  body('voice').optional().isIn(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']),
  body('speed').optional().isFloat({ min: 0.25, max: 4.0 })
], verifyToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { text, voice = 'alloy', speed = 1.0 } = req.body;
    const userId = req.user.userId;

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'AI service not configured'
      });
    }

    try {
      const response = await axios.post('https://api.openai.com/v1/audio/speech', {
        model: 'tts-1',
        input: text,
        voice,
        speed
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Convert buffer to base64
      const audioBuffer = Buffer.from(response.data);
      const audioBase64 = audioBuffer.toString('base64');

      res.status(200).json({
        success: true,
        data: {
          audioData: audioBase64,
          format: 'mp3',
          voice,
          speed,
          text,
          timestamp: new Date().toISOString()
        }
      });
    } catch (openaiError) {
      console.error('OpenAI TTS error:', openaiError);
      
      // Fallback mock response
      res.status(200).json({
        success: true,
        data: {
          audioData: null,
          format: 'mp3',
          voice,
          speed,
          text,
          isFallback: true,
          message: 'Voice generation temporarily unavailable',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Voice generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate voice',
      message: error.message
    });
  }
});

// Image generation endpoint
router.post('/image', [
  body('prompt').notEmpty().trim(),
  body('size').optional().isIn(['256x256', '512x512', '1024x1024']),
  body('quality').optional().isIn(['standard', 'hd']),
  body('style').optional().isIn(['vivid', 'natural'])
], verifyToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { 
      prompt, 
      size = '512x512', 
      quality = 'standard', 
      style = 'vivid' 
    } = req.body;
    const userId = req.user.userId;

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'AI service not configured'
      });
    }

    try {
      const response = await axios.post('https://api.openai.com/v1/images/generations', {
        model: 'dall-e-3',
        prompt,
        size,
        quality,
        style,
        n: 1
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 seconds for image generation
      });

      const imageData = response.data.data[0];

      res.status(200).json({
        success: true,
        data: {
          imageUrl: imageData.url,
          revisedPrompt: imageData.revised_prompt,
          size,
          quality,
          style,
          prompt,
          timestamp: new Date().toISOString()
        }
      });
    } catch (openaiError) {
      console.error('OpenAI DALL-E error:', openaiError);
      
      // Fallback mock response
      const fallbackImageUrl = `https://picsum.photos/512/512?random=${Date.now()}`;
      
      res.status(200).json({
        success: true,
        data: {
          imageUrl: fallbackImageUrl,
          revisedPrompt: prompt,
          size,
          quality,
          style,
          prompt,
          isFallback: true,
          message: 'AI image generation temporarily unavailable',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate image',
      message: error.message
    });
  }
});

// Text analysis endpoint
router.post('/analyze', [
  body('text').notEmpty().trim(),
  body('type').isIn(['sentiment', 'keywords', 'summary', 'language'])
], verifyToken, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { text, type } = req.body;
    const userId = req.user.userId;

    let analysisResult = {};

    switch (type) {
      case 'sentiment':
        // Mock sentiment analysis
        const sentiments = ['positive', 'neutral', 'negative'];
        const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
        const confidence = 0.6 + Math.random() * 0.4;
        
        analysisResult = {
          sentiment,
          confidence,
          score: sentiment === 'positive' ? confidence : sentiment === 'negative' ? -confidence : 0
        };
        break;

      case 'keywords':
        // Mock keyword extraction
        const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        const uniqueWords = [...new Set(words)];
        const keywords = uniqueWords.slice(0, 10);
        
        analysisResult = {
          keywords,
          count: keywords.length
        };
        break;

      case 'summary':
        // Mock text summarization
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const summaryLength = Math.min(3, sentences.length);
        const summary = sentences.slice(0, summaryLength).join('. ') + '.';
        
        analysisResult = {
          summary,
          originalLength: text.length,
          summaryLength: summary.length,
          compressionRatio: (summary.length / text.length).toFixed(2)
        };
        break;

      case 'language':
        // Mock language detection
        const languages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
        const detectedLanguage = languages[Math.floor(Math.random() * languages.length)];
        
        analysisResult = {
          language: detectedLanguage,
          confidence: 0.8 + Math.random() * 0.2
        };
        break;
    }

    res.status(200).json({
      success: true,
      data: {
        type,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        analysis: analysisResult,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Text analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze text',
      message: error.message
    });
  }
});

// AI models info endpoint
router.get('/models', verifyToken, async (req, res) => {
  try {
    const models = {
      chat: [
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          description: 'Fast and efficient for most tasks',
          maxTokens: 4096,
          cost: 0.002
        },
        {
          id: 'gpt-4',
          name: 'GPT-4',
          description: 'More capable for complex tasks',
          maxTokens: 8192,
          cost: 0.03
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          description: 'Latest and most powerful model',
          maxTokens: 128000,
          cost: 0.01
        }
      ],
      voice: [
        {
          id: 'alloy',
          name: 'Alloy',
          description: 'Neutral and versatile'
        },
        {
          id: 'echo',
          name: 'Echo',
          description: 'Male voice'
        },
        {
          id: 'fable',
          name: 'Fable',
          description: 'British accent'
        },
        {
          id: 'onyx',
          name: 'Onyx',
          description: 'Deep male voice'
        },
        {
          id: 'nova',
          name: 'Nova',
          description: 'Female voice'
        },
        {
          id: 'shimmer',
          name: 'Shimmer',
          description: 'Soft female voice'
        }
      ],
      image: [
        {
          id: 'dall-e-3',
          name: 'DALL-E 3',
          description: 'Latest image generation model',
          maxResolution: '1024x1024',
          styles: ['vivid', 'natural']
        }
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        models,
        availableServices: {
          chat: process.env.OPENAI_API_KEY ? true : false,
          voice: process.env.OPENAI_API_KEY ? true : false,
          image: process.env.OPENAI_API_KEY ? true : false
        }
      }
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI models',
      message: error.message
    });
  }
});

module.exports = router;
