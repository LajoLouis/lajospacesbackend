import { Request, Response } from 'express';
import { Property } from '../models/Property';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';
import { catchAsync } from '../utils/catchAsync';
import { Types } from 'mongoose';

/**
 * Advanced property search with filters
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
    rules,
    availableFrom,
    availableTo,
    roommatePreferences,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    isVerified,
    hasPhotos,
    ownerType,
    createdAfter,
    createdBefore,
    updatedAfter,
    updatedBefore
  } = req.body;

  // Build search query
  const searchQuery: any = {
    status: 'active',
    isAvailable: true
  };

  // Text search
  if (query) {
    searchQuery.$text = { $search: query };
  }

  // Property type filter
  if (propertyType) {
    if (Array.isArray(propertyType)) {
      searchQuery.propertyType = { $in: propertyType };
    } else {
      searchQuery.propertyType = propertyType;
    }
  }

  // Listing type filter
  if (listingType) {
    if (Array.isArray(listingType)) {
      searchQuery.listingType = { $in: listingType };
    } else {
      searchQuery.listingType = listingType;
    }
  }

  // Price range filter
  if (minPrice || maxPrice) {
    searchQuery['pricing.rentPerMonth'] = {};
    if (minPrice) searchQuery['pricing.rentPerMonth'].$gte = minPrice;
    if (maxPrice) searchQuery['pricing.rentPerMonth'].$lte = maxPrice;
  }

  // Bedroom filter
  if (bedrooms) {
    if (typeof bedrooms === 'object' && (bedrooms.min || bedrooms.max)) {
      searchQuery.bedrooms = {};
      if (bedrooms.min) searchQuery.bedrooms.$gte = bedrooms.min;
      if (bedrooms.max) searchQuery.bedrooms.$lte = bedrooms.max;
    } else {
      searchQuery.bedrooms = bedrooms;
    }
  }

  // Bathroom filter
  if (bathrooms) {
    if (typeof bathrooms === 'object' && (bathrooms.min || bathrooms.max)) {
      searchQuery.bathrooms = {};
      if (bathrooms.min) searchQuery.bathrooms.$gte = bathrooms.min;
      if (bathrooms.max) searchQuery.bathrooms.$lte = bathrooms.max;
    } else {
      searchQuery.bathrooms = bathrooms;
    }
  }

  // Location filters
  if (location) {
    if (location.city) {
      searchQuery['location.city'] = { $regex: location.city, $options: 'i' };
    }
    if (location.state) {
      searchQuery['location.state'] = location.state;
    }
    if (location.area) {
      searchQuery['location.area'] = { $regex: location.area, $options: 'i' };
    }
    if (location.coordinates) {
      searchQuery['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [location.coordinates.longitude, location.coordinates.latitude]
          },
          $maxDistance: location.coordinates.radius || 5000
        }
      };
    }
  }

  // Amenities filters
  if (amenities) {
    Object.keys(amenities).forEach(amenity => {
      if (amenities[amenity] === true) {
        searchQuery[`amenities.${amenity}`] = true;
      }
    });
  }

  // Rules filters
  if (rules) {
    Object.keys(rules).forEach(rule => {
      if (typeof rules[rule] === 'boolean') {
        searchQuery[`rules.${rule}`] = rules[rule];
      }
    });
  }

  // Availability filters
  if (availableFrom) {
    searchQuery.availableFrom = { $lte: new Date(availableFrom) };
  }
  if (availableTo) {
    searchQuery.$or = [
      { availableTo: { $exists: false } },
      { availableTo: { $gte: new Date(availableTo) } }
    ];
  }

  // Roommate preferences (for roommate listings)
  if (roommatePreferences && listingType === 'roommate') {
    if (roommatePreferences.gender && roommatePreferences.gender !== 'any') {
      searchQuery['roommatePreferences.gender'] = { $in: [roommatePreferences.gender, 'any'] };
    }
    if (roommatePreferences.ageRange) {
      if (roommatePreferences.ageRange.min) {
        searchQuery['roommatePreferences.ageRange.max'] = { $gte: roommatePreferences.ageRange.min };
      }
      if (roommatePreferences.ageRange.max) {
        searchQuery['roommatePreferences.ageRange.min'] = { $lte: roommatePreferences.ageRange.max };
      }
    }
  }

  // Verification filter
  if (isVerified !== undefined) {
    searchQuery.isVerified = isVerified;
  }

  // Photos filter
  if (hasPhotos !== undefined) {
    if (hasPhotos) {
      searchQuery['photos.0'] = { $exists: true };
    } else {
      searchQuery.photos = { $size: 0 };
    }
  }

  // Owner type filter
  if (ownerType) {
    searchQuery.ownerType = ownerType;
  }

  // Date filters
  if (createdAfter || createdBefore) {
    searchQuery.createdAt = {};
    if (createdAfter) searchQuery.createdAt.$gte = new Date(createdAfter);
    if (createdBefore) searchQuery.createdAt.$lte = new Date(createdBefore);
  }

  if (updatedAfter || updatedBefore) {
    searchQuery.updatedAt = {};
    if (updatedAfter) searchQuery.updatedAt.$gte = new Date(updatedAfter);
    if (updatedBefore) searchQuery.updatedAt.$lte = new Date(updatedBefore);
  }

  // Pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Sort options
  const sortOptions: any = {};
  if (query && !sortBy) {
    // If text search, sort by relevance score first
    sortOptions.score = { $meta: 'textScore' };
  }
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  try {
    // Execute search
    const [properties, totalCount] = await Promise.all([
      Property.find(searchQuery)
        .populate('ownerId', 'firstName lastName email accountType isEmailVerified phoneNumber')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Property.countDocuments(searchQuery)
    ]);

    // Format results
    const formattedProperties = properties.map(property => ({
      id: property._id,
      title: property.title,
      description: property.description.substring(0, 200) + (property.description.length > 200 ? '...' : ''),
      propertyType: property.propertyType,
      listingType: property.listingType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      location: {
        city: property.location.city,
        state: property.location.state,
        area: property.location.area,
        address: property.location.address
      },
      pricing: {
        rentPerMonth: property.pricing.rentPerMonth,
        securityDeposit: property.pricing.securityDeposit
      },
      amenities: property.amenities,
      primaryPhoto: property.photos?.find((p: any) => p.isPrimary) || property.photos?.[0] || null,
      photoCount: property.photos?.length || 0,
      isVerified: property.isVerified,
      availableFrom: property.availableFrom,
      analytics: {
        views: property.analytics?.views || 0,
        favorites: property.analytics?.favorites || 0
      },
      owner: {
        id: (property.ownerId as any)._id,
        name: `${(property.ownerId as any).firstName} ${(property.ownerId as any).lastName}`,
        accountType: (property.ownerId as any).accountType,
        isEmailVerified: (property.ownerId as any).isEmailVerified
      },
      createdAt: property.createdAt,
      updatedAt: property.updatedAt
    }));

    // Log search activity
    if (req.user) {
      logger.info(`Property search by user ${req.user._id}`, {
        query: searchQuery,
        resultsCount: properties.length,
        userId: req.user._id
      });
    }

    return res.json({
      success: true,
      data: {
        properties: formattedProperties,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum)
        },
        searchQuery: query || 'Advanced search',
        filtersApplied: Object.keys(req.body).length - 3, // Exclude page, limit, sortBy
        totalResults: totalCount
      }
    });

  } catch (error) {
    logger.error('Property search error:', error);
    throw new AppError('Search failed', 500);
  }
});

/**
 * Find properties near a location
 */
export const getNearbyProperties = catchAsync(async (req: Request, res: Response) => {
  const {
    latitude,
    longitude,
    radius = 5000,
    propertyType,
    listingType,
    minPrice,
    maxPrice,
    limit = 20,
    sortBy = 'distance'
  } = req.query;

  // Build query
  const searchQuery: any = {
    status: 'active',
    isAvailable: true,
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude as string), parseFloat(latitude as string)]
        },
        $maxDistance: parseInt(radius as string)
      }
    }
  };

  // Additional filters
  if (propertyType) {
    if (Array.isArray(propertyType)) {
      searchQuery.propertyType = { $in: propertyType };
    } else {
      searchQuery.propertyType = propertyType;
    }
  }

  if (listingType) {
    if (Array.isArray(listingType)) {
      searchQuery.listingType = { $in: listingType };
    } else {
      searchQuery.listingType = listingType;
    }
  }

  if (minPrice || maxPrice) {
    searchQuery['pricing.rentPerMonth'] = {};
    if (minPrice) searchQuery['pricing.rentPerMonth'].$gte = parseInt(minPrice as string);
    if (maxPrice) searchQuery['pricing.rentPerMonth'].$lte = parseInt(maxPrice as string);
  }

  // Sort options
  const sortOptions: any = {};
  if (sortBy === 'distance') {
    // Default sort by distance (already handled by $near)
  } else if (sortBy === 'price') {
    sortOptions['pricing.rentPerMonth'] = 1;
  } else if (sortBy === 'views') {
    sortOptions['analytics.views'] = -1;
  } else {
    sortOptions[sortBy as string] = -1;
  }

  try {
    const properties = await Property.find(searchQuery)
      .populate('ownerId', 'firstName lastName accountType')
      .sort(sortOptions)
      .limit(parseInt(limit as string))
      .lean();

    const formattedProperties = properties.map(property => ({
      id: property._id,
      title: property.title,
      propertyType: property.propertyType,
      listingType: property.listingType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      location: {
        city: property.location.city,
        state: property.location.state,
        area: property.location.area,
        coordinates: property.location.coordinates
      },
      pricing: {
        rentPerMonth: property.pricing.rentPerMonth
      },
      primaryPhoto: property.photos?.find((p: any) => p.isPrimary) || property.photos?.[0] || null,
      isVerified: property.isVerified,
      analytics: {
        views: property.analytics?.views || 0
      }
    }));

    return res.json({
      success: true,
      data: {
        properties: formattedProperties,
        searchCenter: {
          latitude: parseFloat(latitude as string),
          longitude: parseFloat(longitude as string)
        },
        radius: parseInt(radius as string),
        totalResults: properties.length
      }
    });

  } catch (error) {
    logger.error('Nearby properties search error:', error);
    throw new AppError('Nearby search failed', 500);
  }
});

/**
 * Get available search filters and their options
 */
export const getPropertyFilters = catchAsync(async (_req: Request, res: Response) => {
  try {
    // Get dynamic filter options from database
    const [
      _propertyTypes, // Not used directly, but kept for potential future use
      cities,
      states,
      priceRanges,
      bedroomCounts,
      bathroomCounts
    ] = await Promise.all([
      Property.distinct('propertyType', { status: 'active' }),
      Property.distinct('location.city', { status: 'active' }),
      Property.distinct('location.state', { status: 'active' }),
      Property.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$pricing.rentPerMonth' },
            maxPrice: { $max: '$pricing.rentPerMonth' },
            avgPrice: { $avg: '$pricing.rentPerMonth' }
          }
        }
      ]),
      Property.distinct('bedrooms', { status: 'active' }),
      Property.distinct('bathrooms', { status: 'active' })
    ]);

    const filters = {
      propertyTypes: [
        { value: 'apartment', label: 'Apartment', count: await Property.countDocuments({ propertyType: 'apartment', status: 'active' }) },
        { value: 'house', label: 'House', count: await Property.countDocuments({ propertyType: 'house', status: 'active' }) },
        { value: 'condo', label: 'Condo', count: await Property.countDocuments({ propertyType: 'condo', status: 'active' }) },
        { value: 'studio', label: 'Studio', count: await Property.countDocuments({ propertyType: 'studio', status: 'active' }) },
        { value: 'duplex', label: 'Duplex', count: await Property.countDocuments({ propertyType: 'duplex', status: 'active' }) },
        { value: 'bungalow', label: 'Bungalow', count: await Property.countDocuments({ propertyType: 'bungalow', status: 'active' }) },
        { value: 'mansion', label: 'Mansion', count: await Property.countDocuments({ propertyType: 'mansion', status: 'active' }) }
      ].filter(type => type.count > 0),

      listingTypes: [
        { value: 'rent', label: 'For Rent', count: await Property.countDocuments({ listingType: 'rent', status: 'active' }) },
        { value: 'roommate', label: 'Roommate', count: await Property.countDocuments({ listingType: 'roommate', status: 'active' }) },
        { value: 'sublet', label: 'Sublet', count: await Property.countDocuments({ listingType: 'sublet', status: 'active' }) }
      ].filter(type => type.count > 0),

      locations: {
        cities: cities.sort(),
        states: states.sort()
      },

      priceRange: priceRanges[0] || { minPrice: 0, maxPrice: 1000000, avgPrice: 100000 },

      bedrooms: bedroomCounts.sort((a, b) => a - b),
      bathrooms: bathroomCounts.sort((a, b) => a - b),

      amenities: [
        { key: 'wifi', label: 'WiFi' },
        { key: 'parking', label: 'Parking' },
        { key: 'security', label: 'Security' },
        { key: 'generator', label: 'Generator' },
        { key: 'borehole', label: 'Borehole' },
        { key: 'airConditioning', label: 'Air Conditioning' },
        { key: 'kitchen', label: 'Kitchen' },
        { key: 'refrigerator', label: 'Refrigerator' },
        { key: 'furnished', label: 'Furnished' },
        { key: 'tv', label: 'TV' },
        { key: 'washingMachine', label: 'Washing Machine' },
        { key: 'elevator', label: 'Elevator' },
        { key: 'gym', label: 'Gym' },
        { key: 'swimmingPool', label: 'Swimming Pool' },
        { key: 'playground', label: 'Playground' },
        { key: 'prepaidMeter', label: 'Prepaid Meter' },
        { key: 'cableTV', label: 'Cable TV' },
        { key: 'cleaningService', label: 'Cleaning Service' }
      ],

      sortOptions: [
        { value: 'createdAt', label: 'Newest First' },
        { value: 'pricing.rentPerMonth', label: 'Price: Low to High' },
        { value: 'analytics.views', label: 'Most Popular' },
        { value: 'title', label: 'Alphabetical' }
      ]
    };

    return res.json({
      success: true,
      data: { filters }
    });

  } catch (error) {
    logger.error('Get property filters error:', error);
    throw new AppError('Failed to get filters', 500);
  }
});

/**
 * Get search suggestions based on query
 */
export const getSearchSuggestions = catchAsync(async (req: Request, res: Response) => {
  const { query, type = 'all', limit = 10 } = req.query;

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
      const locations = await Property.aggregate([
        {
          $match: {
            status: 'active',
            $or: [
              { 'location.city': { $regex: searchStr, $options: 'i' } },
              { 'location.state': { $regex: searchStr, $options: 'i' } },
              { 'location.area': { $regex: searchStr, $options: 'i' } }
            ]
          }
        },
        {
          $group: {
            _id: null,
            cities: { $addToSet: '$location.city' },
            states: { $addToSet: '$location.state' },
            areas: { $addToSet: '$location.area' }
          }
        }
      ]);

      suggestions.locations = {
        cities: locations[0]?.cities?.filter((city: string) =>
          city && city.toLowerCase().includes(searchStr.toLowerCase())
        ).slice(0, parseInt(limit as string)) || [],
        states: locations[0]?.states?.filter((state: string) =>
          state && state.toLowerCase().includes(searchStr.toLowerCase())
        ).slice(0, parseInt(limit as string)) || [],
        areas: locations[0]?.areas?.filter((area: string) =>
          area && area.toLowerCase().includes(searchStr.toLowerCase())
        ).slice(0, parseInt(limit as string)) || []
      };
    }

    if (type === 'all' || type === 'properties') {
      // Property title suggestions
      const properties = await Property.find({
        status: 'active',
        title: { $regex: searchStr, $options: 'i' }
      })
      .select('title')
      .limit(parseInt(limit as string))
      .lean();

      suggestions.properties = properties.map(p => p.title);
    }

    return res.json({
      success: true,
      data: { suggestions }
    });

  } catch (error) {
    logger.error('Search suggestions error:', error);
    throw new AppError('Failed to get suggestions', 500);
  }
});

/**
 * Save a search query for later
 */
export const saveSearch = catchAsync(async (req: Request, res: Response) => {
  const { name, searchCriteria, alertFrequency = 'never', isActive = true } = req.body;
  const userId = req.user?._id;

  // TODO: Implement SavedSearch model and logic
  // For now, return a placeholder response

  return res.json({
    success: true,
    message: 'Search saved successfully',
    data: {
      id: new Types.ObjectId(),
      name,
      searchCriteria,
      alertFrequency,
      isActive,
      userId,
      createdAt: new Date()
    }
  });
});

/**
 * Get user's saved searches
 */
export const getSavedSearches = catchAsync(async (_req: Request, res: Response) => {
  // const userId = req.user?._id; // Will be needed when SavedSearch model is implemented

  // TODO: Implement SavedSearch model and logic
  // For now, return empty array

  return res.json({
    success: true,
    data: {
      savedSearches: [],
      total: 0
    }
  });
});

/**
 * Delete a saved search
 */
export const deleteSavedSearch = catchAsync(async (_req: Request, res: Response) => {
  // const { id } = req.params; // Will be needed when SavedSearch model is implemented
  // const userId = req.user?._id; // Will be needed when SavedSearch model is implemented

  // TODO: Implement SavedSearch model and logic
  // For now, return success response

  return res.json({
    success: true,
    message: 'Saved search deleted successfully'
  });
});
