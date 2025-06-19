import sharp from 'sharp';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';

// Image optimization options
interface OptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'auto';
  crop?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  background?: string;
  blur?: number;
  sharpen?: boolean;
  grayscale?: boolean;
  removeMetadata?: boolean;
}

// Predefined image sizes for different use cases
export const IMAGE_SIZES = {
  avatar: {
    thumbnail: { width: 50, height: 50, crop: 'cover' as const },
    small: { width: 100, height: 100, crop: 'cover' as const },
    medium: { width: 200, height: 200, crop: 'cover' as const },
    large: { width: 400, height: 400, crop: 'cover' as const }
  },
  property: {
    thumbnail: { width: 300, height: 200, crop: 'cover' as const },
    small: { width: 600, height: 400, crop: 'cover' as const },
    medium: { width: 1200, height: 800, crop: 'cover' as const },
    large: { width: 1920, height: 1280, crop: 'inside' as const },
    hero: { width: 2400, height: 1600, crop: 'cover' as const }
  },
  message: {
    thumbnail: { width: 150, height: 150, crop: 'cover' as const },
    preview: { width: 400, height: 300, crop: 'inside' as const },
    full: { width: 1200, height: 900, crop: 'inside' as const }
  },
  document: {
    preview: { width: 200, height: 260, crop: 'inside' as const }
  }
};

// Quality settings for different use cases
export const QUALITY_SETTINGS = {
  thumbnail: 70,
  preview: 80,
  standard: 85,
  high: 90,
  lossless: 100
};

/**
 * Optimize image with Sharp
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  options: OptimizationOptions = {}
): Promise<Buffer> {
  try {
    let pipeline = sharp(inputBuffer);

    // Get image metadata
    const metadata = await pipeline.metadata();
    logger.info('Processing image:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: inputBuffer.length
    });

    // Remove metadata if requested (default: true for privacy)
    if (options.removeMetadata !== false) {
      pipeline = pipeline.withMetadata({});
    }

    // Resize image if dimensions specified
    if (options.width || options.height) {
      const resizeOptions: sharp.ResizeOptions = {
        width: options.width,
        height: options.height,
        fit: options.crop || 'cover',
        withoutEnlargement: true
      };

      if (options.background) {
        resizeOptions.background = options.background;
      }

      pipeline = pipeline.resize(resizeOptions);
    }

    // Apply filters
    if (options.blur) {
      pipeline = pipeline.blur(options.blur);
    }

    if (options.sharpen) {
      pipeline = pipeline.sharpen();
    }

    if (options.grayscale) {
      pipeline = pipeline.grayscale();
    }

    // Set output format and quality
    const format = options.format || 'auto';
    const quality = options.quality || QUALITY_SETTINGS.standard;

    if (format === 'jpeg' || (format === 'auto' && metadata.format !== 'png')) {
      pipeline = pipeline.jpeg({
        quality,
        progressive: true,
        mozjpeg: true
      });
    } else if (format === 'png') {
      pipeline = pipeline.png({
        compressionLevel: 9
      });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({
        quality,
        effort: 6
      });
    }

    const optimizedBuffer = await pipeline.toBuffer();

    logger.info('Image optimization completed:', {
      originalSize: inputBuffer.length,
      optimizedSize: optimizedBuffer.length,
      compressionRatio: ((inputBuffer.length - optimizedBuffer.length) / inputBuffer.length * 100).toFixed(2) + '%'
    });

    return optimizedBuffer;
  } catch (error) {
    logger.error('Image optimization error:', error);
    throw new AppError('Failed to optimize image', 500);
  }
}

/**
 * Generate multiple image sizes
 */
export async function generateImageSizes(
  inputBuffer: Buffer,
  sizeCategory: 'avatar' | 'property' | 'message' | 'document'
): Promise<{ [key: string]: Buffer }> {
  try {
    const sizes = IMAGE_SIZES[sizeCategory];
    const results: { [key: string]: Buffer } = {};

    for (const [sizeName, sizeOptions] of Object.entries(sizes)) {
      const optimizedBuffer = await optimizeImage(inputBuffer, {
        ...sizeOptions,
        quality: QUALITY_SETTINGS.standard,
        format: 'auto',
        removeMetadata: true
      });

      results[sizeName] = optimizedBuffer;
    }

    return results;
  } catch (error) {
    logger.error('Error generating image sizes:', error);
    throw new AppError('Failed to generate image sizes', 500);
  }
}

/**
 * Create image thumbnail
 */
export async function createThumbnail(
  inputBuffer: Buffer,
  width: number = 200,
  height: number = 200
): Promise<Buffer> {
  return optimizeImage(inputBuffer, {
    width,
    height,
    crop: 'cover',
    quality: QUALITY_SETTINGS.thumbnail,
    format: 'jpeg',
    removeMetadata: true
  });
}

/**
 * Compress image for web
 */
export async function compressForWeb(
  inputBuffer: Buffer,
  maxWidth: number = 1200,
  quality: number = QUALITY_SETTINGS.standard
): Promise<Buffer> {
  try {
    const metadata = await sharp(inputBuffer).metadata();
    
    // Only resize if image is larger than maxWidth
    const shouldResize = metadata.width && metadata.width > maxWidth;
    
    return optimizeImage(inputBuffer, {
      width: shouldResize ? maxWidth : undefined,
      quality,
      format: 'auto',
      removeMetadata: true,
      sharpen: true
    });
  } catch (error) {
    logger.error('Web compression error:', error);
    throw new AppError('Failed to compress image for web', 500);
  }
}

/**
 * Create progressive JPEG
 */
export async function createProgressiveJPEG(
  inputBuffer: Buffer,
  quality: number = QUALITY_SETTINGS.standard
): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();
  } catch (error) {
    logger.error('Progressive JPEG creation error:', error);
    throw new AppError('Failed to create progressive JPEG', 500);
  }
}

/**
 * Convert to WebP format
 */
export async function convertToWebP(
  inputBuffer: Buffer,
  quality: number = QUALITY_SETTINGS.standard
): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      .webp({
        quality,
        effort: 6
      })
      .toBuffer();
  } catch (error) {
    logger.error('WebP conversion error:', error);
    throw new AppError('Failed to convert to WebP', 500);
  }
}

/**
 * Extract image metadata
 */
export async function extractImageMetadata(inputBuffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  colorSpace: string;
  density?: number;
}> {
  try {
    const metadata = await sharp(inputBuffer).metadata();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: inputBuffer.length,
      hasAlpha: metadata.hasAlpha || false,
      colorSpace: metadata.space || 'unknown',
      density: metadata.density
    };
  } catch (error) {
    logger.error('Metadata extraction error:', error);
    throw new AppError('Failed to extract image metadata', 500);
  }
}

/**
 * Validate image integrity
 */
export async function validateImageIntegrity(inputBuffer: Buffer): Promise<boolean> {
  try {
    // Try to process the image with Sharp
    const metadata = await sharp(inputBuffer).metadata();
    
    // Basic validation checks
    if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
      return false;
    }

    if (!metadata.format || !['jpeg', 'png', 'webp', 'gif', 'tiff', 'svg'].includes(metadata.format)) {
      return false;
    }

    // Try to create a small thumbnail to ensure the image can be processed
    await sharp(inputBuffer)
      .resize(50, 50)
      .jpeg({ quality: 50 })
      .toBuffer();

    return true;
  } catch (error) {
    logger.warn('Image integrity validation failed:', error);
    return false;
  }
}

/**
 * Auto-orient image based on EXIF data
 */
export async function autoOrientImage(inputBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .toBuffer();
  } catch (error) {
    logger.error('Auto-orientation error:', error);
    throw new AppError('Failed to auto-orient image', 500);
  }
}

/**
 * Remove sensitive metadata from image
 */
export async function sanitizeImage(inputBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      .withMetadata({}) // Remove EXIF and other metadata
      .toBuffer();
  } catch (error) {
    logger.error('Image sanitization error:', error);
    throw new AppError('Failed to sanitize image', 500);
  }
}

/**
 * Batch process images
 */
export async function batchOptimizeImages(
  images: { buffer: Buffer; options?: OptimizationOptions }[]
): Promise<Buffer[]> {
  try {
    const promises = images.map(({ buffer, options }) => 
      optimizeImage(buffer, options)
    );

    return await Promise.all(promises);
  } catch (error) {
    logger.error('Batch optimization error:', error);
    throw new AppError('Failed to batch optimize images', 500);
  }
}

export default {
  optimizeImage,
  generateImageSizes,
  createThumbnail,
  compressForWeb,
  createProgressiveJPEG,
  convertToWebP,
  extractImageMetadata,
  validateImageIntegrity,
  autoOrientImage,
  sanitizeImage,
  batchOptimizeImages,
  IMAGE_SIZES,
  QUALITY_SETTINGS
};
