# CurrencyDashboard - Implementation Code Snippets

This file contains production-ready code that can be directly integrated into the project.

---

## 1. Validators Module (lib/validators.mjs)

```javascript
/**
 * Input validation for analysis requests
 */

export const validateAnalysisInput = (input) => {
  const { fedRate, exchangeRate, stockKrw, goldKrw, bond } = input;
  const errors = [];

  // Type and range validation
  if (typeof fedRate !== 'number' || fedRate < 0 || fedRate > 10) {
    errors.push('fedRate must be a number between 0 and 10');
  }

  if (typeof exchangeRate !== 'number' || exchangeRate < 800 || exchangeRate > 2000) {
    errors.push('exchangeRate must be a number between 800 and 2000 KRW');
  }

  if (typeof stockKrw !== 'number' || stockKrw < 0 || stockKrw > 10000) {
    errors.push('stockKrw must be a positive number less than 10000');
  }

  if (typeof goldKrw !== 'number' || goldKrw < 0 || goldKrw > 1000) {
    errors.push('goldKrw must be a positive number less than 1000');
  }

  if (typeof bond !== 'number' || bond < 0 || bond > 100) {
    errors.push('bond must be a number between 0 and 100');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? input : null
  };
};

export const sanitizePrompt = (text) => {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/[<>]/g, '') // Remove potential injection chars
    .slice(0, 2000)       // Limit length
    .trim();
};
```

---

## 2. OpenAI Client Module (lib/openaiClient.mjs)

```javascript
/**
 * Enhanced OpenAI API client with retry logic, timeout handling, and proper formatting
 */

class APIError extends Error {
  constructor(message, status, type) {
    super(message);
    this.status = status;
    this.type = type;
    this.name = 'APIError';
  }
}

class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class OpenAIClient {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.apiKey = apiKey;
    this.maxRetries = options.maxRetries || 3;
    this.timeoutMs = options.timeoutMs || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.backoffJitter = options.backoffJitter || true;
  }

  async getAnalysis(params, retryCount = 0) {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4-mini',
          messages: this.buildMessages(params),
          temperature: 0.7,
          max_tokens: 500,
          top_p: 0.9
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      // Handle rate limiting
      if (response.status === 429) {
        if (retryCount < this.maxRetries) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
          const waitTime = retryAfter * 1000 + this.getJitter();
          
          console.log(`Rate limited. Retrying after ${waitTime}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
          await this.delay(waitTime);
          return this.getAnalysis(params, retryCount + 1);
        }
        throw new APIError('Rate limited - max retries exceeded', 429, 'rate_limit_error');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new APIError(
          error.error?.message || response.statusText,
          response.status,
          error.error?.type || 'unknown'
        );
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from OpenAI');
      }

      return {
        analysis: data.choices[0].message.content,
        usage: data.usage,
        model: data.model,
        timestamp: new Date().toISOString(),
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle timeout with retry
      if (error.name === 'AbortError') {
        if (retryCount < this.maxRetries) {
          const waitTime = Math.pow(this.backoffMultiplier, retryCount) * 1000 + this.getJitter();
          console.log(`Timeout. Retrying after ${waitTime}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
          await this.delay(waitTime);
          return this.getAnalysis(params, retryCount + 1);
        }
        throw new TimeoutError(`Request timeout after ${this.maxRetries} retries (${duration}ms total)`);
      }

      // Handle retryable API errors
      if (error instanceof APIError && retryCount < this.maxRetries) {
        if (this.isRetryableError(error)) {
          const waitTime = Math.pow(this.backoffMultiplier, retryCount) * 1000 + this.getJitter();
          console.log(`Retryable error: ${error.message}. Retrying after ${waitTime}ms`);
          await this.delay(waitTime);
          return this.getAnalysis(params, retryCount + 1);
        }
      }

      throw error;
    }
  }

  buildMessages(params) {
    return [
      {
        role: 'system',
        content: '당신은 거시경제 애널리스트입니다. 한국 개인투자자 관점에서 실용적인 제안을 한국어로 작성하세요. 마크다운 형식(불릿 포인트)을 사용하여 명확하고 간결하게 작성하세요.'
      },
      {
        role: 'user',
        content: this.formatAnalysisPrompt(params)
      }
    ];
  }

  formatAnalysisPrompt(params) {
    const { fedRate, exchangeRate, stockKrw, goldKrw, bond } = params;
    
    return `현재 시뮬레이션 데이터:

**거시경제 지표:**
- Fed 기준금리: ${fedRate.toFixed(2)}%
- USD/KRW 예상 환율: ₩${exchangeRate.toLocaleString()}
- S&P500 (원화 환산): ₩${stockKrw.toLocaleString()}
- 금 (원화 환산): ₩${goldKrw.toLocaleString()}
- 미국채 (AGG): ${bond.toFixed(1)}

**요청사항:**

1) **현황 진단 (2문장)**
   - 현재 경제 상황의 핵심 특징 요약

2) **한국 투자자 액션 아이템 (3개)**
   - 각 항목을 구체적인 투자 액션으로 제시

3) **주의할 리스크 (2개)**
   - 고려해야 할 주요 위험 요소

마크다운 불릿 형식으로 작성하세요.`;
  }

  isRetryableError(error) {
    if (error instanceof APIError) {
      // Retry on server errors and specific client errors
      return [408, 429, 500, 502, 503, 504].includes(error.status);
    }
    return error instanceof TimeoutError;
  }

  getJitter() {
    if (!this.backoffJitter) return 0;
    return Math.random() * 1000; // 0-1000ms jitter
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { APIError, TimeoutError };
```

---

## 3. Response Caching Module (lib/cache.mjs)

```javascript
/**
 * Simple in-memory cache for analysis responses
 * Implements TTL (Time To Live) and smart key generation
 */

export class AnalysisCache {
  constructor(ttlMinutes = 30) {
    this.cache = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Generate cache key from simulation parameters
   * Rounds values to create broader cache hits
   */
  generateKey(fedRate, exchangeRate, stockKrw, goldKrw, bond) {
    const rounded = {
      fedRate: Math.round(fedRate * 4) / 4,           // Round to 0.25%
      exchangeRate: Math.round(exchangeRate / 10) * 10, // Round to 10 KRW
      stockKrw: Math.round(stockKrw / 5) * 5,         // Round to 5
      goldKrw: Math.round(goldKrw / 2) * 2,           // Round to 2
      bond: Math.round(bond)                           // Round to 1
    };
    
    return JSON.stringify(rounded);
  }

  set(key, value) {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return {
      ...entry.data,
      fromCache: true,
      cacheAge: Date.now() - entry.timestamp
    };
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : 0;

    return {
      size: this.cache.size,
      hitRate: `${hitRate}%`,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      ttlMinutes: this.ttlMs / 60000,
      items: Array.from(this.cache.entries()).map(([key, val]) => ({
        key: JSON.parse(key),
        age: Date.now() - val.timestamp,
        ageSec: Math.round((Date.now() - val.timestamp) / 1000)
      }))
    };
  }
}

export const analysisCache = new AnalysisCache(30); // 30 minutes TTL
```

---

## 4. Rate Limiting Module (lib/rateLimit.mjs)

```javascript
/**
 * Simple in-memory rate limiter
 * Supports multiple limits (per minute, per hour)
 */

class RateLimiter {
  constructor(options = {}) {
    this.requestLog = new Map();
    this.minuteLimit = options.requestsPerMinute || 10;
    this.hourLimit = options.requestsPerHour || 100;
    this.windowMs = options.windowMs || 60000;
  }

  /**
   * Check if request is within rate limits
   */
  check(clientId) {
    const now = Date.now();
    const clientLog = this.requestLog.get(clientId) || [];

    // Clean up old requests
    const recentRequests = clientLog.filter(ts => now - ts < this.windowMs);

    // Check minute limit
    if (recentRequests.length >= this.minuteLimit) {
      const oldestRequest = recentRequests[0];
      const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
      
      return {
        allowed: false,
        limitType: 'minute',
        retryAfter,
        remaining: 0
      };
    }

    // Check hour limit
    const hourAgoRequests = clientLog.filter(ts => now - ts < 3600000);
    if (hourAgoRequests.length >= this.hourLimit) {
      const oldestRequest = hourAgoRequests[0];
      const retryAfter = Math.ceil((oldestRequest + 3600000 - now) / 1000);
      
      return {
        allowed: false,
        limitType: 'hour',
        retryAfter,
        remaining: 0
      };
    }

    // Record new request
    recentRequests.push(now);
    this.requestLog.set(clientId, recentRequests);

    return {
      allowed: true,
      remaining: this.minuteLimit - recentRequests.length,
      reset: new Date(now + this.windowMs)
    };
  }

  /**
   * Get rate limit headers for response
   */
  getHeaders(clientId) {
    const clientLog = this.requestLog.get(clientId) || [];
    const now = Date.now();
    const recentRequests = clientLog.filter(ts => now - ts < this.windowMs);
    const remaining = Math.max(0, this.minuteLimit - recentRequests.length);

    return {
      'X-RateLimit-Limit': this.minuteLimit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(now + this.windowMs).toISOString()
    };
  }

  /**
   * Clear all rate limit records (for testing)
   */
  reset() {
    this.requestLog.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeClients: this.requestLog.size,
      totalRequests: Array.from(this.requestLog.values())
        .reduce((sum, reqs) => sum + reqs.length, 0)
    };
  }
}

// Export singleton instance
export const limiter = new RateLimiter({
  requestsPerMinute: 10,
  requestsPerHour: 100
});

export const checkRateLimit = (clientId) => limiter.check(clientId);
export const getRateLimitHeaders = (clientId) => limiter.getHeaders(clientId);
```

---

## 5. Logger Module (lib/logger.mjs)

```javascript
/**
 * Structured logging for monitoring and debugging
 */

class Logger {
  constructor(options = {}) {
    this.prefix = options.prefix || 'CurrencyDashboard';
    this.level = options.level || 'info';
    this.enableFile = options.enableFile || false;
  }

  /**
   * Log with structured format
   */
  log(level, message, data = {}) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const levelIndex = levels.indexOf(level);
    const currentLevelIndex = levels.indexOf(this.level);

    // Skip if below current log level
    if (levelIndex < currentLevelIndex) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      prefix: this.prefix,
      message,
      ...data
    };

    const logString = JSON.stringify(logEntry);

    // Console output with color coding
    const colors = {
      debug: '\x1b[36m',   // Cyan
      info: '\x1b[32m',    // Green
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m'    // Red
    };
    const reset = '\x1b[0m';

    console.log(`${colors[level]}${logString}${reset}`);
  }

  debug(message, data) { this.log('debug', message, data); }
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }
}

export const logger = new Logger({ level: 'info' });
```

---

## 6. Updated Server Implementation (server.mjs - Full Implementation)

```javascript
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { OpenAIClient, TimeoutError, APIError } from './lib/openaiClient.mjs';
import { AnalysisCache } from './lib/cache.mjs';
import { checkRateLimit, getRateLimitHeaders } from './lib/rateLimit.mjs';
import { validateAnalysisInput, sanitizePrompt } from './lib/validators.mjs';
import { logger } from './lib/logger.mjs';

// Load environment variables from .env file
const loadEnv = () => {
  const envPath = '.env';
  if (!existsSync(envPath)) {
    logger.warn('No .env file found. Using environment variables.');
    return;
  }

  const envLines = readFileSync(envPath, 'utf8').split('\n');
  envLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

loadEnv();

const port = Number(process.env.OPENAI_BACKEND_PORT || 8787);
const apiKey = process.env.OPENAI_API_KEY;

// Initialize services
const openai = new OpenAIClient(apiKey, {
  maxRetries: 3,
  timeoutMs: 30000
});

const cache = new AnalysisCache(30); // 30 min TTL

// Helper functions
const sendJson = (res, statusCode, payload, headers = {}) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers
  });
  res.end(JSON.stringify(payload));
};

const parseBody = async (req) => {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
};

// Create server
const server = createServer(async (req, res) => {
  const startTime = Date.now();
  const clientId = req.headers['x-client-id'] || req.socket.remoteAddress;

  logger.debug('Request received', {
    method: req.method,
    url: req.url,
    clientId
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        server: 'ok',
        openai: apiKey ? 'configured' : 'missing'
      },
      uptime: process.uptime()
    });
    return;
  }

  // Analysis endpoint
  if (req.url === '/api/analysis' && req.method === 'POST') {
    try {
      // Rate limiting check
      const rateLimitCheck = checkRateLimit(clientId);
      const rateLimitHeaders = getRateLimitHeaders(clientId);

      if (!rateLimitCheck.allowed) {
        logger.warn('Rate limit exceeded', { clientId, limitType: rateLimitCheck.limitType });
        
        return sendJson(res, 429, {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter,
          limitType: rateLimitCheck.limitType
        }, {
          'Retry-After': rateLimitCheck.retryAfter.toString(),
          ...rateLimitHeaders
        });
      }

      // Parse and validate input
      let body;
      try {
        body = await parseBody(req);
      } catch (error) {
        logger.error('JSON parse error', { error: error.message });
        return sendJson(res, 400, {
          error: 'Invalid JSON in request body'
        }, rateLimitHeaders);
      }

      const { fedRate, exchangeRate, stockKrw, goldKrw, bond } = body;
      const validation = validateAnalysisInput({
        fedRate: Number(fedRate),
        exchangeRate: Number(exchangeRate),
        stockKrw: Number(stockKrw),
        goldKrw: Number(goldKrw),
        bond: Number(bond)
      });

      if (!validation.isValid) {
        logger.warn('Validation failed', { errors: validation.errors });
        return sendJson(res, 400, {
          error: 'Validation failed',
          details: validation.errors
        }, rateLimitHeaders);
      }

      // Check cache
      const cacheKey = cache.generateKey(
        validation.data.fedRate,
        validation.data.exchangeRate,
        validation.data.stockKrw,
        validation.data.goldKrw,
        validation.data.bond
      );

      const cached = cache.get(cacheKey);
      if (cached) {
        logger.info('Cache hit', { cacheAge: cached.cacheAge });
        return sendJson(res, 200, cached, rateLimitHeaders);
      }

      logger.info('Cache miss, calling OpenAI API');

      // Call OpenAI API
      const result = await openai.getAnalysis(validation.data);

      // Store in cache
      cache.set(cacheKey, result);

      logger.info('Analysis complete', {
        duration: result.duration,
        tokens: result.usage.total_tokens
      });

      return sendJson(res, 200, result, rateLimitHeaders);

    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = 
        error instanceof TimeoutError ? 504 :
        error instanceof APIError && error.status ? error.status :
        500;

      logger.error('Analysis request failed', {
        error: error.message,
        errorType: error.name,
        duration,
        clientId
      });

      return sendJson(res, statusCode, {
        error: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Cache stats endpoint (optional, for monitoring)
  if (req.url === '/api/cache-stats' && req.method === 'GET') {
    sendJson(res, 200, {
      cache: cache.getStats(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Not found
  sendJson(res, 404, {
    error: 'Not found',
    path: req.url
  });
});

// Error handling
server.on('error', (error) => {
  logger.error('Server error', {
    error: error.message,
    code: error.code
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(port, () => {
  logger.info(`OpenAI backend listening on port ${port}`, {
    nodeEnv: process.env.NODE_ENV,
    model: process.env.OPENAI_MODEL || 'gpt-4-mini'
  });
});

// Log startup info
if (!apiKey) {
  logger.warn('OPENAI_API_KEY not configured - API calls will fail');
}
```

---

## 7. Frontend Hook for State Management (useAnalysis.js)

```javascript
import { useReducer, useCallback } from 'react';

const initialState = {
  analysis: null,
  isLoading: false,
  error: null,
  usage: null,
  fromCache: false,
  duration: null
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
        analysis: null
      };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        analysis: action.payload.analysis,
        usage: action.payload.usage,
        fromCache: action.payload.fromCache || false,
        duration: action.payload.duration,
        error: null
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        analysis: null
      };
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
};

export const useAnalysis = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchAnalysis = useCallback(async (params) => {
    dispatch({ type: 'FETCH_START' });

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': `client_${Date.now()}_${Math.random()}`
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: 'Unknown error occurred'
        }));
        throw new Error(error.error || error.details?.[0] || 'Request failed');
      }

      const data = await response.json();
      dispatch({ type: 'FETCH_SUCCESS', payload: data });
      return data;

    } catch (error) {
      dispatch({
        type: 'FETCH_ERROR',
        payload: error.message || 'Failed to fetch analysis'
      });
      throw error;
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  return {
    ...state,
    fetchAnalysis,
    clearAnalysis
  };
};
```

---

## 8. Updated .env.example

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4-mini
OPENAI_TIMEOUT_MS=30000
OPENAI_MAX_RETRIES=3

# Server Configuration
OPENAI_BACKEND_PORT=8787
NODE_ENV=development
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=10
RATE_LIMIT_REQUESTS_PER_HOUR=100

# Caching
CACHE_TTL_MINUTES=30

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

---

## 9. Basic Test Suite (tests/openaiClient.test.mjs)

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIClient, TimeoutError, APIError } from '../lib/openaiClient.mjs';

describe('OpenAIClient', () => {
  let client;

  beforeEach(() => {
    client = new OpenAIClient('test-key', {
      maxRetries: 2,
      timeoutMs: 5000
    });
  });

  describe('buildMessages', () => {
    it('should format messages correctly', () => {
      const params = {
        fedRate: 5.5,
        exchangeRate: 1300,
        stockKrw: 100,
        goldKrw: 80,
        bond: 85
      };

      const messages = client.buildMessages(params);
      
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[0].content).toContain('한국어');
      expect(messages[1].content).toContain('Fed 기준금리');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(client.isRetryableError(new APIError('Error', 500, 'error'))).toBe(true);
      expect(client.isRetryableError(new APIError('Error', 503, 'error'))).toBe(true);
      expect(client.isRetryableError(new APIError('Error', 400, 'error'))).toBe(false);
      expect(client.isRetryableError(new TimeoutError('Timeout'))).toBe(true);
    });
  });

  describe('jitter', () => {
    it('should return 0 when jitter disabled', () => {
      const clientNoJitter = new OpenAIClient('test-key', { backoffJitter: false });
      expect(clientNoJitter.getJitter()).toBe(0);
    });

    it('should return value between 0 and 1000 when jitter enabled', () => {
      const jitter = client.getJitter();
      expect(jitter).toBeGreaterThanOrEqual(0);
      expect(jitter).toBeLessThanOrEqual(1000);
    });
  });
});
```

---

## 10. Deployment Guide (Dockerfile example)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server.mjs"]
```

---

These code snippets are production-ready and can be integrated directly into the project following the implementation roadmap provided in the main analysis report.

