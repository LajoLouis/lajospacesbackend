import { Express } from 'express';
import request from 'supertest';
import { User, IUser } from '../../src/models/User';
import { Property, IProperty } from '../../src/models/Property';
import { Notification, INotification } from '../../src/models/Notification';
import { testUtils } from '../setup/jest.setup';

/**
 * Test helper class for common testing operations
 */
export class TestHelpers {
  private app: Express;

  constructor(app: Express) {
    this.app = app;
  }

  /**
   * Create a test user and return user data with auth token
   */
  async createTestUser(overrides: any = {}): Promise<{
    user: IUser;
    token: string;
    password: string;
  }> {
    const password = 'password123';
    const userData = testUtils.generateTestUser({ password, ...overrides });
    const user = await User.create(userData);
    const token = user.generateAuthToken();

    return { user, token, password };
  }

  /**
   * Create multiple test users
   */
  async createTestUsers(count: number, overrides: any = {}): Promise<Array<{
    user: IUser;
    token: string;
    password: string;
  }>> {
    const users = [];
    for (let i = 0; i < count; i++) {
      const userData = {
        email: testUtils.randomEmail(),
        phoneNumber: testUtils.randomPhoneNumber(),
        ...overrides
      };
      const userWithToken = await this.createTestUser(userData);
      users.push(userWithToken);
    }
    return users;
  }

  /**
   * Create a test admin user
   */
  async createTestAdmin(overrides: any = {}): Promise<{
    user: IUser;
    token: string;
    password: string;
  }> {
    return this.createTestUser({ role: 'admin', ...overrides });
  }

  /**
   * Create a test property
   */
  async createTestProperty(ownerId: string, overrides: any = {}): Promise<IProperty> {
    const propertyData = testUtils.generateTestProperty(ownerId, overrides);
    return await Property.create(propertyData);
  }

  /**
   * Create multiple test properties
   */
  async createTestProperties(ownerId: string, count: number, overrides: any = {}): Promise<IProperty[]> {
    const properties = [];
    for (let i = 0; i < count; i++) {
      const propertyData = {
        title: `Test Property ${i + 1}`,
        ...overrides
      };
      const property = await this.createTestProperty(ownerId, propertyData);
      properties.push(property);
    }
    return properties;
  }

  /**
   * Create a test notification
   */
  async createTestNotification(userId: string, overrides: any = {}): Promise<INotification> {
    const notificationData = testUtils.generateTestNotification(userId, overrides);
    return await Notification.create(notificationData);
  }

  /**
   * Make authenticated request
   */
  async authenticatedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string, token: string) {
    return request(this.app)
      [method](url)
      .set('Authorization', `Bearer ${token}`);
  }

  /**
   * Login user and return token
   */
  async loginUser(email: string, password: string): Promise<string> {
    const response = await request(this.app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    return response.body.data.token;
  }

  /**
   * Register user and return user data with token
   */
  async registerUser(userData: any): Promise<{
    user: any;
    token: string;
  }> {
    const response = await request(this.app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    return {
      user: response.body.data.user,
      token: response.body.data.token
    };
  }

  /**
   * Create test data set for complex scenarios
   */
  async createTestDataSet(): Promise<{
    users: Array<{ user: IUser; token: string; password: string }>;
    admin: { user: IUser; token: string; password: string };
    properties: IProperty[];
    notifications: INotification[];
  }> {
    // Create users
    const users = await this.createTestUsers(3);
    const admin = await this.createTestAdmin();

    // Create properties
    const properties = [];
    for (const { user } of users) {
      const userProperties = await this.createTestProperties(user._id.toString(), 2);
      properties.push(...userProperties);
    }

    // Create notifications
    const notifications = [];
    for (const { user } of users) {
      const userNotifications = await this.createTestNotification(user._id.toString());
      notifications.push(userNotifications);
    }

    return { users, admin, properties, notifications };
  }

  /**
   * Assert response structure
   */
  assertSuccessResponse(response: any, expectedData?: any) {
    expect(response.body.success).toBe(true);
    if (expectedData) {
      expect(response.body.data).toMatchObject(expectedData);
    }
  }

  assertErrorResponse(response: any, expectedError?: string) {
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    if (expectedError) {
      expect(response.body.error).toContain(expectedError);
    }
  }

  /**
   * Assert pagination response
   */
  assertPaginationResponse(response: any, expectedTotal?: number) {
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.pagination).toBeDefined();
    expect(response.body.pagination.page).toBeDefined();
    expect(response.body.pagination.limit).toBeDefined();
    expect(response.body.pagination.total).toBeDefined();
    expect(response.body.pagination.pages).toBeDefined();
    
    if (expectedTotal !== undefined) {
      expect(response.body.pagination.total).toBe(expectedTotal);
    }
  }

  /**
   * Wait for async operations
   */
  async waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate test file data
   */
  generateTestFile(filename: string = 'test.jpg', mimetype: string = 'image/jpeg'): any {
    return {
      fieldname: 'image',
      originalname: filename,
      encoding: '7bit',
      mimetype,
      buffer: Buffer.from('test file content'),
      size: 1024
    };
  }

  /**
   * Generate test coordinates for Nigerian locations
   */
  generateNigerianCoordinates(): { latitude: number; longitude: number } {
    const nigerianLocations = [
      { latitude: 6.5244, longitude: 3.3792 }, // Lagos
      { latitude: 9.0765, longitude: 7.3986 }, // Abuja
      { latitude: 7.3775, longitude: 3.9470 }, // Ibadan
      { latitude: 11.9804, longitude: 8.5201 }, // Kano
      { latitude: 6.2649, longitude: 7.1608 }, // Enugu
    ];

    return nigerianLocations[Math.floor(Math.random() * nigerianLocations.length)];
  }

  /**
   * Generate test Nigerian states and LGAs
   */
  generateNigerianLocation(): { state: string; lga: string } {
    const locations = [
      { state: 'Lagos', lga: 'Victoria Island' },
      { state: 'Lagos', lga: 'Ikeja' },
      { state: 'Lagos', lga: 'Surulere' },
      { state: 'Abuja', lga: 'Wuse' },
      { state: 'Abuja', lga: 'Garki' },
      { state: 'Rivers', lga: 'Port Harcourt' },
      { state: 'Kano', lga: 'Kano Municipal' },
      { state: 'Oyo', lga: 'Ibadan North' }
    ];

    return locations[Math.floor(Math.random() * locations.length)];
  }

  /**
   * Mock external service responses
   */
  mockEmailService() {
    const emailService = require('../../src/services/emailService');
    jest.spyOn(emailService.emailService, 'sendEmail').mockResolvedValue({ success: true });
    jest.spyOn(emailService.emailService, 'sendWelcomeEmail').mockResolvedValue({ success: true });
    jest.spyOn(emailService.emailService, 'sendVerificationEmail').mockResolvedValue({ success: true });
  }

  mockUploadService() {
    const uploadService = require('../../src/services/uploadService');
    jest.spyOn(uploadService.uploadService, 'uploadImage').mockResolvedValue({
      url: 'https://test.cloudinary.com/test-image.jpg',
      publicId: 'test-public-id'
    });
  }

  /**
   * Clean up test data
   */
  async cleanupTestData() {
    await Promise.all([
      User.deleteMany({}),
      Property.deleteMany({}),
      Notification.deleteMany({})
    ]);
  }

  /**
   * Verify database state
   */
  async verifyDatabaseState(expectedCounts: {
    users?: number;
    properties?: number;
    notifications?: number;
  }) {
    const counts = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Notification.countDocuments()
    ]);

    if (expectedCounts.users !== undefined) {
      expect(counts[0]).toBe(expectedCounts.users);
    }
    if (expectedCounts.properties !== undefined) {
      expect(counts[1]).toBe(expectedCounts.properties);
    }
    if (expectedCounts.notifications !== undefined) {
      expect(counts[2]).toBe(expectedCounts.notifications);
    }
  }

  /**
   * Generate test search filters
   */
  generateSearchFilters(overrides: any = {}): any {
    const location = this.generateNigerianLocation();
    return {
      state: location.state,
      lga: location.lga,
      type: 'apartment',
      minPrice: 50000,
      maxPrice: 200000,
      amenities: ['parking', 'security'],
      ...overrides
    };
  }

  /**
   * Assert Nigerian data format
   */
  assertNigerianDataFormat(data: any) {
    if (data.phoneNumber) {
      expect(data.phoneNumber).toBeValidPhoneNumber();
    }
    if (data.email) {
      expect(data.email).toBeValidEmail();
    }
    if (data._id) {
      expect(data._id).toBeValidObjectId();
    }
  }
}

/**
 * Factory for creating test helpers
 */
export function createTestHelpers(app: Express): TestHelpers {
  return new TestHelpers(app);
}

export default TestHelpers;
