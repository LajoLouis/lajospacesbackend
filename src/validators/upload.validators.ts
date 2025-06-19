import Joi from 'joi';

/**
 * Upload single image validation schema
 */
export const uploadImageSchema = Joi.object({
  folder: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Folder name must be at least 1 character',
      'string.max': 'Folder name cannot exceed 100 characters'
    }),
  
  tags: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .max(10)
    .optional()
    .messages({
      'array.max': 'Maximum 10 tags allowed',
      'string.min': 'Tag must be at least 1 character',
      'string.max': 'Tag cannot exceed 50 characters'
    }),
  
  quality: Joi.number()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.min': 'Quality must be at least 1',
      'number.max': 'Quality cannot exceed 100'
    }),
  
  width: Joi.number()
    .min(1)
    .max(4000)
    .optional()
    .messages({
      'number.min': 'Width must be at least 1 pixel',
      'number.max': 'Width cannot exceed 4000 pixels'
    }),
  
  height: Joi.number()
    .min(1)
    .max(4000)
    .optional()
    .messages({
      'number.min': 'Height must be at least 1 pixel',
      'number.max': 'Height cannot exceed 4000 pixels'
    })
});

/**
 * Upload avatar validation schema
 */
export const uploadAvatarSchema = Joi.object({
  isPrimary: Joi.boolean()
    .default(true)
    .optional()
    .messages({
      'boolean.base': 'isPrimary must be a boolean value'
    })
});

/**
 * Upload property photos validation schema
 */
export const uploadPropertyPhotosSchema = Joi.object({
  propertyId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid property ID format'
    }),
  
  isMainPhoto: Joi.boolean()
    .default(false)
    .optional()
    .messages({
      'boolean.base': 'isMainPhoto must be a boolean value'
    }),
  
  photoType: Joi.string()
    .valid('exterior', 'interior', 'kitchen', 'bathroom', 'bedroom', 'living_room', 'other')
    .default('other')
    .optional()
    .messages({
      'any.only': 'Invalid photo type'
    }),
  
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    })
});

/**
 * Upload message attachment validation schema
 */
export const uploadMessageAttachmentSchema = Joi.object({
  conversationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid conversation ID format',
      'any.required': 'Conversation ID is required'
    }),
  
  messageType: Joi.string()
    .valid('image', 'document', 'video', 'audio')
    .default('image')
    .optional()
    .messages({
      'any.only': 'Invalid message type'
    }),
  
  caption: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Caption cannot exceed 1000 characters'
    })
});

/**
 * Bulk upload validation schema
 */
export const bulkUploadSchema = Joi.object({
  folder: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .default('lajospaces/bulk')
    .optional()
    .messages({
      'string.min': 'Folder name must be at least 1 character',
      'string.max': 'Folder name cannot exceed 100 characters'
    }),
  
  tags: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .max(10)
    .optional()
    .messages({
      'array.max': 'Maximum 10 tags allowed',
      'string.min': 'Tag must be at least 1 character',
      'string.max': 'Tag cannot exceed 50 characters'
    }),
  
  optimizeForWeb: Joi.boolean()
    .default(true)
    .optional()
    .messages({
      'boolean.base': 'optimizeForWeb must be a boolean value'
    }),
  
  generateThumbnails: Joi.boolean()
    .default(true)
    .optional()
    .messages({
      'boolean.base': 'generateThumbnails must be a boolean value'
    })
});

/**
 * Generate upload URL validation schema
 */
export const generateUploadUrlSchema = Joi.object({
  folder: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .default('lajospaces/direct')
    .optional()
    .messages({
      'string.min': 'Folder name must be at least 1 character',
      'string.max': 'Folder name cannot exceed 100 characters'
    }),
  
  tags: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .max(10)
    .optional()
    .messages({
      'array.max': 'Maximum 10 tags allowed',
      'string.min': 'Tag must be at least 1 character',
      'string.max': 'Tag cannot exceed 50 characters'
    }),
  
  maxFileSize: Joi.number()
    .min(1024) // 1KB minimum
    .max(50 * 1024 * 1024) // 50MB maximum
    .default(10 * 1024 * 1024) // 10MB default
    .optional()
    .messages({
      'number.min': 'Maximum file size must be at least 1KB',
      'number.max': 'Maximum file size cannot exceed 50MB'
    }),
  
  allowedFormats: Joi.array()
    .items(Joi.string().valid('jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'mp4', 'mov'))
    .min(1)
    .default(['jpg', 'jpeg', 'png', 'webp'])
    .optional()
    .messages({
      'array.min': 'At least one format must be allowed',
      'any.only': 'Invalid file format'
    }),
  
  transformation: Joi.object({
    width: Joi.number().min(1).max(4000).optional(),
    height: Joi.number().min(1).max(4000).optional(),
    crop: Joi.string().valid('scale', 'fit', 'limit', 'mfit', 'fill', 'lfill', 'pad', 'lpad', 'mpad', 'crop', 'thumb', 'imagga_crop', 'imagga_scale').optional(),
    quality: Joi.string().valid('auto', 'auto:best', 'auto:good', 'auto:eco', 'auto:low').default('auto:good').optional(),
    format: Joi.string().valid('auto', 'jpg', 'png', 'webp', 'gif').default('auto').optional()
  }).optional()
});

/**
 * File metadata validation schema
 */
export const fileMetadataSchema = Joi.object({
  originalName: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .required()
    .messages({
      'string.min': 'Original filename must be at least 1 character',
      'string.max': 'Original filename cannot exceed 255 characters',
      'any.required': 'Original filename is required'
    }),
  
  mimeType: Joi.string()
    .pattern(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid MIME type format',
      'any.required': 'MIME type is required'
    }),
  
  size: Joi.number()
    .min(1)
    .max(100 * 1024 * 1024) // 100MB max
    .required()
    .messages({
      'number.min': 'File size must be at least 1 byte',
      'number.max': 'File size cannot exceed 100MB',
      'any.required': 'File size is required'
    }),
  
  encoding: Joi.string()
    .trim()
    .optional()
});

/**
 * Image optimization options validation schema
 */
export const imageOptimizationSchema = Joi.object({
  width: Joi.number()
    .min(1)
    .max(4000)
    .optional()
    .messages({
      'number.min': 'Width must be at least 1 pixel',
      'number.max': 'Width cannot exceed 4000 pixels'
    }),
  
  height: Joi.number()
    .min(1)
    .max(4000)
    .optional()
    .messages({
      'number.min': 'Height must be at least 1 pixel',
      'number.max': 'Height cannot exceed 4000 pixels'
    }),
  
  quality: Joi.number()
    .min(1)
    .max(100)
    .default(85)
    .optional()
    .messages({
      'number.min': 'Quality must be at least 1',
      'number.max': 'Quality cannot exceed 100'
    }),
  
  format: Joi.string()
    .valid('jpeg', 'png', 'webp', 'auto')
    .default('auto')
    .optional()
    .messages({
      'any.only': 'Invalid image format'
    }),
  
  crop: Joi.string()
    .valid('cover', 'contain', 'fill', 'inside', 'outside')
    .default('cover')
    .optional()
    .messages({
      'any.only': 'Invalid crop mode'
    }),
  
  background: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      'string.pattern.base': 'Background must be a valid hex color'
    }),
  
  blur: Joi.number()
    .min(0.3)
    .max(1000)
    .optional()
    .messages({
      'number.min': 'Blur must be at least 0.3',
      'number.max': 'Blur cannot exceed 1000'
    }),
  
  sharpen: Joi.boolean()
    .default(false)
    .optional(),
  
  grayscale: Joi.boolean()
    .default(false)
    .optional(),
  
  removeMetadata: Joi.boolean()
    .default(true)
    .optional()
});

/**
 * Cloudinary upload options validation schema
 */
export const cloudinaryOptionsSchema = Joi.object({
  folder: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
  
  public_id: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .pattern(/^[a-zA-Z0-9_\-\/]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Public ID can only contain letters, numbers, underscores, hyphens, and forward slashes'
    }),
  
  tags: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .max(10)
    .optional(),
  
  overwrite: Joi.boolean()
    .default(false)
    .optional(),
  
  transformation: Joi.array()
    .items(Joi.object())
    .max(10)
    .optional()
    .messages({
      'array.max': 'Maximum 10 transformations allowed'
    })
});

export default {
  uploadImageSchema,
  uploadAvatarSchema,
  uploadPropertyPhotosSchema,
  uploadMessageAttachmentSchema,
  bulkUploadSchema,
  generateUploadUrlSchema,
  fileMetadataSchema,
  imageOptimizationSchema,
  cloudinaryOptionsSchema
};
