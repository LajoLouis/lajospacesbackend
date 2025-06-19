import { cleanupTestDatabase } from '../../src/config/testDatabase';
import { logger } from '../../src/utils/logger';

// Global teardown function that runs once after all tests
export default async function globalTeardown(): Promise<void> {
  try {
    logger.info('Starting global test teardown...');

    // Cleanup test databases
    await cleanupTestDatabase();

    logger.info('Global test teardown completed successfully');
  } catch (error) {
    logger.error('Global test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
};
