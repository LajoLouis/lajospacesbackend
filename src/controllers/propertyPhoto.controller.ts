import { Request, Response } from 'express';
import { Property } from '../models/Property';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { catchAsync } from '../utils/catchAsync';
import { uploadPropertyPhoto, deleteImage } from '../services/cloudinaryService';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload property photos
 */
export const uploadPropertyPhotos = catchAsync(async (req: Request, res: Response) => {
  const { id: propertyId } = req.params;
  const userId = req.user?._id;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    throw new AppError('No photos provided', 400);
  }

  // Find property and verify ownership
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found', 404);
  }

  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only upload photos to your own properties', 403);
  }

  // Check photo limit (max 20 photos per property)
  const currentPhotoCount = property.photos.length;
  const maxPhotos = 20;
  
  if (currentPhotoCount + files.length > maxPhotos) {
    throw new AppError(`Cannot upload more than ${maxPhotos} photos per property. Current: ${currentPhotoCount}`, 400);
  }

  const uploadedPhotos: any[] = [];
  const uploadPromises = files.map(async (file, index) => {
    try {
      const photoId = uuidv4();
      const { caption, room } = req.body;
      
      // Upload to Cloudinary with property-specific folder
      const uploadResult = await uploadPropertyPhoto(
        file.buffer,
        userId,
        propertyId
      );

      const photoData = {
        id: photoId,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        caption: Array.isArray(caption) ? caption[index] : caption,
        room: Array.isArray(room) ? room[index] : room,
        isPrimary: false, // Will be set separately
        uploadedAt: new Date()
      };

      uploadedPhotos.push(photoData);
      return photoData;
    } catch (error) {
      logger.error(`Failed to upload photo ${index + 1}:`, error);
      throw new AppError(`Failed to upload photo ${index + 1}`, 500);
    }
  });

  await Promise.all(uploadPromises);

  // Add photos to property
  property.photos.push(...uploadedPhotos);

  // If this is the first photo, make it primary
  if (currentPhotoCount === 0 && uploadedPhotos.length > 0) {
    property.photos[0].isPrimary = true;
  }

  property.lastModifiedBy = new Types.ObjectId(userId);
  await property.save();

  logger.info(`Uploaded ${uploadedPhotos.length} photos to property: ${propertyId}`);

  return ApiResponse.success(res, {
    uploadedPhotos,
    totalPhotos: property.photos.length,
    maxPhotos
  }, `Successfully uploaded ${uploadedPhotos.length} photo(s)`, 201);
});

/**
 * Get property photos
 */
export const getPropertyPhotos = catchAsync(async (req: Request, res: Response) => {
  const { id: propertyId } = req.params;

  const property = await Property.findById(propertyId).select('photos');
  if (!property) {
    throw new AppError('Property not found', 404);
  }

  return ApiResponse.success(res, {
    photos: property.photos,
    totalPhotos: property.photos.length,
    primaryPhoto: property.photos.find(photo => photo.isPrimary) || property.photos[0] || null
  }, 'Property photos retrieved successfully');
});

/**
 * Delete a property photo
 */
export const deletePropertyPhoto = catchAsync(async (req: Request, res: Response) => {
  const { id: propertyId, photoId } = req.params;
  const userId = req.user?._id;

  // Find property and verify ownership
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found', 404);
  }

  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only delete photos from your own properties', 403);
  }

  // Find photo
  const photoIndex = property.photos.findIndex(photo => photo.id === photoId);
  if (photoIndex === -1) {
    throw new AppError('Photo not found', 404);
  }

  const photo = property.photos[photoIndex];
  const wasPrimary = photo.isPrimary;

  try {
    // Delete from Cloudinary
    await deleteImage(photo.publicId);
  } catch (error) {
    logger.error(`Failed to delete photo from Cloudinary: ${photo.publicId}`, error);
    // Continue with database deletion even if Cloudinary deletion fails
  }

  // Remove photo from property
  property.photos.splice(photoIndex, 1);

  // If deleted photo was primary, make the first remaining photo primary
  if (wasPrimary && property.photos.length > 0) {
    property.photos[0].isPrimary = true;
  }

  property.lastModifiedBy = new Types.ObjectId(userId);
  await property.save();

  logger.info(`Deleted photo ${photoId} from property: ${propertyId}`);

  return ApiResponse.success(res, {
    deletedPhotoId: photoId,
    remainingPhotos: property.photos.length
  }, 'Photo deleted successfully');
});

/**
 * Set primary photo
 */
export const setPrimaryPhoto = catchAsync(async (req: Request, res: Response) => {
  const { id: propertyId, photoId } = req.params;
  const userId = req.user?._id;

  // Find property and verify ownership
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found', 404);
  }

  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only modify photos of your own properties', 403);
  }

  // Find photo
  const photo = property.photos.find(photo => photo.id === photoId);
  if (!photo) {
    throw new AppError('Photo not found', 404);
  }

  // Remove primary status from all photos
  property.photos.forEach(photo => {
    photo.isPrimary = false;
  });

  // Set new primary photo
  photo.isPrimary = true;

  property.lastModifiedBy = new Types.ObjectId(userId);
  await property.save();

  logger.info(`Set primary photo ${photoId} for property: ${propertyId}`);

  return ApiResponse.success(res, {
    primaryPhoto: photo,
    propertyId
  }, 'Primary photo updated successfully');
});

/**
 * Reorder property photos
 */
export const reorderPropertyPhotos = catchAsync(async (req: Request, res: Response) => {
  const { id: propertyId } = req.params;
  const { photoOrder } = req.body;
  const userId = req.user?._id;

  // Find property and verify ownership
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found', 404);
  }

  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only reorder photos of your own properties', 403);
  }

  // Validate photo order
  if (!Array.isArray(photoOrder) || photoOrder.length !== property.photos.length) {
    throw new AppError('Photo order must include all existing photos', 400);
  }

  // Verify all photo IDs exist
  const existingPhotoIds = property.photos.map(photo => photo.id);
  const missingIds = photoOrder.filter(id => !existingPhotoIds.includes(id));
  const extraIds = existingPhotoIds.filter(id => !photoOrder.includes(id));

  if (missingIds.length > 0 || extraIds.length > 0) {
    throw new AppError('Photo order contains invalid photo IDs', 400);
  }

  // Reorder photos
  const reorderedPhotos = photoOrder.map(photoId => {
    return property.photos.find(photo => photo.id === photoId)!;
  });

  property.photos = reorderedPhotos;
  property.lastModifiedBy = new Types.ObjectId(userId);
  await property.save();

  logger.info(`Reordered photos for property: ${propertyId}`);

  return ApiResponse.success(res, {
    photos: property.photos,
    newOrder: photoOrder
  }, 'Photos reordered successfully');
});

/**
 * Update photo details (caption, room)
 */
export const updatePhotoDetails = catchAsync(async (req: Request, res: Response) => {
  const { id: propertyId, photoId } = req.params;
  const { caption, room } = req.body;
  const userId = req.user?._id;

  // Find property and verify ownership
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found', 404);
  }

  if (property.ownerId.toString() !== userId) {
    throw new AppError('You can only update photos of your own properties', 403);
  }

  // Find photo
  const photo = property.photos.find(photo => photo.id === photoId);
  if (!photo) {
    throw new AppError('Photo not found', 404);
  }

  // Update photo details
  if (caption !== undefined) {
    photo.caption = caption;
  }
  if (room !== undefined) {
    photo.room = room;
  }

  property.lastModifiedBy = new Types.ObjectId(userId);
  await property.save();

  logger.info(`Updated photo details ${photoId} for property: ${propertyId}`);

  return ApiResponse.success(res, {
    photo,
    propertyId
  }, 'Photo details updated successfully');
});

/**
 * Get photo upload guidelines
 */
export const getPhotoGuidelines = catchAsync(async (_req: Request, res: Response) => {
  return ApiResponse.success(res, {
    guidelines: {
      maxPhotos: 20,
      maxFileSize: '10MB',
      allowedFormats: ['JPEG', 'PNG', 'WebP'],
      recommendedSize: '1200x800 pixels',
      tips: [
        'Use high-quality, well-lit photos',
        'Include photos of all rooms and common areas',
        'Show the property\'s best features',
        'Include exterior and interior shots',
        'Avoid blurry or dark images',
        'Take photos from multiple angles',
        'Include amenities like kitchen, bathroom, parking',
        'Show the neighborhood and nearby landmarks'
      ]
    },
    requirements: {
      minPhotos: 1,
      primaryPhotoRequired: true,
      roomLabelsRecommended: true
    },
    roomSuggestions: [
      'living room',
      'bedroom',
      'kitchen',
      'bathroom',
      'dining room',
      'balcony',
      'exterior',
      'parking',
      'compound',
      'neighborhood'
    ]
  }, 'Photo upload guidelines retrieved successfully');
});
