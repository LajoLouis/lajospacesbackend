import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET
});

// Upload options interface
interface UploadOptions {
  folder?: string;
  transformation?: any[];
  tags?: string[];
  public_id?: string;
  overwrite?: boolean;
}

// Upload result interface
interface UploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  created_at: string;
}

/**
 * Upload image to Cloudinary
 */
export async function uploadImage(
  imageBuffer: Buffer | string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const defaultOptions = {
      folder: 'lajospaces/profiles',
      resource_type: 'image' as const,
      quality: 'auto',
      fetch_format: 'auto',
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto:good' },
        { format: 'auto' }
      ],
      tags: ['profile', 'lajospaces'],
      ...options
    };

    const result = await cloudinary.uploader.upload(
      imageBuffer instanceof Buffer ? `data:image/jpeg;base64,${imageBuffer.toString('base64')}` : imageBuffer as string,
      defaultOptions
    );

    logger.info('Image uploaded to Cloudinary', {
      public_id: result.public_id,
      secure_url: result.secure_url,
      bytes: result.bytes
    });

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      created_at: result.created_at
    };
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Upload profile photo with specific transformations
 */
export async function uploadProfilePhoto(
  imageBuffer: Buffer | string,
  userId: string,
  isPrimary: boolean = false
): Promise<UploadResult> {
  const options: UploadOptions = {
    folder: 'lajospaces/profiles',
    public_id: `user_${userId}_${Date.now()}`,
    transformation: [
      // Create multiple sizes
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good' },
      { format: 'auto' }
    ],
    tags: ['profile', 'user', userId, isPrimary ? 'primary' : 'secondary']
  };

  return uploadImage(imageBuffer, options);
}

/**
 * Upload room/property photo
 */
export async function uploadPropertyPhoto(
  imageBuffer: Buffer | string,
  userId: string,
  propertyId?: string
): Promise<UploadResult> {
  const options: UploadOptions = {
    folder: 'lajospaces/properties',
    public_id: `property_${propertyId || userId}_${Date.now()}`,
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto:good' },
      { format: 'auto' }
    ],
    tags: ['property', 'room', userId, propertyId || 'listing']
  };

  return uploadImage(imageBuffer, options);
}

/**
 * Delete image from Cloudinary
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      logger.info('Image deleted from Cloudinary', { public_id: publicId });
    } else {
      logger.warn('Image deletion failed or image not found', { 
        public_id: publicId, 
        result: result.result 
      });
    }
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete image');
  }
}

/**
 * Generate optimized image URL with transformations
 */
export function generateImageUrl(
  publicId: string,
  transformations: any[] = []
): string {
  try {
    const defaultTransformations = [
      { quality: 'auto:good' },
      { format: 'auto' }
    ];

    return cloudinary.url(publicId, {
      transformation: [...defaultTransformations, ...transformations],
      secure: true
    });
  } catch (error) {
    logger.error('Error generating image URL:', error);
    return '';
  }
}

/**
 * Generate multiple image sizes
 */
export function generateImageSizes(publicId: string): {
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
  original: string;
} {
  return {
    thumbnail: generateImageUrl(publicId, [{ width: 150, height: 150, crop: 'fill' }]),
    small: generateImageUrl(publicId, [{ width: 300, height: 300, crop: 'fill' }]),
    medium: generateImageUrl(publicId, [{ width: 600, height: 600, crop: 'limit' }]),
    large: generateImageUrl(publicId, [{ width: 1200, height: 1200, crop: 'limit' }]),
    original: generateImageUrl(publicId)
  };
}

/**
 * Validate image file
 */
export function validateImageFile(file: any): { isValid: boolean; error?: string } {
  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { isValid: false, error: 'File size must be less than 10MB' };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return { isValid: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
  }

  return { isValid: true };
}

/**
 * Get image metadata
 */
export async function getImageMetadata(publicId: string): Promise<any> {
  try {
    const result = await cloudinary.api.resource(publicId);
    return {
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      created_at: result.created_at,
      secure_url: result.secure_url
    };
  } catch (error) {
    logger.error('Error getting image metadata:', error);
    throw new Error('Failed to get image metadata');
  }
}

/**
 * Bulk delete images
 */
export async function bulkDeleteImages(publicIds: string[]): Promise<void> {
  try {
    if (publicIds.length === 0) return;

    const result = await cloudinary.api.delete_resources(publicIds);
    
    logger.info('Bulk image deletion completed', {
      deleted: Object.keys(result.deleted).length,
      not_found: Object.keys(result.not_found || {}).length
    });
  } catch (error) {
    logger.error('Bulk image deletion error:', error);
    throw new Error('Failed to delete images');
  }
}

/**
 * Search images by tags
 */
export async function searchImagesByTags(tags: string[], maxResults: number = 50): Promise<any[]> {
  try {
    const result = await cloudinary.search
      .expression(`tags:${tags.join(' AND tags:')}`)
      .max_results(maxResults)
      .execute();

    return result.resources;
  } catch (error) {
    logger.error('Image search error:', error);
    throw new Error('Failed to search images');
  }
}

export default {
  uploadImage,
  uploadProfilePhoto,
  uploadPropertyPhoto,
  deleteImage,
  generateImageUrl,
  generateImageSizes,
  validateImageFile,
  getImageMetadata,
  bulkDeleteImages,
  searchImagesByTags
};
