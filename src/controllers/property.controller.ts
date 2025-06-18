import { Request, Response } from 'express';
import { Property } from '../models/Property';
import User from '../models/User.model';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { catchAsync } from '../utils/catchAsync';
import { Types } from 'mongoose';

/**
 * Create a new property listing
 */
export const createProperty = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  
  if (!userId) {
    throw new AppError('User authentication required', 401);
  }

  // Validate user exists and can create properties
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if user account type allows property creation
  if (user.accountType === 'seeker') {
    throw new AppError('Only property owners and agents can create property listings', 403);
  }

  const propertyData = {
    ...req.body,
    ownerId: new Types.ObjectId(userId),
    lastModifiedBy: new Types.ObjectId(userId),
    status: 'draft' // New properties start as draft
  };

  // Validate required fields
  if (!propertyData.title || !propertyData.description || !propertyData.location) {
    throw new AppError('Title, description, and location are required', 400);
  }

  // Set default coordinates if not provided (Lagos center as fallback)
  if (!propertyData.location.coordinates) {
    propertyData.location.coordinates = {
      type: 'Point',
      coordinates: [3.3792, 6.5244] // Lagos coordinates
    };
  }

  const property = new Property(propertyData);
  await property.save();

  logger.info(`Property created: ${property._id} by user: ${userId}`);

  return ApiResponse.success(res, {
    property: await property.populate('ownerId', 'firstName lastName email accountType')
  }, 'Property created successfully', 201);
});

/**
 * Get all properties with filtering and pagination
 */
export const getProperties = catchAsync(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    propertyType,
    listingType,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    city,
    state,
    area,
    amenities,
    status = 'active',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search,
    latitude,
    longitude,
    radius = 5000 // 5km default radius
  } = req.query;

  // Build filter object
  const filter: any = {
    status: status,
    isAvailable: true
  };

  // Property type filter
  if (propertyType) {
    filter.propertyType = propertyType;
  }

  // Listing type filter
  if (listingType) {
    filter.listingType = listingType;
  }

  // Price range filter
  if (minPrice || maxPrice) {
    filter['pricing.rentPerMonth'] = {};
    if (minPrice) filter['pricing.rentPerMonth'].$gte = Number(minPrice);
    if (maxPrice) filter['pricing.rentPerMonth'].$lte = Number(maxPrice);
  }

  // Bedroom filter
  if (bedrooms) {
    filter.bedrooms = Number(bedrooms);
  }

  // Bathroom filter
  if (bathrooms) {
    filter.bathrooms = Number(bathrooms);
  }

  // Location filters
  if (city) {
    filter['location.city'] = new RegExp(city as string, 'i');
  }
  if (state) {
    filter['location.state'] = new RegExp(state as string, 'i');
  }
  if (area) {
    filter['location.area'] = new RegExp(area as string, 'i');
  }

  // Amenities filter
  if (amenities) {
    const amenityList = (amenities as string).split(',');
    amenityList.forEach(amenity => {
      filter[`amenities.${amenity.trim()}`] = true;
    });
  }

  // Text search
  if (search) {
    filter.$text = { $search: search as string };
  }

  // Geospatial search
  let query = Property.find(filter);
  
  if (latitude && longitude) {
    query = Property.find({
      ...filter,
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)]
          },
          $maxDistance: Number(radius)
        }
      }
    });
  }

  // Sorting
  const sortOptions: any = {};
  sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  // Execute query with pagination
  const skip = (Number(page) - 1) * Number(limit);
  
  const [properties, total] = await Promise.all([
    query
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate('ownerId', 'firstName lastName email accountType isEmailVerified')
      .lean(),
    Property.countDocuments(filter)
  ]);

  // Calculate pagination info
  const totalPages = Math.ceil(total / Number(limit));
  const hasNextPage = Number(page) < totalPages;
  const hasPrevPage = Number(page) > 1;

  return ApiResponse.success(res, {
    properties,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: totalPages,
      hasNextPage,
      hasPrevPage
    },
    filters: {
      applied: Object.keys(filter).length - 2, // Exclude status and isAvailable
      available: {
        propertyTypes: ['apartment', 'house', 'condo', 'studio', 'duplex', 'bungalow', 'mansion'],
        listingTypes: ['rent', 'roommate', 'sublet'],
        amenities: [
          'wifi', 'parking', 'security', 'generator', 'borehole', 'airConditioning',
          'kitchen', 'refrigerator', 'microwave', 'gasStove', 'furnished', 'tv',
          'washingMachine', 'elevator', 'gym', 'swimmingPool', 'playground',
          'prepaidMeter', 'cableTV', 'cleaningService'
        ]
      }
    }
  }, 'Properties retrieved successfully');
});

/**
 * Get a single property by ID
 */
export const getProperty = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const property = await Property.findById(id)
    .populate('ownerId', 'firstName lastName email accountType isEmailVerified phoneNumber')
    .populate('verifiedBy', 'firstName lastName');

  if (!property) {
    throw new AppError('Property not found', 404);
  }

  // Check if property is accessible
  if (property.status === 'draft' && property.ownerId._id.toString() !== userId) {
    throw new AppError('Property not found', 404);
  }

  // Increment view count (but not for the owner)
  if (property.ownerId._id.toString() !== userId) {
    await property.incrementViews();
  }

  return ApiResponse.success(res, {
    property
  }, 'Property retrieved successfully');
});

/**
 * Update a property
 */
export const updateProperty = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const property = await Property.findById(id);

  if (!property) {
    throw new AppError('Property not found', 404);
  }

  // Check ownership
  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only update your own properties', 403);
  }

  // Update property
  const updateData = {
    ...req.body,
    lastModifiedBy: new Types.ObjectId(userId)
  };

  // Remove fields that shouldn't be updated directly
  delete updateData.ownerId;
  delete updateData.analytics;
  delete updateData.createdAt;

  const updatedProperty = await Property.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('ownerId', 'firstName lastName email accountType');

  logger.info(`Property updated: ${id} by user: ${userId}`);

  return ApiResponse.success(res, {
    property: updatedProperty
  }, 'Property updated successfully');
});

/**
 * Delete a property
 */
export const deleteProperty = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const property = await Property.findById(id);

  if (!property) {
    throw new AppError('Property not found', 404);
  }

  // Check ownership
  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only delete your own properties', 403);
  }

  await Property.findByIdAndDelete(id);

  logger.info(`Property deleted: ${id} by user: ${userId}`);

  return ApiResponse.success(res, null, 'Property deleted successfully');
});

/**
 * Get properties by owner
 */
export const getOwnerProperties = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const {
    page = 1,
    limit = 20,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter
  const filter: any = { ownerId: userId };
  if (status) {
    filter.status = status;
  }

  // Sorting
  const sortOptions: any = {};
  sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  // Execute query with pagination
  const skip = (Number(page) - 1) * Number(limit);
  
  const [properties, total] = await Promise.all([
    Property.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Property.countDocuments(filter)
  ]);

  // Calculate pagination info
  const totalPages = Math.ceil(total / Number(limit));

  return ApiResponse.success(res, {
    properties,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: totalPages
    },
    summary: {
      total,
      active: await Property.countDocuments({ ownerId: userId, status: 'active' }),
      draft: await Property.countDocuments({ ownerId: userId, status: 'draft' }),
      rented: await Property.countDocuments({ ownerId: userId, status: 'rented' })
    }
  }, 'Owner properties retrieved successfully');
});

/**
 * Publish a draft property
 */
export const publishProperty = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const property = await Property.findById(id);

  if (!property) {
    throw new AppError('Property not found', 404);
  }

  // Check ownership
  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only publish your own properties', 403);
  }

  // Check if property has minimum required data
  if (!property.photos || property.photos.length === 0) {
    throw new AppError('Property must have at least one photo before publishing', 400);
  }

  if (!property.pricing.rentPerMonth || property.pricing.rentPerMonth <= 0) {
    throw new AppError('Property must have a valid rent amount before publishing', 400);
  }

  // Update status to active
  property.status = 'active';
  property.lastModifiedBy = new Types.ObjectId(userId);
  await property.save();

  logger.info(`Property published: ${id} by user: ${userId}`);

  return ApiResponse.success(res, {
    property
  }, 'Property published successfully');
});

/**
 * Get property analytics
 */
export const getPropertyAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const property = await Property.findById(id);

  if (!property) {
    throw new AppError('Property not found', 404);
  }

  // Check ownership
  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only view analytics for your own properties', 403);
  }

  return ApiResponse.success(res, {
    analytics: property.analytics,
    summary: {
      totalViews: property.analytics.views,
      totalFavorites: property.analytics.favorites,
      totalInquiries: property.analytics.inquiries,
      totalApplications: property.analytics.applications,
      lastViewedAt: property.analytics.lastViewedAt,
      averageViewDuration: property.analytics.averageViewDuration
    }
  }, 'Property analytics retrieved successfully');
});

/**
 * Search properties with advanced filters
 */
export const searchProperties = catchAsync(async (req: Request, res: Response) => {
  const {
    query,
    propertyType,
    listingType,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    location,
    amenities,
    page = 1,
    limit = 20
  } = req.body;

  // Build aggregation pipeline
  const pipeline: any[] = [
    // Match basic filters
    {
      $match: {
        status: 'active',
        isAvailable: true
      }
    }
  ];

  // Text search
  if (query) {
    pipeline.unshift({
      $match: {
        $text: { $search: query }
      }
    });
    pipeline.push({
      $addFields: {
        score: { $meta: 'textScore' }
      }
    });
  }

  // Property type filter
  if (propertyType) {
    pipeline.push({
      $match: { propertyType }
    });
  }

  // Listing type filter
  if (listingType) {
    pipeline.push({
      $match: { listingType }
    });
  }

  // Price range filter
  if (minPrice || maxPrice) {
    const priceMatch: any = {};
    if (minPrice) priceMatch.$gte = Number(minPrice);
    if (maxPrice) priceMatch.$lte = Number(maxPrice);

    pipeline.push({
      $match: {
        'pricing.rentPerMonth': priceMatch
      }
    });
  }

  // Bedroom/bathroom filters
  if (bedrooms) {
    pipeline.push({
      $match: { bedrooms: Number(bedrooms) }
    });
  }

  if (bathrooms) {
    pipeline.push({
      $match: { bathrooms: Number(bathrooms) }
    });
  }

  // Location filter
  if (location) {
    const locationMatch: any = {};
    if (location.city) locationMatch['location.city'] = new RegExp(location.city, 'i');
    if (location.state) locationMatch['location.state'] = new RegExp(location.state, 'i');
    if (location.area) locationMatch['location.area'] = new RegExp(location.area, 'i');

    pipeline.push({
      $match: locationMatch
    });
  }

  // Amenities filter
  if (amenities && amenities.length > 0) {
    const amenityMatch: any = {};
    amenities.forEach((amenity: string) => {
      amenityMatch[`amenities.${amenity}`] = true;
    });

    pipeline.push({
      $match: amenityMatch
    });
  }

  // Add owner information
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'ownerId',
      foreignField: '_id',
      as: 'owner',
      pipeline: [
        {
          $project: {
            firstName: 1,
            lastName: 1,
            email: 1,
            accountType: 1,
            isEmailVerified: 1
          }
        }
      ]
    }
  });

  pipeline.push({
    $unwind: '$owner'
  });

  // Sort by relevance (if text search) or date
  if (query) {
    pipeline.push({
      $sort: { score: { $meta: 'textScore' }, createdAt: -1 }
    });
  } else {
    pipeline.push({
      $sort: { createdAt: -1 }
    });
  }

  // Pagination
  const skip = (Number(page) - 1) * Number(limit);
  pipeline.push(
    { $skip: skip },
    { $limit: Number(limit) }
  );

  // Execute aggregation
  const [properties, totalCount] = await Promise.all([
    Property.aggregate(pipeline),
    Property.aggregate([
      ...pipeline.slice(0, -2), // Remove skip and limit for count
      { $count: 'total' }
    ])
  ]);

  const total = totalCount[0]?.total || 0;
  const totalPages = Math.ceil(total / Number(limit));

  return ApiResponse.success(res, {
    properties,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: totalPages
    },
    searchInfo: {
      query,
      resultsFound: properties.length,
      totalMatches: total
    }
  }, 'Property search completed successfully');
});

/**
 * Get property suggestions based on user preferences
 */
export const getPropertySuggestions = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { limit = 10 } = req.query;

  // Get user profile to understand preferences
  const user = await User.findById(userId).populate('profile');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Build suggestion criteria based on user profile
  const suggestionCriteria: any = {
    status: 'active',
    isAvailable: true
  };

  // If user has housing preferences, use them
  // Get user profile for housing preferences
  const Profile = require('../models/Profile.model').default;
  const userProfile = await Profile.findOne({ userId });
  if (userProfile?.housingPreferences) {
    const prefs = userProfile.housingPreferences;

    // Property types
    if (prefs.propertyTypes && prefs.propertyTypes.length > 0) {
      suggestionCriteria.propertyType = { $in: prefs.propertyTypes };
    }

    // Budget range
    if (prefs.budgetRange) {
      suggestionCriteria['pricing.rentPerMonth'] = {
        $gte: prefs.budgetRange.min,
        $lte: prefs.budgetRange.max
      };
    }

    // Preferred areas
    if (prefs.preferredAreas && prefs.preferredAreas.length > 0) {
      suggestionCriteria['location.area'] = { $in: prefs.preferredAreas };
    }

    // Room type
    if (prefs.roomType === 'private-room') {
      suggestionCriteria.listingType = 'roommate';
    }
  }

  // Get suggested properties
  const suggestions = await Property.find(suggestionCriteria)
    .sort({ 'analytics.views': -1, createdAt: -1 })
    .limit(Number(limit))
    .populate('ownerId', 'firstName lastName email accountType')
    .lean();

  return ApiResponse.success(res, {
    suggestions,
    criteria: suggestionCriteria,
    count: suggestions.length
  }, 'Property suggestions retrieved successfully');
});

/**
 * Get nearby properties
 */
export const getNearbyProperties = catchAsync(async (req: Request, res: Response) => {
  const { latitude, longitude, radius = 5000, limit = 20 } = req.query;

  if (!latitude || !longitude) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const nearbyProperties = await Property.findNearby(
    Number(longitude),
    Number(latitude),
    Number(radius)
  )
    .limit(Number(limit))
    .populate('ownerId', 'firstName lastName email accountType')
    .lean();

  return ApiResponse.success(res, {
    properties: nearbyProperties,
    searchCenter: {
      latitude: Number(latitude),
      longitude: Number(longitude)
    },
    radius: Number(radius),
    count: nearbyProperties.length
  }, 'Nearby properties retrieved successfully');
});

/**
 * Health check for property routes
 */
export const healthCheck = catchAsync(async (_req: Request, res: Response) => {
  const propertyCount = await Property.countDocuments();
  const activeProperties = await Property.countDocuments({ status: 'active' });

  return ApiResponse.success(res, {
    message: 'Property routes working',
    timestamp: new Date().toISOString(),
    statistics: {
      totalProperties: propertyCount,
      activeProperties,
      availableProperties: await Property.countDocuments({ status: 'active', isAvailable: true })
    },
    endpoints: {
      createProperty: 'POST /',
      getProperties: 'GET /',
      getProperty: 'GET /:id',
      updateProperty: 'PATCH /:id',
      deleteProperty: 'DELETE /:id',
      getOwnerProperties: 'GET /owner',
      publishProperty: 'PATCH /:id/publish',
      getPropertyAnalytics: 'GET /:id/analytics',
      searchProperties: 'POST /search',
      getPropertySuggestions: 'GET /suggestions',
      getNearbyProperties: 'GET /nearby'
    }
  }, 'Property service is healthy');
});
