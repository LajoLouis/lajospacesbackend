import { config } from 'dotenv';
import { logger } from '../../src/utils/logger';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console methods but keep error logging
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidObjectId(): R;
      toBeValidEmail(): R;
      toBeValidPhoneNumber(): R;
      toHaveValidTimestamps(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidObjectId(received: any) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    const pass = typeof received === 'string' && objectIdRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received: any) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toBeValidPhoneNumber(received: any) {
    const phoneRegex = /^\+234[789][01]\d{8}$/;
    const pass = typeof received === 'string' && phoneRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Nigerian phone number`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Nigerian phone number`,
        pass: false,
      };
    }
  },

  toHaveValidTimestamps(received: any) {
    const hasCreatedAt = received.createdAt && received.createdAt instanceof Date;
    const hasUpdatedAt = received.updatedAt && received.updatedAt instanceof Date;
    const pass = hasCreatedAt && hasUpdatedAt;
    
    if (pass) {
      return {
        message: () => `expected object not to have valid timestamps`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected object to have valid createdAt and updatedAt timestamps`,
        pass: false,
      };
    }
  }
});

// Mock external services
jest.mock('../../src/services/emailService', () => ({
  emailService: {
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
    sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
    sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
    sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
    sendNotificationEmail: jest.fn().mockResolvedValue({ success: true })
  }
}));

jest.mock('../../src/services/uploadService', () => ({
  uploadService: {
    uploadImage: jest.fn().mockResolvedValue({
      url: 'https://test.cloudinary.com/test-image.jpg',
      publicId: 'test-public-id'
    }),
    deleteImage: jest.fn().mockResolvedValue({ success: true }),
    uploadMultipleImages: jest.fn().mockResolvedValue([
      {
        url: 'https://test.cloudinary.com/test-image-1.jpg',
        publicId: 'test-public-id-1'
      }
    ])
  }
}));

// Mock Redis for tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    flushDb: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    mGet: jest.fn().mockResolvedValue([]),
    sAdd: jest.fn().mockResolvedValue(1),
    sRem: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([]),
    zAdd: jest.fn().mockResolvedValue(1),
    zCard: jest.fn().mockResolvedValue(0),
    zRange: jest.fn().mockResolvedValue([]),
    zRemRangeByScore: jest.fn().mockResolvedValue(0),
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    ttl: jest.fn().mockResolvedValue(-1),
    info: jest.fn().mockResolvedValue(''),
    sendCommand: jest.fn().mockResolvedValue('OK'),
    isOpen: true,
    on: jest.fn(),
    off: jest.fn()
  }))
}));

// Mock Socket.IO for tests
jest.mock('socket.io', () => ({
  Server: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn()
    })),
    close: jest.fn()
  }))
}));

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Test utilities
export const testUtils = {
  // Generate test data
  generateTestUser: (overrides: any = {}) => ({
    firstName: 'Test',
    lastName: 'User',
    email: `test.user.${Date.now()}@test.com`,
    password: 'password123',
    phoneNumber: '+2348012345678',
    role: 'user',
    emailVerified: true,
    isActive: true,
    ...overrides
  }),

  generateTestProperty: (ownerId: string, overrides: any = {}) => ({
    title: 'Test Property',
    description: 'Test property description',
    type: 'apartment',
    price: 100000,
    currency: 'NGN',
    location: {
      state: 'Lagos',
      lga: 'Victoria Island',
      address: '123 Test Street',
      coordinates: {
        latitude: 6.4281,
        longitude: 3.4219
      }
    },
    amenities: ['parking', 'security'],
    images: [],
    owner: ownerId,
    status: 'available',
    ...overrides
  }),

  generateTestNotification: (userId: string, overrides: any = {}) => ({
    userId,
    type: 'welcome',
    title: 'Test Notification',
    message: 'Test notification message',
    priority: 'medium',
    read: false,
    dismissed: false,
    ...overrides
  }),

  // Wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random string
  randomString: (length: number = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Generate random email
  randomEmail: () => `test.${Date.now()}.${Math.random().toString(36).substring(7)}@test.com`,

  // Generate random phone number
  randomPhoneNumber: () => {
    const prefixes = ['803', '806', '813', '816', '903', '906'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    return `+234${prefix}${suffix}`;
  }
};

export default testUtils;
