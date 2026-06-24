#!/usr/bin/env node

/**
 * Qwen2-VL Integration Test Script
 * 
 * This script verifies that the Qwen2-VL integration is properly configured
 * and functional. Run this after installation to ensure everything works.
 * 
 * Usage: node test-qwen2vl.js
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

async function test1_HealthCheck() {
  logSection('TEST 1: Health Check');
  
  try {
    log('📡 Checking service health...', 'blue');
    const response = await fetch(`${BASE_URL}/qwen2vl-health`);
    const health = await response.json();
    
    log(`Status: ${health.status}`, health.status === 'healthy' ? 'green' : 'red');
    log(`Model: ${health.model}`, 'blue');
    log(`Token Configured: ${health.token_configured}`, health.token_configured ? 'green' : 'red');
    log(`Timestamp: ${health.timestamp}`, 'blue');
    
    if (health.status === 'healthy') {
      log('✅ Health check passed', 'green');
      return true;
    } else {
      log('❌ Health check failed', 'red');
      if (health.error) {
        log(`Error: ${health.error}`, 'red');
      }
      if (!health.token_configured) {
        log('⚠️ HF_TOKEN not configured. Set it in .env file', 'yellow');
      }
      return false;
    }
  } catch (error) {
    log('❌ Health check request failed', 'red');
    log(`Error: ${error.message}`, 'red');
    log('⚠️ Make sure server is running on port 3001', 'yellow');
    return false;
  }
}

async function test2_ValidationErrors() {
  logSection('TEST 2: Input Validation');
  
  const tests = [
    {
      name: 'Missing frames',
      body: { transcript: 'Test transcript' },
      expectedStatus: 400,
      expectedError: 'frames'
    },
    {
      name: 'Empty frames array',
      body: { frames: [], transcript: 'Test transcript' },
      expectedStatus: 400,
      expectedError: 'frames'
    },
    {
      name: 'Missing transcript',
      body: { frames: ['https://example.com/image.jpg'] },
      expectedStatus: 400,
      expectedError: 'transcript'
    },
    {
      name: 'Empty transcript',
      body: { frames: ['https://example.com/image.jpg'], transcript: '' },
      expectedStatus: 400,
      expectedError: 'transcript'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      log(`Testing: ${test.name}`, 'blue');
      const response = await fetch(`${BASE_URL}/analyze-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.body)
      });
      
      const result = await response.json();
      
      if (response.status === test.expectedStatus && 
          result.error && 
          result.error.toLowerCase().includes(test.expectedError)) {
        log(`  ✅ Correctly rejected: ${result.error}`, 'green');
        passed++;
      } else {
        log(`  ❌ Unexpected response: ${response.status} - ${result.error || 'No error'}`, 'red');
        failed++;
      }
    } catch (error) {
      log(`  ❌ Test failed: ${error.message}`, 'red');
      failed++;
    }
  }
  
  log(`\nValidation Tests: ${passed} passed, ${failed} failed`, passed > failed ? 'green' : 'red');
  return failed === 0;
}

async function test3_MinimalAnalysis() {
  logSection('TEST 3: Minimal Analysis Request');
  
  // Use a simple test image (1x1 pixel transparent PNG in base64)
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const testTranscript = `This is a test video transcript for Qwen2-VL integration testing.
  
The video covers basic HTML concepts including semantic elements like header, nav, main, and footer.
These elements help structure web pages in a meaningful way that both humans and machines can understand.

This transcript is intentionally brief to minimize API usage during testing.`;

  try {
    log('📤 Sending minimal analysis request...', 'blue');
    log('Frames: 1 (1x1 test image)', 'blue');
    log(`Transcript: ${testTranscript.length} characters`, 'blue');
    
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}/analyze-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frames: [testImage],
        transcript: testTranscript,
        timeout: 60000,
        maxRetries: 2
      })
    });
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const error = await response.json();
      log(`❌ Request failed (${response.status})`, 'red');
      log(`Error: ${error.error}`, 'red');
      log(`Details: ${error.details}`, 'yellow');
      return false;
    }
    
    const result = await response.json();
    
    log(`✅ Request completed in ${duration}ms`, 'green');
    log('\nResponse Structure:', 'cyan');
    log(`  Success: ${result.success}`, result.success ? 'green' : 'red');
    log(`  Raw Response Length: ${result.raw?.length || 0} characters`, 'blue');
    log(`  Parsed Response: ${result.parsed ? 'Yes' : 'No'}`, result.parsed ? 'green' : 'red');
    
    if (result.parsed) {
      log('\nParsed Results:', 'cyan');
      log(`  Summary: ${result.parsed.summary?.substring(0, 100)}...`, 'blue');
      log(`  Quality Score: ${result.parsed.content_quality_score}/10`, 'blue');
      log(`  Learning Points: ${result.parsed.key_learning_points?.length || 0}`, 'blue');
      log(`  Suggestions: ${result.parsed.suggestions_for_improvement?.length || 0}`, 'blue');
      log(`  Target Audience: ${result.parsed.target_audience || 'N/A'}`, 'blue');
      log(`  Comprehension Level: ${result.parsed.estimated_comprehension_level || 'N/A'}`, 'blue');
    }
    
    if (result.metadata) {
      log('\nMetadata:', 'cyan');
      log(`  Model: ${result.metadata.model}`, 'blue');
      log(`  Frames Analyzed: ${result.metadata.frames_analyzed}`, 'blue');
      log(`  Transcript Length: ${result.metadata.transcript_length}`, 'blue');
      log(`  Attempt: ${result.metadata.attempt}`, 'blue');
      log(`  Timestamp: ${result.metadata.timestamp}`, 'blue');
    }
    
    // Validate response structure
    const requiredFields = ['success', 'raw', 'parsed', 'metadata'];
    const missingFields = requiredFields.filter(field => !result[field]);
    
    if (missingFields.length > 0) {
      log(`\n⚠️ Missing fields: ${missingFields.join(', ')}`, 'yellow');
    }
    
    const requiredParsedFields = [
      'summary', 
      'key_learning_points', 
      'content_quality_score',
      'suggestions_for_improvement'
    ];
    
    const missingParsedFields = requiredParsedFields.filter(
      field => !result.parsed?.[field]
    );
    
    if (missingParsedFields.length > 0) {
      log(`⚠️ Missing parsed fields: ${missingParsedFields.join(', ')}`, 'yellow');
    }
    
    log('\n✅ Minimal analysis test passed', 'green');
    return true;
    
  } catch (error) {
    log('❌ Analysis request failed', 'red');
    log(`Error: ${error.message}`, 'red');
    return false;
  }
}

async function test4_PerformanceMetrics() {
  logSection('TEST 4: Performance Metrics');
  
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const testTranscript = 'Brief test transcript for performance testing.';
  
  const iterations = 3;
  const timings = [];
  
  log(`Running ${iterations} iterations to measure performance...`, 'blue');
  
  for (let i = 1; i <= iterations; i++) {
    try {
      log(`\nIteration ${i}/${iterations}`, 'cyan');
      
      const startTime = Date.now();
      
      const response = await fetch(`${BASE_URL}/analyze-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: [testImage],
          transcript: testTranscript,
          timeout: 30000,
          maxRetries: 1
        })
      });
      
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        timings.push(duration);
        log(`  Duration: ${duration}ms`, 'green');
      } else {
        log(`  Failed (${response.status})`, 'red');
      }
      
      // Wait between iterations
      if (i < iterations) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      log(`  Error: ${error.message}`, 'red');
    }
  }
  
  if (timings.length > 0) {
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);
    
    log('\nPerformance Summary:', 'cyan');
    log(`  Successful requests: ${timings.length}/${iterations}`, 'blue');
    log(`  Average time: ${avg.toFixed(0)}ms`, 'blue');
    log(`  Min time: ${min}ms`, 'blue');
    log(`  Max time: ${max}ms`, 'blue');
    
    if (avg < 10000) {
      log('✅ Performance is excellent (<10s average)', 'green');
    } else if (avg < 30000) {
      log('✅ Performance is good (<30s average)', 'green');
    } else {
      log('⚠️ Performance is slow (>30s average)', 'yellow');
    }
    
    return true;
  } else {
    log('❌ No successful requests', 'red');
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('\n' + '='.repeat(80), 'cyan');
  log('  QWEN2-VL INTEGRATION TEST SUITE', 'cyan');
  log('='.repeat(80) + '\n', 'cyan');
  
  const results = {
    total: 4,
    passed: 0,
    failed: 0
  };
  
  // Test 1: Health Check
  const test1 = await test1_HealthCheck();
  if (test1) results.passed++; else results.failed++;
  
  if (!test1) {
    log('\n⚠️ Health check failed. Skipping remaining tests.', 'yellow');
    log('Fix configuration issues before running other tests.', 'yellow');
  } else {
    // Test 2: Validation
    const test2 = await test2_ValidationErrors();
    if (test2) results.passed++; else results.failed++;
    
    // Test 3: Minimal Analysis
    const test3 = await test3_MinimalAnalysis();
    if (test3) results.passed++; else results.failed++;
    
    // Test 4: Performance (optional, only if previous tests passed)
    if (test3) {
      const test4 = await test4_PerformanceMetrics();
      if (test4) results.passed++; else results.failed++;
    } else {
      log('\n⚠️ Skipping performance test due to previous failures', 'yellow');
      results.failed++;
    }
  }
  
  // Final Summary
  logSection('TEST SUMMARY');
  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, 'red');
  
  if (results.passed === results.total) {
    log('\n🎉 All tests passed! Integration is working correctly.', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some tests failed. Please review the output above.', 'red');
    log('\nCommon issues:', 'yellow');
    log('  1. HF_TOKEN not set in .env file', 'yellow');
    log('  2. Server not running (npm start)', 'yellow');
    log('  3. @huggingface/inference package not installed', 'yellow');
    log('  4. Network connectivity issues', 'yellow');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  log('\n❌ Test suite crashed', 'red');
  log(`Error: ${error.message}`, 'red');
  log(`Stack: ${error.stack}`, 'red');
  process.exit(1);
});
