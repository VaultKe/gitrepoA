# Real Backend Setup Guide for VaultKe

This guide will help you set up a real backend server to work with the VaultKe mobile app.

## 🚀 Quick Start

The app is now configured to work with **real backend data only**. Mock data has been completely removed.

### API Configuration

- **Development**: `http://localhost:8080/api/v1`
- **Production**: `https://api.vaultke.com/api/v1`

## 📋 Backend Requirements

Your backend server must implement the following endpoints:

### 🔐 Authentication Endpoints
```
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
```

### 🛒 Marketplace Endpoints
```
GET    /api/v1/marketplace/products
POST   /api/v1/marketplace/products
GET    /api/v1/marketplace/products/:id
PUT    /api/v1/marketplace/products/:id
DELETE /api/v1/marketplace/products/:id
```

### 👥 Chama Endpoints
```
GET  /api/v1/chamas
POST /api/v1/chamas
GET  /api/v1/chamas/:id
POST /api/v1/chamas/:id/join
POST /api/v1/chamas/:id/leave
```

### 💬 Chat Endpoints
```
GET  /api/v1/chat/rooms
POST /api/v1/chat/rooms
GET  /api/v1/chat/rooms/:id/messages
POST /api/v1/chat/rooms/:id/messages
```

### 💰 Wallet Endpoints
```
GET  /api/v1/wallets/balance
GET  /api/v1/wallets/transactions
POST /api/v1/wallets/deposit
POST /api/v1/wallets/withdraw
POST /api/v1/wallets/transfer
```

## 🔧 Backend Setup Options

### Option 1: Golang Backend (Recommended)

1. **Install Dependencies**
```bash
go mod init vaultke-backend
go get github.com/gin-gonic/gin
go get github.com/gin-contrib/cors
go get gorm.io/gorm
go get gorm.io/driver/postgres
```

2. **Basic Server Setup**
```go
package main

import (
    "github.com/gin-gonic/gin"
    "github.com/gin-contrib/cors"
)

func main() {
    r := gin.Default()

    // CORS configuration
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:19006", "http://dqtl6f-ip-41-139-130-223.tunnelmole.net"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
        AllowCredentials: true,
    }))

    // API routes
    api := r.Group("/api/v1")
    {
        // Auth routes
        auth := api.Group("/auth")
        {
            auth.POST("/login", loginHandler)
            auth.POST("/register", registerHandler)
        }

        // Marketplace routes
        marketplace := api.Group("/marketplace")
        {
            marketplace.GET("/products", getProductsHandler)
            marketplace.POST("/products", createProductHandler)
        }
    }

    r.Run(":8080")
}
```

### Option 2: Node.js Backend

1. **Install Dependencies**
```bash
npm init -y
npm install express cors helmet morgan dotenv
npm install jsonwebtoken bcryptjs
npm install sequelize pg pg-hstore
```

2. **Basic Server Setup**
```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:19006', 'http://dqtl6f-ip-41-139-130-223.tunnelmole.net'],
    credentials: true
}));
app.use(express.json());

// Routes
app.get('/api/v1/marketplace/products', (req, res) => {
    // Return products from database
    res.json({
        success: true,
        data: {
            products: [],
            total: 0
        }
    });
});

app.post('/api/v1/marketplace/products', (req, res) => {
    // Create product in database
    res.json({
        success: true,
        data: req.body,
        message: 'Product created successfully'
    });
});

app.listen(8080, () => {
    console.log('Server running on port 8080');
});
```

## 📊 Database Schema

### Products Table
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    stock INTEGER DEFAULT 0,
    min_order INTEGER DEFAULT 1,
    max_order INTEGER,
    tags TEXT,
    county VARCHAR(100),
    town VARCHAR(100),
    address TEXT,
    seller_id INTEGER REFERENCES users(id),
    images JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    county VARCHAR(100),
    town VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔒 Authentication

The app expects JWT tokens in the following format:

```json
{
    "success": true,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "id": 1,
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "role": "user"
        }
    }
}
```

## 📱 API Response Format

All API responses should follow this format:

### Success Response
```json
{
    "success": true,
    "data": { ... },
    "message": "Optional success message"
}
```

### Error Response
```json
{
    "success": false,
    "error": "Error message",
    "details": "Optional detailed error information"
}
```

## 🚀 Running the Backend

1. **Start your backend server on port 8080**
2. **Ensure CORS is properly configured**
3. **Test the endpoints using curl or Postman**

### Test Commands
```bash
# Test products endpoint
curl -X GET http://localhost:8080/api/v1/marketplace/products

# Test product creation
curl -X POST http://localhost:8080/api/v1/marketplace/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","price":100,"category":"Test"}'
```

## 🔧 Frontend Configuration

The app will automatically connect to:
- `http://localhost:8080/api/v1` in development
- `https://api.vaultke.com/api/v1` in production

To change the API URL, update the `API_BASE_URL` in `src/services/api.js`.

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure your backend has CORS properly configured
   - Check that the frontend URL is in the allowed origins

2. **Connection Refused**
   - Verify the backend is running on port 8080
   - Check firewall settings

3. **404 Errors**
   - Ensure all required endpoints are implemented
   - Check the API route structure

4. **Authentication Issues**
   - Verify JWT token format
   - Check token expiration handling

### Error Messages

The app will show helpful error messages:
- "Unable to connect to server" - Backend not running or CORS issue
- "Network error" - Connection problems
- Specific API errors will be displayed as returned by the backend

## 📚 Next Steps

1. Set up your preferred backend framework
2. Implement the required API endpoints
3. Configure your database
4. Test the integration with the mobile app
5. Deploy to production when ready

For production deployment, update the `API_BASE_URL` to point to your production server.
