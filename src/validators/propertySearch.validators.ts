import Joi from 'joi';

// Nigerian states for validation
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

// Property types and enums
const PROPERTY_TYPES = ['apartment', 'house', 'condo', 'studio', 'duplex', 'bungalow', 'mansion'];
const LISTING_TYPES = ['rent', 'roommate', 'sublet'];
const SORT_OPTIONS = ['createdAt', 'updatedAt', 'pricing.rentPerMonth', 'analytics.views', 'title', 'bedrooms', 'bathrooms'];
const SORT_ORDERS = ['asc', 'desc'];

/**
 * Advanced property search validation schema
 */
export const searchPropertiesSchema = Joi.object({
  // Text search
  query: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Search query cannot exceed 200 characters'
  }),
  
  // Property filters
  propertyType: Joi.alternatives().try(
    Joi.string().valid(...PROPERTY_TYPES),
    Joi.array().items(Joi.string().valid(...PROPERTY_TYPES)).max(5)
  ).optional(),
  
  listingType: Joi.alternatives().try(
    Joi.string().valid(...LISTING_TYPES),
    Joi.array().items(Joi.string().valid(...LISTING_TYPES)).max(3)
  ).optional(),
  
  // Price filters
  minPrice: Joi.number().min(0).max(10000000).optional().messages({
    'number.min': 'Minimum price cannot be negative',
    'number.max': 'Minimum price cannot exceed ₦10,000,000'
  }),
  
  maxPrice: Joi.number().min(0).max(10000000).optional().messages({
    'number.min': 'Maximum price cannot be negative',
    'number.max': 'Maximum price cannot exceed ₦10,000,000'
  }),
  
  // Room filters
  bedrooms: Joi.alternatives().try(
    Joi.number().min(0).max(20),
    Joi.object({
      min: Joi.number().min(0).max(20).optional(),
      max: Joi.number().min(0).max(20).optional()
    })
  ).optional(),
  
  bathrooms: Joi.alternatives().try(
    Joi.number().min(1).max(20),
    Joi.object({
      min: Joi.number().min(1).max(20).optional(),
      max: Joi.number().min(1).max(20).optional()
    })
  ).optional(),
  
  // Location filters
  location: Joi.object({
    city: Joi.string().trim().max(100).optional(),
    state: Joi.string().valid(...NIGERIAN_STATES).optional(),
    area: Joi.string().trim().max(100).optional(),
    coordinates: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      radius: Joi.number().min(100).max(50000).default(5000) // in meters
    }).optional()
  }).optional(),
  
  // Amenities filters
  amenities: Joi.object({
    wifi: Joi.boolean().optional(),
    parking: Joi.boolean().optional(),
    security: Joi.boolean().optional(),
    generator: Joi.boolean().optional(),
    borehole: Joi.boolean().optional(),
    airConditioning: Joi.boolean().optional(),
    kitchen: Joi.boolean().optional(),
    refrigerator: Joi.boolean().optional(),
    furnished: Joi.boolean().optional(),
    tv: Joi.boolean().optional(),
    washingMachine: Joi.boolean().optional(),
    elevator: Joi.boolean().optional(),
    gym: Joi.boolean().optional(),
    swimmingPool: Joi.boolean().optional(),
    playground: Joi.boolean().optional(),
    prepaidMeter: Joi.boolean().optional(),
    cableTV: Joi.boolean().optional(),
    cleaningService: Joi.boolean().optional()
  }).optional(),
  
  // Rules filters
  rules: Joi.object({
    smokingAllowed: Joi.boolean().optional(),
    petsAllowed: Joi.boolean().optional(),
    partiesAllowed: Joi.boolean().optional(),
    guestsAllowed: Joi.boolean().optional()
  }).optional(),
  
  // Availability filters
  availableFrom: Joi.date().min('now').optional().messages({
    'date.min': 'Available from date cannot be in the past'
  }),
  
  availableTo: Joi.date().optional(),
  
  // Roommate preferences (for roommate listings)
  roommatePreferences: Joi.object({
    gender: Joi.string().valid('male', 'female', 'any').optional(),
    ageRange: Joi.object({
      min: Joi.number().min(18).max(100).optional(),
      max: Joi.number().min(18).max(100).optional()
    }).optional()
  }).optional(),
  
  // Pagination and sorting
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sortBy: Joi.string().valid(...SORT_OPTIONS).default('createdAt'),
  sortOrder: Joi.string().valid(...SORT_ORDERS).default('desc'),
  
  // Advanced filters
  isVerified: Joi.boolean().optional(),
  hasPhotos: Joi.boolean().optional(),
  ownerType: Joi.string().valid('individual', 'agent', 'company').optional(),
  
  // Date filters
  createdAfter: Joi.date().optional(),
  createdBefore: Joi.date().optional(),
  updatedAfter: Joi.date().optional(),
  updatedBefore: Joi.date().optional()
  
}).custom((value, helpers) => {
  // Validate price range
  if (value.minPrice && value.maxPrice && value.minPrice > value.maxPrice) {
    return helpers.error('custom.invalidPriceRange');
  }
  
  // Validate bedroom range
  if (value.bedrooms && typeof value.bedrooms === 'object' && value.bedrooms.min && value.bedrooms.max) {
    if (value.bedrooms.min > value.bedrooms.max) {
      return helpers.error('custom.invalidBedroomRange');
    }
  }
  
  // Validate bathroom range
  if (value.bathrooms && typeof value.bathrooms === 'object' && value.bathrooms.min && value.bathrooms.max) {
    if (value.bathrooms.min > value.bathrooms.max) {
      return helpers.error('custom.invalidBathroomRange');
    }
  }
  
  // Validate date ranges
  if (value.availableFrom && value.availableTo && value.availableFrom > value.availableTo) {
    return helpers.error('custom.invalidAvailabilityRange');
  }
  
  if (value.createdAfter && value.createdBefore && value.createdAfter > value.createdBefore) {
    return helpers.error('custom.invalidCreatedDateRange');
  }
  
  if (value.updatedAfter && value.updatedBefore && value.updatedAfter > value.updatedBefore) {
    return helpers.error('custom.invalidUpdatedDateRange');
  }
  
  return value;
}).messages({
  'custom.invalidPriceRange': 'Minimum price cannot be greater than maximum price',
  'custom.invalidBedroomRange': 'Minimum bedrooms cannot be greater than maximum bedrooms',
  'custom.invalidBathroomRange': 'Minimum bathrooms cannot be greater than maximum bathrooms',
  'custom.invalidAvailabilityRange': 'Available from date cannot be after available to date',
  'custom.invalidCreatedDateRange': 'Created after date cannot be after created before date',
  'custom.invalidUpdatedDateRange': 'Updated after date cannot be after updated before date'
});

/**
 * Nearby properties validation schema
 */
export const nearbyPropertiesSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Latitude must be between -90 and 90',
    'number.max': 'Latitude must be between -90 and 90',
    'any.required': 'Latitude is required'
  }),
  
  longitude: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Longitude must be between -180 and 180',
    'number.max': 'Longitude must be between -180 and 180',
    'any.required': 'Longitude is required'
  }),
  
  radius: Joi.number().min(100).max(50000).default(5000).messages({
    'number.min': 'Radius must be at least 100 meters',
    'number.max': 'Radius cannot exceed 50 kilometers'
  }),
  
  propertyType: Joi.alternatives().try(
    Joi.string().valid(...PROPERTY_TYPES),
    Joi.array().items(Joi.string().valid(...PROPERTY_TYPES))
  ).optional(),
  
  listingType: Joi.alternatives().try(
    Joi.string().valid(...LISTING_TYPES),
    Joi.array().items(Joi.string().valid(...LISTING_TYPES))
  ).optional(),
  
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  
  limit: Joi.number().min(1).max(100).default(20),
  sortBy: Joi.string().valid('distance', 'price', 'createdAt', 'views').default('distance')
});

/**
 * Save search validation schema
 */
export const saveSearchSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'Search name is required',
    'string.min': 'Search name must be at least 3 characters',
    'string.max': 'Search name cannot exceed 100 characters',
    'any.required': 'Search name is required'
  }),
  
  searchCriteria: searchPropertiesSchema.required().messages({
    'any.required': 'Search criteria is required'
  }),
  
  alertFrequency: Joi.string().valid('immediate', 'daily', 'weekly', 'never').default('never'),
  
  isActive: Joi.boolean().default(true)
});

/**
 * Search suggestions validation schema
 */
export const searchSuggestionsSchema = Joi.object({
  query: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Search query is required',
    'string.min': 'Search query must be at least 2 characters',
    'string.max': 'Search query cannot exceed 100 characters',
    'any.required': 'Search query is required'
  }),
  
  type: Joi.string().valid('all', 'locations', 'properties', 'amenities').default('all'),
  
  limit: Joi.number().min(1).max(20).default(10)
});

export default {
  searchPropertiesSchema,
  nearbyPropertiesSchema,
  saveSearchSchema,
  searchSuggestionsSchema
};
