import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { performSecurityValidation } from '../services/fileSecurityService';

// File type validation
const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const allowedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  document: 5 * 1024 * 1024, // 5MB
  video: 50 * 1024 * 1024, // 50MB
  avatar: 2 * 1024 * 1024, // 2MB for profile pictures
  property: 15 * 1024 * 1024 // 15MB for property photos
};

// Multer configuration for memory storage
const storage = multer.memoryStorage();

// File filter function
const createFileFilter = (allowedTypes: string[], maxSize: number) => {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      return cb(error as any, false);
    }

    // File size will be checked by multer limits
    cb(null, true);
  };
};

// Generic upload middleware factory
const createUploadMiddleware = (
  fieldName: string,
  allowedTypes: string[],
  maxSize: number,
  maxCount: number = 1
) => {
  return multer({
    storage,
    limits: {
      fileSize: maxSize,
      files: maxCount
    },
    fileFilter: createFileFilter(allowedTypes, maxSize)
  });
};

// Specific upload middlewares
export const uploadSingleImage = createUploadMiddleware(
  'image',
  allowedImageTypes,
  FILE_SIZE_LIMITS.image,
  1
).single('image');

export const uploadMultipleImages = createUploadMiddleware(
  'images',
  allowedImageTypes,
  FILE_SIZE_LIMITS.image,
  10
).array('images', 10);

export const uploadAvatar = createUploadMiddleware(
  'avatar',
  allowedImageTypes,
  FILE_SIZE_LIMITS.avatar,
  1
).single('avatar');

export const uploadPropertyPhotos = createUploadMiddleware(
  'photos',
  allowedImageTypes,
  FILE_SIZE_LIMITS.property,
  20
).array('photos', 20);

export const uploadDocument = createUploadMiddleware(
  'document',
  allowedDocumentTypes,
  FILE_SIZE_LIMITS.document,
  1
).single('document');

export const uploadVideo = createUploadMiddleware(
  'video',
  allowedVideoTypes,
  FILE_SIZE_LIMITS.video,
  1
).single('video');

// Mixed upload for messages (image, document, or video)
export const uploadMessageFile = multer({
  storage,
  limits: {
    fileSize: FILE_SIZE_LIMITS.image, // Use image limit as default
    files: 1
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allAllowedTypes = [...allowedImageTypes, ...allowedDocumentTypes, ...allowedVideoTypes];
    
    if (!allAllowedTypes.includes(file.mimetype)) {
      const error = new Error(`Invalid file type. Allowed types: ${allAllowedTypes.join(', ')}`);
      return cb(error as any, false);
    }

    // Adjust size limit based on file type
    let sizeLimit = FILE_SIZE_LIMITS.image;
    if (allowedDocumentTypes.includes(file.mimetype)) {
      sizeLimit = FILE_SIZE_LIMITS.document;
    } else if (allowedVideoTypes.includes(file.mimetype)) {
      sizeLimit = FILE_SIZE_LIMITS.video;
    }

    // Note: We can't dynamically change multer limits here, so we'll check in the route handler
    cb(null, true);
  }
}).single('file');

// Error handling middleware for multer errors
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    let statusCode = 400;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts in multipart form';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        break;
      default:
        message = error.message || 'File upload error';
    }

    logger.error('Multer upload error:', {
      code: error.code,
      message: error.message,
      field: error.field
    });

    return res.status(statusCode).json({
      success: false,
      message,
      error: {
        code: error.code,
        field: error.field
      }
    });
  }

  // Handle other upload-related errors
  if (error.message && error.message.includes('Invalid file type')) {
    logger.error('File type validation error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  // Pass other errors to the global error handler
  next(error);
};

// File validation helper
export const validateUploadedFile = (file: Express.Multer.File, type: 'image' | 'document' | 'video' | 'avatar' | 'property') => {
  if (!file) {
    throw new AppError('No file uploaded', 400);
  }

  // Check file size based on type
  const sizeLimit = FILE_SIZE_LIMITS[type];
  if (file.size > sizeLimit) {
    throw new AppError(`File size exceeds limit of ${Math.round(sizeLimit / (1024 * 1024))}MB`, 400);
  }

  // Check file type based on type
  let allowedTypes: string[];
  switch (type) {
    case 'image':
    case 'avatar':
    case 'property':
      allowedTypes = allowedImageTypes;
      break;
    case 'document':
      allowedTypes = allowedDocumentTypes;
      break;
    case 'video':
      allowedTypes = allowedVideoTypes;
      break;
    default:
      allowedTypes = allowedImageTypes;
  }

  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`, 400);
  }

  return true;
};

// File metadata extractor
export const extractFileMetadata = (file: Express.Multer.File) => {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    encoding: file.encoding,
    fieldName: file.fieldname
  };
};

// Bulk file validation
export const validateUploadedFiles = (files: Express.Multer.File[], type: 'image' | 'document' | 'video' | 'property') => {
  if (!files || files.length === 0) {
    throw new AppError('No files uploaded', 400);
  }

  const maxFiles = type === 'property' ? 20 : 10;
  if (files.length > maxFiles) {
    throw new AppError(`Too many files. Maximum ${maxFiles} files allowed`, 400);
  }

  files.forEach((file, index) => {
    try {
      validateUploadedFile(file, type);
    } catch (error) {
      throw new AppError(`File ${index + 1}: ${(error as AppError).message}`, 400);
    }
  });

  return true;
};

// Comprehensive security check using the security service
export const performSecurityCheck = async (file: Express.Multer.File): Promise<boolean> => {
  try {
    const securityResult = await performSecurityValidation(file);

    if (!securityResult.isSecure) {
      logger.warn('File failed comprehensive security validation:', {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        issues: securityResult.issues,
        warnings: securityResult.warnings
      });
      return false;
    }

    // Log warnings but allow the file
    if (securityResult.warnings.length > 0) {
      logger.warn('File security warnings:', {
        filename: file.originalname,
        warnings: securityResult.warnings
      });
    }

    return true;
  } catch (error) {
    logger.error('Security check error:', error);
    return false;
  }
};

export default {
  uploadSingleImage,
  uploadMultipleImages,
  uploadAvatar,
  uploadPropertyPhotos,
  uploadDocument,
  uploadVideo,
  uploadMessageFile,
  handleUploadError,
  validateUploadedFile,
  validateUploadedFiles,
  extractFileMetadata,
  performSecurityCheck
};
