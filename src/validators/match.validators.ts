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
const LIFESTYLE_OPTIONS = ['yes', 'no', 'occasionally', 'no_preference'];
const LIFESTYLE_EXTENDED = ['love', 'okay', 'rarely', 'never', 'no_preference'];
const SCHEDULE_OPTIONS = ['day_shift', 'night_shift', 'flexible', 'student', 'no_preference'];
const CLEANLINESS_LEVELS = ['very_clean', 'clean', 'average', 'relaxed', 'no_preference'];
const SOCIAL_LEVELS = ['very_social', 'social', 'moderate', 'private', 'no_preference'];
const PREFERENCE_OPTIONS = ['required', 'preferred', 'not_needed'];

/**
 * Swipe match validation schema
 */
export const swipeMatchSchema = Joi.object({
  targetId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/).messages({
    'string.empty': 'Target ID is required',
    'string.pattern.base': 'Target ID must be a valid ObjectId'
  }),
  
  targetType: Joi.string().required().valid('user', 'property').messages({
    'any.only': 'Target type must be either user or property'
  }),
  
  action: Joi.string().required().valid('liked', 'passed', 'super_liked').messages({
    'any.only': 'Action must be liked, passed, or super_liked'
  })
});

/**
 * Update match preferences validation schema
 */
export const updatePreferencesSchema = Joi.object({
  isActive: Joi.boolean().optional(),
  
  maxDistance: Joi.number().min(1).max(1000).optional().messages({
    'number.min': 'Maximum distance must be at least 1 km',
    'number.max': 'Maximum distance cannot exceed 1000 km'
  }),
  
  ageRange: Joi.object({
    min: Joi.number().min(18).max(100).required(),
    max: Joi.number().min(18).max(100).required()
  }).custom((value, helpers) => {
    if (value.min >= value.max) {
      return helpers.error('ageRange.invalid');
    }
    return value;
  }).messages({
    'ageRange.invalid': 'Maximum age must be greater than minimum age'
  }).optional(),
  
  genderPreference: Joi.string().valid('male', 'female', 'any').optional(),
  
  budgetRange: Joi.object({
    min: Joi.number().min(0).required(),
    max: Joi.number().min(0).required()
  }).custom((value, helpers) => {
    if (value.min >= value.max) {
      return helpers.error('budgetRange.invalid');
    }
    return value;
  }).messages({
    'budgetRange.invalid': 'Maximum budget must be greater than minimum budget'
  }).optional(),
  
  budgetFlexibility: Joi.number().min(0).max(100).optional().messages({
    'number.min': 'Budget flexibility cannot be negative',
    'number.max': 'Budget flexibility cannot exceed 100%'
  }),
  
  preferredStates: Joi.array().items(
    Joi.string().valid(...NIGERIAN_STATES)
  ).max(10).optional(),
  
  preferredCities: Joi.array().items(
    Joi.string().trim().max(100)
  ).max(20).optional(),
  
  preferredAreas: Joi.array().items(
    Joi.string().trim().max(100)
  ).max(30).optional(),
  
  locationFlexibility: Joi.number().min(0).max(100).optional(),
  
  lifestyle: Joi.object({
    smoking: Joi.string().valid(...LIFESTYLE_OPTIONS).optional(),
    drinking: Joi.string().valid(...LIFESTYLE_OPTIONS).optional(),
    pets: Joi.string().valid('love', 'okay', 'allergic', 'no_preference').optional(),
    parties: Joi.string().valid(...LIFESTYLE_EXTENDED).optional(),
    guests: Joi.string().valid('frequent', 'occasional', 'rare', 'never', 'no_preference').optional(),
    cleanliness: Joi.string().valid(...CLEANLINESS_LEVELS).optional(),
    noise_level: Joi.string().valid('quiet', 'moderate', 'lively', 'no_preference').optional()
  }).optional(),
  
  schedule: Joi.object({
    work_schedule: Joi.string().valid(...SCHEDULE_OPTIONS).optional(),
    sleep_schedule: Joi.string().valid('early_bird', 'night_owl', 'flexible', 'no_preference').optional(),
    social_level: Joi.string().valid(...SOCIAL_LEVELS).optional()
  }).optional(),
  
  propertyPreferences: Joi.object({
    propertyTypes: Joi.array().items(
      Joi.string().valid(...PROPERTY_TYPES)
    ).max(7).optional(),
    
    amenities: Joi.array().items(
      Joi.string().trim().max(50)
    ).max(20).optional(),
    
    minimumBedrooms: Joi.number().min(0).max(20).optional(),
    minimumBathrooms: Joi.number().min(1).max(20).optional(),
    
    furnished: Joi.string().valid('yes', 'no', 'partial', 'no_preference').optional(),
    parking: Joi.string().valid(...PREFERENCE_OPTIONS).optional(),
    security: Joi.string().valid(...PREFERENCE_OPTIONS).optional()
  }).optional(),
  
  roommatePreferences: Joi.object({
    occupation: Joi.array().items(
      Joi.string().trim().max(100)
    ).max(10).optional(),
    
    education_level: Joi.array().items(
      Joi.string().trim().max(100)
    ).max(10).optional(),
    
    relationship_status: Joi.array().items(
      Joi.string().trim().max(50)
    ).max(5).optional(),
    
    has_children: Joi.string().valid('yes', 'no', 'no_preference').optional(),
    
    religion: Joi.array().items(
      Joi.string().trim().max(50)
    ).max(10).optional(),
    
    languages: Joi.array().items(
      Joi.string().trim().max(50)
    ).max(10).optional()
  }).optional(),
  
  dealBreakers: Joi.array().items(
    Joi.string().trim().max(200)
  ).max(20).optional(),
  
  matchingSettings: Joi.object({
    auto_like_high_compatibility: Joi.boolean().optional(),
    
    compatibility_threshold: Joi.number().min(0).max(100).optional().messages({
      'number.min': 'Compatibility threshold cannot be negative',
      'number.max': 'Compatibility threshold cannot exceed 100'
    }),
    
    daily_match_limit: Joi.number().min(1).max(100).optional().messages({
      'number.min': 'Daily match limit must be at least 1',
      'number.max': 'Daily match limit cannot exceed 100'
    }),
    
    show_distance: Joi.boolean().optional(),
    show_last_active: Joi.boolean().optional()
  }).optional()
});

/**
 * Toggle preferences validation schema
 */
export const togglePreferencesSchema = Joi.object({
  isActive: Joi.boolean().required().messages({
    'any.required': 'isActive field is required',
    'boolean.base': 'isActive must be a boolean value'
  })
});

/**
 * Deal breaker validation schema
 */
export const dealBreakerSchema = Joi.object({
  dealBreaker: Joi.string().required().trim().min(3).max(200).messages({
    'string.empty': 'Deal breaker is required',
    'string.min': 'Deal breaker must be at least 3 characters',
    'string.max': 'Deal breaker cannot exceed 200 characters'
  })
});

/**
 * Match query validation schema
 */
export const matchQuerySchema = Joi.object({
  type: Joi.string().valid('roommate', 'housing', 'both').default('both'),
  limit: Joi.number().min(1).max(100).default(20),
  page: Joi.number().min(1).default(1)
});

/**
 * Match history query validation schema
 */
export const matchHistoryQuerySchema = Joi.object({
  status: Joi.string().valid('all', 'matched', 'pending', 'rejected', 'expired').default('all'),
  type: Joi.string().valid('all', 'roommate', 'housing').default('all'),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sortBy: Joi.string().valid('lastInteractionAt', 'matchedAt', 'compatibilityScore', 'createdAt').default('lastInteractionAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * Preference section validation schema
 */
export const preferenceSectionSchema = Joi.object({
  section: Joi.string().valid(
    'lifestyle', 
    'schedule', 
    'propertyPreferences', 
    'roommatePreferences', 
    'matchingSettings'
  ).required()
});

/**
 * Lifestyle preferences validation schema
 */
export const lifestylePreferencesSchema = Joi.object({
  smoking: Joi.string().valid(...LIFESTYLE_OPTIONS).optional(),
  drinking: Joi.string().valid(...LIFESTYLE_OPTIONS).optional(),
  pets: Joi.string().valid('love', 'okay', 'allergic', 'no_preference').optional(),
  parties: Joi.string().valid(...LIFESTYLE_EXTENDED).optional(),
  guests: Joi.string().valid('frequent', 'occasional', 'rare', 'never', 'no_preference').optional(),
  cleanliness: Joi.string().valid(...CLEANLINESS_LEVELS).optional(),
  noise_level: Joi.string().valid('quiet', 'moderate', 'lively', 'no_preference').optional()
});

/**
 * Schedule preferences validation schema
 */
export const schedulePreferencesSchema = Joi.object({
  work_schedule: Joi.string().valid(...SCHEDULE_OPTIONS).optional(),
  sleep_schedule: Joi.string().valid('early_bird', 'night_owl', 'flexible', 'no_preference').optional(),
  social_level: Joi.string().valid(...SOCIAL_LEVELS).optional()
});

/**
 * Property preferences validation schema
 */
export const propertyPreferencesSchema = Joi.object({
  propertyTypes: Joi.array().items(
    Joi.string().valid(...PROPERTY_TYPES)
  ).max(7).optional(),
  
  amenities: Joi.array().items(
    Joi.string().trim().max(50)
  ).max(20).optional(),
  
  minimumBedrooms: Joi.number().min(0).max(20).optional(),
  minimumBathrooms: Joi.number().min(1).max(20).optional(),
  
  furnished: Joi.string().valid('yes', 'no', 'partial', 'no_preference').optional(),
  parking: Joi.string().valid(...PREFERENCE_OPTIONS).optional(),
  security: Joi.string().valid(...PREFERENCE_OPTIONS).optional()
});

/**
 * Roommate preferences validation schema
 */
export const roommatePreferencesSchema = Joi.object({
  occupation: Joi.array().items(
    Joi.string().trim().max(100)
  ).max(10).optional(),
  
  education_level: Joi.array().items(
    Joi.string().trim().max(100)
  ).max(10).optional(),
  
  relationship_status: Joi.array().items(
    Joi.string().trim().max(50)
  ).max(5).optional(),
  
  has_children: Joi.string().valid('yes', 'no', 'no_preference').optional(),
  
  religion: Joi.array().items(
    Joi.string().trim().max(50)
  ).max(10).optional(),
  
  languages: Joi.array().items(
    Joi.string().trim().max(50)
  ).max(10).optional()
});

/**
 * Matching settings validation schema
 */
export const matchingSettingsSchema = Joi.object({
  auto_like_high_compatibility: Joi.boolean().optional(),
  
  compatibility_threshold: Joi.number().min(0).max(100).optional().messages({
    'number.min': 'Compatibility threshold cannot be negative',
    'number.max': 'Compatibility threshold cannot exceed 100'
  }),
  
  daily_match_limit: Joi.number().min(1).max(100).optional().messages({
    'number.min': 'Daily match limit must be at least 1',
    'number.max': 'Daily match limit cannot exceed 100'
  }),
  
  show_distance: Joi.boolean().optional(),
  show_last_active: Joi.boolean().optional()
});

export default {
  swipeMatchSchema,
  updatePreferencesSchema,
  togglePreferencesSchema,
  dealBreakerSchema,
  matchQuerySchema,
  matchHistoryQuerySchema,
  preferenceSectionSchema,
  lifestylePreferencesSchema,
  schedulePreferencesSchema,
  propertyPreferencesSchema,
  roommatePreferencesSchema,
  matchingSettingsSchema
};
