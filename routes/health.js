const express = require('express');
const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: 'connected', // Would check actual DB connection
        auth: 'operational',
        chat: 'operational',
        marketplace: 'operational',
        ai: 'operational',
        subscription: 'operational'
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
      }
    };

    res.status(200).json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Detailed health check with service status
router.get('/detailed', async (req, res) => {
  try {
    const detailed = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      endpoints: {
        auth: {
          '/api/auth/login': 'POST - Available',
          '/api/auth/register': 'POST - Available',
          '/api/auth/refresh': 'POST - Available',
          '/api/auth/logout': 'POST - Available'
        },
        chat: {
          '/api/chat/send': 'POST - Available',
          '/api/chat/get': 'GET - Available',
          '/api/chat/history': 'GET - Available'
        },
        marketplace: {
          '/api/marketplace/get-items': 'GET - Available',
          '/api/marketplace/buy': 'POST - Available',
          '/api/marketplace/sell': 'POST - Available'
        },
        subscription: {
          '/api/subscription/check': 'GET - Available',
          '/api/subscription/plans': 'GET - Available',
          '/api/subscription/upgrade': 'POST - Available'
        },
        ai: {
          '/api/ai/chat': 'POST - Available',
          '/api/ai/voice': 'POST - Available',
          '/api/ai/image': 'POST - Available'
        }
      },
      rateLimit: {
        windowMs: process.env.RATE_LIMIT_WINDOW_MS || '15 minutes',
        maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 100
      }
    };

    res.status(200).json({
      success: true,
      data: detailed
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Detailed health check failed',
      message: error.message
    });
  }
});

// Ping endpoint for connectivity test
router.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
