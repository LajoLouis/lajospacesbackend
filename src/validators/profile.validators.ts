import Joi from 'joi';

// Nigerian states for validation
// Nigerian states for validation (currently unused but available for future use)
/*
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];
*/

// Common lifestyle options
const LIFESTYLE_OPTIONS = ['no-smoking', 'smoking-allowed', 'outdoor-only', 'no-preference'];
const DRINKING_OPTIONS = ['no-drinking', 'social-drinking', 'regular-drinking', 'no-preference'];
const PET_OPTIONS = ['no-pets', 'cats-only', 'dogs-only', 'all-pets', 'no-preference'];
const CLEANLINESS_OPTIONS = ['very-clean', 'moderately-clean', 'relaxed', 'no-preference'];
const NOISE_OPTIONS = ['very-quiet', 'moderate', 'lively', 'no-preference'];
const GUEST_OPTIONS = ['no-guests', 'occasional-guests', 'frequent-guests', 'no-preference'];

// Property types
const PROPERTY_TYPES = ['apartment', 'house', 'condo', 'townhouse', 'studio'];
const ROOM_TYPES = ['private-room', 'shared-room', 'master-bedroom', 'any'];
const LEASE_DURATIONS = ['short-term', 'long-term', 'flexible'];

// Gender preferences
const GENDER_PREFERENCES = ['male', 'female', 'any', 'same-gender', 'different-gender'];

/**
 * Update profile validation schema
 */
export const updateProfileSchema = Joi.object({
  bio: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Bio cannot exceed 500 characters'
    }),

  occupation: Joi.string()
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.max': 'Occupation cannot exceed 100 characters'
    }),

  education: Joi.string()
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.max': 'Education cannot exceed 100 characters'
    }),

  languages: Joi.array()
    .items(
      Joi.string()
        .max(50)
        .trim()
        .messages({
          'string.max': 'Language name cannot exceed 50 characters'
        })
    )
    .max(10)
    .optional()
    .messages({
      'array.max': 'Cannot specify more than 10 languages'
    }),

  lifestyle: Joi.object({
    smokingPolicy: Joi.string().valid(...LIFESTYLE_OPTIONS).optional(),
    drinkingPolicy: Joi.string().valid(...DRINKING_OPTIONS).optional(),
    petPolicy: Joi.string().valid(...PET_OPTIONS).optional(),
    cleanlinessLevel: Joi.string().valid(...CLEANLINESS_OPTIONS).optional(),
    noiseLevel: Joi.string().valid(...NOISE_OPTIONS).optional(),
    guestPolicy: Joi.string().valid(...GUEST_OPTIONS).optional()
  }).optional(),

  housingPreferences: Joi.object({
    propertyTypes: Joi.array()
      .items(Joi.string().valid(...PROPERTY_TYPES))
      .max(5)
      .optional()
      .messages({
        'array.max': 'Cannot select more than 5 property types'
      }),

    budgetRange: Joi.object({
      min: Joi.number().min(0).max(10000000).optional(),
      max: Joi.number().min(0).max(10000000).optional()
    }).optional(),

    preferredAreas: Joi.array()
      .items(Joi.string().trim().max(100))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Cannot specify more than 10 preferred areas'
      }),

    moveInDate: Joi.date().min('now').optional(),

    leaseDuration: Joi.string().valid(...LEASE_DURATIONS).optional(),

    roomType: Joi.string().valid(...ROOM_TYPES).optional(),

    amenities: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(20)
      .optional()
      .messages({
        'array.max': 'Cannot specify more than 20 amenities'
      })
  }).optional(),

  roommatePreferences: Joi.object({
    ageRange: Joi.object({
      min: Joi.number().min(18).max(100).optional(),
      max: Joi.number().min(18).max(100).optional()
    }).optional(),

    genderPreference: Joi.string().valid(...GENDER_PREFERENCES).optional(),

    occupationPreference: Joi.array()
      .items(Joi.string().trim().max(100))
      .max(10)
      .optional(),

    lifestyleCompatibility: Joi.object({
      smokingTolerance: Joi.string().valid(...LIFESTYLE_OPTIONS).optional(),
      drinkingTolerance: Joi.string().valid(...DRINKING_OPTIONS).optional(),
      petTolerance: Joi.string().valid(...PET_OPTIONS).optional(),
      cleanlinessExpectation: Joi.string().valid(...CLEANLINESS_OPTIONS).optional(),
      noiseExpectation: Joi.string().valid(...NOISE_OPTIONS).optional(),
      guestTolerance: Joi.string().valid(...GUEST_OPTIONS).optional()
    }).optional()
  }).optional(),

  interests: Joi.array()
    .items(
      Joi.string()
        .max(50)
        .trim()
        .messages({
          'string.max': 'Interest cannot exceed 50 characters'
        })
    )
    .max(20)
    .optional()
    .messages({
      'array.max': 'Cannot specify more than 20 interests'
    }),

  hobbies: Joi.array()
    .items(
      Joi.string()
        .max(50)
        .trim()
        .messages({
          'string.max': 'Hobby cannot exceed 50 characters'
        })
    )
    .max(20)
    .optional()
    .messages({
      'array.max': 'Cannot specify more than 20 hobbies'
    }),

  socialMedia: Joi.object({
    instagram: Joi.string()
      .pattern(/^[a-zA-Z0-9._]+$/)
      .max(30)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid Instagram username',
        'string.max': 'Instagram username cannot exceed 30 characters'
      }),

    facebook: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'Facebook must be a valid URL'
      }),

    linkedin: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'LinkedIn must be a valid URL'
      }),

    twitter: Joi.string()
      .pattern(/^[a-zA-Z0-9_]+$/)
      .max(15)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid Twitter username',
        'string.max': 'Twitter username cannot exceed 15 characters'
      })
  }).optional(),

  privacy: Joi.object({
    showFullName: Joi.boolean().optional(),
    showAge: Joi.boolean().optional(),
    showLocation: Joi.boolean().optional(),
    showOccupation: Joi.boolean().optional(),
    showSocialMedia: Joi.boolean().optional(),
    allowMessagesFromUnmatched: Joi.boolean().optional()
  }).optional()
});

/**
 * Privacy settings validation schema
 */
export const privacySettingsSchema = Joi.object({
  privacy: Joi.object({
    showFullName: Joi.boolean().required(),
    showAge: Joi.boolean().required(),
    showLocation: Joi.boolean().required(),
    showOccupation: Joi.boolean().required(),
    showSocialMedia: Joi.boolean().required(),
    allowMessagesFromUnmatched: Joi.boolean().required()
  }).required()
});

/**
 * Housing preferences validation schema
 */
export const housingPreferencesSchema = Joi.object({
  housingPreferences: Joi.object({
    propertyTypes: Joi.array()
      .items(Joi.string().valid(...PROPERTY_TYPES))
      .min(1)
      .max(5)
      .required()
      .messages({
        'array.min': 'Please select at least one property type',
        'array.max': 'Cannot select more than 5 property types'
      }),

    budgetRange: Joi.object({
      min: Joi.number().min(0).max(10000000).required(),
      max: Joi.number().min(0).max(10000000).required()
    }).required().custom((value, helpers) => {
      if (value.min >= value.max) {
        return helpers.error('budget.range');
      }
      return value;
    }).messages({
      'budget.range': 'Maximum budget must be greater than minimum budget'
    }),

    preferredAreas: Joi.array()
      .items(Joi.string().trim().max(100))
      .min(1)
      .max(10)
      .required()
      .messages({
        'array.min': 'Please specify at least one preferred area',
        'array.max': 'Cannot specify more than 10 preferred areas'
      }),

    moveInDate: Joi.date().min('now').required(),

    leaseDuration: Joi.string().valid(...LEASE_DURATIONS).required(),

    roomType: Joi.string().valid(...ROOM_TYPES).required(),

    amenities: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(20)
      .optional()
      .messages({
        'array.max': 'Cannot specify more than 20 amenities'
      })
  }).required()
});

/**
 * Roommate preferences validation schema
 */
export const roommatePreferencesSchema = Joi.object({
  roommatePreferences: Joi.object({
    ageRange: Joi.object({
      min: Joi.number().min(18).max(100).required(),
      max: Joi.number().min(18).max(100).required()
    }).required().custom((value, helpers) => {
      if (value.min >= value.max) {
        return helpers.error('age.range');
      }
      return value;
    }).messages({
      'age.range': 'Maximum age must be greater than minimum age'
    }),

    genderPreference: Joi.string().valid(...GENDER_PREFERENCES).required(),

    occupationPreference: Joi.array()
      .items(Joi.string().trim().max(100))
      .max(10)
      .optional(),

    lifestyleCompatibility: Joi.object({
      smokingTolerance: Joi.string().valid(...LIFESTYLE_OPTIONS).required(),
      drinkingTolerance: Joi.string().valid(...DRINKING_OPTIONS).required(),
      petTolerance: Joi.string().valid(...PET_OPTIONS).required(),
      cleanlinessExpectation: Joi.string().valid(...CLEANLINESS_OPTIONS).required(),
      noiseExpectation: Joi.string().valid(...NOISE_OPTIONS).required(),
      guestTolerance: Joi.string().valid(...GUEST_OPTIONS).required()
    }).required()
  }).required()
});

/**
 * User ID parameter validation
 */
export const userIdParamSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format'
    })
});

export default {
  updateProfileSchema,
  privacySettingsSchema,
  housingPreferencesSchema,
  roommatePreferencesSchema,
  userIdParamSchema
};
