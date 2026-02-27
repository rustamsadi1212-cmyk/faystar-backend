# Fal.ai Video Generation API Documentation

## Overview
This API provides video generation capabilities using Fal.ai's Pika 1.0 model integrated into the FayStar backend.

## Base URL
```
http://localhost:3000/api/video
```

## Authentication
All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Generate Video
**POST** `/api/video/generate`

Generates a video using Fal.ai Pika 1.0 model.

#### Request Body
```json
{
  "prompt": "A beautiful sunset over mountains with cinematic lighting",
  "duration": 5,
  "aspectRatio": "16:9"
}
```

#### Parameters
- `prompt` (required, string): Text description of the video to generate (1-1000 characters)
- `duration` (optional, integer): Video duration in seconds (1-20, default: 5)
- `aspectRatio` (optional, string): Video aspect ratio (default: "16:9")
  - Available values: "16:9", "9:16", "1:1", "4:3", "21:9"

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "videoUrl": "https://fal-cdn.batuhan-941.workers.dev/video/123456789.mp4",
    "requestId": "req_123456789",
    "estimatedTime": "30-60 seconds",
    "duration": 5,
    "aspectRatio": "16:9",
    "prompt": "A beautiful sunset over mountains with cinematic lighting",
    "createdAt": "2024-02-27T21:00:00.000Z"
  },
  "message": "Video generation completed successfully"
}
```

#### Response (Error)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "prompt",
      "message": "Prompt is required",
      "value": ""
    }
  ]
}
```

### 2. Get Video Status
**GET** `/api/video/status/:requestId`

Check the status of a video generation request.

#### Parameters
- `requestId` (required, string): The request ID returned from the generate endpoint

#### Response
```json
{
  "success": true,
  "data": {
    "requestId": "req_123456789",
    "status": "completed",
    "videoUrl": "https://fal-cdn.batuhan-941.workers.dev/video/123456789.mp4",
    "progress": 1.0,
    "estimatedTime": "30-60 seconds",
    "createdAt": "2024-02-27T21:00:00.000Z"
  }
}
```

### 3. Health Check
**GET** `/api/video/health`

Check if the Fal.ai service is available.

#### Response
```json
{
  "success": true,
  "service": "fal.ai",
  "status": "healthy",
  "timestamp": "2024-02-27T21:00:00.000Z"
}
```

## Postman Collection Example

### Request Configuration
1. **Method**: POST
2. **URL**: `http://localhost:3000/api/video/generate`
3. **Headers**:
   - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `Content-Type`: `application/json`

### Request Body (raw JSON)
```json
{
  "prompt": "A futuristic city with flying cars at night, neon lights, cyberpunk style",
  "duration": 7,
  "aspectRatio": "16:9"
}
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "videoUrl": "https://storage.googleapis.com/fal-ai/video/generated_video_12345.mp4",
    "requestId": "req_abc123def456",
    "estimatedTime": "45-90 seconds",
    "duration": 7,
    "aspectRatio": "16:9",
    "prompt": "A futuristic city with flying cars at night, neon lights, cyberpunk style",
    "createdAt": "2024-02-27T21:15:30.123Z"
  },
  "message": "Video generation completed successfully"
}
```

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Token required"
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "prompt",
      "message": "Prompt must be between 1 and 1000 characters",
      "value": ""
    }
  ]
}
```

#### 429 Rate Limited
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many video generation requests. Please try again later",
  "retryAfter": 60
}
```

#### 500 Server Error
```json
{
  "success": false,
  "error": "Video generation failed",
  "message": "An error occurred while generating your video"
}
```

## Rate Limits
- Maximum 100 requests per 15 minutes per IP
- Additional rate limiting may be applied by Fal.ai API

## Environment Setup

1. Copy `.env.example` to `.env`
2. Set your Fal.ai API key:
   ```
   FAL_KEY=your-fal-ai-api-key-here
   ```
3. Restart the server

## Testing with Postman

1. Import the following collection into Postman:

```json
{
  "info": {
    "name": "FayStar Video API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Generate Video",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{jwt_token}}",
            "type": "text"
          },
          {
            "key": "Content-Type",
            "value": "application/json",
            "type": "text"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"prompt\": \"A beautiful sunset over mountains\",\n  \"duration\": 5,\n  \"aspectRatio\": \"16:9\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/video/generate",
          "host": ["{{base_url}}"],
          "path": ["api", "video", "generate"]
        }
      }
    },
    {
      "name": "Get Video Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{jwt_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/video/status/{{requestId}}",
          "host": ["{{base_url}}"],
          "path": ["api", "video", "status", "{{requestId}}"]
        }
      }
    },
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{base_url}}/api/video/health",
          "host": ["{{base_url}}"],
          "path": ["api", "video", "health"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "jwt_token",
      "value": "your-jwt-token-here"
    }
  ]
}
```

2. Set the environment variables:
   - `base_url`: `http://localhost:3000`
   - `jwt_token`: Your JWT token from authentication

3. Test the endpoints

## Notes
- Video generation typically takes 30-90 seconds
- Generated videos are hosted on Fal.ai CDN
- The service includes automatic retry logic for network issues
- All requests are logged for debugging purposes
- The API follows RESTful conventions and returns consistent JSON responses
