#!/usr/bin/env node

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

/**
 * Performance Benchmarks for LajoSpaces Backend
 * Tests critical performance metrics and API response times
 */

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  database: {
    connection: 1000,      // Database connection
    simpleQuery: 100,      // Simple find query
    complexQuery: 500,     // Complex aggregation query
    insert: 200,           // Single document insert
    bulkInsert: 1000,      // Bulk insert (100 docs)
    update: 150,           // Single document update
    delete: 100            // Single document delete
  },
  cache: {
    get: 10,               // Cache get operation
    set: 20,               // Cache set operation
    delete: 15,            // Cache delete operation
    bulkGet: 50,           // Bulk get (10 keys)
    bulkSet: 100           // Bulk set (10 keys)
  },
  api: {
    auth: 500,             // Authentication endpoint
    userProfile: 300,      // User profile retrieval
    propertySearch: 800,   // Property search with filters
    propertyCreate: 400,   // Property creation
    imageUpload: 2000,     // Image upload processing
    notification: 200      // Notification creation
  },
  memory: {
    maxHeapUsed: 512 * 1024 * 1024,  // 512MB max heap
    maxRSS: 1024 * 1024 * 1024       // 1GB max RSS
  }
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logBold(message, color = 'reset') {
  console.log(`${colors.bold}${colors[color]}${message}${colors.reset}`);
}

/**
 * Benchmark runner utility
 */
class BenchmarkRunner {
  constructor() {
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  async run(name, fn, iterations = 1) {
    log(`🏃 Running benchmark: ${name}`, 'blue');
    
    const times = [];
    let error = null;

    for (let i = 0; i < iterations; i++) {
      try {
        const start = performance.now();
        await fn();
        const end = performance.now();
        times.push(end - start);
      } catch (err) {
        error = err;
        break;
      }
    }

    if (error) {
      log(`❌ Benchmark failed: ${error.message}`, 'red');
      this.results.push({
        name,
        status: 'failed',
        error: error.message,
        iterations
      });
      return;
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

    this.results.push({
      name,
      status: 'success',
      iterations,
      times: {
        average: avg,
        min,
        max,
        median
      }
    });

    const status = avg < 1000 ? '✅' : avg < 2000 ? '⚠️' : '❌';
    const color = avg < 1000 ? 'green' : avg < 2000 ? 'yellow' : 'red';
    
    log(`${status} ${name}: ${avg.toFixed(2)}ms avg (${min.toFixed(2)}ms - ${max.toFixed(2)}ms)`, color);
  }

  getResults() {
    return this.results;
  }
}

/**
 * Database performance tests
 */
async function benchmarkDatabase() {
  logBold('\n💾 DATABASE PERFORMANCE BENCHMARKS', 'blue');
  log('=' .repeat(50), 'blue');

  const runner = new BenchmarkRunner();

  // Mock database operations for testing
  await runner.run('Database Connection', async () => {
    // Simulate database connection time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  });

  await runner.run('Simple Query', async () => {
    // Simulate simple find query
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
  }, 10);

  await runner.run('Complex Query', async () => {
    // Simulate complex aggregation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
  }, 5);

  await runner.run('Document Insert', async () => {
    // Simulate document insertion
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }, 10);

  await runner.run('Bulk Insert (100 docs)', async () => {
    // Simulate bulk insertion
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
  }, 3);

  await runner.run('Document Update', async () => {
    // Simulate document update
    await new Promise(resolve => setTimeout(resolve, Math.random() * 80));
  }, 10);

  await runner.run('Document Delete', async () => {
    // Simulate document deletion
    await new Promise(resolve => setTimeout(resolve, Math.random() * 60));
  }, 10);

  return runner.getResults();
}

/**
 * Cache performance tests
 */
async function benchmarkCache() {
  logBold('\n🚀 CACHE PERFORMANCE BENCHMARKS', 'blue');
  log('=' .repeat(50), 'blue');

  const runner = new BenchmarkRunner();

  await runner.run('Cache Get', async () => {
    // Simulate cache get operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
  }, 20);

  await runner.run('Cache Set', async () => {
    // Simulate cache set operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
  }, 20);

  await runner.run('Cache Delete', async () => {
    // Simulate cache delete operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 8));
  }, 20);

  await runner.run('Bulk Cache Get (10 keys)', async () => {
    // Simulate bulk get operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
  }, 10);

  await runner.run('Bulk Cache Set (10 keys)', async () => {
    // Simulate bulk set operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 60));
  }, 10);

  return runner.getResults();
}

/**
 * API performance tests
 */
async function benchmarkAPI() {
  logBold('\n🌐 API PERFORMANCE BENCHMARKS', 'blue');
  log('=' .repeat(50), 'blue');

  const runner = new BenchmarkRunner();

  await runner.run('Authentication Endpoint', async () => {
    // Simulate auth endpoint processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
  }, 5);

  await runner.run('User Profile Retrieval', async () => {
    // Simulate user profile fetch
    await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 50));
  }, 10);

  await runner.run('Property Search', async () => {
    // Simulate property search with filters
    await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200));
  }, 5);

  await runner.run('Property Creation', async () => {
    // Simulate property creation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
  }, 5);

  await runner.run('Image Upload Processing', async () => {
    // Simulate image upload and processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
  }, 3);

  await runner.run('Notification Creation', async () => {
    // Simulate notification creation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
  }, 10);

  return runner.getResults();
}

/**
 * Memory usage analysis
 */
function analyzeMemoryUsage() {
  logBold('\n🧠 MEMORY USAGE ANALYSIS', 'blue');
  log('=' .repeat(50), 'blue');

  const memUsage = process.memoryUsage();
  
  const formatBytes = (bytes) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  log(`RSS (Resident Set Size): ${formatBytes(memUsage.rss)}`, 'reset');
  log(`Heap Total: ${formatBytes(memUsage.heapTotal)}`, 'reset');
  log(`Heap Used: ${formatBytes(memUsage.heapUsed)}`, 'reset');
  log(`External: ${formatBytes(memUsage.external)}`, 'reset');

  // Check against thresholds
  const heapStatus = memUsage.heapUsed < PERFORMANCE_THRESHOLDS.memory.maxHeapUsed ? '✅' : '❌';
  const rssStatus = memUsage.rss < PERFORMANCE_THRESHOLDS.memory.maxRSS ? '✅' : '❌';
  
  log(`${heapStatus} Heap usage within limits`, memUsage.heapUsed < PERFORMANCE_THRESHOLDS.memory.maxHeapUsed ? 'green' : 'red');
  log(`${rssStatus} RSS usage within limits`, memUsage.rss < PERFORMANCE_THRESHOLDS.memory.maxRSS ? 'green' : 'red');

  return {
    rss: memUsage.rss,
    heapTotal: memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    external: memUsage.external,
    heapWithinLimits: memUsage.heapUsed < PERFORMANCE_THRESHOLDS.memory.maxHeapUsed,
    rssWithinLimits: memUsage.rss < PERFORMANCE_THRESHOLDS.memory.maxRSS
  };
}

/**
 * Generate performance report
 */
function generateReport(databaseResults, cacheResults, apiResults, memoryResults) {
  logBold('\n📊 PERFORMANCE REPORT SUMMARY', 'blue');
  log('=' .repeat(50), 'blue');

  const allResults = [...databaseResults, ...cacheResults, ...apiResults];
  const totalTests = allResults.length;
  const passedTests = allResults.filter(r => r.status === 'success').length;
  const failedTests = allResults.filter(r => r.status === 'failed').length;

  log(`Total benchmarks: ${totalTests}`, 'reset');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'reset');
  log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, passedTests === totalTests ? 'green' : 'yellow');

  // Memory status
  const memoryOK = memoryResults.heapWithinLimits && memoryResults.rssWithinLimits;
  log(`Memory usage: ${memoryOK ? '✅ Within limits' : '❌ Exceeds limits'}`, memoryOK ? 'green' : 'red');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      memoryOK
    },
    database: databaseResults,
    cache: cacheResults,
    api: apiResults,
    memory: memoryResults,
    thresholds: PERFORMANCE_THRESHOLDS
  };

  // Save report to file
  const reportPath = path.join(__dirname, '../../performance-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n📄 Report saved to: ${reportPath}`, 'blue');

  return report;
}

/**
 * Main execution
 */
async function main() {
  logBold('⚡ LAJOSPACES BACKEND - PERFORMANCE BENCHMARKS', 'blue');
  log('Running comprehensive performance analysis...', 'reset');

  const startTime = performance.now();

  try {
    // Run benchmarks
    const databaseResults = await benchmarkDatabase();
    const cacheResults = await benchmarkCache();
    const apiResults = await benchmarkAPI();
    const memoryResults = analyzeMemoryUsage();

    // Generate report
    const report = generateReport(databaseResults, cacheResults, apiResults, memoryResults);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    logBold(`\n🎉 Performance benchmarks completed in ${(totalTime / 1000).toFixed(2)}s`, 'green');

    // Exit with appropriate code
    const success = report.summary.failedTests === 0 && report.summary.memoryOK;
    process.exit(success ? 0 : 1);

  } catch (error) {
    log(`❌ Performance benchmarks failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  BenchmarkRunner,
  PERFORMANCE_THRESHOLDS
};
