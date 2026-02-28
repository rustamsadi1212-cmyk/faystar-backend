const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();

// Mock chat database
const chats = [];
const messages = [];

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

// Send message endpoint
router.post('/send', [
  body('chatId').notEmpty(),
  body('message').notEmpty().trim(),
  body('recipientId').notEmpty()
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

    const { chatId, message, recipientId } = req.body;
    const senderId = req.user.userId;

    // Create message
    const newMessage = {
      id: Date.now().toString(),
      chatId,
      senderId,
      recipientId,
      message,
      timestamp: new Date().toISOString(),
      type: 'text',
      status: 'sent',
      isRead: false
    };

    messages.push(newMessage);

    // Update chat last message
    let chat = chats.find(c => c.id === chatId);
    if (!chat) {
      // Create new chat if doesn't exist
      chat = {
        id: chatId,
        participants: [senderId, recipientId],
        lastMessage: newMessage.message,
        lastMessageTime: newMessage.timestamp,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      chats.push(chat);
    } else {
      chat.lastMessage = newMessage.message;
      chat.lastMessageTime = newMessage.timestamp;
      chat.updatedAt = new Date().toISOString();
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: newMessage
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error.message
    });
  }
});

// Get messages endpoint
router.get('/get', [
  query('chatId').notEmpty()
], verifyToken, async (req, res) => {
  try {
    const { chatId } = req.query;
    const userId = req.user.userId;

    // Get chat messages
    const chatMessages = messages.filter(msg => 
      msg.chatId === chatId && 
      (msg.senderId === userId || msg.recipientId === userId)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Mark messages as read
    chatMessages.forEach(msg => {
      if (msg.recipientId === userId && !msg.isRead) {
        msg.isRead = true;
        msg.readAt = new Date().toISOString();
      }
    });

    // Get chat info
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        chat,
        messages: chatMessages
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
      message: error.message
    });
  }
});

// Get chat history endpoint
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user chats
    const userChats = chats.filter(chat => 
      chat.participants.includes(userId)
    ).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    // Get last message for each chat
    const chatsWithLastMessage = userChats.map(chat => {
      const lastMessage = messages
        .filter(msg => msg.chatId === chat.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      return {
        ...chat,
        lastMessage,
        unreadCount: messages.filter(msg => 
          msg.chatId === chat.id && 
          msg.recipientId === userId && 
          !msg.isRead
        ).length
      };
    });

    res.status(200).json({
      success: true,
      data: {
        chats: chatsWithLastMessage
      }
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat history',
      message: error.message
    });
  }
});

// Create new chat endpoint
router.post('/create', [
  body('participantId').notEmpty()
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

    const { participantId } = req.body;
    const creatorId = req.user.userId;

    // Generate unique chat ID
    const chatId = `chat_${Date.now()}_${creatorId}_${participantId}`;

    // Check if chat already exists
    const existingChat = chats.find(chat => 
      chat.participants.includes(creatorId) && 
      chat.participants.includes(participantId)
    );

    if (existingChat) {
      return res.status(409).json({
        success: false,
        error: 'Chat already exists',
        data: {
          chatId: existingChat.id
        }
      });
    }

    // Create new chat
    const newChat = {
      id: chatId,
      participants: [creatorId, participantId],
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    chats.push(newChat);

    res.status(201).json({
      success: true,
      message: 'Chat created successfully',
      data: {
        chat: newChat
      }
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat',
      message: error.message
    });
  }
});

// Delete message endpoint
router.delete('/message/:messageId', verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const messageIndex = messages.findIndex(msg => 
      msg.id === messageId && msg.senderId === userId
    );

    if (messageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Mark message as deleted
    messages[messageIndex].status = 'deleted';
    messages[messageIndex].deletedAt = new Date().toISOString();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message',
      message: error.message
    });
  }
});

module.exports = router;
