const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Mock subscription database
const subscriptions = [];
const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    duration: 'lifetime',
    features: [
      'Basic chat functionality',
      'Limited marketplace access',
      '5 AI messages per day'
    ],
    limits: {
      aiMessages: 5,
      marketplaceListings: 3,
      storage: 100 // MB
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    duration: 'monthly',
    features: [
      'Unlimited chat functionality',
      'Full marketplace access',
      'Unlimited AI messages',
      'Voice cloning',
      'Priority support',
      'Advanced analytics'
    ],
    limits: {
      aiMessages: -1, // Unlimited
      marketplaceListings: -1,
      storage: 10000 // 10GB
    }
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 29.99,
    duration: 'monthly',
    features: [
      'Everything in Pro',
      'AI video generation',
      'Advanced voice features',
      'White label options',
      'API access',
      'Dedicated support'
    ],
    limits: {
      aiMessages: -1,
      marketplaceListings: -1,
      storage: 50000 // 50GB
    }
  }
];

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

// Check subscription status
router.get('/check', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find user subscription
    let subscription = subscriptions.find(sub => 
      sub.userId === userId && 
      sub.status === 'active'
    );

    // If no subscription, create free one
    if (!subscription) {
      subscription = {
        id: Date.now().toString(),
        userId,
        planId: 'free',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: null,
        features: plans.find(p => p.id === 'free').features,
        limits: plans.find(p => p.id === 'free').limits,
        usage: {
          aiMessages: 0,
          marketplaceListings: 0,
          storage: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      subscriptions.push(subscription);
    }

    const plan = plans.find(p => p.id === subscription.planId);

    res.status(200).json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          features: subscription.features,
          limits: subscription.limits,
          usage: subscription.usage
        },
        plan,
        isPro: subscription.planId !== 'free',
        canAccessProFeatures: ['pro', 'premium'].includes(subscription.planId)
      }
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription',
      message: error.message
    });
  }
});

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        plans
      }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get plans',
      message: error.message
    });
  }
});

// Upgrade subscription
router.post('/upgrade', [
  body('planId').isIn(['free', 'pro', 'premium']),
  body('paymentMethodId').optional().notEmpty()
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

    const { planId, paymentMethodId } = req.body;
    const userId = req.user.userId;

    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan'
      });
    }

    // Find existing subscription
    let subscription = subscriptions.find(sub => 
      sub.userId === userId && 
      sub.status === 'active'
    );

    if (subscription) {
      // Update existing subscription
      subscription.planId = planId;
      subscription.status = 'active';
      subscription.features = plan.features;
      subscription.limits = plan.limits;
      subscription.updatedAt = new Date().toISOString();
      
      if (planId !== 'free') {
        subscription.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
      } else {
        subscription.endDate = null;
      }
    } else {
      // Create new subscription
      subscription = {
        id: Date.now().toString(),
        userId,
        planId,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: planId !== 'free' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
        features: plan.features,
        limits: plan.limits,
        usage: {
          aiMessages: 0,
          marketplaceListings: 0,
          storage: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      subscriptions.push(subscription);
    }

    // In a real implementation, process payment here
    const paymentProcessed = plan.price === 0 || paymentMethodId;

    if (!paymentProcessed) {
      return res.status(400).json({
        success: false,
        error: 'Payment processing failed'
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully upgraded to ${plan.name} plan`,
      data: {
        subscription,
        plan
      }
    });
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upgrade subscription',
      message: error.message
    });
  }
});

// Update usage
router.post('/usage', [
  body('type').isIn(['aiMessages', 'marketplaceListings', 'storage']),
  body('amount').isInt({ min: 1 })
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

    const { type, amount } = req.body;
    const userId = req.user.userId;

    const subscription = subscriptions.find(sub => 
      sub.userId === userId && 
      sub.status === 'active'
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Check limits
    const limit = subscription.limits[type];
    const currentUsage = subscription.usage[type] || 0;

    if (limit !== -1 && currentUsage + amount > limit) {
      return res.status(429).json({
        success: false,
        error: 'Usage limit exceeded',
        data: {
          type,
          current: currentUsage,
          requested: amount,
          limit,
          remaining: Math.max(0, limit - currentUsage)
        }
      });
    }

    // Update usage
    subscription.usage[type] = currentUsage + amount;
    subscription.updatedAt = new Date().toISOString();

    res.status(200).json({
      success: true,
      message: 'Usage updated successfully',
      data: {
        type,
        newUsage: subscription.usage[type],
        limit,
        remaining: limit === -1 ? 'Unlimited' : Math.max(0, limit - subscription.usage[type])
      }
    });
  } catch (error) {
    console.error('Update usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update usage',
      message: error.message
    });
  }
});

// Cancel subscription
router.post('/cancel', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const subscription = subscriptions.find(sub => 
      sub.userId === userId && 
      sub.status === 'active'
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Set subscription to expire at end of period
    subscription.status = 'cancelled';
    subscription.updatedAt = new Date().toISOString();

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        subscription,
        willExpireOn: subscription.endDate
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
      message: error.message
    });
  }
});

module.exports = router;
