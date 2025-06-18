import { Request, Response } from 'express';
import { MatchPreferences } from '../models/Match';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';
import { catchAsync } from '../utils/catchAsync';

/**
 * Get user's match preferences
 */
export const getMatchPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    let preferences = await MatchPreferences.findOne({ userId });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = new MatchPreferences({
        userId,
        isActive: true,
        maxDistance: 50,
        ageRange: { min: 18, max: 65 },
        genderPreference: 'any',
        budgetRange: { min: 0, max: 1000000 },
        budgetFlexibility: 20,
        preferredStates: [],
        preferredCities: [],
        preferredAreas: [],
        locationFlexibility: 50,
        lifestyle: {
          smoking: 'no_preference',
          drinking: 'no_preference',
          pets: 'no_preference',
          parties: 'no_preference',
          guests: 'no_preference',
          cleanliness: 'no_preference',
          noise_level: 'no_preference'
        },
        schedule: {
          work_schedule: 'no_preference',
          sleep_schedule: 'no_preference',
          social_level: 'no_preference'
        },
        propertyPreferences: {
          propertyTypes: [],
          amenities: [],
          minimumBedrooms: 1,
          minimumBathrooms: 1,
          furnished: 'no_preference',
          parking: 'preferred',
          security: 'preferred'
        },
        roommatePreferences: {
          occupation: [],
          education_level: [],
          relationship_status: [],
          has_children: 'no_preference',
          religion: [],
          languages: []
        },
        dealBreakers: [],
        matchingSettings: {
          auto_like_high_compatibility: false,
          compatibility_threshold: 60,
          daily_match_limit: 20,
          show_distance: true,
          show_last_active: true
        }
      });

      await preferences.save();
    }

    return res.json({
      success: true,
      data: { preferences }
    });

  } catch (error) {
    logger.error('Error getting match preferences:', error);
    throw new AppError('Failed to get match preferences', 500);
  }
});

/**
 * Update user's match preferences
 */
export const updateMatchPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const updates = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Update last active timestamp
    updates.lastActiveAt = new Date();

    const preferences = await MatchPreferences.findOneAndUpdate(
      { userId },
      { $set: updates },
      { 
        new: true, 
        upsert: true,
        runValidators: true
      }
    );

    logger.info(`Updated match preferences for user ${userId}`, {
      userId,
      updatedFields: Object.keys(updates)
    });

    return res.json({
      success: true,
      data: { preferences },
      message: 'Match preferences updated successfully'
    });

  } catch (error) {
    logger.error('Error updating match preferences:', error);
    throw new AppError('Failed to update match preferences', 500);
  }
});

/**
 * Toggle match preferences active status
 */
export const toggleMatchPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { isActive } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (typeof isActive !== 'boolean') {
    throw new AppError('isActive must be a boolean value', 400);
  }

  try {
    const preferences = await MatchPreferences.findOneAndUpdate(
      { userId },
      { 
        isActive,
        lastActiveAt: new Date()
      },
      { 
        new: true,
        upsert: true
      }
    );

    logger.info(`${isActive ? 'Activated' : 'Deactivated'} matching for user ${userId}`);

    return res.json({
      success: true,
      data: { 
        isActive: preferences.isActive,
        lastActiveAt: preferences.lastActiveAt
      },
      message: `Matching ${isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    logger.error('Error toggling match preferences:', error);
    throw new AppError('Failed to toggle match preferences', 500);
  }
});

/**
 * Update specific preference section
 */
export const updatePreferenceSection = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { section } = req.params;
  const updates = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const validSections = [
    'lifestyle', 
    'schedule', 
    'propertyPreferences', 
    'roommatePreferences', 
    'matchingSettings'
  ];

  if (!validSections.includes(section)) {
    throw new AppError(`Invalid section. Must be one of: ${validSections.join(', ')}`, 400);
  }

  try {
    const updateQuery: any = {
      lastActiveAt: new Date()
    };
    updateQuery[section] = updates;

    const preferences = await MatchPreferences.findOneAndUpdate(
      { userId },
      { $set: updateQuery },
      { 
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    logger.info(`Updated ${section} preferences for user ${userId}`, {
      userId,
      section,
      updates
    });

    return res.json({
      success: true,
      data: { 
        preferences,
        updatedSection: section
      },
      message: `${section} preferences updated successfully`
    });

  } catch (error) {
    logger.error(`Error updating ${section} preferences:`, error);
    throw new AppError(`Failed to update ${section} preferences`, 500);
  }
});

/**
 * Add deal breaker
 */
export const addDealBreaker = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { dealBreaker } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!dealBreaker || typeof dealBreaker !== 'string') {
    throw new AppError('Deal breaker must be a non-empty string', 400);
  }

  try {
    const preferences = await MatchPreferences.findOneAndUpdate(
      { userId },
      { 
        $addToSet: { dealBreakers: dealBreaker.trim() },
        lastActiveAt: new Date()
      },
      { 
        new: true,
        upsert: true
      }
    );

    return res.json({
      success: true,
      data: { 
        dealBreakers: preferences.dealBreakers
      },
      message: 'Deal breaker added successfully'
    });

  } catch (error) {
    logger.error('Error adding deal breaker:', error);
    throw new AppError('Failed to add deal breaker', 500);
  }
});

/**
 * Remove deal breaker
 */
export const removeDealBreaker = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { dealBreaker } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!dealBreaker || typeof dealBreaker !== 'string') {
    throw new AppError('Deal breaker must be a non-empty string', 400);
  }

  try {
    const preferences = await MatchPreferences.findOneAndUpdate(
      { userId },
      { 
        $pull: { dealBreakers: dealBreaker.trim() },
        lastActiveAt: new Date()
      },
      { new: true }
    );

    if (!preferences) {
      throw new AppError('Match preferences not found', 404);
    }

    return res.json({
      success: true,
      data: { 
        dealBreakers: preferences.dealBreakers
      },
      message: 'Deal breaker removed successfully'
    });

  } catch (error) {
    logger.error('Error removing deal breaker:', error);
    throw new AppError('Failed to remove deal breaker', 500);
  }
});

/**
 * Get match preferences summary/stats
 */
export const getPreferencesSummary = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const preferences = await MatchPreferences.findOne({ userId });

    if (!preferences) {
      throw new AppError('Match preferences not found', 404);
    }

    // Calculate preference completeness
    const sections = {
      basic: !!(preferences.maxDistance && preferences.ageRange && preferences.budgetRange),
      lifestyle: Object.values(preferences.lifestyle).some(val => val !== 'no_preference'),
      schedule: Object.values(preferences.schedule).some(val => val !== 'no_preference'),
      property: preferences.propertyPreferences.propertyTypes.length > 0 || 
                preferences.propertyPreferences.amenities.length > 0,
      roommate: preferences.roommatePreferences.occupation.length > 0 ||
                preferences.roommatePreferences.education_level.length > 0 ||
                preferences.roommatePreferences.religion.length > 0
    };

    const completedSections = Object.values(sections).filter(Boolean).length;
    const totalSections = Object.keys(sections).length;
    const completeness = Math.round((completedSections / totalSections) * 100);

    const summary = {
      isActive: preferences.isActive,
      completeness,
      completedSections,
      totalSections,
      sections,
      lastActiveAt: preferences.lastActiveAt,
      settings: {
        maxDistance: preferences.maxDistance,
        compatibilityThreshold: preferences.matchingSettings.compatibility_threshold,
        dailyMatchLimit: preferences.matchingSettings.daily_match_limit,
        autoLikeHighCompatibility: preferences.matchingSettings.auto_like_high_compatibility
      },
      counts: {
        preferredStates: preferences.preferredStates.length,
        preferredCities: preferences.preferredCities.length,
        propertyTypes: preferences.propertyPreferences.propertyTypes.length,
        amenities: preferences.propertyPreferences.amenities.length,
        dealBreakers: preferences.dealBreakers.length
      }
    };

    return res.json({
      success: true,
      data: { summary }
    });

  } catch (error) {
    logger.error('Error getting preferences summary:', error);
    throw new AppError('Failed to get preferences summary', 500);
  }
});
