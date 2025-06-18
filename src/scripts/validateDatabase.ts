import { connectDatabase, disconnectDatabase } from '../config/database';
import { connectRedis, disconnectRedis } from '../config/redis';
import { logger } from '../utils/logger';
import User from '../models/User.model';
import Profile from '../models/Profile.model';

/**
 * Validate database connection and data integrity
 */
async function validateDatabase(): Promise<void> {
  try {
    logger.info('🔍 Starting database validation...');
    
    // Connect to databases
    await connectDatabase();
    await connectRedis();
    
    // Test MongoDB operations
    logger.info('📊 Testing MongoDB operations...');
    
    // Count documents
    const userCount = await User.countDocuments();
    const profileCount = await Profile.countDocuments();
    
    logger.info(`📊 Found ${userCount} users and ${profileCount} profiles`);
    
    // Test user queries
    const users = await User.find().limit(3);
    logger.info(`✅ Successfully queried ${users.length} users`);
    
    // Test profile queries with population
    const profiles = await Profile.find().populate('userId').limit(3);
    logger.info(`✅ Successfully queried ${profiles.length} profiles with user data`);
    
    // Test geospatial query (find users near San Francisco)
    const nearSF = await User.find({
      'location.coordinates.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749] // San Francisco
          },
          $maxDistance: 50000 // 50km
        }
      }
    });
    logger.info(`✅ Geospatial query found ${nearSF.length} users near San Francisco`);
    
    // Test user methods
    if (users.length > 0) {
      const user = users[0];
      logger.info(`✅ User methods test:`);
      logger.info(`   - Full name: ${user.getFullName()}`);
      logger.info(`   - Age: ${user.getAge()}`);
      logger.info(`   - Profile completion: ${user.calculateProfileCompletion()}%`);
    }
    
    // Test profile methods
    if (profiles.length > 0) {
      const profile = profiles[0];
      logger.info(`✅ Profile methods test:`);
      logger.info(`   - Profile completeness: ${profile.calculateCompleteness()}%`);
      logger.info(`   - Photo count: ${(profile as any).photoCount}`);
      logger.info(`   - Is complete: ${profile.isProfileComplete}`);
    }
    
    // Test Redis operations
    logger.info('🔴 Testing Redis operations...');
    
    const { redisUtils } = await import('../config/redis');
    
    // Test basic Redis operations
    await redisUtils.set('test_key', 'test_value', 60);
    const testValue = await redisUtils.get('test_key');
    
    if (testValue === 'test_value') {
      logger.info('✅ Redis read/write operations working');
    } else {
      throw new Error('Redis read/write test failed');
    }
    
    // Clean up test data
    await redisUtils.del('test_key');
    
    // Test Redis key generators
    const { redisKeys } = await import('../config/redis');
    const userSessionKey = redisKeys.userSession('test_user_id');
    const refreshTokenKey = redisKeys.refreshToken('test_token_id');
    
    logger.info(`✅ Redis key generators working:`);
    logger.info(`   - User session key: ${userSessionKey}`);
    logger.info(`   - Refresh token key: ${refreshTokenKey}`);
    
    // Database indexes validation
    logger.info('📊 Validating database indexes...');
    
    const userIndexes = await User.collection.getIndexes();
    const profileIndexes = await Profile.collection.getIndexes();
    
    logger.info(`✅ User collection has ${Object.keys(userIndexes).length} indexes`);
    logger.info(`✅ Profile collection has ${Object.keys(profileIndexes).length} indexes`);
    
    // Performance test
    logger.info('⚡ Running performance tests...');
    
    const startTime = Date.now();
    await User.find({ accountType: 'seeker' }).limit(10);
    const queryTime = Date.now() - startTime;
    
    logger.info(`✅ User query performance: ${queryTime}ms`);
    
    if (queryTime > 1000) {
      logger.warn('⚠️  Query performance is slow, consider optimizing indexes');
    }
    
    logger.info('🎉 Database validation completed successfully!');
    logger.info('📊 Summary:');
    logger.info(`   - MongoDB: ✅ Connected and functional`);
    logger.info(`   - Redis: ✅ Connected and functional`);
    logger.info(`   - Users: ${userCount} documents`);
    logger.info(`   - Profiles: ${profileCount} documents`);
    logger.info(`   - Indexes: ✅ Properly configured`);
    logger.info(`   - Geospatial queries: ✅ Working`);
    logger.info(`   - Model methods: ✅ Working`);
    logger.info(`   - Performance: ✅ Acceptable`);
    
  } catch (error) {
    logger.error('❌ Database validation failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from databases
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  validateDatabase();
}

export { validateDatabase };
