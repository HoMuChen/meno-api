# Refresh Token Implementation

This document describes the refresh token implementation for Meno API.

## Overview

The authentication system now supports **short-lived access tokens** and **long-lived refresh tokens** for enhanced security. This implementation follows industry best practices for token-based authentication.

## Features

### ✅ Implemented Features

1. **Dual Token System**
   - **Access tokens**: JWT signed with `JWT_SECRET` (short-lived, default: 1 day)
   - **Refresh tokens**: Random cryptographic strings (long-lived, default: 7 days)
   - Both durations configurable via environment variables

   **Why different token types?**
   - Access tokens are JWTs for stateless verification
   - Refresh tokens are random strings for immediate revocation capability

2. **Token Rotation**
   - New refresh token generated on each refresh
   - Old refresh token automatically revoked
   - Prevents token reuse attacks

3. **Secure Storage**
   - Refresh tokens stored in MongoDB
   - TTL (Time To Live) index for automatic cleanup
   - Token revocation support

4. **Multiple Authentication Methods**
   - Email/password login
   - Google OAuth (web)
   - Google OAuth (Chrome extension)
   - All methods return both tokens

5. **Enhanced Security**
   - Refresh tokens stored in httpOnly cookies (XSS protection)
   - Google OAuth callback redirects with access token only
   - Access token in URL (short-lived, acceptable risk)
   - Cookie auto-updated on token refresh

6. **Complete API**
   - `/auth/signup` - Returns both tokens
   - `/auth/login` - Returns both tokens
   - `/auth/refresh` - Exchange refresh token for new token pair
   - `/auth/logout` - Revoke refresh token
   - `/auth/google/callback` - Secure token transfer via postMessage
   - `/auth/google/token` - Chrome extension token exchange

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# Access token (JWT) - short-lived, signed token
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ACCESS_TOKEN_EXPIRY=1d

# Refresh token - long-lived, random cryptographic string (not JWT)
# Note: Refresh tokens are generated using crypto.randomBytes() and don't require a signing secret
REFRESH_TOKEN_EXPIRY=7d
```

**Important:** Refresh tokens are **not JWTs**. They are cryptographically random 128-character strings generated with `crypto.randomBytes(64).toString('hex')` and stored in the database. This approach is more secure than JWT refresh tokens because they can be revoked immediately.

### Duration Format

Supported formats for token expiry:
- `s` - seconds (e.g., `3600s`)
- `m` - minutes (e.g., `60m`)
- `h` - hours (e.g., `24h`)
- `d` - days (e.g., `7d`)

### Recommended Settings

**Development:**
```env
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d
```

**Production:**
```env
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d
```

## API Endpoints

### POST /auth/signup

Register a new user and receive tokens.

**Request:**
```json
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
      "name": "John Doe"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "abc123...",
    "expiresIn": 86400
  }
}
```

### POST /auth/login

Login and receive tokens.

**Request:**
```json
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
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "refreshToken": "abc123...",
    "expiresIn": 86400
  }
}
```

### POST /auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "your-refresh-token-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": { ... },
    "accessToken": "NEW_ACCESS_TOKEN",
    "refreshToken": "NEW_REFRESH_TOKEN",
    "expiresIn": 86400
  }
}
```

**Error Responses:**
- `400` - Missing refresh token
- `401` - Invalid or expired refresh token

### POST /auth/logout

Revoke refresh token (logout).

**Request:**
```json
{
  "refreshToken": "your-refresh-token-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### GET /auth/google/callback

Google OAuth callback handler. Sets httpOnly cookie for refresh token and redirects with access token.

**Flow:**
1. User clicks "Login with Google"
2. Browser redirects to OAuth provider
3. User authenticates with Google
4. Backend generates tokens
5. Backend sets httpOnly cookie with refresh token
6. Backend redirects to frontend with access token in URL
7. Frontend reads access token from URL and stores it

**Frontend Implementation:**
```javascript
// After Google OAuth redirect, extract token from URL
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('token');

if (accessToken) {
  // Store access token (short-lived)
  localStorage.setItem('accessToken', accessToken);

  // Refresh token is already in httpOnly cookie!
  // No manual handling needed

  // Clean up URL
  window.history.replaceState({}, document.title, window.location.pathname);

  // Fetch user info
  fetch('/auth/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }).then(/* update UI */);
}
```

### POST /auth/google/token

Chrome extension Google OAuth token exchange.

**Request:**
```json
{
  "idToken": "google-id-token",
  "accessToken": "google-access-token"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "abc123...",
  "expiresIn": 86400,
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "picture": "..."
  }
}
```

## Frontend Integration

### Token Storage

```javascript
// Store access token after login/signup
// Refresh token is automatically stored in httpOnly cookie by server!
function storeAccessToken(accessToken, expiresIn) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('tokenExpiry', Date.now() + expiresIn * 1000);
}

// Get access token
function getAccessToken() {
  return localStorage.getItem('accessToken');
}

// Clear tokens on logout
function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('tokenExpiry');
  // httpOnly cookie will be cleared by server on /auth/logout
}
```

### Automatic Token Refresh

```javascript
// Axios interceptor for automatic token refresh
// IMPORTANT: Configure axios to send cookies
axios.defaults.withCredentials = true;

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 error and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Call refresh endpoint
        // Refresh token is sent automatically via httpOnly cookie!
        const response = await axios.post('/auth/refresh', {}, {
          withCredentials: true // Send cookies
        });

        const { accessToken, expiresIn } = response.data.data;

        // Store new access token
        // New refresh token is automatically updated in cookie by server
        storeAccessToken(accessToken, expiresIn);

        // Update authorization header
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

        // Retry original request
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### Logout

```javascript
async function logout() {
  try {
    // Call logout endpoint to revoke refresh token
    // Refresh token sent automatically via httpOnly cookie
    await axios.post('/auth/logout', {}, {
      withCredentials: true // Send cookies
    });

    // Clear local storage
    clearTokens();

    // Redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
    // Clear tokens anyway
    clearTokens();
    window.location.href = '/login';
  }
}
```

## Chrome Extension Integration

### Manifest Configuration

```json
{
  "permissions": [
    "identity",
    "storage"
  ],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["profile", "email"]
  }
}
```

### Authentication Flow

```javascript
// Get Google tokens
chrome.identity.getAuthToken({ interactive: true }, async (token) => {
  if (chrome.runtime.lastError || !token) {
    console.error('Failed to get Google token');
    return;
  }

  try {
    // Exchange Google tokens for backend tokens
    const response = await fetch('http://localhost:6001/auth/google/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idToken: token,
        accessToken: token
      })
    });

    const data = await response.json();
    const { accessToken, refreshToken, expiresIn, user } = data;

    // Store tokens in chrome.storage.local
    chrome.storage.local.set({
      accessToken,
      refreshToken,
      tokenExpiry: Date.now() + expiresIn * 1000,
      user
    });

    console.log('Authenticated:', user);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
});
```

## Database Schema

### RefreshToken Model

```javascript
{
  token: String,           // Refresh token (128 characters)
  userId: ObjectId,        // Reference to User
  expiresAt: Date,         // Expiration date
  revoked: Boolean,        // Revocation status
  revokedAt: Date,         // Revocation timestamp
  createdAt: Date,         // Creation timestamp
  updatedAt: Date          // Last update timestamp
}
```

### Indexes

- `token` (unique) - Fast token lookup
- `userId` - Find all user tokens
- `expiresAt` (TTL) - Automatic cleanup of expired tokens
- `userId + revoked` (compound) - Find active user tokens

## Security Considerations

### Implemented Security Measures

1. **Token Rotation**
   - Each refresh generates a new token pair
   - Old refresh token is immediately revoked
   - Prevents token reuse attacks

2. **No Tokens in URLs**
   - Google OAuth callback uses `postMessage` API
   - Tokens never exposed in query parameters
   - Prevents token leakage via browser history/logs

3. **Separate Secrets**
   - Access and refresh tokens use different secrets
   - Compromised access token doesn't expose refresh capability

4. **TTL Indexes**
   - Expired tokens automatically deleted from database
   - Reduces database size and improves performance

5. **Revocation Support**
   - Logout revokes refresh tokens
   - Can revoke individual tokens
   - Can revoke all user tokens (useful for security incidents)

### Best Practices for Production

1. **Use HTTPS**
   - Always use HTTPS in production
   - Prevents man-in-the-middle attacks

2. **Secure Storage**
   - Consider using `httpOnly` cookies for refresh tokens
   - Prevents XSS attacks from stealing tokens

3. **Short Access Token Expiry**
   - Use 15-30 minutes for access tokens in production
   - Reduces impact of token compromise

4. **Long Refresh Token Expiry**
   - Use 7-30 days for refresh tokens
   - Balance security and user experience

5. **Rate Limiting**
   - Implement rate limiting on `/auth/refresh`
   - Prevents brute force attacks

6. **Monitoring**
   - Log all token refresh attempts
   - Alert on suspicious patterns (many refreshes from same IP)

## Migration Guide

### Existing Users

The implementation is backward compatible:

1. **Existing users** can continue using their current tokens
2. **New logins** will receive both access and refresh tokens
3. **No forced re-login** required

### Frontend Updates Required

1. **Update token storage** to handle both tokens
2. **Implement token refresh** interceptor
3. **Update Google OAuth** to use postMessage API
4. **Update logout** to revoke refresh token

### Gradual Rollout

1. Deploy backend changes
2. Update frontend to support new token format
3. Existing users continue working
4. New logins get refresh tokens
5. Optional: Force re-login after X days for full migration

## Testing

See `test-refresh-token.http` for comprehensive API testing examples.

### Manual Testing Checklist

- [ ] Sign up with email/password returns both tokens
- [ ] Login with email/password returns both tokens
- [ ] Access token works for protected endpoints
- [ ] Refresh endpoint exchanges tokens correctly
- [ ] Old refresh token is revoked after refresh
- [ ] Logout revokes refresh token
- [ ] Revoked token cannot be used for refresh
- [ ] Google OAuth returns both tokens
- [ ] Google OAuth doesn't expose tokens in URL
- [ ] Chrome extension token exchange returns both tokens

## Troubleshooting

### Common Issues

**Issue:** "Refresh token is invalid or expired"
- **Cause:** Token was already used or revoked
- **Solution:** User must log in again

**Issue:** Tokens not received after Google OAuth
- **Cause:** `postMessage` event listener not set up
- **Solution:** Add event listener before opening popup

**Issue:** "Access token expired"
- **Cause:** Access token lifetime reached
- **Solution:** Use refresh token to get new access token

**Issue:** Chrome extension authentication fails
- **Cause:** Incorrect Google OAuth configuration
- **Solution:** Verify `client_id` in manifest matches backend

## Token Architecture

### Access Tokens (JWT)

**Type:** JSON Web Token (JWT)
**Secret:** `JWT_SECRET`
**Expiry:** Configurable (default: 1 day)
**Storage:** Client-side (localStorage or memory)
**Validation:** Signature verification using `JWT_SECRET`

**Structure:**
```javascript
{
  userId: "507f1f77bcf86cd799439011",
  email: "user@example.com",
  iat: 1641234567,
  exp: 1641320967
}
```

**Why JWT?**
- Stateless verification (no database lookup needed)
- Contains user information
- Can be verified independently by any service with the secret

### Refresh Tokens (Random String)

**Type:** Cryptographically random string
**Generation:** `crypto.randomBytes(64).toString('hex')`
**Length:** 128 characters
**Expiry:** Configurable (default: 7 days)
**Storage:** Server-side (database) + Client-side (httpOnly cookie)
**Validation:** Database lookup

**Example:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8
```

**Why Random Strings?**
- Impossible to forge (cryptographic randomness)
- Can be revoked immediately (database-backed)
- Smaller attack surface (not decodable)
- No secret key management needed

### Comparison

| Feature | Access Token (JWT) | Refresh Token (Random) |
|---------|-------------------|------------------------|
| **Type** | JSON Web Token | Random String |
| **Secret** | JWT_SECRET | None (random) |
| **Verification** | Signature check | Database lookup |
| **Revocation** | Not possible | Immediate |
| **Storage** | Client + None | Client + Database |
| **Decodable** | Yes (base64) | No (random bytes) |
| **Size** | ~200-300 bytes | 128 characters |

---

## Architecture Decisions

### Why Token Rotation?

Token rotation (generating new refresh token on each use) provides:
- Detection of token theft
- Limits the window of attack
- Industry best practice for refresh tokens

### Why postMessage for Google OAuth?

Using `postMessage` instead of URL redirect:
- Prevents token exposure in browser history
- Prevents token leakage via Referer headers
- Prevents token logging in server logs
- Better security posture

### Why Plain Text Storage?

Refresh tokens are stored in plain text (not hashed) because:
- Simpler implementation as requested
- TTL index provides automatic cleanup
- Token rotation provides security
- Can be upgraded to hashed storage later if needed

## Future Enhancements

Possible improvements for future versions:

1. **Token Hashing**
   - Hash refresh tokens before database storage
   - Protects against database breaches

2. **Token Families**
   - Track token generation lineage
   - Detect and prevent token reuse attacks
   - Revoke entire family on suspicious activity

3. **Device Tracking**
   - Store device info (user-agent, IP, platform)
   - Allow users to view active sessions
   - Enable per-device token revocation

4. **Rate Limiting**
   - Limit refresh requests per user
   - Prevent brute force attacks

5. **Audit Logging**
   - Log all token operations
   - Track suspicious patterns
   - Security analytics

## Support

For issues or questions:
- Check the API documentation: `/api-docs`
- Review error logs in `./logs`
- Test endpoints using `test-refresh-token.http`

## Version History

- **v1.0.0** (2025-11-12)
  - Initial implementation
  - Dual token system (access + refresh)
  - Token rotation
  - Secure Google OAuth callback
  - Chrome extension support
