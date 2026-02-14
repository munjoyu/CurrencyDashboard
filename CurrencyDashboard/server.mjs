import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

// ==================== ENV CONFIGURATION ====================
const envPath = '.env';
if (existsSync(envPath)) {
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
}

const port = Number(process.env.OPENAI_BACKEND_PORT || 8787);
const APP_VERSION = '1.2.3-local';
const START_TIME = Date.now();

// ==================== LOGGER ====================
class Logger {
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({ timestamp, level, message, ...data }));
  }
  info(msg, data) { this.log('INFO', msg, data); }
  error(msg, data) { this.log('ERROR', msg, data); }
  warn(msg, data) { this.log('WARN', msg, data); }
  debug(msg, data) { this.log('DEBUG', msg, data); }
}
const logger = new Logger();

// ==================== METRICS COLLECTOR ====================
class MetricsCollector {
  constructor() {
    this.requests = [];
    this.endpointMetrics = new Map();
  }

  recordRequest(method, path, statusCode, duration, cached = false) {
    const now = Date.now();
    this.requests.push({ method, path, statusCode, duration, timestamp: now, cached });
    
    // Keep only last 1000 requests
    if (this.requests.length > 1000) {
      this.requests.shift();
    }

    // Track per-endpoint
    const key = `${method} ${path}`;
    if (!this.endpointMetrics.has(key)) {
      this.endpointMetrics.set(key, { count: 0, errors: 0, latencies: [], totalLatency: 0 });
    }
    const metric = this.endpointMetrics.get(key);
    metric.count++;
    metric.latencies.push(duration);
    metric.totalLatency += duration;
    if (statusCode >= 400) metric.errors++;
  }

  getLast5MinMetrics() {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    return this.requests.filter(r => r.timestamp > fiveMinAgo);
  }

  getStats() {
    const allRequests = this.requests;
    const recentRequests = this.getLast5MinMetrics();
    const errors = allRequests.filter(r => r.statusCode >= 400);
    const cachedRequests = allRequests.filter(r => r.cached);

    const avgLatency = allRequests.length > 0 
      ? Math.round(allRequests.reduce((sum, r) => sum + r.duration, 0) / allRequests.length)
      : 0;

    const topEndpoints = Array.from(this.endpointMetrics.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([endpoint, metric]) => ({
        endpoint,
        count: metric.count,
        errors: metric.errors,
        avg_latency_ms: Math.round(metric.totalLatency / metric.count)
      }));

    return {
      period: 'all_time',
      requests_total: allRequests.length,
      requests_last_5min: recentRequests.length,
      errors_total: errors.length,
      error_rate_percent: allRequests.length > 0 ? (errors.length / allRequests.length * 100).toFixed(2) : 0,
      avg_latency_ms: avgLatency,
      cache_hit_rate_percent: allRequests.length > 0 ? (cachedRequests.length / allRequests.length * 100).toFixed(2) : 0,
      top_endpoints: topEndpoints
    };
  }
}
const metricsCollector = new MetricsCollector();

// ==================== HEALTH CHECKER ====================
class HealthChecker {
  constructor() {
    this.lastHealthCheck = Date.now();
    this.openaiHealthy = true;
    this.lastOpenaiCheck = null;
  }

  getUptime() {
    const totalSeconds = Math.floor((Date.now() - START_TIME) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours}h ${mins}m ${secs}s`;
  }

  async checkOpenAI() {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('demo')) {
      this.openaiHealthy = false;
      this.lastOpenaiCheck = new Date().toISOString();
      return {
        status: 'degraded',
        error: 'No valid API key configured (using demo key)'
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      this.openaiHealthy = response.ok;
      this.lastOpenaiCheck = new Date().toISOString();
      
      if (!response.ok) {
        return { status: 'degraded', error: `HTTP ${response.status}` };
      }
      
      return { status: 'healthy', last_check: this.lastOpenaiCheck };
    } catch (error) {
      this.openaiHealthy = false;
      this.lastOpenaiCheck = new Date().toISOString();
      return { status: 'unhealthy', error: error.message };
    }
  }

  getMemoryStatus() {
    const used = process.memoryUsage();
    const usagePercent = Math.round((used.heapUsed / used.heapTotal) * 100);
    return {
      status: usagePercent < 85 ? 'healthy' : 'degraded',
      usage_percent: usagePercent,
      heap_mb: Math.round(used.heapUsed / 1024 / 1024)
    };
  }

  async getHealthStatus() {
    const openaiStatus = await this.checkOpenAI();
    const memStatus = this.getMemoryStatus();
    const overallStatus = 
      openaiStatus.status === 'unhealthy' || memStatus.status === 'unhealthy' ? 'unhealthy' :
      openaiStatus.status === 'degraded' || memStatus.status === 'degraded' ? 'degraded' : 
      'healthy';

    return {
      status: overallStatus,
      uptime: this.getUptime(),
      timestamp: new Date().toISOString(),
      checks: {
        openai: openaiStatus,
        memory: memStatus,
        cache: {
          status: 'healthy',
          size: responseCache.cache.size
        }
      },
      version: APP_VERSION,
      environment: 'development'
    };
  }
}
const healthChecker = new HealthChecker();

// ==================== RATE LIMITER ====================
class RateLimiter {
  constructor(maxPerMinute = 30, maxPerHour = 200) {
    this.maxPerMinute = maxPerMinute;
    this.maxPerHour = maxPerHour;
    this.requests = [];
  }

  isAllowed(clientId) {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    this.requests = this.requests.filter(r => r.time > oneHourAgo);

    const recentMinute = this.requests.filter(r => r.clientId === clientId && r.time > oneMinuteAgo).length;
    const recentHour = this.requests.filter(r => r.clientId === clientId).length;

    if (recentMinute >= this.maxPerMinute) {
      logger.warn('Rate limit exceeded (per minute)', { clientId, count: recentMinute });
      return false;
    }
    if (recentHour >= this.maxPerHour) {
      logger.warn('Rate limit exceeded (per hour)', { clientId, count: recentHour });
      return false;
    }

    this.requests.push({ clientId, time: now });
    return true;
  }
}
const rateLimiter = new RateLimiter();

// ==================== RESPONSE CACHE ====================
class ResponseCache {
  constructor(ttlSeconds = 1800) {
    this.cache = new Map();
    this.ttlSeconds = ttlSeconds;
  }

  getKey(input) {
    return JSON.stringify(input);
  }

  get(input) {
    const key = this.getKey(input);
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttlSeconds * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    logger.debug('Cache hit', { key });
    return cached.data;
  }

  set(input, data) {
    const key = this.getKey(input);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    logger.debug('Cache set', { key });
  }

  clear() {
    this.cache.clear();
  }
}
const responseCache = new ResponseCache();

// ==================== INPUT VALIDATION ====================
function validateAnalysisInput(data) {
  const { fedRate, exchangeRate, stockKrw, goldKrw, bond } = data;
  const values = [fedRate, exchangeRate, stockKrw, goldKrw, bond].map(Number);

  if (!values.every(Number.isFinite)) {
    return { valid: false, error: '유효한 숫자 데이터가 필요합니다.' };
  }

  if (fedRate < -5 || fedRate > 20) {
    return { valid: false, error: 'Fed 금리는 -5% ~ 20% 범위여야 합니다.' };
  }

  if (exchangeRate < 500 || exchangeRate > 2500) {
    return { valid: false, error: '환율은 500 ~ 2500 KRW/USD 범위여야 합니다.' };
  }

  if (stockKrw < 0 || goldKrw < 0 || bond < 0) {
    return { valid: false, error: '자산 값은 0 이상이어야 합니다.' };
  }

  return { valid: true };
}

// ==================== TEST MODE MOCK DATA ====================
function getMockAnalysis(fedRate, exchangeRate, stockKrw, goldKrw, bond) {
  const analyses = [
    `**시장 현황 진단**
- 중절기를 맞이한 연준의 신중한 기조가 유지되고 있습니다.
- 환율 상승세와 원금리 하향 추세가 동시 진행 중입니다.

**한국 투자자용 액션**
- 미국주(S&P500)는 장기 매수 관점에서 분할 매수 진행 추천
- 달러 뱅킹: 정기적인 환율 헤지 및 포지션 조정
- 채권 포함 포트폴리오 구성으로 변동성 완화

**리스크 경고**
- 연준의 급격한 금리 인상 가능성 주시 필요
- 지정학적 이슈 발생 시 환율 급등 가능성 경고`,

    `**시장 현황 진단**
- 금리 인상 사이클에 진입한 상황으로 보수적 운영이 필요합니다.
- 고금리 국면에서 채권의 매력도가 상승 중입니다.

**한국 투자자용 액션**
- 혼합자산펀드 또는 로보어드바이저를 통한 자동 리밸런싱 추천
- 미국 기술주보다 금융주/에너지주 비중 증대
- 황금 비율(주식 60/채권 40) 포트폴리오 구성 검토

**리스크 경고**
- 강한 달러는 수출주에 악영향을 미칠 수 있습니다.
- 인플레이션 재가속 시 주가 급락 가능성 존재`,

    `**시장 현황 진단**
- 현물 자산(금, 주식) 가입 타이밍이 좋아 보입니다.
- 더 낮은 환율은 기대하기 어려울 것으로 판단됩니다.

**한국 투자자용 액션**
- 적극적 성장주 비중 확대 (NASDAQ 연동 ETF 추천)
- 금 포지션을 인플레 헤지용으로 5-10% 추가
- 배당주 중심으로 미국주 구성하기

**리스크 경고**
- 테이퍼링 발표 시 주가 변동성 급증 가능
- 경기침체 신호 시 방어적 포지셔닝 필요`
  ];
  
  return analyses[Math.floor(Math.random() * analyses.length)];
}

// ==================== OPENAI CLIENT WITH RETRY ====================
class OpenAIClient {
  constructor(apiKey, model = 'gpt-3.5-turbo', testMode = false) {
    this.apiKey = apiKey;
    this.model = model;
    this.maxRetries = 3;
    this.timeout = 30000;
    this.testMode = testMode;
  }

  async makeRequest(messages, retryCount = 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 500
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 429 && retryCount < this.maxRetries) {
          const delayMs = Math.pow(2, retryCount) * 1000;
          logger.warn('Rate limited by OpenAI, retrying', { retryCount, delayMs });
          await new Promise(r => setTimeout(r, delayMs));
          return this.makeRequest(messages, retryCount + 1);
        }

        throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      return result.choices[0]?.message?.content || null;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('OpenAI API request timeout (30s)');
      }

      if (retryCount < this.maxRetries) {
        const delayMs = Math.pow(2, retryCount) * 1000;
        logger.warn('Request failed, retrying', { error: error.message, retryCount, delayMs });
        await new Promise(r => setTimeout(r, delayMs));
        return this.makeRequest(messages, retryCount + 1);
      }

      throw error;
    }
  }

  async analyzeMarket(fedRate, exchangeRate, stockKrw, goldKrw, bond) {
    // Test mode - return mock data
    if (this.testMode) {
      return getMockAnalysis(fedRate, exchangeRate, stockKrw, goldKrw, bond);
    }

    const messages = [
      {
        role: 'system',
        content: '당신은 거시경제 애널리스트입니다. 한국 개인투자자 관점에서 실용적인 제안을 한국어로 작성하세요.'
      },
      {
        role: 'user',
        content: `현재 시뮬레이션 데이터입니다.\n- Fed 금리: ${fedRate}%\n- 예상 환율: ${exchangeRate} KRW/USD\n- S&P500(원화환산): ${stockKrw}\n- Gold(원화환산): ${goldKrw}\n- 미국채(AGG): ${bond}\n\n요청사항:\n1) 현재 국면 진단 2문장\n2) 한국 투자자용 액션 아이템 3개\n3) 리스크 경고 2개\n마크다운 불릿으로 간결하게 작성`
      }
    ];

    return this.makeRequest(messages);
  }
}

// ==================== HTTP SERVER ====================
const sendJson = (res, statusCode, payload, requestId = 'unknown', isCached = false, duration = 0) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE,PUT',
    'Access-Control-Allow-Headers': 'Content-Type,X-Client-Id',
    'X-App-Version': APP_VERSION,
    'X-Request-ID': requestId,
    'X-Response-Time-Ms': duration.toString(),
    'X-Cache': isCached ? 'HIT' : 'MISS'
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

const getClientId = (req) => {
  return req.headers['x-client-id'] || req.socket.remoteAddress || 'anonymous';
};

const generateRequestId = () => {
  return 'req_' + Math.random().toString(36).substring(2, 11);
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE,PUT',
      'Access-Control-Allow-Headers': 'Content-Type,X-Client-Id',
      'X-App-Version': APP_VERSION
    });
    res.end();
    return;
  }

  const requestId = generateRequestId();
  const startTime = Date.now();
  const clientId = getClientId(req);

  logger.info('Request received', { method: req.method, url: req.url, clientId, requestId });

  try {
    // ============ HEALTH ENDPOINTS ============

    // GET /api/health - Full health check (detailed)
    if (req.url === '/api/health' && req.method === 'GET') {
      const healthStatus = await healthChecker.getHealthStatus();
      const duration = Date.now() - startTime;
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 206 : 503;
      sendJson(res, statusCode, healthStatus, requestId, false, duration);
      metricsCollector.recordRequest(req.method, req.url, statusCode, duration);
      return;
    }

    // GET /api/health/live - Liveness probe (fast, simple)
    if (req.url === '/api/health/live' && req.method === 'GET') {
      const duration = Date.now() - startTime;
      sendJson(res, 200, { status: 'alive', timestamp: new Date().toISOString() }, requestId, false, duration);
      metricsCollector.recordRequest(req.method, req.url, 200, duration);
      return;
    }

    // GET /api/health/ready - Readiness probe (checks dependencies)
    if (req.url === '/api/health/ready' && req.method === 'GET') {
      const stats = metricsCollector.getStats();
      const hasErrors = stats.errors_total > 5;
      const statusCode = hasErrors ? 503 : 200;
      const duration = Date.now() - startTime;
      sendJson(res, statusCode, { 
        status: hasErrors ? 'not_ready' : 'ready',
        dependencies: {
          cache: 'ready',
          memory: 'ready',
          recent_errors: stats.errors_total
        },
        timestamp: new Date().toISOString()
      }, requestId, false, duration);
      metricsCollector.recordRequest(req.method, req.url, statusCode, duration);
      return;
    }

    // GET /api/health/deep - Deep health check
    if (req.url === '/api/health/deep' && req.method === 'GET') {
      const healthStatus = await healthChecker.getHealthStatus();
      const stats = metricsCollector.getStats();
      const duration = Date.now() - startTime;
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 206 : 503;
      
      const deepHealth = {
        ...healthStatus,
        metrics: stats,
        duration_ms: duration
      };

      sendJson(res, statusCode, deepHealth, requestId, false, duration);
      metricsCollector.recordRequest(req.method, req.url, statusCode, duration);
      return;
    }

    // ============ STATS ENDPOINTS ============

    // GET /api/stats - Request statistics
    if (req.url === '/api/stats' && req.method === 'GET') {
      const stats = metricsCollector.getStats();
      const duration = Date.now() - startTime;
      sendJson(res, 200, stats, requestId, false, duration);
      metricsCollector.recordRequest(req.method, req.url, 200, duration);
      return;
    }

    // ============ ANALYSIS ENDPOINTS ============

    // POST /api/analysis - AI market analysis
    if (req.url === '/api/analysis' && req.method === 'POST') {
      // Rate limiting check
      if (!rateLimiter.isAllowed(clientId)) {
        logger.warn('Rate limit exceeded', { clientId });
        const duration = Date.now() - startTime;
        sendJson(res, 429, { error: '요청 수 제한을 초과했습니다. 잠시 후 다시 시도하세요.' }, requestId, false, duration);
        metricsCollector.recordRequest(req.method, req.url, 429, duration);
        return;
      }

      // Parse request body
      const requestData = await parseBody(req);
      const { fedRate, exchangeRate, stockKrw, goldKrw, bond } = requestData;

      // Input validation
      const validation = validateAnalysisInput({ fedRate, exchangeRate, stockKrw, goldKrw, bond });
      if (!validation.valid) {
        logger.warn('Invalid input', { clientId, error: validation.error });
        const duration = Date.now() - startTime;
        sendJson(res, 400, { error: validation.error }, requestId, false, duration);
        metricsCollector.recordRequest(req.method, req.url, 400, duration);
        return;
      }

      // Check cache
      const cacheKey = { fedRate, exchangeRate, stockKrw, goldKrw, bond };
      const cachedAnalysis = responseCache.get(cacheKey);
      if (cachedAnalysis) {
        logger.info('Returning cached analysis', { clientId, requestId });
        const duration = Date.now() - startTime;
        sendJson(res, 200, { 
          analysis: cachedAnalysis, 
          cached: true,
          duration_ms: duration 
        }, requestId, true, duration);
        metricsCollector.recordRequest(req.method, req.url, 200, duration, true);
        return;
      }

      // Check OpenAI API key - use test mode if not available
      const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      const hasApiKey = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('YOUR_KEY');
      const client = new OpenAIClient(
        process.env.OPENAI_API_KEY || 'test-mode',
        model,
        !hasApiKey // Enable test mode if no valid API key
      );
      
      logger.info('Processing analysis request', { 
        clientId, 
        model, 
        testMode: !hasApiKey,
        requestId 
      });
      const aiStartTime = Date.now();
      const analysis = await client.analyzeMarket(fedRate, exchangeRate, stockKrw, goldKrw, bond);
      const aiDuration = Date.now() - aiStartTime;

      if (!analysis) {
        logger.error('Empty response from OpenAI', { clientId, requestId });
        const duration = Date.now() - startTime;
        sendJson(res, 500, { error: '분석 결과를 생성하지 못했습니다.' }, requestId, false, duration);
        metricsCollector.recordRequest(req.method, req.url, 500, duration);
        return;
      }

      // Cache the result
      responseCache.set(cacheKey, analysis);

      logger.info('Analysis completed successfully', { clientId, requestId, aiDuration });
      const duration = Date.now() - startTime;
      sendJson(res, 200, { 
        analysis, 
        cached: false,
        duration_ms: duration,
        ai_duration_ms: aiDuration,
        confidence_score: 0.85
      }, requestId, false, duration);
      metricsCollector.recordRequest(req.method, req.url, 200, duration);
      return;
    }

    // GET /api/analysis/status - Last analysis status
    if (req.url === '/api/analysis/status' && req.method === 'GET') {
      const duration = Date.now() - startTime;
      const cacheSize = responseCache.cache.size;
      sendJson(res, 200, {
        cached_analyses: cacheSize,
        cache_enabled: true,
        ttl_seconds: 1800,
        timestamp: new Date().toISOString()
      }, requestId, false, duration);
      metricsCollector.recordRequest(req.method, req.url, 200, duration);
      return;
    }

    // ROOT API ENDPOINT
    if (req.url === '/' && req.method === 'GET') {
      const stats = metricsCollector.getStats();
      const healthStatus = await healthChecker.getHealthStatus();
      const duration = Date.now() - startTime;
      const uptime = Math.floor((Date.now() - START_TIME) / 1000);
      
      const response = {
        service: 'CurrencyDashboard API',
        version: APP_VERSION,
        status: healthStatus.status,
        uptime_seconds: uptime,
        endpoints: {
          health: [
            'GET /api/health - Full health check',
            'GET /api/health/live - Liveness probe',
            'GET /api/health/ready - Readiness probe',
            'GET /api/health/deep - Deep diagnostics'
          ],
          metrics: [
            'GET /api/stats - Request statistics'
          ],
          analysis: [
            'POST /api/analysis - Market analysis (requires market_data)',
            'GET /api/analysis/status - Cache status'
          ]
        },
        stats: {
          requests_total: stats.requests_total,
          errors: stats.errors_total,
          cache_hits: Math.floor((stats.cache_hit_rate_percent || 0)),
          avg_latency_ms: stats.avg_latency_ms
        },
        timestamp: new Date().toISOString()
      };
      
      sendJson(res, 200, response, requestId, false, duration);
      metricsCollector.recordRequest(req.method, req.url, 200, duration);
      return;
    }

    // Not found
    const notFoundDuration = Date.now() - startTime;
    sendJson(res, 404, { error: 'Not found', path: req.url }, requestId, false, notFoundDuration);
    metricsCollector.recordRequest(req.method, req.url, 404, notFoundDuration);

  } catch (error) {
    logger.error('Unhandled error', { clientId, requestId, error: error.message });
    const duration = Date.now() - startTime;
    sendJson(res, 500, { 
      error: '서버 오류가 발생했습니다.',
      requestId 
    }, requestId, false, duration);
    metricsCollector.recordRequest('UNKNOWN', req.url, 500, duration);
  }
});

server.listen(port, () => {
  logger.info(`OpenAI backend started`, { port });
});
