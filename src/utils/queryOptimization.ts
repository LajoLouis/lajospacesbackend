import mongoose, { Query, Document, Model, FilterQuery, UpdateQuery } from 'mongoose';
import { logger } from './logger';
import { cacheService, cacheHelpers } from '../services/cacheService';

// Query optimization configuration
export interface QueryOptimizationConfig {
  enableCaching: boolean;
  cacheType: 'user' | 'property' | 'search' | 'static' | 'temp';
  cacheTTL?: number;
  enablePagination: boolean;
  defaultLimit: number;
  maxLimit: number;
  enableProjection: boolean;
  enablePopulation: boolean;
  enableSorting: boolean;
  enableIndexHints: boolean;
}

// Default optimization configuration
const defaultConfig: QueryOptimizationConfig = {
  enableCaching: true,
  cacheType: 'temp',
  enablePagination: true,
  defaultLimit: 20,
  maxLimit: 100,
  enableProjection: true,
  enablePopulation: true,
  enableSorting: true,
  enableIndexHints: true
};

// Pagination interface
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string | Record<string, 1 | -1>;
  select?: string | Record<string, 1 | 0>;
  populate?: string | Record<string, any>;
}

// Pagination result interface
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
    hasPrev: boolean;
  };
}

// Query performance metrics
export interface QueryMetrics {
  queryType: string;
  executionTime: number;
  documentsExamined: number;
  documentsReturned: number;
  indexUsed: boolean;
  cacheHit: boolean;
  timestamp: Date;
}

class QueryOptimizer {
  private metrics: QueryMetrics[] = [];
  private maxMetricsHistory = 1000;

  /**
   * Optimize a find query with caching and pagination
   */
  async optimizedFind<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options: PaginationOptions = {},
    config: Partial<QueryOptimizationConfig> = {}
  ): Promise<PaginatedResult<T>> {
    const startTime = Date.now();
    const finalConfig = { ...defaultConfig, ...config };
    
    // Generate cache key
    const cacheKey = this.generateCacheKey('find', model.modelName, filter, options);
    
    // Try to get from cache first
    if (finalConfig.enableCaching) {
      const cached = await cacheService.get<PaginatedResult<T>>(cacheKey, finalConfig.cacheType);
      if (cached) {
        this.recordMetrics('find', Date.now() - startTime, 0, cached.data.length, false, true);
        return cached;
      }
    }

    try {
      // Build optimized query
      const query = this.buildOptimizedQuery(model, filter, options, finalConfig);
      
      // Execute count and find queries in parallel
      const [total, data] = await Promise.all([
        model.countDocuments(filter),
        query.exec()
      ]);

      // Calculate pagination info
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(finalConfig.maxLimit, Math.max(1, options.limit || finalConfig.defaultLimit));
      const pages = Math.ceil(total / limit);

      const result: PaginatedResult<T> = {
        data,
        pagination: {
          page,
          limit,
          total,
          pages,
          hasMore: page < pages,
          hasPrev: page > 1
        }
      };

      // Cache the result
      if (finalConfig.enableCaching) {
        await cacheService.set(cacheKey, result, finalConfig.cacheType, finalConfig.cacheTTL);
      }

      // Record metrics
      this.recordMetrics('find', Date.now() - startTime, total, data.length, true, false);

      return result;
    } catch (error) {
      logger.error('Query optimization error:', error);
      throw error;
    }
  }

  /**
   * Optimize a findOne query with caching
   */
  async optimizedFindOne<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options: { select?: string; populate?: string } = {},
    config: Partial<QueryOptimizationConfig> = {}
  ): Promise<T | null> {
    const startTime = Date.now();
    const finalConfig = { ...defaultConfig, ...config };
    
    // Generate cache key
    const cacheKey = this.generateCacheKey('findOne', model.modelName, filter, options);
    
    // Try to get from cache first
    if (finalConfig.enableCaching) {
      const cached = await cacheService.get<T>(cacheKey, finalConfig.cacheType);
      if (cached) {
        this.recordMetrics('findOne', Date.now() - startTime, 0, 1, false, true);
        return cached;
      }
    }

    try {
      let query = model.findOne(filter);

      // Apply optimizations
      if (finalConfig.enableProjection && options.select) {
        query = query.select(options.select);
      }

      if (finalConfig.enablePopulation && options.populate) {
        query = query.populate(options.populate);
      }

      const result = await query.exec();

      // Cache the result
      if (finalConfig.enableCaching && result) {
        await cacheService.set(cacheKey, result, finalConfig.cacheType, finalConfig.cacheTTL);
      }

      // Record metrics
      this.recordMetrics('findOne', Date.now() - startTime, 1, result ? 1 : 0, true, false);

      return result;
    } catch (error) {
      logger.error('Query optimization error:', error);
      throw error;
    }
  }

  /**
   * Optimize an aggregation query with caching
   */
  async optimizedAggregate<T>(
    model: Model<any>,
    pipeline: any[],
    options: { allowDiskUse?: boolean } = {},
    config: Partial<QueryOptimizationConfig> = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const finalConfig = { ...defaultConfig, ...config };
    
    // Generate cache key
    const cacheKey = this.generateCacheKey('aggregate', model.modelName, pipeline, options);
    
    // Try to get from cache first
    if (finalConfig.enableCaching) {
      const cached = await cacheService.get<T[]>(cacheKey, finalConfig.cacheType);
      if (cached) {
        this.recordMetrics('aggregate', Date.now() - startTime, 0, cached.length, false, true);
        return cached;
      }
    }

    try {
      const result = await model.aggregate(pipeline).option(options);

      // Cache the result
      if (finalConfig.enableCaching) {
        await cacheService.set(cacheKey, result, finalConfig.cacheType, finalConfig.cacheTTL);
      }

      // Record metrics
      this.recordMetrics('aggregate', Date.now() - startTime, result.length, result.length, true, false);

      return result;
    } catch (error) {
      logger.error('Aggregation optimization error:', error);
      throw error;
    }
  }

  /**
   * Build optimized query with all optimizations applied
   */
  private buildOptimizedQuery<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options: PaginationOptions,
    config: QueryOptimizationConfig
  ): Query<T[], T> {
    let query = model.find(filter);

    // Apply pagination
    if (config.enablePagination) {
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(config.maxLimit, Math.max(1, options.limit || config.defaultLimit));
      const skip = (page - 1) * limit;
      
      query = query.skip(skip).limit(limit);
    }

    // Apply sorting
    if (config.enableSorting && options.sort) {
      query = query.sort(options.sort);
    }

    // Apply field selection (projection)
    if (config.enableProjection && options.select) {
      query = query.select(options.select);
    }

    // Apply population
    if (config.enablePopulation && options.populate) {
      query = query.populate(options.populate);
    }

    // Apply lean for better performance (returns plain objects instead of Mongoose documents)
    query = query.lean();

    return query;
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(
    operation: string,
    modelName: string,
    filter: any,
    options: any
  ): string {
    const keyData = {
      operation,
      model: modelName,
      filter: JSON.stringify(filter),
      options: JSON.stringify(options)
    };
    
    return `query:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  /**
   * Record query performance metrics
   */
  private recordMetrics(
    queryType: string,
    executionTime: number,
    documentsExamined: number,
    documentsReturned: number,
    indexUsed: boolean,
    cacheHit: boolean
  ): void {
    const metric: QueryMetrics = {
      queryType,
      executionTime,
      documentsExamined,
      documentsReturned,
      indexUsed,
      cacheHit,
      timestamp: new Date()
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log slow queries
    if (executionTime > 1000) { // Log queries taking more than 1 second
      logger.warn('Slow query detected', {
        queryType,
        executionTime,
        documentsExamined,
        documentsReturned,
        indexUsed,
        cacheHit
      });
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): any {
    if (this.metrics.length === 0) {
      return { totalQueries: 0 };
    }

    const totalQueries = this.metrics.length;
    const totalExecutionTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0);
    const averageExecutionTime = totalExecutionTime / totalQueries;
    const cacheHitRate = this.metrics.filter(m => m.cacheHit).length / totalQueries;
    const slowQueries = this.metrics.filter(m => m.executionTime > 1000).length;

    const queryTypeStats = this.metrics.reduce((stats, metric) => {
      if (!stats[metric.queryType]) {
        stats[metric.queryType] = { count: 0, totalTime: 0, cacheHits: 0 };
      }
      stats[metric.queryType].count++;
      stats[metric.queryType].totalTime += metric.executionTime;
      if (metric.cacheHit) {
        stats[metric.queryType].cacheHits++;
      }
      return stats;
    }, {} as any);

    return {
      totalQueries,
      averageExecutionTime: Math.round(averageExecutionTime),
      cacheHitRate: Math.round(cacheHitRate * 100),
      slowQueries,
      queryTypeStats,
      recentMetrics: this.metrics.slice(-10) // Last 10 queries
    };
  }

  /**
   * Clear query metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Invalidate cache for a model
   */
  async invalidateModelCache(modelName: string): Promise<void> {
    await cacheHelpers.invalidatePattern(`*${modelName}*`);
    logger.info(`Cache invalidated for model: ${modelName}`);
  }
}

// Create and export singleton instance
export const queryOptimizer = new QueryOptimizer();

// Helper functions for common query patterns
export const queryHelpers = {
  /**
   * Optimized user lookup with caching
   */
  async findUserById(userId: string, select?: string): Promise<any> {
    const User = mongoose.model('User');
    return await queryOptimizer.optimizedFindOne(
      User,
      { _id: userId },
      { select },
      { cacheType: 'user', cacheTTL: 15 * 60 } // 15 minutes
    );
  },

  /**
   * Optimized property search with pagination
   */
  async searchProperties(
    filter: any,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<any>> {
    const Property = mongoose.model('Property');
    return await queryOptimizer.optimizedFind(
      Property,
      filter,
      options,
      { cacheType: 'search', cacheTTL: 5 * 60 } // 5 minutes
    );
  },

  /**
   * Optimized property lookup with caching
   */
  async findPropertyById(propertyId: string, populate?: string): Promise<any> {
    const Property = mongoose.model('Property');
    return await queryOptimizer.optimizedFindOne(
      Property,
      { _id: propertyId },
      { populate },
      { cacheType: 'property', cacheTTL: 30 * 60 } // 30 minutes
    );
  },

  /**
   * Optimized notification lookup
   */
  async getUserNotifications(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<any>> {
    const Notification = mongoose.model('Notification');
    return await queryOptimizer.optimizedFind(
      Notification,
      { userId, dismissed: false },
      { ...options, sort: { createdAt: -1 } },
      { cacheType: 'notification', cacheTTL: 5 * 60 } // 5 minutes
    );
  }
};

export default queryOptimizer;
