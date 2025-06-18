import { Request, Response, NextFunction } from 'express';
import { AppError, catchAsync } from '../middleware/errorHandler';
import { logger, logHelpers } from '../utils/logger';
import User from '../models/User.model';
import Profile from '../models/Profile.model';
// import { Types } from 'mongoose'; // Commented out as not used

/**
 * Search users with filters
 */
export const searchUsers = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const {
    // Basic filters
    accountType,
    gender,
    ageMin,
    ageMax,
    location,
    
    // Lifestyle filters
    smokingPolicy,
    drinkingPolicy,
    petPolicy,
    cleanlinessLevel,
    
    // Housing filters
    budgetMin,
    budgetMax,
    propertyTypes,
    roomType,
    
    // Other filters
    interests,
    occupation,
    isEmailVerified,
    
    // Search and pagination
    search,
    page = 1,
    limit = 20,
    sortBy = 'lastActiveAt',
    sortOrder = 'desc'
  } = req.query;

  // Build user query
  const userQuery: any = {
    isActive: true
  };

  // Account type filter
  if (accountType) {
    userQuery.accountType = { $in: Array.isArray(accountType) ? accountType : [accountType] };
  }

  // Gender filter
  if (gender && gender !== 'any') {
    userQuery.gender = gender;
  }

  // Age filter
  if (ageMin || ageMax) {
    const currentYear = new Date().getFullYear();
    userQuery.dateOfBirth = {};
    
    if (ageMax) {
      userQuery.dateOfBirth.$gte = new Date(currentYear - parseInt(ageMax as string) - 1, 0, 1);
    }
    if (ageMin) {
      userQuery.dateOfBirth.$lte = new Date(currentYear - parseInt(ageMin as string), 11, 31);
    }
  }

  // Location filter
  if (location) {
    const locationStr = location as string;
    userQuery.$or = [
      { 'location.city': { $regex: locationStr, $options: 'i' } },
      { 'location.state': { $regex: locationStr, $options: 'i' } }
    ];
  }

  // Email verification filter
  if (isEmailVerified === 'true') {
    userQuery.isEmailVerified = true;
  }

  // Text search in name
  if (search) {
    const searchStr = search as string;
    userQuery.$or = [
      { firstName: { $regex: searchStr, $options: 'i' } },
      { lastName: { $regex: searchStr, $options: 'i' } },
      { email: { $regex: searchStr, $options: 'i' } }
    ];
  }

  // Build profile query
  const profileQuery: any = {};

  // Lifestyle filters
  if (smokingPolicy) {
    profileQuery['lifestyle.smokingPolicy'] = smokingPolicy;
  }
  if (drinkingPolicy) {
    profileQuery['lifestyle.drinkingPolicy'] = drinkingPolicy;
  }
  if (petPolicy) {
    profileQuery['lifestyle.petPolicy'] = petPolicy;
  }
  if (cleanlinessLevel) {
    profileQuery['lifestyle.cleanlinessLevel'] = cleanlinessLevel;
  }

  // Housing budget filter
  if (budgetMin || budgetMax) {
    profileQuery['housingPreferences.budgetRange'] = {};
    if (budgetMin) {
      profileQuery['housingPreferences.budgetRange.min'] = { $gte: parseInt(budgetMin as string) };
    }
    if (budgetMax) {
      profileQuery['housingPreferences.budgetRange.max'] = { $lte: parseInt(budgetMax as string) };
    }
  }

  // Property types filter
  if (propertyTypes) {
    const types = Array.isArray(propertyTypes) ? propertyTypes : [propertyTypes];
    profileQuery['housingPreferences.propertyTypes'] = { $in: types };
  }

  // Room type filter
  if (roomType) {
    profileQuery['housingPreferences.roomType'] = roomType;
  }

  // Interests filter
  if (interests) {
    const interestList = Array.isArray(interests) ? interests : [interests];
    profileQuery.interests = { $in: interestList };
  }

  // Occupation filter
  if (occupation) {
    profileQuery.occupation = { $regex: occupation as string, $options: 'i' };
  }

  // Pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Sort options
  const sortOptions: any = {};
  sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  try {
    // First find users matching user criteria
    const users = await User.find(userQuery)
      .select('_id firstName lastName dateOfBirth gender location accountType isEmailVerified lastActiveAt createdAt')
      .sort(sortOptions)
      .lean();

    if (users.length === 0) {
      return res.json({
        success: true,
        data: {
          users: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            pages: 0
          }
        }
      });
    }

    const userIds = users.map(user => user._id);

    // Then find profiles matching profile criteria
    let profilesQuery = Profile.find({
      userId: { $in: userIds },
      ...profileQuery
    }).populate({
      path: 'userId',
      select: 'firstName lastName dateOfBirth gender location accountType isEmailVerified lastActiveAt createdAt'
    });

    // Apply pagination to profiles
    const totalProfiles = await Profile.countDocuments({
      userId: { $in: userIds },
      ...profileQuery
    });

    const profiles = await profilesQuery
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Format results
    const results = profiles.map(profile => {
      const user = profile.userId as any;
      
      return {
        id: user._id,
        firstName: profile.privacy?.showFullName !== false ? user.firstName : user.firstName.charAt(0) + '.',
        lastName: profile.privacy?.showFullName !== false ? user.lastName : user.lastName.charAt(0) + '.',
        age: profile.privacy?.showAge !== false ? new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear() : null,
        gender: user.gender,
        location: profile.privacy?.showLocation !== false ? user.location : null,
        accountType: user.accountType,
        isEmailVerified: user.isEmailVerified,
        
        // Profile data
        bio: profile.bio,
        occupation: profile.privacy?.showOccupation !== false ? profile.occupation : null,
        education: profile.education,
        interests: profile.interests?.slice(0, 5) || [], // Show first 5 interests
        hobbies: profile.hobbies?.slice(0, 5) || [], // Show first 5 hobbies
        primaryPhoto: profile.photos?.find((p: any) => p.isPrimary) || profile.photos?.[0] || null,
        photoCount: profile.photos?.length || 0,
        
        // Lifestyle
        lifestyle: profile.lifestyle,
        
        // Verification status
        verifications: profile.verifications,
        
        // Activity
        lastActiveAt: user.lastActiveAt,
        memberSince: user.createdAt,
        profileCompleteness: profile.isProfileComplete
      };
    });

    // Log search activity
    if (req.user) {
      logHelpers.userAction(req.user.userId, 'user_search', {
        filters: { accountType, gender, location, ageMin, ageMax },
        resultsCount: results.length
      });
    }

    return res.json({
      success: true,
      data: {
        users: results,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalProfiles,
          pages: Math.ceil(totalProfiles / limitNum)
        },
        filters: {
          applied: Object.keys(req.query).length - 3, // Exclude page, limit, sortBy
          available: {
            accountTypes: ['seeker', 'owner', 'both'],
            genders: ['male', 'female', 'non-binary', 'any'],
            lifestyleOptions: {
              smoking: ['no-smoking', 'smoking-allowed', 'outdoor-only'],
              drinking: ['no-drinking', 'social-drinking', 'regular-drinking'],
              pets: ['no-pets', 'cats-only', 'dogs-only', 'all-pets'],
              cleanliness: ['very-clean', 'moderately-clean', 'relaxed']
            }
          }
        }
      }
    });

  } catch (error) {
    logger.error('User search error:', error);
    throw new AppError('Search failed', 500, true, 'SEARCH_FAILED');
  }
});

/**
 * Get search suggestions
 */
export const getSearchSuggestions = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { query, type = 'all' } = req.query;

  if (!query || (query as string).length < 2) {
    return res.json({
      success: true,
      data: { suggestions: [] }
    });
  }

  const searchStr = query as string;
  const suggestions: any = {};

  try {
    if (type === 'all' || type === 'locations') {
      // Location suggestions
      const locations = await User.aggregate([
        {
          $match: {
            isActive: true,
            $or: [
              { 'location.city': { $regex: searchStr, $options: 'i' } },
              { 'location.state': { $regex: searchStr, $options: 'i' } }
            ]
          }
        },
        {
          $group: {
            _id: null,
            cities: { $addToSet: '$location.city' },
            states: { $addToSet: '$location.state' }
          }
        }
      ]);

      suggestions.locations = {
        cities: locations[0]?.cities?.filter((city: string) => 
          city && city.toLowerCase().includes(searchStr.toLowerCase())
        ).slice(0, 5) || [],
        states: locations[0]?.states?.filter((state: string) => 
          state && state.toLowerCase().includes(searchStr.toLowerCase())
        ).slice(0, 5) || []
      };
    }

    if (type === 'all' || type === 'interests') {
      // Interest suggestions
      const interests = await Profile.aggregate([
        { $unwind: '$interests' },
        {
          $match: {
            interests: { $regex: searchStr, $options: 'i' }
          }
        },
        {
          $group: {
            _id: '$interests',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      suggestions.interests = interests.map(item => item._id);
    }

    if (type === 'all' || type === 'occupations') {
      // Occupation suggestions
      const occupations = await Profile.aggregate([
        {
          $match: {
            occupation: { $regex: searchStr, $options: 'i' }
          }
        },
        {
          $group: {
            _id: '$occupation',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      suggestions.occupations = occupations.map(item => item._id);
    }

    return res.json({
      success: true,
      data: { suggestions }
    });

  } catch (error) {
    logger.error('Search suggestions error:', error);
    throw new AppError('Failed to get suggestions', 500, true, 'SUGGESTIONS_FAILED');
  }
});

/**
 * Get popular search filters
 */
export const getPopularFilters = catchAsync(async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    // Get most common locations
    const popularLocations = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: { city: '$location.city', state: '$location.state' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get most common interests
    const popularInterests = await Profile.aggregate([
      { $unwind: '$interests' },
      {
        $group: {
          _id: '$interests',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);

    // Get budget ranges
    const budgetRanges = await Profile.aggregate([
      {
        $match: {
          'housingPreferences.budgetRange.min': { $exists: true },
          'housingPreferences.budgetRange.max': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgMin: { $avg: '$housingPreferences.budgetRange.min' },
          avgMax: { $avg: '$housingPreferences.budgetRange.max' },
          minBudget: { $min: '$housingPreferences.budgetRange.min' },
          maxBudget: { $max: '$housingPreferences.budgetRange.max' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        popularLocations: popularLocations.map(item => ({
          city: item._id.city,
          state: item._id.state,
          count: item.count
        })),
        popularInterests: popularInterests.map(item => ({
          interest: item._id,
          count: item.count
        })),
        budgetInsights: budgetRanges[0] || {
          avgMin: 50000,
          avgMax: 150000,
          minBudget: 20000,
          maxBudget: 500000
        }
      }
    });

  } catch (error) {
    logger.error('Popular filters error:', error);
    throw new AppError('Failed to get popular filters', 500, true, 'POPULAR_FILTERS_FAILED');
  }
});

export default {
  searchUsers,
  getSearchSuggestions,
  getPopularFilters
};
