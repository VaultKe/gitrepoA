package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	allowedOrigins := []string{
		"https://gitrepoa-1.onrender.com",
		"http://localhost:8081",
		"https://localhost:8084",
		"https://127.0.0.1:8081",
		"http://localhost:8085",
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"https://vault-better1.vercel.app",
		"http://localhost:19006",
		"http://127.0.0.1:19006",
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowedOrigin := "*"

		for _, o := range allowedOrigins {
			if o == origin {
				allowedOrigin = origin
				break
			}
		}

		c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
