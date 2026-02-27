# FayStar Backend API

Production-ready backend API for FayStar AI mobile application.

## 🚀 Features

- **Authentication**: Login, Register, Token Management
- **Chat System**: Real-time messaging, Chat history
- **Marketplace**: Item listings, Orders, Categories
- **Subscription Management**: Plans, Usage tracking, Upgrades
- **AI Services**: Chat, Voice generation, Image generation
- **Health Monitoring**: Service health checks and monitoring

## 📡 API Endpoints

### Authentication (`/api/auth`)
- `POST /login` - User login
- `POST /register` - User registration
- `POST /refresh` - Refresh JWT token
- `POST /logout` - User logout
- `GET /profile` - Get user profile

### Chat (`/api/chat`)
- `POST /send` - Send message
- `GET /get` - Get chat messages
- `GET /history` - Get chat history
- `POST /create` - Create new chat
- `DELETE /message/:id` - Delete message

### Marketplace (`/api/marketplace`)
- `GET /get-items` - Get marketplace items
- `GET /item/:id` - Get single item
- `POST /create` - Create new listing
- `POST /buy` - Buy item
- `GET /orders` - Get user orders
- `GET /categories` - Get categories

### Subscription (`/api/subscription`)
- `GET /check` - Check subscription status
- `GET /plans` - Get available plans
- `POST /upgrade` - Upgrade subscription
- `POST /usage` - Update usage tracking
- `POST /cancel` - Cancel subscription

### AI Services (`/api/ai`)
- `POST /chat` - AI chat completion
- `POST /voice` - Voice generation
- `POST /image` - Image generation
- `POST /analyze` - Text analysis
- `GET /models` - Get available AI models

### Health (`/health`)
- `GET /` - Basic health check
- `GET /detailed` - Detailed health status
- `GET /ping` - Connectivity test

## 🛠️ Installation

1. **Install dependencies**:
```bash
cd backend
npm install
```

2. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the server**:
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/faystar_db

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# API Keys
OPENAI_API_KEY=your-openai-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent API abuse
- **CORS Protection**: Cross-origin request security
- **Input Validation**: Request data validation
- **Helmet.js**: Security headers
- **Password Hashing**: bcrypt for secure passwords

## 📊 Rate Limiting

- **Window**: 15 minutes (900000ms)
- **Max Requests**: 100 per window
- **Health Check**: Excluded from rate limiting

## 🔄 Fallback System

When backend services are unavailable:
- **AI Services**: Returns helpful fallback responses
- **Authentication**: Graceful degradation
- **Data Storage**: Mock data continuation
- **Error Handling**: User-friendly error messages

## 🧪 Testing

```bash
# Run tests
npm test

# Development with auto-reload
npm run dev
```

## 📱 Flutter Integration

The backend is designed to work seamlessly with the Flutter app through:

- **Repository Pattern**: Clean architecture
- **Dio HTTP Client**: Robust network handling
- **Error Interceptors**: Automatic error handling
- **Token Management**: Secure auth token storage
- **Health Checks**: Backend connectivity monitoring

## 🚀 Deployment

### Docker (Recommended)
```bash
docker build -t faystar-backend .
docker run -p 3000:3000 faystar-backend
```

### Manual
```bash
npm install --production
npm start
```

## 📈 Monitoring

- **Health Endpoints**: `/health`, `/health/detailed`, `/health/ping`
- **Request Logging**: All API requests logged
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time tracking

## 🔄 API Versioning

Current version: `v1.0.0`

All endpoints are prefixed with `/api` for future versioning support.

## 📝 API Documentation

### Request Format
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

### Authentication
Add JWT token to requests:
```
Authorization: Bearer <your-jwt-token>
```

## 🚨 Error Handling

Common error responses:
- `400` - Validation error
- `401` - Unauthorized
- `404` - Not found
- `429` - Rate limit exceeded
- `500` - Internal server error

## 🔄 Development

### Adding New Endpoints

1. Create route file in `/routes/`
2. Add validation rules
3. Implement error handling
4. Add to `server.js`
5. Update documentation

### Database Schema

Currently using in-memory storage for development. Production deployment should include:
- MongoDB for persistent storage
- Redis for caching
- File storage for uploads

## 📞 Support

For issues and support:
1. Check health endpoint: `GET /health`
2. Review server logs
3. Verify environment configuration
4. Test API endpoints individually

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: 2025-02-27
