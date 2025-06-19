import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { 
  validateUploadedFile, 
  validateUploadedFiles, 
  extractFileMetadata,
  performSecurityCheck 
} from '../middleware/upload';
import { 
  optimizeImage, 
  generateImageSizes, 
  compressForWeb,
  extractImageMetadata,
  validateImageIntegrity 
} from '../services/imageOptimizationService';
import {
  uploadImage,
  uploadProfilePhoto,
  uploadPropertyPhoto,
  uploadMessageAttachment,
  bulkUploadImages as cloudinaryBulkUpload,
  deleteImage,
  generateImageSizes as generateCloudinarySizes,
  generateSignedUploadUrl
} from '../services/cloudinaryService';

/**
 * Upload single image
 */
export const uploadSingleImage = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const file = req.file;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!file) {
    throw new AppError('No file uploaded', 400);
  }

  // Validate file
  validateUploadedFile(file, 'image');

  // Security check
  const isSecure = await performSecurityCheck(file);
  if (!isSecure) {
    throw new AppError('File failed security validation', 400);
  }

  // Validate image integrity
  const isValid = await validateImageIntegrity(file.buffer);
  if (!isValid) {
    throw new AppError('Invalid or corrupted image file', 400);
  }

  // Optimize image
  const optimizedBuffer = await compressForWeb(file.buffer);

  // Upload to Cloudinary
  const uploadResult = await uploadImage(optimizedBuffer, {
    folder: 'lajospaces/uploads',
    tags: ['upload', userId.toString()]
  });

  // Extract metadata
  const metadata = await extractImageMetadata(optimizedBuffer);

  logger.info('Single image uploaded successfully', {
    userId,
    publicId: uploadResult.public_id,
    originalSize: file.size,
    optimizedSize: optimizedBuffer.length
  });

  return res.status(201).json({
    success: true,
    data: {
      upload: uploadResult,
      metadata,
      sizes: generateCloudinarySizes(uploadResult.public_id)
    },
    message: 'Image uploaded successfully'
  });
});

/**
 * Upload profile avatar
 */
export const uploadAvatar = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const file = req.file;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!file) {
    throw new AppError('No avatar file uploaded', 400);
  }

  // Validate file
  validateUploadedFile(file, 'avatar');

  // Security check
  const isSecure = await performSecurityCheck(file);
  if (!isSecure) {
    throw new AppError('Avatar file failed security validation', 400);
  }

  // Optimize for avatar (square crop, face detection)
  const optimizedBuffer = await optimizeImage(file.buffer, {
    width: 400,
    height: 400,
    crop: 'cover',
    quality: 85,
    format: 'auto',
    removeMetadata: true
  });

  // Upload to Cloudinary with avatar-specific settings
  const uploadResult = await uploadProfilePhoto(optimizedBuffer, userId.toString(), true);

  logger.info('Avatar uploaded successfully', {
    userId,
    publicId: uploadResult.public_id
  });

  return res.status(201).json({
    success: true,
    data: {
      avatar: uploadResult,
      sizes: generateCloudinarySizes(uploadResult.public_id)
    },
    message: 'Avatar uploaded successfully'
  });
});

/**
 * Upload property photos
 */
export const uploadPropertyPhotos = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const files = req.files as Express.Multer.File[];
  const { propertyId } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!files || files.length === 0) {
    throw new AppError('No property photos uploaded', 400);
  }

  // Validate files
  validateUploadedFiles(files, 'property');

  // Security check for all files
  for (const file of files) {
    const isSecure = await performSecurityCheck(file);
    if (!isSecure) {
      throw new AppError(`File ${file.originalname} failed security validation`, 400);
    }
  }

  // Process and upload images
  const uploadPromises = files.map(async (file, index) => {
    try {
      // Optimize for property photos
      const optimizedBuffer = await optimizeImage(file.buffer, {
        width: 1200,
        height: 800,
        crop: 'inside',
        quality: 85,
        format: 'auto',
        removeMetadata: true,
        sharpen: true
      });

      // Upload to Cloudinary
      const uploadResult = await uploadPropertyPhoto(
        optimizedBuffer, 
        userId.toString(), 
        propertyId
      );

      return {
        index,
        originalName: file.originalname,
        upload: uploadResult,
        sizes: generateCloudinarySizes(uploadResult.public_id)
      };
    } catch (error) {
      logger.error(`Error uploading property photo ${index}:`, error);
      return {
        index,
        originalName: file.originalname,
        error: (error as Error).message
      };
    }
  });

  const results = await Promise.all(uploadPromises);
  const successful = results.filter(result => !result.error);
  const failed = results.filter(result => result.error);

  logger.info('Property photos upload completed', {
    userId,
    propertyId,
    total: files.length,
    successful: successful.length,
    failed: failed.length
  });

  return res.status(201).json({
    success: true,
    data: {
      uploads: successful,
      failed: failed.length > 0 ? failed : undefined,
      summary: {
        total: files.length,
        successful: successful.length,
        failed: failed.length
      }
    },
    message: `${successful.length} of ${files.length} property photos uploaded successfully`
  });
});

/**
 * Upload message attachment
 */
export const uploadMessageAttachment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const file = req.file;
  const { conversationId } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!file) {
    throw new AppError('No attachment uploaded', 400);
  }

  if (!conversationId) {
    throw new AppError('Conversation ID is required', 400);
  }

  // Validate conversation ID
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new AppError('Invalid conversation ID', 400);
  }

  // Security check
  const isSecure = await performSecurityCheck(file);
  if (!isSecure) {
    throw new AppError('File failed security validation', 400);
  }

  let processedBuffer = file.buffer;

  // Optimize if it's an image
  if (file.mimetype.startsWith('image/')) {
    processedBuffer = await optimizeImage(file.buffer, {
      width: 800,
      height: 600,
      crop: 'inside',
      quality: 80,
      format: 'auto',
      removeMetadata: true
    });
  }

  // Upload to Cloudinary
  const uploadResult = await uploadMessageAttachment(
    processedBuffer,
    file.mimetype,
    userId.toString(),
    conversationId
  );

  const metadata = extractFileMetadata(file);

  logger.info('Message attachment uploaded successfully', {
    userId,
    conversationId,
    publicId: uploadResult.public_id,
    fileType: file.mimetype
  });

  return res.status(201).json({
    success: true,
    data: {
      attachment: uploadResult,
      metadata,
      sizes: file.mimetype.startsWith('image/') ? 
        generateCloudinarySizes(uploadResult.public_id) : undefined
    },
    message: 'Attachment uploaded successfully'
  });
});

/**
 * Bulk upload images
 */
export const bulkUploadImages = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const files = req.files as Express.Multer.File[];
  const { folder = 'lajospaces/bulk' } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!files || files.length === 0) {
    throw new AppError('No files uploaded', 400);
  }

  if (files.length > 20) {
    throw new AppError('Maximum 20 files allowed for bulk upload', 400);
  }

  // Validate all files
  validateUploadedFiles(files, 'image');

  // Process files for bulk upload
  const processedFiles = await Promise.all(
    files.map(async (file) => {
      // Security check
      const isSecure = await performSecurityCheck(file);
      if (!isSecure) {
        throw new AppError(`File ${file.originalname} failed security validation`, 400);
      }

      // Optimize image
      const optimizedBuffer = await compressForWeb(file.buffer);

      return {
        buffer: optimizedBuffer,
        options: {
          tags: ['bulk', userId.toString(), 'upload']
        }
      };
    })
  );

  // Bulk upload to Cloudinary
  const uploadResults = await cloudinaryBulkUpload(processedFiles, folder);

  logger.info('Bulk upload completed', {
    userId,
    folder,
    total: files.length,
    successful: uploadResults.length
  });

  return res.status(201).json({
    success: true,
    data: {
      uploads: uploadResults.map(result => ({
        upload: result,
        sizes: generateCloudinarySizes(result.public_id)
      })),
      summary: {
        total: files.length,
        successful: uploadResults.length,
        failed: files.length - uploadResults.length
      }
    },
    message: `${uploadResults.length} of ${files.length} images uploaded successfully`
  });
});

/**
 * Delete uploaded image
 */
export const deleteUploadedImage = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { publicId } = req.params;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!publicId) {
    throw new AppError('Public ID is required', 400);
  }

  // Delete from Cloudinary
  await deleteImage(publicId);

  logger.info('Image deleted successfully', {
    userId,
    publicId
  });

  return res.json({
    success: true,
    message: 'Image deleted successfully'
  });
});

/**
 * Generate signed upload URL for direct client uploads
 */
export const generateUploadUrl = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { folder = 'lajospaces/direct', tags = [] } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const uploadUrl = generateSignedUploadUrl(
    folder,
    [...tags, userId.toString()]
  );

  return res.json({
    success: true,
    data: {
      uploadUrl: uploadUrl.url,
      signature: uploadUrl.signature,
      timestamp: uploadUrl.timestamp,
      cloudName: config.CLOUDINARY_CLOUD_NAME,
      apiKey: config.CLOUDINARY_API_KEY
    },
    message: 'Signed upload URL generated successfully'
  });
});
