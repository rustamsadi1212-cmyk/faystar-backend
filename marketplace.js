const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();

// Mock marketplace database
const items = [];
const orders = [];
const categories = [
  'Electronics', 'Fashion', 'Home & Garden', 'Sports', 'Books', 
  'Toys', 'Automotive', 'Health', 'Food', 'Services'
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

// Get marketplace items
router.get('/get-items', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isIn(categories),
  query('search').optional().trim()
], async (req, res) => {
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
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Filter items
    let filteredItems = items.filter(item => item.status === 'active');

    if (category) {
      filteredItems = filteredItems.filter(item => item.category === category);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredItems = filteredItems.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort items
    filteredItems.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'desc') {
        return new Date(bValue) - new Date(aValue);
      } else {
        return new Date(aValue) - new Date(bValue);
      }
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        items: paginatedItems,
        pagination: {
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit),
          totalItems: filteredItems.length,
          totalPages: Math.ceil(filteredItems.length / limit)
        },
        filters: {
          categories,
          availableCategories: [...new Set(items.map(item => item.category))]
        }
      }
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get items',
      message: error.message
    });
  }
});

// Get single item
router.get('/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const item = items.find(i => i.id === itemId && i.status === 'active');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        item
      }
    });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get item',
      message: error.message
    });
  }
});

// Create new listing
router.post('/create', [
  body('title').notEmpty().trim(),
  body('description').notEmpty().trim(),
  body('price').isFloat({ min: 0 }),
  body('category').isIn(categories),
  body('condition').isIn(['new', 'like-new', 'good', 'fair', 'poor'])
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

    const { title, description, price, category, condition, images = [] } = req.body;
    const sellerId = req.user.userId;

    const newItem = {
      id: Date.now().toString(),
      title,
      description,
      price: parseFloat(price),
      category,
      condition,
      images,
      sellerId,
      status: 'active',
      views: 0,
      likes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    items.push(newItem);

    res.status(201).json({
      success: true,
      message: 'Item listed successfully',
      data: {
        item: newItem
      }
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create item',
      message: error.message
    });
  }
});

// Buy item
router.post('/buy', [
  body('itemId').notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('shippingAddress').notEmpty()
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

    const { itemId, quantity, shippingAddress } = req.body;
    const buyerId = req.user.userId;

    // Find item
    const item = items.find(i => i.id === itemId && i.status === 'active');
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    if (item.sellerId === buyerId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot buy your own item'
      });
    }

    // Create order
    const newOrder = {
      id: Date.now().toString(),
      itemId,
      buyerId,
      sellerId: item.sellerId,
      quantity,
      totalPrice: item.price * quantity,
      shippingAddress,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    orders.push(newOrder);

    // Update item status
    item.status = 'sold';
    item.updatedAt = new Date().toISOString();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        order: newOrder
      }
    });
  } catch (error) {
    console.error('Buy item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place order',
      message: error.message
    });
  }
});

// Get user orders
router.get('/orders', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userOrders = orders.filter(order => 
      order.buyerId === userId || order.sellerId === userId
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Add item details to orders
    const ordersWithItems = userOrders.map(order => {
      const item = items.find(i => i.id === order.itemId);
      return {
        ...order,
        item
      };
    });

    res.status(200).json({
      success: true,
      data: {
        orders: ordersWithItems
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders',
      message: error.message
    });
  }
});

// Get categories
router.get('/categories', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        categories,
        itemCounts: categories.map(cat => ({
          category: cat,
          count: items.filter(item => item.category === cat && item.status === 'active').length
        }))
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories',
      message: error.message
    });
  }
});

module.exports = router;
