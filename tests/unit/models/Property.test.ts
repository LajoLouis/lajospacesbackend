import mongoose from 'mongoose';
import { Property, IProperty } from '../../../src/models/Property';
import { User } from '../../../src/models/User';
import { setupTestDatabase, clearTestData, cleanupTestDatabase } from '../../../src/config/testDatabase';
import { testUtils } from '../../setup/jest.setup';

describe('Property Model', () => {
  let testUser: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    
    // Create a test user for property ownership
    const userData = testUtils.generateTestUser();
    testUser = await User.create(userData);
  });

  describe('Property Creation', () => {
    it('should create a valid property', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id);
      const property = new Property(propertyData);
      const savedProperty = await property.save();

      expect(savedProperty._id).toBeDefined();
      expect(savedProperty.title).toBe(propertyData.title);
      expect(savedProperty.description).toBe(propertyData.description);
      expect(savedProperty.type).toBe(propertyData.type);
      expect(savedProperty.price).toBe(propertyData.price);
      expect(savedProperty.currency).toBe(propertyData.currency);
      expect(savedProperty.owner.toString()).toBe(testUser._id.toString());
      expect(savedProperty.status).toBe('available');
      expect(savedProperty).toHaveValidTimestamps();
    });

    it('should set default values correctly', async () => {
      const propertyData = {
        title: 'Test Property',
        description: 'Test description',
        type: 'apartment',
        price: 100000,
        location: {
          state: 'Lagos',
          lga: 'Victoria Island',
          address: '123 Test Street'
        },
        owner: testUser._id
      };
      const property = new Property(propertyData);
      const savedProperty = await property.save();

      expect(savedProperty.currency).toBe('NGN');
      expect(savedProperty.status).toBe('available');
      expect(savedProperty.amenities).toEqual([]);
      expect(savedProperty.images).toEqual([]);
      expect(savedProperty.views).toBe(0);
      expect(savedProperty.featured).toBe(false);
    });

    it('should save location with coordinates', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, {
        location: {
          state: 'Lagos',
          lga: 'Victoria Island',
          address: '123 Test Street',
          coordinates: {
            latitude: 6.4281,
            longitude: 3.4219
          }
        }
      });
      const property = new Property(propertyData);
      const savedProperty = await property.save();

      expect(savedProperty.location.coordinates.latitude).toBe(6.4281);
      expect(savedProperty.location.coordinates.longitude).toBe(3.4219);
    });
  });

  describe('Property Validation', () => {
    it('should require title', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { title: undefined });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/title.*required/);
    });

    it('should require description', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { description: undefined });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/description.*required/);
    });

    it('should require type', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { type: undefined });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/type.*required/);
    });

    it('should validate type enum', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { type: 'invalid-type' });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/type.*enum/);
    });

    it('should accept valid property types', async () => {
      const validTypes = ['apartment', 'house', 'room', 'studio', 'duplex', 'bungalow'];

      for (const type of validTypes) {
        const propertyData = testUtils.generateTestProperty(testUser._id, { type });
        const property = new Property(propertyData);
        const savedProperty = await property.save();

        expect(savedProperty.type).toBe(type);
      }
    });

    it('should require price', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { price: undefined });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/price.*required/);
    });

    it('should validate price is positive', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { price: -1000 });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/price.*positive/);
    });

    it('should require owner', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { owner: undefined });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/owner.*required/);
    });

    it('should validate owner is valid ObjectId', async () => {
      const propertyData = testUtils.generateTestProperty('invalid-id');
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/Cast to ObjectId failed/);
    });

    it('should validate status enum', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { status: 'invalid-status' });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/status.*enum/);
    });

    it('should validate currency enum', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, { currency: 'INVALID' });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/currency.*enum/);
    });
  });

  describe('Property Location Validation', () => {
    it('should require location state', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, {
        location: {
          lga: 'Victoria Island',
          address: '123 Test Street'
        }
      });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/state.*required/);
    });

    it('should require location LGA', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, {
        location: {
          state: 'Lagos',
          address: '123 Test Street'
        }
      });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/lga.*required/);
    });

    it('should require location address', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, {
        location: {
          state: 'Lagos',
          lga: 'Victoria Island'
        }
      });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/address.*required/);
    });

    it('should validate coordinates if provided', async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id, {
        location: {
          state: 'Lagos',
          lga: 'Victoria Island',
          address: '123 Test Street',
          coordinates: {
            latitude: 200, // Invalid latitude
            longitude: 3.4219
          }
        }
      });
      const property = new Property(propertyData);

      await expect(property.save()).rejects.toThrow(/latitude.*between/);
    });
  });

  describe('Property Methods', () => {
    let property: IProperty;

    beforeEach(async () => {
      const propertyData = testUtils.generateTestProperty(testUser._id);
      property = new Property(propertyData);
      await property.save();
    });

    it('should increment view count', async () => {
      const initialViews = property.views;
      await property.incrementViews();
      
      expect(property.views).toBe(initialViews + 1);
    });

    it('should check if property is available', () => {
      property.status = 'available';
      expect(property.isAvailable()).toBe(true);

      property.status = 'rented';
      expect(property.isAvailable()).toBe(false);
    });

    it('should calculate distance to coordinates', () => {
      property.location.coordinates = {
        latitude: 6.4281,
        longitude: 3.4219
      };

      const distance = property.distanceTo(6.5244, 3.3792); // Lagos Island coordinates
      expect(typeof distance).toBe('number');
      expect(distance).toBeGreaterThan(0);
    });

    it('should format price with currency', () => {
      property.price = 120000;
      property.currency = 'NGN';

      const formattedPrice = property.getFormattedPrice();
      expect(formattedPrice).toBe('₦120,000');
    });
  });

  describe('Property Statics', () => {
    beforeEach(async () => {
      // Create test properties
      const properties = [
        testUtils.generateTestProperty(testUser._id, { 
          status: 'available',
          type: 'apartment',
          price: 100000,
          location: { state: 'Lagos', lga: 'Victoria Island', address: '123 Test St' }
        }),
        testUtils.generateTestProperty(testUser._id, { 
          status: 'rented',
          type: 'house',
          price: 200000,
          location: { state: 'Lagos', lga: 'Ikeja', address: '456 Test Ave' }
        }),
        testUtils.generateTestProperty(testUser._id, { 
          status: 'available',
          type: 'studio',
          price: 80000,
          location: { state: 'Abuja', lga: 'Wuse', address: '789 Test Rd' }
        })
      ];

      await Property.insertMany(properties);
    });

    it('should find available properties', async () => {
      const availableProperties = await Property.findAvailable();
      expect(availableProperties).toHaveLength(2);
      availableProperties.forEach(property => {
        expect(property.status).toBe('available');
      });
    });

    it('should find properties by type', async () => {
      const apartments = await Property.findByType('apartment');
      expect(apartments).toHaveLength(1);
      expect(apartments[0].type).toBe('apartment');
    });

    it('should find properties by owner', async () => {
      const ownerProperties = await Property.findByOwner(testUser._id);
      expect(ownerProperties).toHaveLength(3);
      ownerProperties.forEach(property => {
        expect(property.owner.toString()).toBe(testUser._id.toString());
      });
    });

    it('should find properties by location', async () => {
      const lagosProperties = await Property.findByLocation('Lagos');
      expect(lagosProperties).toHaveLength(2);
      lagosProperties.forEach(property => {
        expect(property.location.state).toBe('Lagos');
      });
    });

    it('should find properties in price range', async () => {
      const propertiesInRange = await Property.findInPriceRange(90000, 150000);
      expect(propertiesInRange).toHaveLength(1);
      expect(propertiesInRange[0].price).toBe(100000);
    });

    it('should search properties with filters', async () => {
      const searchResults = await Property.searchProperties({
        state: 'Lagos',
        type: 'apartment',
        minPrice: 50000,
        maxPrice: 150000,
        status: 'available'
      });

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].type).toBe('apartment');
      expect(searchResults[0].location.state).toBe('Lagos');
      expect(searchResults[0].status).toBe('available');
    });
  });

  describe('Property Indexes', () => {
    it('should have location index', async () => {
      const indexes = await Property.collection.getIndexes();
      const locationIndex = Object.keys(indexes).find(key => key.includes('location'));
      expect(locationIndex).toBeDefined();
    });

    it('should have owner index', async () => {
      const indexes = await Property.collection.getIndexes();
      const ownerIndex = Object.keys(indexes).find(key => key.includes('owner'));
      expect(ownerIndex).toBeDefined();
    });

    it('should have status index', async () => {
      const indexes = await Property.collection.getIndexes();
      const statusIndex = Object.keys(indexes).find(key => key.includes('status'));
      expect(statusIndex).toBeDefined();
    });
  });
});
