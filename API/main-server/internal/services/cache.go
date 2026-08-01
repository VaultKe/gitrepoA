package services

import (
	"context"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache defines the interface for caching operations used by the application.
type Cache interface {
	// Get retrieves a value from the cache.
	Get(key string) (string, bool)
	// Set stores a value in the cache with an optional TTL.
	Set(key, value string, ttl time.Duration)
	// Delete removes a value from the cache.
	Delete(key string)
	// Flush clears all cached values.
	Flush()
	// Close shuts down the cache backend.
	Close()
}

// NewCache creates the appropriate cache implementation.
// If redisURL is non-empty, it attempts Redis; otherwise, it uses an in-memory cache.
func NewCache(redisURL string) Cache {
	if redisURL != "" {
		cache, err := newRedisCache(redisURL)
		if err == nil {
			return cache
		}
	}

	return newInMemoryCache(10000, 5*time.Minute)
}

// ──────────────────────────────────────────────
// Redis implementation
// ──────────────────────────────────────────────
type RedisCache struct {
	client *redis.Client
	ctx    context.Context
}

func newRedisCache(redisURL string) (*RedisCache, error) {
	ctx := context.Background()
	client := redis.NewClient(&redis.Options{
		Addr:     redisURL,
		Password: "",
		DB:       0,
		PoolSize: 25,
		MinIdleConns: 5,
	})

	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return nil, err
	}

	return &RedisCache{
		client: client,
		ctx:    ctx,
	}, nil
}

func (r *RedisCache) Get(key string) (string, bool) {
	val, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		return "", false
	}
	return val, true
}

func (r *RedisCache) Set(key, value string, ttl time.Duration) {
	r.client.Set(r.ctx, key, value, ttl)
}

func (r *RedisCache) Delete(key string) {
	r.client.Del(r.ctx, key)
}

func (r *RedisCache) Flush() {
	r.client.FlushDB(r.ctx)
}

func (r *RedisCache) Close() {
	r.client.Close()
}

// ──────────────────────────────────────────────
// In-memory fallback implementation
// ──────────────────────────────────────────────
type inMemoryEntry struct {
	value    string
	expireAt time.Time
}

type InMemoryCache struct {
	mu         sync.RWMutex
	items      map[string]inMemoryEntry
	maxItems   int
	defaultTTL time.Duration
}

func newInMemoryCache(maxItems int, defaultTTL time.Duration) *InMemoryCache {
	c := &InMemoryCache{
		items:      make(map[string]inMemoryEntry),
		maxItems:   maxItems,
		defaultTTL: defaultTTL,
	}
	go c.evictLoop()
	return c
}

func (c *InMemoryCache) Get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.items[key]
	if !ok {
		return "", false
	}
	if time.Now().After(entry.expireAt) {
		return "", false
	}
	return entry.value, true
}

func (c *InMemoryCache) Set(key, value string, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if ttl <= 0 {
		ttl = c.defaultTTL
	}

	if len(c.items) >= c.maxItems {
		now := time.Now()
		for k, v := range c.items {
			if now.After(v.expireAt) {
				delete(c.items, k)
			}
		}
	}

	c.items[key] = inMemoryEntry{
		value:    value,
		expireAt: time.Now().Add(ttl),
	}
}

func (c *InMemoryCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}

func (c *InMemoryCache) Flush() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = make(map[string]inMemoryEntry)
}

func (c *InMemoryCache) Close() {
	c.Flush()
}

func (c *InMemoryCache) evictLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for k, v := range c.items {
			if now.After(v.expireAt) {
				delete(c.items, k)
			}
		}
		c.mu.Unlock()
	}
}
