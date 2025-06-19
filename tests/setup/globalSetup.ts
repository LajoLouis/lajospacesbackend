import { config } from 'dotenv';
import { setupTestDatabase } from '../../src/config/testDatabase';
import { logger } from '../../src/utils/logger';

// Global setup function that runs once before all tests
export default async function globalSetup(): Promise<void> {
  try {
    // Load test environment variables
    config({ path: '.env.test' });

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';

    // Suppress console output during setup
    const originalConsole = console.log;
    console.log = () => {};

    logger.info('Starting global test setup...');

    // Setup test databases
    await setupTestDatabase();

    // Restore console
    console.log = originalConsole;

    logger.info('Global test setup completed successfully');
  } catch (error) {
    logger.error('Global test setup failed:', error);
    throw error;
  }
};
