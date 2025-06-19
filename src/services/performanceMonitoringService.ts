import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * Performance Monitoring Service for LajoSpaces Backend
 * Tracks response times, memory usage, and system performance
 */

export interface PerformanceMetrics {
  responseTime: {
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  system: {
    uptime: number;
    loadAverage: number[];
    cpuUsage: NodeJS.CpuUsage;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per minute
  };
  endpoints: Record<string, {
    count: number;
    averageTime: number;
    errors: number;
  }>;
}

export interface RequestMetrics {
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

class PerformanceMonitoringService {
  private requestHistory: RequestMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 10000;
  private readonly SLOW_REQUEST_THRESHOLD = 1000; // 1 second
  private readonly MEMORY_WARNING_THRESHOLD = 512 * 1024 * 1024; // 512MB
  private startTime = Date.now();

  /**
   * Track a request's performance
   */
  trackRequest(metrics: RequestMetrics): void {
    // Add to history
    this.requestHistory.push(metrics);

    // Maintain history size
    if (this.requestHistory.length > this.MAX_HISTORY_SIZE) {
      this.requestHistory.shift();
    }

    // Log slow requests
    if (metrics.responseTime > this.SLOW_REQUEST_THRESHOLD) {
      logger.warn('Slow request detected', {
        method: metrics.method,
        endpoint: metrics.endpoint,
        responseTime: metrics.responseTime,
        statusCode: metrics.statusCode,
        userId: metrics.userId,
        timestamp: metrics.timestamp.toISOString()
      });
    }

    // Log failed requests
    if (metrics.statusCode >= 500) {
      logger.error('Server error response', {
        method: metrics.method,
        endpoint: metrics.endpoint,
        statusCode: metrics.statusCode,
        responseTime: metrics.responseTime,
        userId: metrics.userId,
        ip: metrics.ip,
        timestamp: metrics.timestamp.toISOString()
      });
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentRequests = this.requestHistory.filter(
      req => req.timestamp.getTime() > oneMinuteAgo
    );

    // Calculate response time metrics
    const responseTimes = this.requestHistory.map(req => req.responseTime);
    const responseTimeMetrics = this.calculateResponseTimeMetrics(responseTimes);

    // Calculate memory metrics
    const memoryUsage = process.memoryUsage();

    // Calculate system metrics
    const uptime = (now - this.startTime) / 1000; // seconds
    const cpuUsage = process.cpuUsage();

    // Calculate request metrics
    const totalRequests = this.requestHistory.length;
    const successfulRequests = this.requestHistory.filter(req => req.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const requestRate = recentRequests.length; // requests per minute

    // Calculate endpoint metrics
    const endpointMetrics = this.calculateEndpointMetrics();

    return {
      responseTime: responseTimeMetrics,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      system: {
        uptime,
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
        cpuUsage
      },
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        rate: requestRate
      },
      endpoints: endpointMetrics
    };
  }

  /**
   * Calculate response time statistics
   */
  private calculateResponseTimeMetrics(responseTimes: number[]): PerformanceMetrics['responseTime'] {
    if (responseTimes.length === 0) {
      return { average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = responseTimes.sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      average: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0
    };
  }

  /**
   * Calculate per-endpoint metrics
   */
  private calculateEndpointMetrics(): Record<string, { count: number; averageTime: number; errors: number }> {
    const endpointStats: Record<string, { times: number[]; errors: number }> = {};

    this.requestHistory.forEach(req => {
      const key = `${req.method} ${req.endpoint}`;
      if (!endpointStats[key]) {
        endpointStats[key] = { times: [], errors: 0 };
      }
      endpointStats[key].times.push(req.responseTime);
      if (req.statusCode >= 400) {
        endpointStats[key].errors++;
      }
    });

    const result: Record<string, { count: number; averageTime: number; errors: number }> = {};
    Object.entries(endpointStats).forEach(([endpoint, stats]) => {
      const averageTime = stats.times.reduce((a, b) => a + b, 0) / stats.times.length;
      result[endpoint] = {
        count: stats.times.length,
        averageTime,
        errors: stats.errors
      };
    });

    return result;
  }

  /**
   * Get performance health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: {
      averageResponseTime: number;
      memoryUsage: number;
      errorRate: number;
    };
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check response time
    if (metrics.responseTime.average > 2000) {
      issues.push('High average response time');
      status = 'critical';
    } else if (metrics.responseTime.average > 1000) {
      issues.push('Elevated response time');
      if (status === 'healthy') status = 'warning';
    }

    // Check memory usage
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      issues.push('Critical memory usage');
      status = 'critical';
    } else if (memoryUsagePercent > 75) {
      issues.push('High memory usage');
      if (status === 'healthy') status = 'warning';
    }

    // Check error rate
    const errorRate = metrics.requests.total > 0 
      ? (metrics.requests.failed / metrics.requests.total) * 100 
      : 0;
    if (errorRate > 10) {
      issues.push('High error rate');
      status = 'critical';
    } else if (errorRate > 5) {
      issues.push('Elevated error rate');
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      issues,
      metrics: {
        averageResponseTime: metrics.responseTime.average,
        memoryUsage: memoryUsagePercent,
        errorRate
      }
    };
  }

  /**
   * Get slow endpoints report
   */
  getSlowEndpoints(limit: number = 10): Array<{
    endpoint: string;
    averageTime: number;
    count: number;
    errors: number;
  }> {
    const endpointMetrics = this.calculateEndpointMetrics();
    
    return Object.entries(endpointMetrics)
      .map(([endpoint, metrics]) => ({
        endpoint,
        averageTime: metrics.averageTime,
        count: metrics.count,
        errors: metrics.errors
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, limit);
  }

  /**
   * Monitor memory usage and alert if necessary
   */
  monitorMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    
    if (memoryUsage.heapUsed > this.MEMORY_WARNING_THRESHOLD) {
      logger.warn('High memory usage detected', {
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: string;
    metrics: PerformanceMetrics;
    healthStatus: ReturnType<typeof this.getHealthStatus>;
    slowEndpoints: ReturnType<typeof this.getSlowEndpoints>;
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const healthStatus = this.getHealthStatus();
    const slowEndpoints = this.getSlowEndpoints(5);
    const recommendations: string[] = [];

    // Generate recommendations
    if (metrics.responseTime.average > 1000) {
      recommendations.push('Consider optimizing database queries and adding caching');
    }
    if (metrics.memory.heapUsed > this.MEMORY_WARNING_THRESHOLD) {
      recommendations.push('Monitor memory leaks and optimize memory usage');
    }
    if (metrics.requests.failed > metrics.requests.successful * 0.05) {
      recommendations.push('Investigate and fix high error rate');
    }

    const summary = `Performance Summary: ${healthStatus.status.toUpperCase()} - ` +
      `Avg Response: ${metrics.responseTime.average.toFixed(0)}ms, ` +
      `Memory: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(0)}MB, ` +
      `Requests: ${metrics.requests.total} (${metrics.requests.rate}/min)`;

    return {
      summary,
      metrics,
      healthStatus,
      slowEndpoints,
      recommendations
    };
  }

  /**
   * Cleanup old performance data
   */
  cleanup(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.requestHistory = this.requestHistory.filter(
      req => req.timestamp > oneDayAgo
    );
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(): void {
    // Monitor memory every 5 minutes
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 5 * 60 * 1000);

    // Cleanup old data every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);

    // Log performance summary every 15 minutes
    setInterval(() => {
      const report = this.generateReport();
      logger.info('Performance Report', {
        summary: report.summary,
        healthStatus: report.healthStatus,
        slowEndpoints: report.slowEndpoints.slice(0, 3),
        timestamp: new Date().toISOString()
      });
    }, 15 * 60 * 1000);

    logger.info('Performance monitoring started');
  }
}

// Create singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();

export default performanceMonitoringService;
