import { Types } from 'mongoose';
import { User } from '../models/User.model';
import { Property } from '../models/Property';
import { Profile } from '../models/Profile.model';
import { IMatchPreferences, CompatibilityFactors } from './matchingService';
import { logger } from '../utils/logger';

export class MatchingHelpers {
  
  /**
   * Get potential roommate candidates for a user
   */
  static async getRoommateCandidates(
    userId: Types.ObjectId,
    userPrefs: IMatchPreferences
  ): Promise<any[]> {
    try {
      const query: any = {
        _id: { $ne: userId }, // Exclude self
        accountType: 'tenant', // Only tenants looking for roommates
        isEmailVerified: true,
        isActive: true
      };

      // Add gender filter if specified
      if (userPrefs.genderPreference !== 'any') {
        query['profile.gender'] = userPrefs.genderPreference;
      }

      // Add age filter
      const currentYear = new Date().getFullYear();
      const minBirthYear = currentYear - userPrefs.ageRange.max;
      const maxBirthYear = currentYear - userPrefs.ageRange.min;
      
      query['profile.dateOfBirth'] = {
        $gte: new Date(`${minBirthYear}-01-01`),
        $lte: new Date(`${maxBirthYear}-12-31`)
      };

      const candidates = await User.find(query)
        .populate('profile')
        .limit(100) // Limit to prevent performance issues
        .lean();

      return candidates;
    } catch (error) {
      logger.error('Error getting roommate candidates:', error);
      return [];
    }
  }

  /**
   * Get potential property candidates for a user
   */
  static async getPropertyCandidates(
    userId: Types.ObjectId,
    userPrefs: IMatchPreferences
  ): Promise<any[]> {
    try {
      const query: any = {
        status: 'active',
        isAvailable: true,
        ownerId: { $ne: userId }, // Exclude user's own properties
        'pricing.rentPerMonth': {
          $gte: userPrefs.budgetRange.min,
          $lte: userPrefs.budgetRange.max
        }
      };

      // Add property type filter
      if (userPrefs.propertyPreferences.propertyTypes.length > 0) {
        query.propertyType = { $in: userPrefs.propertyPreferences.propertyTypes };
      }

      // Add bedroom/bathroom filters
      if (userPrefs.propertyPreferences.minimumBedrooms > 0) {
        query.bedrooms = { $gte: userPrefs.propertyPreferences.minimumBedrooms };
      }

      if (userPrefs.propertyPreferences.minimumBathrooms > 0) {
        query.bathrooms = { $gte: userPrefs.propertyPreferences.minimumBathrooms };
      }

      // Add location filters
      if (userPrefs.preferredStates.length > 0) {
        query['location.state'] = { $in: userPrefs.preferredStates };
      }

      if (userPrefs.preferredCities.length > 0) {
        query['location.city'] = { $in: userPrefs.preferredCities };
      }

      // Add amenity filters
      if (userPrefs.propertyPreferences.amenities.length > 0) {
        userPrefs.propertyPreferences.amenities.forEach(amenity => {
          query[`amenities.${amenity}`] = true;
        });
      }

      const properties = await Property.find(query)
        .limit(100)
        .lean();

      return properties;
    } catch (error) {
      logger.error('Error getting property candidates:', error);
      return [];
    }
  }

  /**
   * Calculate distance between two users
   */
  static async calculateDistance(
    userId: Types.ObjectId,
    targetUserId: Types.ObjectId
  ): Promise<number> {
    try {
      const [userProfile, targetProfile] = await Promise.all([
        Profile.findOne({ userId }),
        Profile.findOne({ userId: targetUserId })
      ]);

      if (!(userProfile as any)?.location?.coordinates || !(targetProfile as any)?.location?.coordinates) {
        return 999; // Return high distance if coordinates not available
      }

      const userCoords = (userProfile as any).location.coordinates;
      const targetCoords = (targetProfile as any).location.coordinates;

      return this.calculateDistanceBetweenCoordinates(
        userCoords.coordinates[1], // latitude
        userCoords.coordinates[0], // longitude
        targetCoords.coordinates[1],
        targetCoords.coordinates[0]
      );
    } catch (error) {
      logger.error('Error calculating distance between users:', error);
      return 999;
    }
  }

  /**
   * Calculate distance between user and property
   */
  static async calculatePropertyDistance(
    userId: Types.ObjectId,
    propertyId: Types.ObjectId
  ): Promise<number> {
    try {
      const [userProfile, property] = await Promise.all([
        Profile.findOne({ userId }),
        Property.findById(propertyId)
      ]);

      if (!(userProfile as any)?.location?.coordinates || !property?.location?.coordinates) {
        return 999;
      }

      const userCoords = (userProfile as any).location.coordinates;
      const propertyCoords = property.location.coordinates;

      return this.calculateDistanceBetweenCoordinates(
        userCoords.coordinates[1],
        userCoords.coordinates[0],
        propertyCoords.coordinates[1],
        propertyCoords.coordinates[0]
      );
    } catch (error) {
      logger.error('Error calculating distance to property:', error);
      return 999;
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  static calculateDistanceBetweenCoordinates(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Check if two users are in the same state
   */
  static async checkStateMatch(
    userId: Types.ObjectId,
    targetId: Types.ObjectId,
    targetType: 'user' | 'property'
  ): Promise<boolean> {
    try {
      const userProfile = await Profile.findOne({ userId });
      
      if (targetType === 'user') {
        const targetProfile = await Profile.findOne({ userId: targetId });
        return (userProfile as any)?.location?.state === (targetProfile as any)?.location?.state;
      } else {
        const property = await Property.findById(targetId);
        return (userProfile as any)?.location?.state === property?.location?.state;
      }
    } catch (error) {
      logger.error('Error checking state match:', error);
      return false;
    }
  }

  /**
   * Generate match reasons based on compatibility factors
   */
  static generateMatchReasons(factors: CompatibilityFactors): string[] {
    const reasons: string[] = [];

    if (factors.location >= 80) {
      reasons.push('Great location compatibility');
    }
    if (factors.budget >= 80) {
      reasons.push('Perfect budget match');
    }
    if (factors.lifestyle >= 80) {
      reasons.push('Similar lifestyle preferences');
    }
    if (factors.schedule >= 80) {
      reasons.push('Compatible schedules');
    }
    if (factors.cleanliness >= 80) {
      reasons.push('Matching cleanliness standards');
    }
    if (factors.socialLevel >= 80) {
      reasons.push('Similar social preferences');
    }
    if (factors.overall >= 90) {
      reasons.push('Exceptional overall compatibility');
    }

    return reasons.length > 0 ? reasons : ['Good potential match'];
  }

  /**
   * Generate property-specific match reasons
   */
  static generatePropertyMatchReasons(factors: CompatibilityFactors, property: any): string[] {
    const reasons: string[] = [];

    if (factors.location >= 80) {
      reasons.push(`Great location in ${property.location.city}`);
    }
    if (factors.budget >= 80) {
      reasons.push('Within your budget range');
    }
    if (factors.preferences >= 80) {
      reasons.push('Matches your property preferences');
    }
    if (property.amenities?.wifi) {
      reasons.push('Has WiFi');
    }
    if (property.amenities?.parking) {
      reasons.push('Parking available');
    }
    if (property.amenities?.security) {
      reasons.push('Secure building');
    }
    if (property.amenities?.generator) {
      reasons.push('Backup power available');
    }

    return reasons.length > 0 ? reasons : ['Good property match'];
  }

  /**
   * Check if two lifestyle preferences are compatible
   */
  static isCompatibleLifestyle(pref1: string, pref2: string): boolean {
    const compatibilityMap: { [key: string]: string[] } = {
      'yes': ['yes', 'occasionally'],
      'no': ['no', 'rarely', 'never'],
      'occasionally': ['yes', 'occasionally', 'rarely'],
      'rarely': ['no', 'occasionally', 'rarely'],
      'never': ['no', 'rarely', 'never'],
      'love': ['love', 'okay'],
      'okay': ['love', 'okay', 'rarely'],
      'allergic': ['no', 'never'],
      'frequent': ['frequent', 'occasional'],
      'occasional': ['frequent', 'occasional', 'rare'],
      'rare': ['occasional', 'rare', 'never']
    };

    return compatibilityMap[pref1]?.includes(pref2) || false;
  }

  /**
   * Check if two schedule preferences are compatible
   */
  static isCompatibleSchedule(pref1: string, pref2: string): boolean {
    const compatibilityMap: { [key: string]: string[] } = {
      'day_shift': ['day_shift', 'flexible'],
      'night_shift': ['night_shift', 'flexible'],
      'flexible': ['day_shift', 'night_shift', 'flexible', 'student'],
      'student': ['student', 'flexible'],
      'early_bird': ['early_bird', 'flexible'],
      'night_owl': ['night_owl', 'flexible'],
      'very_social': ['very_social', 'social'],
      'social': ['very_social', 'social', 'moderate'],
      'moderate': ['social', 'moderate', 'private'],
      'private': ['moderate', 'private']
    };

    return compatibilityMap[pref1]?.includes(pref2) || false;
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
