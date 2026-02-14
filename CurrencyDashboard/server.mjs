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

// ==================== OPENAI CLIENT WITH RETRY ====================
class OpenAIClient {
  constructor(apiKey, model = 'gpt-3.5-turbo') {
    this.apiKey = apiKey;
    this.model = model;
    this.maxRetries = 3;
    this.timeout = 30000;
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
const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const clientId = getClientId(req);
  logger.info('Request received', { method: req.method, url: req.url, clientId });

  // Health check endpoint
  if (req.url === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { 
      ok: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
    return;
  }

  // Analysis endpoint with OpenAI integration
  if (req.url === '/api/analysis' && req.method === 'POST') {
    try {
      // Rate limiting check
      if (!rateLimiter.isAllowed(clientId)) {
        logger.warn('Rate limit exceeded', { clientId });
        sendJson(res, 429, { error: '요청 수 제한을 초과했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }

      // Parse request body
      const requestData = await parseBody(req);
      const { fedRate, exchangeRate, stockKrw, goldKrw, bond } = requestData;

      // Input validation
      const validation = validateAnalysisInput({ fedRate, exchangeRate, stockKrw, goldKrw, bond });
      if (!validation.valid) {
        logger.warn('Invalid input', { clientId, error: validation.error });
        sendJson(res, 400, { error: validation.error });
        return;
      }

      // Check cache
      const cacheKey = { fedRate, exchangeRate, stockKrw, goldKrw, bond };
      const cachedAnalysis = responseCache.get(cacheKey);
      if (cachedAnalysis) {
        logger.info('Returning cached analysis', { clientId });
        sendJson(res, 200, { analysis: cachedAnalysis, cached: true });
        return;
      }

      // Check OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        logger.error('OpenAI API key not configured');
        sendJson(res, 500, { error: 'OPENAI_API_KEY가 설정되지 않았습니다.' });
        return;
      }

      // Call OpenAI API with retry logic
      const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      const client = new OpenAIClient(process.env.OPENAI_API_KEY, model);
      
      logger.info('Calling OpenAI API', { clientId, model });
      const analysis = await client.analyzeMarket(fedRate, exchangeRate, stockKrw, goldKrw, bond);

      if (!analysis) {
        logger.error('Empty response from OpenAI', { clientId });
        sendJson(res, 500, { error: '분석 결과를 생성하지 못했습니다.' });
        return;
      }

      // Cache the result
      responseCache.set(cacheKey, analysis);

      logger.info('Analysis completed successfully', { clientId });
      sendJson(res, 200, { analysis, cached: false });
      return;
    } catch (error) {
      logger.error('Analysis request failed', { clientId, error: error.message });
      const statusCode = error.message.includes('timeout') ? 504 : 500;
      sendJson(res, statusCode, { 
        error: '분석 중 오류가 발생했습니다.',
        detail: error.message
      });
      return;
    }
  }

  // Cache statistics endpoint
  if (req.url === '/api/stats' && req.method === 'GET') {
    sendJson(res, 200, { 
      cacheSize: responseCache.cache.size,
      uptime: process.uptime()
    });
    return;
  }

  // Not found
  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  logger.info(`OpenAI backend started`, { port });
});
