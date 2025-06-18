import Joi from 'joi';

// Nigerian states for validation
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

// Property types
const PROPERTY_TYPES = ['apartment', 'house', 'condo', 'studio', 'duplex', 'bungalow', 'mansion'];
const LISTING_TYPES = ['rent', 'roommate', 'sublet'];
const OWNER_TYPES = ['individual', 'agent', 'company'];
const PAYMENT_FREQUENCIES = ['monthly', 'quarterly', 'biannually', 'annually'];
const PROPERTY_STATUSES = ['draft', 'active', 'inactive', 'rented', 'suspended'];

// Location schema
const locationSchema = Joi.object({
  address: Joi.string().trim().max(300).required().messages({
    'string.empty': 'Address is required',
    'string.max': 'Address cannot exceed 300 characters'
  }),
  city: Joi.string().trim().max(100).required().messages({
    'string.empty': 'City is required',
    'string.max': 'City cannot exceed 100 characters'
  }),
  state: Joi.string().valid(...NIGERIAN_STATES).required().messages({
    'any.only': 'Please select a valid Nigerian state',
    'any.required': 'State is required'
  }),
  country: Joi.string().valid('Nigeria').default('Nigeria'),
  area: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Area cannot exceed 100 characters'
  }),
  landmark: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Landmark cannot exceed 200 characters'
  }),
  coordinates: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).required().messages({
      'array.length': 'Coordinates must contain exactly 2 numbers [longitude, latitude]'
    })
  }).optional()
});

// Pricing schema
const pricingSchema = Joi.object({
  rentPerMonth: Joi.number().min(1000).max(10000000).required().messages({
    'number.min': 'Rent must be at least ₦1,000',
    'number.max': 'Rent cannot exceed ₦10,000,000',
    'any.required': 'Monthly rent is required'
  }),
  securityDeposit: Joi.number().min(0).required().messages({
    'number.min': 'Security deposit cannot be negative',
    'any.required': 'Security deposit is required'
  }),
  agentFee: Joi.number().min(0).default(0),
  legalFee: Joi.number().min(0).default(0),
  cautionFee: Joi.number().min(0).default(0),
  serviceCharge: Joi.number().min(0).default(0),
  electricityIncluded: Joi.boolean().default(false),
  waterIncluded: Joi.boolean().default(false),
  internetIncluded: Joi.boolean().default(false),
  paymentFrequency: Joi.string().valid(...PAYMENT_FREQUENCIES).default('annually'),
  advancePayment: Joi.number().min(1).max(24).default(12).messages({
    'number.min': 'Advance payment must be at least 1 month',
    'number.max': 'Advance payment cannot exceed 24 months'
  })
});

// Amenities schema
const amenitiesSchema = Joi.object({
  // Basic amenities
  wifi: Joi.boolean().default(false),
  parking: Joi.boolean().default(false),
  security: Joi.boolean().default(false),
  generator: Joi.boolean().default(false),
  borehole: Joi.boolean().default(false),
  airConditioning: Joi.boolean().default(false),
  
  // Kitchen amenities
  kitchen: Joi.boolean().default(true),
  refrigerator: Joi.boolean().default(false),
  microwave: Joi.boolean().default(false),
  gasStove: Joi.boolean().default(false),
  
  // Living amenities
  furnished: Joi.boolean().default(false),
  tv: Joi.boolean().default(false),
  washingMachine: Joi.boolean().default(false),
  
  // Building amenities
  elevator: Joi.boolean().default(false),
  gym: Joi.boolean().default(false),
  swimmingPool: Joi.boolean().default(false),
  playground: Joi.boolean().default(false),
  
  // Utilities
  prepaidMeter: Joi.boolean().default(false),
  cableTV: Joi.boolean().default(false),
  cleaningService: Joi.boolean().default(false)
});

// Rules schema
const rulesSchema = Joi.object({
  smokingAllowed: Joi.boolean().default(false),
  petsAllowed: Joi.boolean().default(false),
  partiesAllowed: Joi.boolean().default(false),
  guestsAllowed: Joi.boolean().default(true),
  curfew: Joi.string().trim().optional(),
  minimumStay: Joi.number().min(1).max(24).optional().messages({
    'number.min': 'Minimum stay must be at least 1 month',
    'number.max': 'Minimum stay cannot exceed 24 months'
  }),
  maximumOccupants: Joi.number().min(1).max(20).required().messages({
    'number.min': 'Maximum occupants must be at least 1',
    'number.max': 'Maximum occupants cannot exceed 20',
    'any.required': 'Maximum occupants is required'
  })
});

// Roommate preferences schema
const roommatePreferencesSchema = Joi.object({
  gender: Joi.string().valid('male', 'female', 'any').default('any'),
  ageRange: Joi.object({
    min: Joi.number().min(18).max(100).default(18),
    max: Joi.number().min(18).max(100).default(65)
  }).default({ min: 18, max: 65 }),
  occupation: Joi.array().items(Joi.string().trim()).default([]),
  lifestyle: Joi.object({
    smoking: Joi.boolean().default(false),
    drinking: Joi.boolean().default(false),
    pets: Joi.boolean().default(false),
    parties: Joi.boolean().default(false)
  }).default({})
});

/**
 * Create property validation schema
 */
export const createPropertySchema = Joi.object({
  title: Joi.string().trim().min(10).max(200).required().messages({
    'string.empty': 'Property title is required',
    'string.min': 'Title must be at least 10 characters',
    'string.max': 'Title cannot exceed 200 characters'
  }),
  description: Joi.string().trim().min(50).max(2000).required().messages({
    'string.empty': 'Property description is required',
    'string.min': 'Description must be at least 50 characters',
    'string.max': 'Description cannot exceed 2000 characters'
  }),
  propertyType: Joi.string().valid(...PROPERTY_TYPES).required().messages({
    'any.only': 'Please select a valid property type',
    'any.required': 'Property type is required'
  }),
  listingType: Joi.string().valid(...LISTING_TYPES).required().messages({
    'any.only': 'Please select a valid listing type',
    'any.required': 'Listing type is required'
  }),
  ownerType: Joi.string().valid(...OWNER_TYPES).default('individual'),
  
  // Property details
  bedrooms: Joi.number().min(0).max(20).required().messages({
    'number.min': 'Bedrooms cannot be negative',
    'number.max': 'Bedrooms cannot exceed 20',
    'any.required': 'Number of bedrooms is required'
  }),
  bathrooms: Joi.number().min(1).max(20).required().messages({
    'number.min': 'Must have at least 1 bathroom',
    'number.max': 'Bathrooms cannot exceed 20',
    'any.required': 'Number of bathrooms is required'
  }),
  totalRooms: Joi.number().min(1).max(50).required().messages({
    'number.min': 'Must have at least 1 room',
    'number.max': 'Total rooms cannot exceed 50',
    'any.required': 'Total number of rooms is required'
  }),
  floorArea: Joi.number().min(10).max(10000).optional().messages({
    'number.min': 'Floor area must be at least 10 square meters',
    'number.max': 'Floor area cannot exceed 10,000 square meters'
  }),
  floor: Joi.number().min(0).max(100).optional(),
  totalFloors: Joi.number().min(1).max(100).optional(),
  yearBuilt: Joi.number().min(1900).max(new Date().getFullYear() + 5).optional(),
  
  // Required schemas
  location: locationSchema.required(),
  pricing: pricingSchema.required(),
  amenities: amenitiesSchema.default({}),
  rules: rulesSchema.required(),
  
  // Optional schemas
  roommatePreferences: roommatePreferencesSchema.optional(),
  
  // Availability
  isAvailable: Joi.boolean().default(true),
  availableFrom: Joi.date().min('now').required().messages({
    'date.min': 'Available from date cannot be in the past',
    'any.required': 'Available from date is required'
  }),
  availableTo: Joi.date().min(Joi.ref('availableFrom')).optional().messages({
    'date.min': 'Available to date must be after available from date'
  }),
  
  // Tags and keywords
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10).default([]).messages({
    'array.max': 'Cannot have more than 10 tags'
  })
});

/**
 * Update property validation schema
 */
export const updatePropertySchema = Joi.object({
  title: Joi.string().trim().min(10).max(200).optional(),
  description: Joi.string().trim().min(50).max(2000).optional(),
  propertyType: Joi.string().valid(...PROPERTY_TYPES).optional(),
  listingType: Joi.string().valid(...LISTING_TYPES).optional(),
  ownerType: Joi.string().valid(...OWNER_TYPES).optional(),
  
  // Property details
  bedrooms: Joi.number().min(0).max(20).optional(),
  bathrooms: Joi.number().min(1).max(20).optional(),
  totalRooms: Joi.number().min(1).max(50).optional(),
  floorArea: Joi.number().min(10).max(10000).optional(),
  floor: Joi.number().min(0).max(100).optional(),
  totalFloors: Joi.number().min(1).max(100).optional(),
  yearBuilt: Joi.number().min(1900).max(new Date().getFullYear() + 5).optional(),
  
  // Optional schemas
  location: locationSchema.optional(),
  pricing: pricingSchema.optional(),
  amenities: amenitiesSchema.optional(),
  rules: rulesSchema.optional(),
  roommatePreferences: roommatePreferencesSchema.optional(),
  
  // Availability
  isAvailable: Joi.boolean().optional(),
  availableFrom: Joi.date().min('now').optional(),
  availableTo: Joi.date().optional(),
  
  // Status
  status: Joi.string().valid(...PROPERTY_STATUSES).optional(),
  
  // Tags
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional()
});

/**
 * Property query validation schema (for GET /properties)
 */
export const propertyQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  propertyType: Joi.string().valid(...PROPERTY_TYPES).optional(),
  listingType: Joi.string().valid(...LISTING_TYPES).optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  bedrooms: Joi.number().min(0).max(20).optional(),
  bathrooms: Joi.number().min(1).max(20).optional(),
  city: Joi.string().trim().max(100).optional(),
  state: Joi.string().valid(...NIGERIAN_STATES).optional(),
  area: Joi.string().trim().max(100).optional(),
  amenities: Joi.string().optional(), // Comma-separated list
  status: Joi.string().valid(...PROPERTY_STATUSES).default('active'),
  sortBy: Joi.string().valid(
    'createdAt', 'updatedAt', 'pricing.rentPerMonth', 'analytics.views',
    'bedrooms', 'bathrooms', 'title'
  ).default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().trim().max(200).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(100).max(50000).default(5000) // in meters
});

/**
 * Search properties validation schema (for POST /properties/search)
 */
export const searchPropertiesSchema = Joi.object({
  query: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Search query cannot exceed 200 characters'
  }),
  propertyType: Joi.string().valid(...PROPERTY_TYPES).optional(),
  listingType: Joi.string().valid(...LISTING_TYPES).optional(),
  minPrice: Joi.number().min(0).optional().messages({
    'number.min': 'Minimum price cannot be negative'
  }),
  maxPrice: Joi.number().min(0).optional().messages({
    'number.min': 'Maximum price cannot be negative'
  }),
  bedrooms: Joi.number().min(0).max(20).optional(),
  bathrooms: Joi.number().min(1).max(20).optional(),
  location: Joi.object({
    city: Joi.string().trim().max(100).optional(),
    state: Joi.string().valid(...NIGERIAN_STATES).optional(),
    area: Joi.string().trim().max(100).optional()
  }).optional(),
  amenities: Joi.array().items(Joi.string().trim()).optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20)
}).custom((value, helpers) => {
  // Validate price range
  if (value.minPrice && value.maxPrice && value.minPrice > value.maxPrice) {
    return helpers.error('custom.invalidPriceRange');
  }
  return value;
}).messages({
  'custom.invalidPriceRange': 'Minimum price cannot be greater than maximum price'
});

/**
 * Property photo validation schema
 */
export const propertyPhotoSchema = Joi.object({
  caption: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Photo caption cannot exceed 200 characters'
  }),
  room: Joi.string().trim().max(50).optional().messages({
    'string.max': 'Room name cannot exceed 50 characters'
  }),
  isPrimary: Joi.boolean().default(false)
});

/**
 * Property photo reorder validation schema
 */
export const reorderPhotosSchema = Joi.object({
  photoOrder: Joi.array().items(Joi.string().trim()).min(1).required().messages({
    'array.min': 'Photo order must contain at least one photo ID',
    'any.required': 'Photo order is required'
  })
});

/**
 * Property analytics query validation schema
 */
export const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional().messages({
    'date.min': 'End date must be after start date'
  }),
  groupBy: Joi.string().valid('day', 'week', 'month').default('day')
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
  limit: Joi.number().min(1).max(100).default(20)
});

/**
 * Property favorites validation schema
 */
export const favoritePropertySchema = Joi.object({
  propertyId: Joi.string().trim().required().messages({
    'string.empty': 'Property ID is required',
    'any.required': 'Property ID is required'
  })
});

/**
 * Property inquiry validation schema
 */
export const propertyInquirySchema = Joi.object({
  message: Joi.string().trim().min(10).max(1000).required().messages({
    'string.empty': 'Inquiry message is required',
    'string.min': 'Message must be at least 10 characters',
    'string.max': 'Message cannot exceed 1000 characters',
    'any.required': 'Inquiry message is required'
  }),
  contactPreference: Joi.string().valid('email', 'phone', 'both').default('email'),
  moveInDate: Joi.date().min('now').optional().messages({
    'date.min': 'Move-in date cannot be in the past'
  }),
  additionalInfo: Joi.string().trim().max(500).optional().messages({
    'string.max': 'Additional information cannot exceed 500 characters'
  })
});

/**
 * Property application validation schema
 */
export const propertyApplicationSchema = Joi.object({
  coverLetter: Joi.string().trim().min(50).max(2000).required().messages({
    'string.empty': 'Cover letter is required',
    'string.min': 'Cover letter must be at least 50 characters',
    'string.max': 'Cover letter cannot exceed 2000 characters',
    'any.required': 'Cover letter is required'
  }),
  moveInDate: Joi.date().min('now').required().messages({
    'date.min': 'Move-in date cannot be in the past',
    'any.required': 'Preferred move-in date is required'
  }),
  leaseDuration: Joi.number().min(1).max(24).required().messages({
    'number.min': 'Lease duration must be at least 1 month',
    'number.max': 'Lease duration cannot exceed 24 months',
    'any.required': 'Preferred lease duration is required'
  }),
  monthlyIncome: Joi.number().min(0).optional().messages({
    'number.min': 'Monthly income cannot be negative'
  }),
  employmentStatus: Joi.string().valid(
    'employed', 'self-employed', 'student', 'unemployed', 'retired'
  ).optional(),
  references: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().max(100).required(),
      relationship: Joi.string().trim().max(100).required(),
      phoneNumber: Joi.string().trim().required(),
      email: Joi.string().email().optional()
    })
  ).max(3).optional().messages({
    'array.max': 'Cannot provide more than 3 references'
  }),
  additionalInfo: Joi.string().trim().max(1000).optional().messages({
    'string.max': 'Additional information cannot exceed 1000 characters'
  })
});
