# CurrencyDashboard

An advanced interactive dashboard for macroeconomic education and investment simulation with OpenAI API integration, comprehensive health monitoring, and real-time metrics tracking.

![Version](https://img.shields.io/badge/version-1.2.3--local-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![React](https://img.shields.io/badge/react-18.2.0-blue)

## 🎯 Features

### 📊 Dual Dashboard Interface
- **기축통화 교육 (Anchor Currency Education)**: Comprehensive macroeconomic education dashboard with Federal Reserve rate controls, reserve data visualization, and currency analysis
- **투자 시뮬레이터 (Investment Simulator)**: Real-time investment simulator with AI-powered market analysis from OpenAI

### 🤖 AI Integration
- **OpenAI Chat Completions API**: Intelligent market analysis with gpt-3.5-turbo
- **Exponential Backoff Retry Logic**: Automatic recovery with smart retry mechanism
- **Response Caching**: 30-minute TTL cache to optimize API usage and costs

### 🏥 Production-Grade Features
- **Health Check System**: 
  - Full health status with component checks (OpenAI, memory, cache)
  - Kubernetes-compatible liveness/readiness probes
  - HTTP status codes: 200 (healthy), 206 (degraded), 503 (unhealthy)
- **Rate Limiting**: Configurable request throttling (30 req/min, 200 req/hour per client)
- **Real-time Metrics**: Request tracking, error rates, latency measurement, cache hit rates
- **Comprehensive Logging**: JSON-structured logs with timestamps and request tracing

### 🎨 Modern UI/UX
- Dark theme optimized interface with Tailwind CSS
- Health status badge with real-time API status polling (5-second intervals)
- Server statistics modal with live metrics
- Responsive navigation with tab switching
- Smooth transitions and hover effects

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/STak6334/CurrencyDashboard.git
cd CurrencyDashboard

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### Running the Application

#### Development Mode (Recommended)
```bash
# Starts both backend (port 8787) and frontend (port 5173) simultaneously
npm run dev
```

#### Backend Only
```bash
node server.mjs
```

#### Frontend Only
```bash
npm run dev:frontend
```

#### Production Build
```bash
npm run build
npm start
```

## 📡 API Endpoints

### Health Checks
- `GET /api/health` - Full health status with component checks (HTTP 200/206/503)
- `GET /api/health/live` - Kubernetes liveness probe
- `GET /api/health/ready` - Readiness probe with dependency checks
- `GET /api/health/deep` - Deep diagnostic health + comprehensive metrics

### Analytics & Metrics
- `GET /api/stats` - Request statistics and performance metrics
- `GET /api/analysis/status` - Cached analysis count and storage status

### AI Analysis
- `POST /api/analysis` - Generate AI market analysis
  - Request: `{ "market_data": "...", "user_id": "..." }`
  - Response: `{ "analysis": "...", "timestamp": "...", "from_cache": boolean }`

## 📊 Response Examples

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2026-02-14T20:36:22.421Z",
  "components": {
    "openai_api": "operational",
    "memory": "normal",
    "cache": "healthy"
  },
  "uptime_seconds": 125
}
```

### Metrics Response
```json
{
  "requests_total": 156,
  "requests_last_5min": 23,
  "error_rate_percent": 0.64,
  "avg_latency_ms": 234,
  "cache_hit_rate_percent": 42.31,
  "top_endpoints": [
    {
      "endpoint": "POST /api/analysis",
      "count": 45,
      "errors": 0,
      "avg_latency_ms": 2150
    }
  ]
}
```

## 🏗️ Architecture

### Backend (Node.js)
- Native HTTP server (no Express overhead)
- Core Classes:
  - `Logger`: JSON-structured logging with request IDs
  - `RateLimiter`: Per-client request throttling
  - `ResponseCache`: TTL-based caching strategy
  - `OpenAIClient`: API client with retry logic
  - `HealthChecker`: Component health monitoring
  - `MetricsCollector`: Request metrics and analytics

### Frontend (React + Vite)
- Component-based architecture:
  - `App.jsx`: Main router with health polling and stats display
  - `AnchorCurrencyDashboard.jsx`: Educational macro dashboard (864 lines)
  - `UltimateEconomySim.jsx`: Investment simulator (180 lines)
- Real-time health status polling
- Modal-based statistics viewer
- Tailwind CSS for styling

### Development Tools
- **Vite 5.4.21**: Lightning-fast frontend bundling
- **dev.mjs**: Unified development environment spawner

## 🔧 Configuration

### Environment Variables
```bash
OPENAI_API_KEY=sk-your-key-here
PORT=8787
NODE_ENV=development
```

### Server Configuration (in server.mjs)
```javascript
const RATE_LIMIT_WINDOW_MINUTES = 1
const RATE_LIMIT_MAX_REQUESTS = 30
const RATE_LIMIT_HOURLY_MAX = 200
const CACHE_TTL_MINUTES = 30
const RETRY_MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1000
```

## 📝 Logging

All requests are logged to `log/requests.log` in JSON format:
```json
{
  "timestamp": "2026-02-14T20:36:22.421Z",
  "level": "INFO",
  "request_id": "req_abc123",
  "method": "POST",
  "path": "/api/analysis",
  "status": 200,
  "duration_ms": 2150,
  "message": "Request completed"
}
```

## 🗂️ Project Structure

```
CurrencyDashboard/
├── server.mjs                 # Backend server (507 lines)
├── dev.mjs                    # Development environment spawner
├── package.json               # Dependencies and scripts
├── vite.config.js             # Vite configuration
├── tailwind.config.js         # Tailwind CSS config
├── postcss.config.js          # PostCSS configuration
├── index.html                 # HTML entry point
├── src/
│   ├── App.jsx                # Main React component with routing
│   ├── main.jsx               # React DOM mount point
│   ├── index.css              # Global styles
│   └── components/
│       ├── AnchorCurrencyDashboard.jsx    # EDU Dashboard (864 lines)
│       └── UltimateEconomySim.jsx         # Investment Simulator (180 lines)
├── log/
│   └── requests.log           # Request logs
├── README.md                  # This file
├── API_IMPROVEMENTS.md        # Detailed API documentation
└── server.mjs.backup          # Backup of original server implementation
```

## 🔍 Health Monitoring Dashboard

The frontend includes a built-in health monitoring system:

1. **Status Badge** (Top-left): Real-time API status indicator
   - 🟢 Healthy: All systems operational
   - 🟡 Degraded: Some issues detected
   - 🔴 Unhealthy: Critical issues
   - ⚪ Unreachable: Backend offline

2. **Stats Button**: Click to view real-time server metrics
   - Total Requests
   - Requests in last 5 minutes
   - Error Rate
   - Average Latency
   - Cache Hit Rate
   - Top 5 Endpoints

## 🚨 Error Handling

The API returns proper HTTP status codes:
- `200 OK`: Request successful
- `206 Partial Content`: Degraded health (non-critical issues)
- `400 Bad Request`: Invalid parameters
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Critical health issues

## 📈 Performance Metrics

Typical performance characteristics:
- **API Response Time**: 2-3 seconds (includes OpenAI processing)
- **Cache Hit Rate**: 40-60% depending on usage patterns
- **Memory Usage**: ~50-100 MB baseline
- **Request Throughput**: 200+ requests/hour per client

## 🔐 Security Considerations

- Rate limiting prevents abuse
- Request IDs for tracing and debugging
- Environment-based API key management
- CORS headers for cross-origin requests
- Input validation on all endpoints

## 📚 Additional Documentation

See [API_IMPROVEMENTS.md](API_IMPROVEMENTS.md) for:
- Curl command examples for all endpoints
- Detailed endpoint specifications
- Request/response schemas
- Error handling guide

## 🛠️ Development Workflow

### Local Testing
```bash
# Start development servers
npm run dev

# Test backend health
curl http://localhost:8787/api/health

# View server stats
curl http://localhost:8787/api/stats

# Submit analysis request
curl -X POST http://localhost:8787/api/analysis \
  -H "Content-Type: application/json" \
  -d '{"market_data": "nasdaq up 2%", "user_id": "user1"}'
```

### Building for Production
```bash
npm run build
npm start
```

Frontend will be available at `http://localhost:5173` (or configured port)
Backend API at `http://localhost:8787`

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🎓 Educational Use

This dashboard is designed for educational purposes to understand:
- Federal Reserve mechanisms and interest rate impacts
- Foreign currency reserves management
- Investment portfolio simulation
- Basic macroeconomic principles
- Real-time API integration patterns

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Windows: Kill process on port 8787
netstat -ano | findstr :8787
taskkill /PID <PID> /F

# Or configure different port in server.mjs
```

### OpenAI API Errors
- Verify API key is set in .env
- Check API rate limits at https://platform.openai.com/account/rate-limits
- Review API usage at https://platform.openai.com/account/billing/overview

### Frontend Not Loading
- Ensure backend is running on port 8787
- Check browser console for CORS errors
- Verify Vite dev server is running on port 5173

### Cache Issues
- Clear browser cache (Ctrl+Shift+Delete)
- Restart backend server to clear in-memory cache
- Analytics cache clears after 30 minutes automatically

## 📞 Support

For issues and questions:
- Check existing GitHub issues
- Review the [API_IMPROVEMENTS.md](API_IMPROVEMENTS.md) documentation
- Check server logs in `log/requests.log`

## 🎉 Acknowledgments

- Built with React, Vite, Tailwind CSS
- OpenAI API for market analysis
- Lucide React for icons
- Modern web technologies and best practices

---

**Version**: 1.2.3-local  
**Last Updated**: February 14, 2026  
**Repository**: https://github.com/STak6334/CurrencyDashboard
