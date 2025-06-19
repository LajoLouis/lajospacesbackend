import mongoose from 'mongoose';
import { User, IUser } from '../../../src/models/User';
import { setupTestDatabase, clearTestData, cleanupTestDatabase } from '../../../src/config/testDatabase';
import { testUtils } from '../../setup/jest.setup';

describe('User Model', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  describe('User Creation', () => {
    it('should create a valid user', async () => {
      const userData = testUtils.generateTestUser();
      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.firstName).toBe(userData.firstName);
      expect(savedUser.lastName).toBe(userData.lastName);
      expect(savedUser.phoneNumber).toBe(userData.phoneNumber);
      expect(savedUser.role).toBe('user');
      expect(savedUser.emailVerified).toBe(true);
      expect(savedUser.isActive).toBe(true);
      expect(savedUser).toHaveValidTimestamps();
    });

    it('should hash password before saving', async () => {
      const userData = testUtils.generateTestUser({ password: 'plaintext123' });
      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.password).not.toBe('plaintext123');
      expect(savedUser.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    it('should generate full name virtual', async () => {
      const userData = testUtils.generateTestUser({
        firstName: 'John',
        lastName: 'Doe'
      });
      const user = new User(userData);

      expect(user.fullName).toBe('John Doe');
    });

    it('should set default values correctly', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        email: testUtils.randomEmail(),
        password: 'password123',
        phoneNumber: testUtils.randomPhoneNumber()
      };
      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.role).toBe('user');
      expect(savedUser.emailVerified).toBe(false);
      expect(savedUser.isActive).toBe(true);
      expect(savedUser.preferences).toBeDefined();
      expect(savedUser.preferences.notifications).toBe(true);
      expect(savedUser.preferences.emailUpdates).toBe(true);
    });
  });

  describe('User Validation', () => {
    it('should require firstName', async () => {
      const userData = testUtils.generateTestUser({ firstName: undefined });
      const user = new User(userData);

      await expect(user.save()).rejects.toThrow(/firstName.*required/);
    });

    it('should require lastName', async () => {
      const userData = testUtils.generateTestUser({ lastName: undefined });
      const user = new User(userData);

      await expect(user.save()).rejects.toThrow(/lastName.*required/);
    });

    it('should require email', async () => {
      const userData = testUtils.generateTestUser({ email: undefined });
      const user = new User(userData);

      await expect(user.save()).rejects.toThrow(/email.*required/);
    });

    it('should validate email format', async () => {
      const userData = testUtils.generateTestUser({ email: 'invalid-email' });
      const user = new User(userData);

      await expect(user.save()).rejects.toThrow(/email.*valid/);
    });

    it('should require unique email', async () => {
      const email = testUtils.randomEmail();
      const userData1 = testUtils.generateTestUser({ email });
      const userData2 = testUtils.generateTestUser({ email });

      const user1 = new User(userData1);
      await user1.save();

      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow(/email.*unique/);
    });

    it('should validate phone number format', async () => {
      const userData = testUtils.generateTestUser({ phoneNumber: 'invalid-phone' });
      const user = new User(userData);

      await expect(user.save()).rejects.toThrow(/phoneNumber.*valid/);
    });

    it('should accept valid Nigerian phone numbers', async () => {
      const validPhones = [
        '+2348031234567',
        '+2347031234567',
        '+2349031234567',
        '+2348061234567'
      ];

      for (const phone of validPhones) {
        const userData = testUtils.generateTestUser({ 
          email: testUtils.randomEmail(),
          phoneNumber: phone 
        });
        const user = new User(userData);
        const savedUser = await user.save();

        expect(savedUser.phoneNumber).toBe(phone);
      }
    });

    it('should validate role enum', async () => {
      const userData = testUtils.generateTestUser({ role: 'invalid-role' });
      const user = new User(userData);

      await expect(user.save()).rejects.toThrow(/role.*enum/);
    });

    it('should validate password length', async () => {
      const userData = testUtils.generateTestUser({ password: '123' });
      const user = new User(userData);

      await expect(user.save()).rejects.toThrow(/password.*6/);
    });
  });

  describe('User Methods', () => {
    let user: IUser;

    beforeEach(async () => {
      const userData = testUtils.generateTestUser({ password: 'password123' });
      user = new User(userData);
      await user.save();
    });

    it('should compare password correctly', async () => {
      const isMatch = await user.comparePassword('password123');
      expect(isMatch).toBe(true);

      const isNotMatch = await user.comparePassword('wrongpassword');
      expect(isNotMatch).toBe(false);
    });

    it('should generate auth token', () => {
      const token = user.generateAuthToken();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should convert to JSON without password', () => {
      const userJSON = user.toJSON();
      expect(userJSON.password).toBeUndefined();
      expect(userJSON.email).toBe(user.email);
      expect(userJSON.firstName).toBe(user.firstName);
    });
  });

  describe('User Indexes', () => {
    it('should have email index', async () => {
      const indexes = await User.collection.getIndexes();
      const emailIndex = Object.keys(indexes).find(key => key.includes('email'));
      expect(emailIndex).toBeDefined();
    });

    it('should have phoneNumber index', async () => {
      const indexes = await User.collection.getIndexes();
      const phoneIndex = Object.keys(indexes).find(key => key.includes('phoneNumber'));
      expect(phoneIndex).toBeDefined();
    });
  });

  describe('User Profile', () => {
    it('should save profile information', async () => {
      const userData = testUtils.generateTestUser({
        profile: {
          bio: 'Test bio',
          occupation: 'Software Developer',
          interests: ['technology', 'music'],
          socialMedia: {
            instagram: '@testuser',
            twitter: '@testuser'
          }
        }
      });
      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.profile.bio).toBe('Test bio');
      expect(savedUser.profile.occupation).toBe('Software Developer');
      expect(savedUser.profile.interests).toContain('technology');
      expect(savedUser.profile.socialMedia.instagram).toBe('@testuser');
    });

    it('should save roommate preferences', async () => {
      const userData = testUtils.generateTestUser({
        roommatePreferences: {
          ageRange: { min: 25, max: 35 },
          gender: 'any',
          occupation: 'professional',
          lifestyle: 'quiet',
          cleanliness: 'very_clean',
          smokingPolicy: 'no_smoking',
          petPolicy: 'no_pets',
          guestPolicy: 'occasional'
        }
      });
      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.roommatePreferences.ageRange.min).toBe(25);
      expect(savedUser.roommatePreferences.gender).toBe('any');
      expect(savedUser.roommatePreferences.smokingPolicy).toBe('no_smoking');
    });
  });

  describe('User Statics', () => {
    it('should find user by email', async () => {
      const userData = testUtils.generateTestUser();
      const user = new User(userData);
      await user.save();

      const foundUser = await User.findByEmail(userData.email);
      expect(foundUser).toBeDefined();
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should find user by phone number', async () => {
      const userData = testUtils.generateTestUser();
      const user = new User(userData);
      await user.save();

      const foundUser = await User.findByPhoneNumber(userData.phoneNumber);
      expect(foundUser).toBeDefined();
      expect(foundUser!.phoneNumber).toBe(userData.phoneNumber);
    });

    it('should find active users', async () => {
      const activeUser = testUtils.generateTestUser({ 
        email: testUtils.randomEmail(),
        isActive: true 
      });
      const inactiveUser = testUtils.generateTestUser({ 
        email: testUtils.randomEmail(),
        isActive: false 
      });

      await User.create([activeUser, inactiveUser]);

      const activeUsers = await User.findActiveUsers();
      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].isActive).toBe(true);
    });

    it('should find verified users', async () => {
      const verifiedUser = testUtils.generateTestUser({ 
        email: testUtils.randomEmail(),
        emailVerified: true 
      });
      const unverifiedUser = testUtils.generateTestUser({ 
        email: testUtils.randomEmail(),
        emailVerified: false 
      });

      await User.create([verifiedUser, unverifiedUser]);

      const verifiedUsers = await User.findVerifiedUsers();
      expect(verifiedUsers).toHaveLength(1);
      expect(verifiedUsers[0].emailVerified).toBe(true);
    });
  });
});
