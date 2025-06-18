import { Request, Response } from 'express';
import { Property } from '../models/Property';
import { PropertyFavorite } from '../models/PropertyFavorite';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { catchAsync } from '../utils/catchAsync';

/**
 * Add property to favorites
 */
export const addToFavorites = catchAsync(async (req: Request, res: Response) => {
  const { propertyId } = req.body;
  const userId = req.user?._id;

  // Check if property exists
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found', 404);
  }

  // Check if property is available
  if (!property.isAvailable || property.status !== 'active') {
    throw new AppError('Property is not available for favoriting', 400);
  }

  // Check if already favorited
  const existingFavorite = await PropertyFavorite.findOne({
    userId,
    propertyId
  });

  if (existingFavorite) {
    throw new AppError('Property is already in your favorites', 400);
  }

  // Create favorite
  const favorite = new PropertyFavorite({
    userId,
    propertyId
  });

  await favorite.save();

  // Update property analytics
  property.analytics.favorites += 1;
  await property.save();

  logger.info(`User ${userId} added property ${propertyId} to favorites`);

  return ApiResponse.success(res, {
    favorite: {
      id: favorite._id,
      propertyId,
      createdAt: favorite.createdAt
    }
  }, 'Property added to favorites successfully', 201);
});

/**
 * Remove property from favorites
 */
export const removeFromFavorites = catchAsync(async (req: Request, res: Response) => {
  const { propertyId } = req.params;
  const userId = req.user?._id;

  // Find and remove favorite
  const favorite = await PropertyFavorite.findOneAndDelete({
    userId,
    propertyId
  });

  if (!favorite) {
    throw new AppError('Property not found in your favorites', 404);
  }

  // Update property analytics
  const property = await Property.findById(propertyId);
  if (property && property.analytics.favorites > 0) {
    property.analytics.favorites -= 1;
    await property.save();
  }

  logger.info(`User ${userId} removed property ${propertyId} from favorites`);

  return ApiResponse.success(res, null, 'Property removed from favorites successfully');
});

/**
 * Get user's favorite properties
 */
export const getUserFavorites = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build sort options
  const sortOptions: any = {};
  sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  // Calculate pagination
  const skip = (Number(page) - 1) * Number(limit);

  // Get favorites with property details
  const [favorites, total] = await Promise.all([
    PropertyFavorite.find({ userId })
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: 'propertyId',
        select: 'title description propertyType listingType bedrooms bathrooms location pricing photos status isAvailable analytics',
        populate: {
          path: 'ownerId',
          select: 'firstName lastName email accountType'
        }
      })
      .lean(),
    PropertyFavorite.countDocuments({ userId })
  ]);

  // Filter out favorites where property no longer exists
  const validFavorites = favorites.filter(fav => fav.propertyId);

  // Calculate pagination info
  const totalPages = Math.ceil(total / Number(limit));

  return ApiResponse.success(res, {
    favorites: validFavorites,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: totalPages
    },
    summary: {
      totalFavorites: total,
      availableProperties: validFavorites.filter(fav => 
        fav.propertyId && (fav.propertyId as any).isAvailable && (fav.propertyId as any).status === 'active'
      ).length
    }
  }, 'Favorite properties retrieved successfully');
});

/**
 * Check if property is favorited by user
 */
export const checkFavoriteStatus = catchAsync(async (req: Request, res: Response) => {
  const { propertyId } = req.params;
  const userId = req.user?._id;

  const favorite = await PropertyFavorite.findOne({
    userId,
    propertyId
  });

  return ApiResponse.success(res, {
    isFavorited: !!favorite,
    favoriteId: favorite?._id || null,
    favoritedAt: favorite?.createdAt || null
  }, 'Favorite status retrieved successfully');
});

/**
 * Get favorite properties count
 */
export const getFavoritesCount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  const count = await PropertyFavorite.countDocuments({ userId });

  return ApiResponse.success(res, {
    count
  }, 'Favorites count retrieved successfully');
});

/**
 * Get popular properties (most favorited)
 */
export const getPopularProperties = catchAsync(async (req: Request, res: Response) => {
  const {
    limit = 20,
    timeframe = 'all', // 'week', 'month', 'all'
    propertyType,
    city,
    state
  } = req.query;

  // Build date filter for timeframe
  let dateFilter = {};
  if (timeframe !== 'all') {
    const now = new Date();
    let startDate = new Date();
    
    if (timeframe === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeframe === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    }
    
    dateFilter = { createdAt: { $gte: startDate } };
  }

  // Aggregation pipeline to get most favorited properties
  const pipeline: any[] = [
    // Match timeframe
    { $match: dateFilter },
    
    // Group by property and count favorites
    {
      $group: {
        _id: '$propertyId',
        favoriteCount: { $sum: 1 },
        latestFavorite: { $max: '$createdAt' }
      }
    },
    
    // Sort by favorite count
    { $sort: { favoriteCount: -1, latestFavorite: -1 } },
    
    // Limit results
    { $limit: Number(limit) },
    
    // Lookup property details
    {
      $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: '_id',
        as: 'property'
      }
    },
    
    // Unwind property
    { $unwind: '$property' },
    
    // Match property filters
    {
      $match: {
        'property.status': 'active',
        'property.isAvailable': true,
        ...(propertyType && { 'property.propertyType': propertyType }),
        ...(city && { 'property.location.city': new RegExp(city as string, 'i') }),
        ...(state && { 'property.location.state': state })
      }
    },
    
    // Lookup owner details
    {
      $lookup: {
        from: 'users',
        localField: 'property.ownerId',
        foreignField: '_id',
        as: 'property.owner',
        pipeline: [
          {
            $project: {
              firstName: 1,
              lastName: 1,
              email: 1,
              accountType: 1
            }
          }
        ]
      }
    },
    
    // Unwind owner
    { $unwind: '$property.owner' },
    
    // Project final structure
    {
      $project: {
        property: 1,
        favoriteCount: 1,
        latestFavorite: 1
      }
    }
  ];

  const popularProperties = await PropertyFavorite.aggregate(pipeline);

  return ApiResponse.success(res, {
    properties: popularProperties,
    timeframe,
    count: popularProperties.length,
    filters: {
      propertyType,
      city,
      state
    }
  }, 'Popular properties retrieved successfully');
});

/**
 * Bulk add/remove favorites
 */
export const bulkUpdateFavorites = catchAsync(async (req: Request, res: Response) => {
  const { propertyIds, action } = req.body; // action: 'add' or 'remove'
  const userId = req.user?._id;

  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    throw new AppError('Property IDs array is required', 400);
  }

  if (!['add', 'remove'].includes(action)) {
    throw new AppError('Action must be either "add" or "remove"', 400);
  }

  const results: {
    successful: any[];
    failed: any[];
  } = {
    successful: [],
    failed: []
  };

  if (action === 'add') {
    // Bulk add to favorites
    for (const propertyId of propertyIds) {
      try {
        // Check if property exists and is available
        const property = await Property.findById(propertyId);
        if (!property || !property.isAvailable || property.status !== 'active') {
          results.failed.push({ propertyId, reason: 'Property not available' });
          continue;
        }

        // Check if already favorited
        const existingFavorite = await PropertyFavorite.findOne({ userId, propertyId });
        if (existingFavorite) {
          results.failed.push({ propertyId, reason: 'Already favorited' });
          continue;
        }

        // Create favorite
        await PropertyFavorite.create({ userId, propertyId });
        
        // Update analytics
        property.analytics.favorites += 1;
        await property.save();

        results.successful.push(propertyId);
      } catch (error) {
        results.failed.push({ propertyId, reason: 'Database error' });
      }
    }
  } else {
    // Bulk remove from favorites
    for (const propertyId of propertyIds) {
      try {
        const favorite = await PropertyFavorite.findOneAndDelete({ userId, propertyId });
        
        if (favorite) {
          // Update analytics
          const property = await Property.findById(propertyId);
          if (property && property.analytics.favorites > 0) {
            property.analytics.favorites -= 1;
            await property.save();
          }
          results.successful.push(propertyId);
        } else {
          results.failed.push({ propertyId, reason: 'Not in favorites' });
        }
      } catch (error) {
        results.failed.push({ propertyId, reason: 'Database error' });
      }
    }
  }

  logger.info(`User ${userId} bulk ${action} favorites: ${results.successful.length} successful, ${results.failed.length} failed`);

  return ApiResponse.success(res, {
    action,
    results,
    summary: {
      total: propertyIds.length,
      successful: results.successful.length,
      failed: results.failed.length
    }
  }, `Bulk ${action} favorites completed`);
});
