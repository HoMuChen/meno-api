# Authentication Implementation Guide

## Overview
This API now supports two authentication methods:
1. **Email/Password Authentication** - Traditional signup and login
2. **Google OAuth 2.0** - Social login via Google

## Setup Instructions

### 1. Environment Configuration

Update your `.env` file with the following variables:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3001
```

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set application type to **Web Application**
6. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` file

### 3. Start the Server

```bash
npm run dev
```

## API Endpoints

### Email/Password Authentication

#### 1. Signup
```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "...",
      "email": "user@example.com",
      "name": "John Doe",
      "provider": "email",
      "status": "active",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 2. Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "...",
      "email": "user@example.com",
      "name": "John Doe",
      "provider": "email",
      "status": "active"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 3. Get Current User Profile
```http
GET /auth/me
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "provider": "email",
    "status": "active"
  }
}
```

### Google OAuth Authentication

#### 1. Initiate Google Login
Navigate to:
```
http://localhost:3000/auth/google
```

This will redirect to Google's login page.

#### 2. Google Callback
After successful authentication, Google redirects to:
```
http://localhost:3000/auth/google/callback
```

Then the API redirects to your frontend with the JWT token:
```
http://localhost:3001/auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Testing with cURL

### Signup
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Profile
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Protecting Routes

To protect any route, use the `authenticate` middleware:

```javascript
const { authenticate } = require('./api/middleware/auth.middleware');

// In your routes file
router.get('/protected-route', authenticate, controller.method);
```

Example:
```javascript
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Public route
router.get('/public', (req, res) => {
  res.json({ message: 'This is public' });
});

// Protected route
router.get('/private', authenticate, (req, res) => {
  res.json({
    message: 'This is protected',
    user: req.user // User object is attached by middleware
  });
});

module.exports = router;
```

## User Model Fields

The User model now includes:

- `email` (String, required, unique)
- `name` (String, required)
- `password` (String, required for email provider, hashed)
- `provider` (String, enum: ['email', 'google'], default: 'email')
- `googleId` (String, unique for Google OAuth users)
- `avatar` (String, optional)
- `status` (String, enum: ['active', 'inactive', 'suspended'], default: 'active')
- `createdAt` (Date, auto-generated)
- `updatedAt` (Date, auto-generated)

## Security Features

1. **Password Hashing** - Passwords are hashed using bcrypt with salt rounds of 10
2. **JWT Tokens** - Stateless authentication using JSON Web Tokens
3. **Token Expiry** - Tokens expire after 7 days (configurable)
4. **Password Validation** - Minimum 6 characters
5. **Email Validation** - Valid email format required
6. **Selective Password Queries** - Password field excluded by default from queries
7. **Account Status** - Users can be active, inactive, or suspended

## Frontend Integration Example

### Signup/Login Flow
```javascript
// Signup
const signup = async (email, password, name) => {
  const response = await fetch('http://localhost:3000/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });

  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
  }
  return data;
};

// Login
const login = async (email, password) => {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
  }
  return data;
};

// Get Profile
const getProfile = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:3000/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
};

// Google OAuth - Open in popup or redirect
const loginWithGoogle = () => {
  window.location.href = 'http://localhost:3000/auth/google';
};

// Handle OAuth callback (in your frontend route)
const handleOAuthCallback = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    localStorage.setItem('token', token);
    // Fetch user profile
    getProfile().then(data => {
      localStorage.setItem('user', JSON.stringify(data.data));
      // Redirect to dashboard
      window.location.href = '/dashboard';
    });
  }
};
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common error codes:
- `400` - Validation error or bad request
- `401` - Unauthorized (invalid credentials or token)
- `409` - Conflict (user already exists)
- `500` - Internal server error

## Next Steps

1. **Update your `.env` file** with the required authentication variables
2. **Get Google OAuth credentials** from Google Cloud Console
3. **Test the endpoints** using cURL, Postman, or your frontend application
4. **Protect your routes** using the authenticate middleware
5. **Customize the frontend redirect URLs** in the auth controller if needed

## Documentation

API documentation is available at:
```
http://localhost:3000/api-docs
```

The Swagger documentation includes all authentication endpoints with request/response examples.
