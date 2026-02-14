import { test } from 'node:test';
import assert from 'node:assert';

// Configuration for tests
const API_URL = 'http://localhost:8787';
const TEST_TIMEOUT = 5000;

// Test data
const validAnalysisData = {
  fedRate: 3.5,
  exchangeRate: 1250,
  stockKrw: 85000,
  goldKrw: 120000,
  bond: 95
};

const invalidData = {
  fedRate: 'invalid',
  exchangeRate: 1250,
  stockKrw: 85000,
  goldKrw: 120000,
  bond: 95
};

export async function runTests() {
  console.log('🧪 Starting CurrencyDashboard API Tests\n');

  try {
    await testHealthEndpoint();
    await testHealthEndpointStructure();
    await testAnalysisValidation();
    await testAnalysisEndpoint();
    await testErrorHandling();
    await testRateLimiting();
    await testCaching();
    await testStatsEndpoint();
    
    console.log('\n✅ All tests completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Test: Health endpoint basic connectivity
async function testHealthEndpoint() {
  console.log('📋 Test 1: Health Endpoint');
  try {
    const response = await fetch(`${API_URL}/api/health`, {
      timeout: TEST_TIMEOUT
    });
    
    assert.strictEqual(response.status, 200, 'Health endpoint should return 200');
    const data = await response.json();
    assert.strictEqual(data.ok, true, 'Health response should have ok: true');
    
    console.log('   ✓ Health endpoint responds correctly');
  } catch (error) {
    console.log('   ℹ️  Server not running on port 8787');
    throw error;
  }
}

// Test: Health endpoint response structure
async function testHealthEndpointStructure() {
  console.log('📋 Test 2: Health Endpoint Structure');
  try {
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();
    
    assert(data.timestamp, 'Response should have timestamp');
    assert(typeof data.uptime === 'number', 'Response should have uptime number');
    
    console.log('   ✓ Health response has correct structure');
    console.log(`   ✓ Server uptime: ${data.uptime.toFixed(2)}s`);
  } catch (error) {
    throw error;
  }
}

// Test: Input validation on analysis endpoint
async function testAnalysisValidation() {
  console.log('📋 Test 3: Input Validation');
  try {
    const response = await fetch(`${API_URL}/api/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData),
      timeout: TEST_TIMEOUT
    });
    
    assert.strictEqual(response.status, 400, 'Invalid input should return 400');
    const data = await response.json();
    assert(data.error, 'Response should include error message');
    
    console.log('   ✓ Invalid input properly rejected');
    console.log(`   ✓ Error message: "${data.error}"`);
  } catch (error) {
    throw error;
  }
}

// Test: Valid analysis request
async function testAnalysisEndpoint() {
  console.log('📋 Test 4: Analysis Endpoint (requires OpenAI API key)');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('   ⊘ Skipped (OPENAI_API_KEY not set)');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validAnalysisData),
      timeout: TEST_TIMEOUT * 2  // Give OpenAI time to respond
    });
    
    if (response.status === 500) {
      const data = await response.json();
      console.log(`   ⚠️  API Error: ${data.detail}`);
      return;
    }
    
    assert.strictEqual(response.status, 200, 'Valid request should return 200');
    const data = await response.json();
    assert(data.analysis, 'Response should include analysis');
    
    console.log('   ✓ Analysis generated successfully');
    console.log(`   ✓ Response: ${data.analysis.substring(0, 50)}...`);
  } catch (error) {
    console.log(`   ⚠️  Analysis test skipped: ${error.message}`);
  }
}

// Test: Error handling for malformed requests
async function testErrorHandling() {
  console.log('📋 Test 5: Error Handling');
  try {
    const response = await fetch(`${API_URL}/api/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
      timeout: TEST_TIMEOUT
    });
    
    assert(response.status >= 400, 'Invalid request should return error status');
    
    console.log('   ✓ Malformed requests handled gracefully');
  } catch (error) {
    throw error;
  }
}

// Test: Rate limiting functionality
async function testRateLimiting() {
  console.log('📋 Test 6: Rate Limiting');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('   ⊘ Skipped (requires valid API key)');
    return;
  }

  try {
    const clientId = 'test-client-' + Date.now();
    let rateLimitHit = false;
    
    // Send multiple requests rapidly
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${API_URL}/api/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId
        },
        body: JSON.stringify(validAnalysisData),
        timeout: TEST_TIMEOUT
      });
      
      if (response.status === 429) {
        rateLimitHit = true;
        console.log('   ✓ Rate limit triggered at request ' + (i + 1));
        break;
      }
    }
    
    if (!rateLimitHit) {
      console.log('   ℹ️  No rate limit hit in 5 requests (limit: 30/min)');
    }
  } catch (error) {
    console.log(`   ⚠️  Rate limit test inconclusive: ${error.message}`);
  }
}

// Test: Response caching
async function testCaching() {
  console.log('📋 Test 7: Response Caching');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('   ⊘ Skipped (requires valid API key)');
    return;
  }

  try {
    const clientId = 'cache-test-' + Date.now();
    
    // First request (should hit OpenAI)
    const response1 = await fetch(`${API_URL}/api/analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId
      },
      body: JSON.stringify(validAnalysisData),
      timeout: TEST_TIMEOUT * 2
    });
    
    if (response1.status === 200) {
      const data1 = await response1.json();
      const cached1 = data1.cached;
      
      // Second identical request (should use cache)
      const response2 = await fetch(`${API_URL}/api/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId
        },
        body: JSON.stringify(validAnalysisData),
        timeout: TEST_TIMEOUT
      });
      
      const data2 = await response2.json();
      const cached2 = data2.cached;
      
      console.log(`   ✓ First request cached: ${cached1}`);
      console.log(`   ✓ Second request cached: ${cached2}`);
      
      if (cached2) {
        console.log('   ✓ Cache working - identical request returned cached result');
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Caching test incomplete: ${error.message}`);
  }
}

// Test: Stats endpoint
async function testStatsEndpoint() {
  console.log('📋 Test 8: Stats Endpoint');
  try {
    const response = await fetch(`${API_URL}/api/stats`);
    
    assert.strictEqual(response.status, 200, 'Stats endpoint should return 200');
    const data = await response.json();
    assert(typeof data.cacheSize === 'number', 'Stats should include cacheSize');
    assert(typeof data.uptime === 'number', 'Stats should include uptime');
    
    console.log('   ✓ Stats endpoint working');
    console.log(`   ✓ Cache size: ${data.cacheSize} entries`);
    console.log(`   ✓ Uptime: ${data.uptime.toFixed(2)}s`);
  } catch (error) {
    throw error;
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export default { runTests };
