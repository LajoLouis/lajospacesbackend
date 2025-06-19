#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Coverage requirements checker for LajoSpaces Backend
 * Ensures code coverage meets minimum thresholds
 */

// Coverage thresholds
const COVERAGE_THRESHOLDS = {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  },
  critical: {
    // Critical files require higher coverage
    'src/models/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'src/services/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'src/middleware/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
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
 * Read and parse coverage summary
 */
function readCoverageSummary() {
  const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
  
  if (!fs.existsSync(coveragePath)) {
    log('❌ Coverage summary not found. Run tests with coverage first.', 'red');
    log('   npm run test:coverage', 'yellow');
    process.exit(1);
  }

  try {
    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    return coverageData;
  } catch (error) {
    log('❌ Failed to parse coverage summary:', 'red');
    log(`   ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Check if coverage meets threshold
 */
function checkThreshold(actual, required, metric) {
  const percentage = actual.pct;
  const meets = percentage >= required;
  
  return {
    meets,
    percentage,
    required,
    metric,
    covered: actual.covered,
    total: actual.total,
    skipped: actual.skipped || 0
  };
}

/**
 * Check global coverage thresholds
 */
function checkGlobalCoverage(coverage) {
  const total = coverage.total;
  const results = [];
  let allPassed = true;

  logBold('\n📊 GLOBAL COVERAGE ANALYSIS', 'blue');
  log('=' .repeat(50), 'blue');

  for (const [metric, threshold] of Object.entries(COVERAGE_THRESHOLDS.global)) {
    const result = checkThreshold(total[metric], threshold, metric);
    results.push(result);

    const status = result.meets ? '✅' : '❌';
    const color = result.meets ? 'green' : 'red';
    
    log(`${status} ${metric.padEnd(12)}: ${result.percentage.toFixed(1)}% (required: ${result.required}%)`, color);
    log(`   Covered: ${result.covered}/${result.total}`, 'reset');

    if (!result.meets) {
      allPassed = false;
      const missing = Math.ceil((result.required * result.total / 100) - result.covered);
      log(`   Missing: ${missing} more ${metric} needed`, 'yellow');
    }
  }

  return { results, allPassed };
}

/**
 * Check file-specific coverage thresholds
 */
function checkFileCoverage(coverage) {
  logBold('\n📁 FILE-SPECIFIC COVERAGE ANALYSIS', 'blue');
  log('=' .repeat(50), 'blue');

  let criticalFilesPassed = true;
  const criticalFiles = [];

  for (const [filePath, fileData] of Object.entries(coverage)) {
    if (filePath === 'total') continue;

    // Check if file is in critical path
    let criticalThreshold = null;
    for (const [criticalPath, thresholds] of Object.entries(COVERAGE_THRESHOLDS.critical)) {
      if (filePath.includes(criticalPath)) {
        criticalThreshold = thresholds;
        break;
      }
    }

    if (criticalThreshold) {
      const fileName = path.basename(filePath);
      log(`\n🔍 Critical file: ${fileName}`, 'yellow');
      
      let filePassed = true;
      for (const [metric, threshold] of Object.entries(criticalThreshold)) {
        const result = checkThreshold(fileData[metric], threshold, metric);
        
        const status = result.meets ? '✅' : '❌';
        const color = result.meets ? 'green' : 'red';
        
        log(`  ${status} ${metric}: ${result.percentage.toFixed(1)}% (required: ${result.required}%)`, color);
        
        if (!result.meets) {
          filePassed = false;
          criticalFilesPassed = false;
        }
      }
      
      criticalFiles.push({ file: fileName, passed: filePassed });
    }
  }

  if (criticalFiles.length === 0) {
    log('ℹ️  No critical files found in coverage report', 'yellow');
  }

  return { criticalFilesPassed, criticalFiles };
}

/**
 * Generate coverage report
 */
function generateCoverageReport(globalResults, fileResults) {
  logBold('\n📋 COVERAGE REPORT SUMMARY', 'blue');
  log('=' .repeat(50), 'blue');

  // Global summary
  const globalPassed = globalResults.allPassed;
  const globalStatus = globalPassed ? '✅ PASSED' : '❌ FAILED';
  const globalColor = globalPassed ? 'green' : 'red';
  
  log(`Global Coverage: ${globalStatus}`, globalColor);

  // Critical files summary
  const criticalPassed = fileResults.criticalFilesPassed;
  const criticalStatus = criticalPassed ? '✅ PASSED' : '❌ FAILED';
  const criticalColor = criticalPassed ? 'green' : 'red';
  
  log(`Critical Files: ${criticalStatus}`, criticalColor);

  // Overall status
  const overallPassed = globalPassed && criticalPassed;
  const overallStatus = overallPassed ? '✅ PASSED' : '❌ FAILED';
  const overallColor = overallPassed ? 'green' : 'red';
  
  logBold(`\nOverall Status: ${overallStatus}`, overallColor);

  return overallPassed;
}

/**
 * Generate improvement suggestions
 */
function generateSuggestions(globalResults, fileResults) {
  logBold('\n💡 IMPROVEMENT SUGGESTIONS', 'yellow');
  log('=' .repeat(50), 'yellow');

  const failedMetrics = globalResults.results.filter(r => !r.meets);
  
  if (failedMetrics.length > 0) {
    log('Global coverage improvements needed:', 'yellow');
    failedMetrics.forEach(metric => {
      const gap = metric.required - metric.percentage;
      log(`  • Increase ${metric.metric} coverage by ${gap.toFixed(1)}%`, 'reset');
    });
  }

  const failedCriticalFiles = fileResults.criticalFiles.filter(f => !f.passed);
  
  if (failedCriticalFiles.length > 0) {
    log('\nCritical files needing attention:', 'yellow');
    failedCriticalFiles.forEach(file => {
      log(`  • ${file.file}`, 'reset');
    });
  }

  if (failedMetrics.length === 0 && failedCriticalFiles.length === 0) {
    log('🎉 All coverage requirements met! Great job!', 'green');
    log('Consider adding more edge case tests to improve quality further.', 'reset');
  }
}

/**
 * Main execution
 */
function main() {
  logBold('🔍 LAJOSPACES BACKEND - COVERAGE ANALYSIS', 'blue');
  log('Checking code coverage against quality requirements...', 'reset');

  try {
    // Read coverage data
    const coverage = readCoverageSummary();
    
    // Check global coverage
    const globalResults = checkGlobalCoverage(coverage);
    
    // Check file-specific coverage
    const fileResults = checkFileCoverage(coverage);
    
    // Generate report
    const passed = generateCoverageReport(globalResults, fileResults);
    
    // Generate suggestions
    generateSuggestions(globalResults, fileResults);
    
    // Exit with appropriate code
    if (passed) {
      logBold('\n🎉 Coverage requirements met!', 'green');
      process.exit(0);
    } else {
      logBold('\n❌ Coverage requirements not met!', 'red');
      log('Please add more tests to meet the minimum coverage thresholds.', 'yellow');
      process.exit(1);
    }
    
  } catch (error) {
    log(`❌ Coverage check failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  checkGlobalCoverage,
  checkFileCoverage,
  COVERAGE_THRESHOLDS
};
