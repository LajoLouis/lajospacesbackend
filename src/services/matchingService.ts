import { Types } from 'mongoose';
import { Match, MatchPreferences, IMatch, IMatchPreferences } from '../models/Match';
import { Property } from '../models/Property';
import { Profile } from '../models/Profile.model';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';
import { MatchingHelpers } from './matchingHelpers';

export interface CompatibilityFactors {
  location: number;
  budget: number;
  lifestyle: number;
  preferences: number;
  schedule: number;
  cleanliness: number;
  socialLevel: number;
  overall: number;
}

// Re-export IMatchPreferences for use in other files
export type { IMatchPreferences } from '../models/Match';

export interface MatchCandidate {
  id: string;
  type: 'user' | 'property';
  compatibilityScore: number;
  compatibilityFactors: CompatibilityFactors;
  distance: number;
  matchReasons: string[];
  commonInterests: string[];
  sharedPreferences: string[];
}

export class MatchingService {
  
  /**
   * Calculate compatibility between two users for roommate matching
   */
  static async calculateUserCompatibility(
    userId: Types.ObjectId,
    targetUserId: Types.ObjectId
  ): Promise<CompatibilityFactors> {
    try {
      // Get user preferences and profiles
      const [userPrefs, targetUserPrefs, userProfile, targetProfile] = await Promise.all([
        MatchPreferences.findOne({ userId }),
        MatchPreferences.findOne({ userId: targetUserId }),
        Profile.findOne({ userId }),
        Profile.findOne({ userId: targetUserId })
      ]);

      if (!userPrefs || !targetUserPrefs || !userProfile || !targetProfile) {
        throw new AppError('User preferences or profiles not found', 404);
      }

      const factors: CompatibilityFactors = {
        location: this.calculateUserLocationCompatibility(userProfile, targetProfile, userPrefs),
        budget: this.calculateUserBudgetCompatibility(userPrefs, targetUserPrefs),
        lifestyle: this.calculateUserLifestyleCompatibility(userPrefs, targetUserPrefs),
        preferences: this.calculateUserPreferencesCompatibility(userPrefs, targetUserPrefs),
        schedule: this.calculateUserScheduleCompatibility(userPrefs, targetUserPrefs),
        cleanliness: this.calculateUserCleanlinessCompatibility(userPrefs, targetUserPrefs),
        socialLevel: this.calculateUserSocialCompatibility(userPrefs, targetUserPrefs),
        overall: 0
      };

      // Calculate weighted overall score
      const weights = {
        location: 0.20,
        budget: 0.20,
        lifestyle: 0.15,
        preferences: 0.15,
        schedule: 0.10,
        cleanliness: 0.10,
        socialLevel: 0.10
      };

      factors.overall = Math.round(
        (factors.location * weights.location) +
        (factors.budget * weights.budget) +
        (factors.lifestyle * weights.lifestyle) +
        (factors.preferences * weights.preferences) +
        (factors.schedule * weights.schedule) +
        (factors.cleanliness * weights.cleanliness) +
        (factors.socialLevel * weights.socialLevel)
      );

      return factors;
    } catch (error) {
      logger.error('Error calculating user compatibility:', error);
      throw new AppError('Failed to calculate compatibility', 500);
    }
  }

  /**
   * Calculate compatibility between user and property for housing matching
   */
  static async calculatePropertyCompatibility(
    userId: Types.ObjectId,
    propertyId: Types.ObjectId
  ): Promise<CompatibilityFactors> {
    try {
      const [userPrefs, userProfile, property] = await Promise.all([
        MatchPreferences.findOne({ userId }),
        Profile.findOne({ userId }),
        Property.findById(propertyId)
      ]);

      if (!userPrefs || !userProfile || !property) {
        throw new AppError('User preferences, profile, or property not found', 404);
      }

      const factors: CompatibilityFactors = {
        location: this.calculatePropertyLocationCompatibility(userProfile, property, userPrefs),
        budget: this.calculatePropertyBudgetCompatibility(userPrefs, property),
        lifestyle: this.calculatePropertyLifestyleCompatibility(userPrefs, property),
        preferences: this.calculatePropertyPreferencesCompatibility(userPrefs, property),
        schedule: 70, // Default for property matches
        cleanliness: this.calculatePropertyCleanlinessCompatibility(userPrefs, property),
        socialLevel: 70, // Default for property matches
        overall: 0
      };

      // Calculate weighted overall score for property matching
      const weights = {
        location: 0.25,
        budget: 0.30,
        lifestyle: 0.15,
        preferences: 0.20,
        schedule: 0.05,
        cleanliness: 0.05,
        socialLevel: 0.00
      };

      factors.overall = Math.round(
        (factors.location * weights.location) +
        (factors.budget * weights.budget) +
        (factors.lifestyle * weights.lifestyle) +
        (factors.preferences * weights.preferences) +
        (factors.schedule * weights.schedule) +
        (factors.cleanliness * weights.cleanliness) +
        (factors.socialLevel * weights.socialLevel)
      );

      return factors;
    } catch (error) {
      logger.error('Error calculating property compatibility:', error);
      throw new AppError('Failed to calculate property compatibility', 500);
    }
  }

  /**
   * Find potential roommate matches for a user
   */
  static async findRoommateMatches(
    userId: Types.ObjectId,
    limit: number = 20
  ): Promise<MatchCandidate[]> {
    try {
      const userPrefs = await MatchPreferences.findOne({ userId });
      if (!userPrefs || !userPrefs.isActive) {
        return [];
      }

      // Get potential candidates based on basic criteria
      const candidates = await MatchingHelpers.getRoommateCandidates(userId, userPrefs);
      const matches: MatchCandidate[] = [];

      for (const candidate of candidates) {
        try {
          const compatibility = await this.calculateUserCompatibility(userId, candidate._id);
          
          if (compatibility.overall >= userPrefs.matchingSettings.compatibility_threshold) {
            const distance = await MatchingHelpers.calculateDistance(userId, candidate._id);
            const matchReasons = MatchingHelpers.generateMatchReasons(compatibility);
            
            matches.push({
              id: candidate._id.toString(),
              type: 'user',
              compatibilityScore: compatibility.overall,
              compatibilityFactors: compatibility,
              distance,
              matchReasons,
              commonInterests: [], // TODO: Implement based on user interests
              sharedPreferences: [] // TODO: Implement based on shared preferences
            });
          }
        } catch (error) {
          logger.warn(`Failed to calculate compatibility for candidate ${candidate._id}:`, error);
          continue;
        }
      }

      // Sort by compatibility score and return top matches
      return matches
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, limit);

    } catch (error) {
      logger.error('Error finding roommate matches:', error);
      throw new AppError('Failed to find roommate matches', 500);
    }
  }

  /**
   * Find potential housing matches for a user
   */
  static async findHousingMatches(
    userId: Types.ObjectId,
    limit: number = 20
  ): Promise<MatchCandidate[]> {
    try {
      const userPrefs = await MatchPreferences.findOne({ userId });
      if (!userPrefs || !userPrefs.isActive) {
        return [];
      }

      // Get potential property candidates
      const properties = await MatchingHelpers.getPropertyCandidates(userId, userPrefs);
      const matches: MatchCandidate[] = [];

      for (const property of properties) {
        try {
          const compatibility = await this.calculatePropertyCompatibility(userId, property._id);
          
          if (compatibility.overall >= userPrefs.matchingSettings.compatibility_threshold) {
            const distance = await MatchingHelpers.calculatePropertyDistance(userId, property._id);
            const matchReasons = MatchingHelpers.generatePropertyMatchReasons(compatibility, property);
            
            matches.push({
              id: property._id.toString(),
              type: 'property',
              compatibilityScore: compatibility.overall,
              compatibilityFactors: compatibility,
              distance,
              matchReasons,
              commonInterests: [],
              sharedPreferences: []
            });
          }
        } catch (error) {
          logger.warn(`Failed to calculate compatibility for property ${property._id}:`, error);
          continue;
        }
      }

      // Sort by compatibility score and return top matches
      return matches
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, limit);

    } catch (error) {
      logger.error('Error finding housing matches:', error);
      throw new AppError('Failed to find housing matches', 500);
    }
  }

  /**
   * Create a match record between user and target
   */
  static async createMatch(
    userId: Types.ObjectId,
    targetId: Types.ObjectId,
    targetType: 'user' | 'property',
    compatibilityFactors: CompatibilityFactors
  ): Promise<IMatch> {
    try {
      // Check if match already exists
      const existingMatch = await Match.findOne({ userId, targetId, targetType });
      if (existingMatch) {
        return existingMatch;
      }

      // Determine match type
      const matchType = targetType === 'user' ? 'roommate' : 'housing';
      
      // Calculate expiration (7 days for roommate, 30 days for housing)
      const expirationDays = targetType === 'user' ? 7 : 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // Calculate additional metrics
      const locationProximity = targetType === 'user'
        ? await MatchingHelpers.calculateDistance(userId, targetId)
        : await MatchingHelpers.calculatePropertyDistance(userId, targetId);

      const budgetCompatibility = compatibilityFactors.budget;
      const stateMatch = await MatchingHelpers.checkStateMatch(userId, targetId, targetType);

      const match = new Match({
        userId,
        targetId,
        targetType,
        matchType,
        compatibilityScore: compatibilityFactors.overall,
        compatibilityFactors,
        expiresAt,
        locationProximity,
        budgetCompatibility,
        stateMatch,
        matchReason: MatchingHelpers.generateMatchReasons(compatibilityFactors),
        lastInteractionAt: new Date()
      });

      await match.save();
      
      logger.info(`Created ${matchType} match between user ${userId} and ${targetType} ${targetId} with ${compatibilityFactors.overall}% compatibility`);
      
      return match;
    } catch (error) {
      logger.error('Error creating match:', error);
      throw new AppError('Failed to create match', 500);
    }
  }

  // Private helper methods for user compatibility calculations

  private static calculateUserLocationCompatibility(
    userProfile: any,
    targetProfile: any,
    userPrefs: IMatchPreferences
  ): number {
    let score = 0;

    // Same state bonus
    if (userProfile.location?.state === targetProfile.location?.state) {
      score += 40;
    }

    // Same city bonus
    if (userProfile.location?.city === targetProfile.location?.city) {
      score += 30;
    }

    // Same area bonus
    if (userProfile.location?.area === targetProfile.location?.area) {
      score += 20;
    }

    // Preferred states/cities
    if (userPrefs.preferredStates.includes(targetProfile.location?.state)) {
      score += 10;
    }

    if (userPrefs.preferredCities.includes(targetProfile.location?.city)) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private static calculateUserBudgetCompatibility(
    userPrefs: IMatchPreferences,
    targetPrefs: IMatchPreferences
  ): number {
    const userMin = userPrefs.budgetRange.min;
    const userMax = userPrefs.budgetRange.max;
    const targetMin = targetPrefs.budgetRange.min;
    const targetMax = targetPrefs.budgetRange.max;

    // Calculate overlap
    const overlapMin = Math.max(userMin, targetMin);
    const overlapMax = Math.min(userMax, targetMax);

    if (overlapMin > overlapMax) {
      return 0; // No overlap
    }

    const overlapRange = overlapMax - overlapMin;
    const userRange = userMax - userMin;
    const targetRange = targetMax - targetMin;
    const avgRange = (userRange + targetRange) / 2;

    const overlapPercentage = (overlapRange / avgRange) * 100;
    return Math.min(overlapPercentage, 100);
  }

  private static calculateUserLifestyleCompatibility(
    userPrefs: IMatchPreferences,
    targetPrefs: IMatchPreferences
  ): number {
    const factors = ['smoking', 'drinking', 'pets', 'parties', 'guests', 'noise_level'];
    let totalScore = 0;
    let validFactors = 0;

    factors.forEach(factor => {
      const userPref = userPrefs.lifestyle[factor as keyof typeof userPrefs.lifestyle];
      const targetPref = targetPrefs.lifestyle[factor as keyof typeof targetPrefs.lifestyle];

      if (userPref !== 'no_preference' && targetPref !== 'no_preference') {
        validFactors++;
        if (userPref === targetPref) {
          totalScore += 100;
        } else if (MatchingHelpers.isCompatibleLifestyle(userPref, targetPref)) {
          totalScore += 70;
        } else {
          totalScore += 30;
        }
      }
    });

    return validFactors > 0 ? Math.round(totalScore / validFactors) : 70;
  }

  private static calculateUserScheduleCompatibility(
    userPrefs: IMatchPreferences,
    targetPrefs: IMatchPreferences
  ): number {
    const scheduleFactors = ['work_schedule', 'sleep_schedule', 'social_level'];
    let totalScore = 0;
    let validFactors = 0;

    scheduleFactors.forEach(factor => {
      const userPref = userPrefs.schedule[factor as keyof typeof userPrefs.schedule];
      const targetPref = targetPrefs.schedule[factor as keyof typeof targetPrefs.schedule];

      if (userPref !== 'no_preference' && targetPref !== 'no_preference') {
        validFactors++;
        if (userPref === targetPref) {
          totalScore += 100;
        } else if (MatchingHelpers.isCompatibleSchedule(userPref, targetPref)) {
          totalScore += 70;
        } else {
          totalScore += 40;
        }
      }
    });

    return validFactors > 0 ? Math.round(totalScore / validFactors) : 70;
  }

  private static calculateUserCleanlinessCompatibility(
    userPrefs: IMatchPreferences,
    targetPrefs: IMatchPreferences
  ): number {
    const userCleanliness = userPrefs.lifestyle.cleanliness;
    const targetCleanliness = targetPrefs.lifestyle.cleanliness;

    if (userCleanliness === 'no_preference' || targetCleanliness === 'no_preference') {
      return 70;
    }

    const cleanlinessLevels = {
      'very_clean': 4,
      'clean': 3,
      'average': 2,
      'relaxed': 1
    };

    const userLevel = cleanlinessLevels[userCleanliness as keyof typeof cleanlinessLevels] || 2;
    const targetLevel = cleanlinessLevels[targetCleanliness as keyof typeof cleanlinessLevels] || 2;
    const difference = Math.abs(userLevel - targetLevel);

    // Perfect match: 100%, 1 level diff: 80%, 2 levels: 60%, 3 levels: 40%
    return Math.max(100 - (difference * 20), 40);
  }

  private static calculateUserSocialCompatibility(
    userPrefs: IMatchPreferences,
    targetPrefs: IMatchPreferences
  ): number {
    const userSocial = userPrefs.schedule.social_level;
    const targetSocial = targetPrefs.schedule.social_level;

    if (userSocial === 'no_preference' || targetSocial === 'no_preference') {
      return 70;
    }

    const socialLevels = {
      'very_social': 4,
      'social': 3,
      'moderate': 2,
      'private': 1
    };

    const userLevel = socialLevels[userSocial as keyof typeof socialLevels] || 2;
    const targetLevel = socialLevels[targetSocial as keyof typeof socialLevels] || 2;
    const difference = Math.abs(userLevel - targetLevel);

    return Math.max(100 - (difference * 15), 50);
  }

  private static calculateUserPreferencesCompatibility(
    userPrefs: IMatchPreferences,
    targetPrefs: IMatchPreferences
  ): number {
    let score = 0;
    let factors = 0;

    // Gender preference compatibility
    if (userPrefs.genderPreference !== 'any' || targetPrefs.genderPreference !== 'any') {
      factors++;
      // This would need user gender information from profile
      score += 70; // Default score for now
    }

    // Age range compatibility
    const userAgeRange = userPrefs.ageRange;
    const targetAgeRange = targetPrefs.ageRange;

    const ageOverlapMin = Math.max(userAgeRange.min, targetAgeRange.min);
    const ageOverlapMax = Math.min(userAgeRange.max, targetAgeRange.max);

    if (ageOverlapMin <= ageOverlapMax) {
      factors++;
      const overlapSize = ageOverlapMax - ageOverlapMin;
      const avgRangeSize = ((userAgeRange.max - userAgeRange.min) + (targetAgeRange.max - targetAgeRange.min)) / 2;
      score += Math.min((overlapSize / avgRangeSize) * 100, 100);
    }

    return factors > 0 ? Math.round(score / factors) : 70;
  }

  // Property compatibility calculation methods

  private static calculatePropertyLocationCompatibility(
    userProfile: any,
    property: any,
    userPrefs: IMatchPreferences
  ): number {
    let score = 0;

    // Same state bonus
    if (userProfile.location?.state === property.location?.state) {
      score += 40;
    }

    // Same city bonus
    if (userProfile.location?.city === property.location?.city) {
      score += 30;
    }

    // Same area bonus
    if (userProfile.location?.area === property.location?.area) {
      score += 20;
    }

    // Preferred states/cities
    if (userPrefs.preferredStates.includes(property.location?.state)) {
      score += 10;
    }

    if (userPrefs.preferredCities.includes(property.location?.city)) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private static calculatePropertyBudgetCompatibility(
    userPrefs: IMatchPreferences,
    property: any
  ): number {
    const userMin = userPrefs.budgetRange.min;
    const userMax = userPrefs.budgetRange.max;
    const propertyPrice = property.pricing.rentPerMonth;

    if (propertyPrice >= userMin && propertyPrice <= userMax) {
      // Perfect match if within range
      const rangeSize = userMax - userMin;

      // Score higher if closer to middle of range
      const middleDistance = Math.abs(propertyPrice - (userMin + userMax) / 2);
      const maxMiddleDistance = rangeSize / 2;

      return Math.max(100 - (middleDistance / maxMiddleDistance) * 20, 80);
    }

    // Calculate how far outside the range
    const flexibility = userPrefs.budgetFlexibility / 100;
    const flexibleMin = userMin * (1 - flexibility);
    const flexibleMax = userMax * (1 + flexibility);

    if (propertyPrice >= flexibleMin && propertyPrice <= flexibleMax) {
      // Within flexible range
      const overagePercentage = propertyPrice > userMax
        ? (propertyPrice - userMax) / userMax
        : (userMin - propertyPrice) / userMin;

      return Math.max(80 - (overagePercentage * 100), 40);
    }

    return 0; // Outside flexible range
  }

  private static calculatePropertyLifestyleCompatibility(
    userPrefs: IMatchPreferences,
    property: any
  ): number {
    let score = 70; // Base score

    // Check rules compatibility
    if (userPrefs.lifestyle.smoking === 'yes' && !property.rules.smokingAllowed) {
      score -= 30;
    }
    if (userPrefs.lifestyle.pets === 'love' && !property.rules.petsAllowed) {
      score -= 25;
    }
    if (userPrefs.lifestyle.parties === 'love' && !property.rules.partiesAllowed) {
      score -= 20;
    }
    if (userPrefs.lifestyle.guests === 'frequent' && !property.rules.guestsAllowed) {
      score -= 20;
    }

    return Math.max(score, 0);
  }

  private static calculatePropertyPreferencesCompatibility(
    userPrefs: IMatchPreferences,
    property: any
  ): number {
    let score = 0;
    let totalChecks = 0;

    // Property type preference
    if (userPrefs.propertyPreferences.propertyTypes.length > 0) {
      totalChecks++;
      if (userPrefs.propertyPreferences.propertyTypes.includes(property.propertyType)) {
        score += 100;
      }
    }

    // Bedroom/bathroom requirements
    totalChecks++;
    if (property.bedrooms >= userPrefs.propertyPreferences.minimumBedrooms) {
      score += 100;
    } else {
      score += 50; // Partial credit
    }

    totalChecks++;
    if (property.bathrooms >= userPrefs.propertyPreferences.minimumBathrooms) {
      score += 100;
    } else {
      score += 50;
    }

    // Amenities matching
    const requiredAmenities = userPrefs.propertyPreferences.amenities;
    if (requiredAmenities.length > 0) {
      totalChecks++;
      let amenityScore = 0;
      requiredAmenities.forEach(amenity => {
        if (property.amenities[amenity]) {
          amenityScore += 100 / requiredAmenities.length;
        }
      });
      score += amenityScore;
    }

    // Furnished preference
    if (userPrefs.propertyPreferences.furnished !== 'no_preference') {
      totalChecks++;
      const isFurnished = property.amenities.furnished;
      if (
        (userPrefs.propertyPreferences.furnished === 'yes' && isFurnished) ||
        (userPrefs.propertyPreferences.furnished === 'no' && !isFurnished)
      ) {
        score += 100;
      } else if (userPrefs.propertyPreferences.furnished === 'partial') {
        score += 70;
      }
    }

    return totalChecks > 0 ? Math.round(score / totalChecks) : 70;
  }

  private static calculatePropertyCleanlinessCompatibility(
    _userPrefs: IMatchPreferences,
    property: any
  ): number {
    // For properties, we can't directly assess cleanliness
    // But we can infer from amenities and property quality
    let score = 70; // Base score

    if (property.amenities.cleaningService) {
      score += 20;
    }
    if (property.isVerified) {
      score += 10;
    }
    if (property.amenities.furnished) {
      score += 5; // Well-maintained properties are often furnished
    }

    return Math.min(score, 100);
  }

}
