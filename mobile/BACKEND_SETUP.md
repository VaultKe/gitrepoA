# Backend Setup Guide

## CORS Error Fix

The CORS error occurs because the frontend (running on a different port) is trying to access the backend API, but the backend doesn't have CORS headers configured.

### Quick Fix for Development

The app now includes **automatic fallback to mock data** when the backend is not available or has CORS issues. This allows you to continue development without a backend.

### Backend CORS Configuration

If you want to run the actual Golang backend, you need to configure CORS. Here's how:

#### 1. Install CORS Middleware (Gin Framework)

```bash
go get github.com/gin-contrib/cors
```

#### 2. Add CORS Configuration to Your Gin Server

```go
package main

import (
    "github.com/gin-gonic/gin"
    "github.com/gin-contrib/cors"
    "time"
)

func main() {
    r := gin.Default()

    // CORS configuration
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:19006", "http://dqtl6f-ip-41-139-130-223.tunnelmole.net", "http://localhost:3000"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
        ExposeHeaders:    []string{"Content-Length"},
        AllowCredentials: true,
        MaxAge:          12 * time.Hour,
    }))

    // Your API routes here
    api := r.Group("/api/v1")
    {
        // Add your routes
    }

    r.Run(":8080")
}
```

#### 3. Alternative: Manual CORS Headers

If you prefer to add CORS headers manually:

```go
func CORSMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
        c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }

        c.Next()
    }
}

// Use the middleware
r.Use(CORSMiddleware())
```

### Frontend Configuration

The frontend is configured to:

1. **Try the real backend first** at `http://localhost:8080/api/v1`
2. **Automatically fallback to mock data** if backend is unavailable
3. **Show console logs** indicating when mock data is being used

### Mock Data Available

The following endpoints have mock data available:

- `/marketplace/products` - Sample marketplace products
- `/chat/rooms/{id}/messages` - Sample chat messages  
- `/chamas` - Sample chama groups

### Running the Backend

1. Make sure your Golang backend is running on port 8080
2. Ensure CORS is properly configured (see above)
3. The frontend will automatically connect to the real backend

### Troubleshooting

#### Still getting CORS errors?

1. Check that your backend is running on `http://localhost:8080`
2. Verify CORS middleware is properly configured
3. Check browser developer tools for specific CORS error messages
4. Try accessing the API directly in browser: `http://localhost:8080/api/v1/marketplace/products`

#### Backend not starting?

1. Check if port 8080 is already in use: `lsof -i :8080`
2. Try running on a different port and update the frontend API_BASE_URL
3. Check backend logs for any startup errors

#### Mock data not showing?

1. Check browser console for "Backend not available, using mock data" messages
2. Verify you're in development mode (`__DEV__` is true)
3. Check that the API endpoint matches the mock data patterns

### Production Configuration

For production:

1. Update `API_BASE_URL` in `src/services/api.js`
2. Remove or disable mock data fallback
3. Ensure production backend has proper CORS configuration
4. Use HTTPS for production API endpoints

### Environment Variables

You can also use environment variables for API configuration:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (__DEV__ ? 'http://localhost:8080/api/v1' : 'https://api.vaultke.com/api/v1');
```

### Testing API Endpoints

Use tools like Postman or curl to test your backend endpoints:

```bash
# Test marketplace products
curl -X GET http://localhost:8080/api/v1/marketplace/products

# Test with CORS headers
curl -X OPTIONS http://localhost:8080/api/v1/marketplace/products \
  -H "Origin: http://localhost:19006" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```

This should help you get the backend running properly with CORS configured correctly!
