// import mongoose from 'mongoose';
// import { config } from '../config/environment';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { connectRedis, disconnectRedis } from '../config/redis';
import { logger } from '../utils/logger';
import User, { IUser } from '../models/User.model';
import Profile, { IProfile } from '../models/Profile.model';

// Sample users data - NIGERIAN FOCUSED
const sampleUsers = [
  {
    email: 'adebayo.lagos@example.com',
    password: 'SecurePass123!',
    firstName: 'Adebayo',
    lastName: 'Ogundimu',
    dateOfBirth: new Date('1995-06-15'),
    gender: 'male' as const,
    phoneNumber: '+2348012345678',
    accountType: 'seeker' as const,
    location: {
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      coordinates: {
        type: 'Point' as const,
        coordinates: [3.3792, 6.5244] // [longitude, latitude] - Lagos coordinates
      }
    }
  },
  {
    email: 'chioma.abuja@example.com',
    password: 'SecurePass123!',
    firstName: 'Chioma',
    lastName: 'Okwu',
    dateOfBirth: new Date('1993-03-22'),
    gender: 'female' as const,
    phoneNumber: '+2348087654321',
    accountType: 'owner' as const,
    location: {
      city: 'Abuja',
      state: 'FCT',
      country: 'Nigeria',
      coordinates: {
        type: 'Point' as const,
        coordinates: [7.3986, 9.0765] // [longitude, latitude] - Abuja coordinates
      }
    }
  },
  {
    email: 'emeka.portharcourt@example.com',
    password: 'SecurePass123!',
    firstName: 'Emeka',
    lastName: 'Nwosu',
    dateOfBirth: new Date('1997-11-08'),
    gender: 'male' as const,
    phoneNumber: '+2348098765432',
    accountType: 'both' as const,
    location: {
      city: 'Port Harcourt',
      state: 'Rivers',
      country: 'Nigeria',
      coordinates: {
        type: 'Point' as const,
        coordinates: [7.0134, 4.8156] // [longitude, latitude] - Port Harcourt coordinates
      }
    }
  }
];

// Sample profiles data - NIGERIAN CONTEXT
const sampleProfiles = [
  {
    bio: 'Software engineer passionate about clean code and good coffee. Looking for a quiet, clean roommate who respects personal space but enjoys occasional conversations. Love exploring Lagos tech scene.',
    occupation: 'Software Engineer',
    education: 'Computer Science, University of Lagos',
    languages: ['English', 'Yoruba', 'Hausa'],
    lifestyle: {
      smokingPolicy: 'no-smoking' as const,
      drinkingPolicy: 'social-drinking' as const,
      petPolicy: 'cats-only' as const,
      cleanlinessLevel: 'very-clean' as const,
      noiseLevel: 'very-quiet' as const,
      guestPolicy: 'occasional-guests' as const
    },
    housingPreferences: {
      propertyTypes: ['apartment', 'condo'],
      budgetRange: { min: 80000, max: 150000 }, // Nigerian Naira
      preferredAreas: ['Victoria Island', 'Ikoyi', 'Lekki', 'Ikeja'],
      moveInDate: new Date('2024-02-01'),
      leaseDuration: 'long-term' as const,
      roomType: 'private-room' as const,
      amenities: ['gym', 'laundry', 'parking', 'wifi', 'generator', 'security']
    },
    roommatePreferences: {
      ageRange: { min: 22, max: 35 },
      genderPreference: 'any' as const,
      occupationPreference: ['tech', 'healthcare', 'education'],
      lifestyleCompatibility: {
        smokingTolerance: 'no-smoking' as const,
        drinkingTolerance: 'social-drinking' as const,
        petTolerance: 'cats-only' as const,
        cleanlinessExpectation: 'very-clean' as const,
        noiseExpectation: 'very-quiet' as const,
        guestTolerance: 'occasional-guests' as const
      }
    },
    interests: ['coding', 'afrobeats', 'photography', 'cooking', 'nollywood', 'football'],
    hobbies: ['football', 'board games', 'reading', 'cycling', 'jollof rice cooking']
  },
  {
    bio: 'Marketing professional and yoga enthusiast. I have a beautiful 2BR apartment in Abuja and looking for a responsible roommate to share it with. Love exploring Nigerian culture and cuisine.',
    occupation: 'Marketing Manager',
    education: 'MBA, Lagos Business School',
    languages: ['English', 'Igbo', 'French'],
    lifestyle: {
      smokingPolicy: 'no-smoking' as const,
      drinkingPolicy: 'social-drinking' as const,
      petPolicy: 'no-pets' as const,
      cleanlinessLevel: 'moderately-clean' as const,
      noiseLevel: 'moderate' as const,
      guestPolicy: 'frequent-guests' as const
    },
    housingPreferences: {
      propertyTypes: ['apartment', 'condo'],
      budgetRange: { min: 100000, max: 200000 }, // Nigerian Naira
      preferredAreas: ['Maitama', 'Asokoro', 'Wuse 2', 'Garki'],
      moveInDate: new Date('2024-03-01'),
      leaseDuration: 'long-term' as const,
      roomType: 'private-room' as const,
      amenities: ['gym', 'pool', 'security', 'parking', 'generator', 'wifi']
    },
    roommatePreferences: {
      ageRange: { min: 25, max: 40 },
      genderPreference: 'female' as const,
      occupationPreference: ['marketing', 'design', 'business'],
      lifestyleCompatibility: {
        smokingTolerance: 'no-smoking' as const,
        drinkingTolerance: 'social-drinking' as const,
        petTolerance: 'no-pets' as const,
        cleanlinessExpectation: 'moderately-clean' as const,
        noiseExpectation: 'moderate' as const,
        guestTolerance: 'frequent-guests' as const
      }
    },
    interests: ['yoga', 'travel', 'nigerian cuisine', 'art', 'fashion', 'afrobeats'],
    hobbies: ['painting', 'dancing', 'meditation', 'cooking', 'ankara fashion']
  },
  {
    bio: 'Graduate student in environmental science. Eco-conscious and looking for like-minded roommates who care about sustainability. Passionate about protecting Nigerian environment.',
    occupation: 'Graduate Student',
    education: 'Environmental Science, University of Port Harcourt',
    languages: ['English', 'Igbo', 'Hausa'],
    lifestyle: {
      smokingPolicy: 'no-smoking' as const,
      drinkingPolicy: 'no-drinking' as const,
      petPolicy: 'all-pets' as const,
      cleanlinessLevel: 'very-clean' as const,
      noiseLevel: 'very-quiet' as const,
      guestPolicy: 'occasional-guests' as const
    },
    housingPreferences: {
      propertyTypes: ['apartment', 'house'],
      budgetRange: { min: 60000, max: 120000 }, // Nigerian Naira
      preferredAreas: ['GRA', 'Trans Amadi', 'Old GRA', 'Rumuola'],
      moveInDate: new Date('2024-01-15'),
      leaseDuration: 'flexible' as const,
      roomType: 'private-room' as const,
      amenities: ['generator', 'borehole', 'security', 'parking']
    },
    roommatePreferences: {
      ageRange: { min: 20, max: 30 },
      genderPreference: 'any' as const,
      occupationPreference: ['student', 'research', 'nonprofit'],
      lifestyleCompatibility: {
        smokingTolerance: 'no-smoking' as const,
        drinkingTolerance: 'no-drinking' as const,
        petTolerance: 'all-pets' as const,
        cleanlinessExpectation: 'very-clean' as const,
        noiseExpectation: 'very-quiet' as const,
        guestTolerance: 'occasional-guests' as const
      }
    },
    interests: ['sustainability', 'research', 'nature', 'volunteering', 'nigerian wildlife', 'environmental protection'],
    hobbies: ['gardening', 'nature walks', 'reading', 'birdwatching', 'community service']
  }
];

/**
 * Clear all existing data from the database
 */
async function clearDatabase(): Promise<void> {
  try {
    logger.info('🧹 Clearing existing database data...');
    
    await User.deleteMany({});
    await Profile.deleteMany({});
    
    logger.info('✅ Database cleared successfully');
  } catch (error) {
    logger.error('❌ Error clearing database:', error);
    throw error;
  }
}

/**
 * Seed users into the database
 */
async function seedUsers(): Promise<IUser[]> {
  try {
    logger.info('👥 Seeding users...');
    
    const users: IUser[] = [];
    
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      users.push(user);
      logger.info(`✅ Created user: ${user.email}`);
    }
    
    logger.info(`✅ Successfully seeded ${users.length} users`);
    return users;
  } catch (error) {
    logger.error('❌ Error seeding users:', error);
    throw error;
  }
}

/**
 * Seed profiles into the database
 */
async function seedProfiles(users: IUser[]): Promise<IProfile[]> {
  try {
    logger.info('📋 Seeding profiles...');
    
    const profiles: IProfile[] = [];
    
    for (let i = 0; i < sampleProfiles.length && i < users.length; i++) {
      const profileData = {
        ...sampleProfiles[i],
        userId: users[i]._id
      };
      
      const profile = new Profile(profileData);
      await profile.save();
      profiles.push(profile);
      logger.info(`✅ Created profile for user: ${users[i].email}`);
    }
    
    logger.info(`✅ Successfully seeded ${profiles.length} profiles`);
    return profiles;
  } catch (error) {
    logger.error('❌ Error seeding profiles:', error);
    throw error;
  }
}

/**
 * Main seeding function
 */
async function seedDatabase(): Promise<void> {
  try {
    logger.info('🌱 Starting database seeding...');
    
    // Connect to databases
    await connectDatabase();
    await connectRedis();
    
    // Clear existing data
    await clearDatabase();
    
    // Seed new data
    const users = await seedUsers();
    const profiles = await seedProfiles(users);
    
    logger.info('🎉 Database seeding completed successfully!');
    logger.info(`📊 Summary:`);
    logger.info(`   - Users created: ${users.length}`);
    logger.info(`   - Profiles created: ${profiles.length}`);
    
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from databases
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase, clearDatabase, seedUsers, seedProfiles };
