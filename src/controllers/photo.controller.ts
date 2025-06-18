import { Request, Response, NextFunction } from 'express';
import { AppError, catchAsync } from '../middleware/errorHandler';
import { logger, logHelpers } from '../utils/logger';
import Profile from '../models/Profile.model';
import { uploadProfilePhoto, deleteImage, generateImageSizes, validateImageFile } from '../services/cloudinaryService';

/**
 * Upload profile photo
 */
export const uploadPhoto = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  if (!req.file) {
    throw new AppError('No image file provided', 400, true, 'NO_FILE');
  }

  // Validate image file
  const validation = validateImageFile(req.file);
  if (!validation.isValid) {
    throw new AppError(validation.error!, 400, true, 'INVALID_FILE');
  }

  const profile = await Profile.findOne({ userId: req.user.userId });
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  // Check photo limit (max 6 photos)
  if (profile.photos.length >= 6) {
    throw new AppError('Maximum 6 photos allowed', 400, true, 'PHOTO_LIMIT_EXCEEDED');
  }

  try {
    // Upload to Cloudinary
    const isPrimary = profile.photos.length === 0; // First photo is primary
    const uploadResult = await uploadProfilePhoto(req.file.buffer, req.user.userId, isPrimary);

    // Add photo to profile
    profile.addPhoto(uploadResult.secure_url, uploadResult.public_id);
    await profile.save();

    // Generate different sizes
    const imageSizes = generateImageSizes(uploadResult.public_id);

    logHelpers.userAction(req.user.userId, 'photo_uploaded', {
      photoId: uploadResult.public_id,
      isPrimary,
      totalPhotos: profile.photos.length
    });

    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        photo: {
          id: uploadResult.public_id,
          url: uploadResult.secure_url,
          sizes: imageSizes,
          isPrimary,
          uploadedAt: new Date()
        },
        totalPhotos: profile.photos.length,
        profileCompleteness: profile.calculateCompleteness()
      }
    });

  } catch (error) {
    logger.error('Photo upload error:', error);
    throw new AppError('Failed to upload photo', 500, true, 'UPLOAD_FAILED');
  }
});

/**
 * Delete profile photo
 */
export const deletePhoto = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const { photoId } = req.params;

  const profile = await Profile.findOne({ userId: req.user.userId });
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  // Find photo
  const photo = profile.photos.find(p => p.publicId === photoId);
  if (!photo) {
    throw new AppError('Photo not found', 404, true, 'PHOTO_NOT_FOUND');
  }

  try {
    // Delete from Cloudinary
    await deleteImage(photoId);

    // Remove from profile
    profile.removePhoto(photoId);
    await profile.save();

    logHelpers.userAction(req.user.userId, 'photo_deleted', {
      photoId,
      remainingPhotos: profile.photos.length
    });

    res.json({
      success: true,
      message: 'Photo deleted successfully',
      data: {
        remainingPhotos: profile.photos.length,
        profileCompleteness: profile.calculateCompleteness()
      }
    });

  } catch (error) {
    logger.error('Photo deletion error:', error);
    throw new AppError('Failed to delete photo', 500, true, 'DELETE_FAILED');
  }
});

/**
 * Set primary photo
 */
export const setPrimaryPhoto = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const { photoId } = req.params;

  const profile = await Profile.findOne({ userId: req.user.userId });
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  // Find photo
  const photo = profile.photos.find(p => p.publicId === photoId);
  if (!photo) {
    throw new AppError('Photo not found', 404, true, 'PHOTO_NOT_FOUND');
  }

  // Set as primary
  profile.setPrimaryPhoto(photoId);
  await profile.save();

  logHelpers.userAction(req.user.userId, 'primary_photo_changed', { photoId });

  res.json({
    success: true,
    message: 'Primary photo updated successfully',
    data: {
      primaryPhoto: profile.photos.find(p => p.isPrimary) || profile.photos[0] || null
    }
  });
});

/**
 * Get all user photos
 */
export const getPhotos = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const profile = await Profile.findOne({ userId: req.user.userId });
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  // Generate different sizes for each photo
  const photosWithSizes = profile.photos.map(photo => ({
    id: photo.publicId,
    url: photo.url,
    sizes: generateImageSizes(photo.publicId),
    isPrimary: photo.isPrimary,
    uploadedAt: photo.uploadedAt
  }));

  res.json({
    success: true,
    data: {
      photos: photosWithSizes,
      totalPhotos: profile.photos.length,
      maxPhotos: 6,
      primaryPhoto: profile.photos.find(p => p.isPrimary) || profile.photos[0] || null
    }
  });
});

/**
 * Reorder photos
 */
export const reorderPhotos = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const { photoOrder } = req.body; // Array of photo IDs in desired order

  if (!Array.isArray(photoOrder)) {
    throw new AppError('Photo order must be an array', 400, true, 'INVALID_ORDER');
  }

  const profile = await Profile.findOne({ userId: req.user.userId });
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  // Validate that all photo IDs exist
  const existingPhotoIds = profile.photos.map(p => p.publicId);
  const invalidIds = photoOrder.filter(id => !existingPhotoIds.includes(id));
  
  if (invalidIds.length > 0) {
    throw new AppError('Invalid photo IDs provided', 400, true, 'INVALID_PHOTO_IDS');
  }

  if (photoOrder.length !== profile.photos.length) {
    throw new AppError('Photo order must include all photos', 400, true, 'INCOMPLETE_ORDER');
  }

  // Reorder photos
  const reorderedPhotos = photoOrder.map(photoId => 
    profile.photos.find(p => p.publicId === photoId)!
  );

  profile.photos = reorderedPhotos;
  await profile.save();

  logHelpers.userAction(req.user.userId, 'photos_reordered', { newOrder: photoOrder });

  res.json({
    success: true,
    message: 'Photos reordered successfully',
    data: {
      photos: profile.photos.map(photo => ({
        id: photo.publicId,
        url: photo.url,
        isPrimary: photo.isPrimary,
        uploadedAt: photo.uploadedAt
      }))
    }
  });
});

/**
 * Get photo upload guidelines
 */
export const getUploadGuidelines = catchAsync(async (_req: Request, res: Response, _next: NextFunction) => {
  res.json({
    success: true,
    data: {
      guidelines: {
        maxPhotos: 6,
        maxFileSize: '10MB',
        allowedFormats: ['JPEG', 'PNG', 'WebP'],
        recommendedSize: '800x800 pixels',
        tips: [
          'Use clear, well-lit photos',
          'Include at least one face photo',
          'Show your personality and interests',
          'Avoid group photos as your primary photo',
          'Keep photos recent (within 2 years)'
        ]
      },
      requirements: {
        minPhotos: 1,
        primaryPhotoRequired: true,
        facePhotoRecommended: true
      }
    }
  });
});

export default {
  uploadPhoto,
  deletePhoto,
  setPrimaryPhoto,
  getPhotos,
  reorderPhotos,
  getUploadGuidelines
};
