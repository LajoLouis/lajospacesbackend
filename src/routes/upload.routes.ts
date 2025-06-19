import { Router } from 'express';
import {
  uploadSingleImage,
  uploadAvatar,
  uploadPropertyPhotos,
  uploadMessageAttachment,
  bulkUploadImages,
  deleteUploadedImage,
  generateUploadUrl
} from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest, validateObjectId } from '../middleware/validation';
import {
  uploadSingleImage as uploadSingleImageMiddleware,
  uploadAvatar as uploadAvatarMiddleware,
  uploadPropertyPhotos as uploadPropertyPhotosMiddleware,
  uploadMessageFile,
  uploadMultipleImages,
  handleUploadError
} from '../middleware/upload';
import {
  uploadImageSchema,
  uploadAvatarSchema,
  uploadPropertyPhotosSchema,
  uploadMessageAttachmentSchema,
  bulkUploadSchema,
  generateUploadUrlSchema
} from '../validators/upload.validators';

const router = Router();

// All upload routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/uploads/image
 * @desc    Upload single image
 * @access  Private
 */
router.post(
  '/image',
  uploadSingleImageMiddleware,
  handleUploadError,
  validateRequest(uploadImageSchema, 'body'),
  uploadSingleImage
);

/**
 * @route   POST /api/uploads/avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post(
  '/avatar',
  uploadAvatarMiddleware,
  handleUploadError,
  validateRequest(uploadAvatarSchema, 'body'),
  uploadAvatar
);

/**
 * @route   POST /api/uploads/property-photos
 * @desc    Upload property photos (bulk)
 * @access  Private
 */
router.post(
  '/property-photos',
  uploadPropertyPhotosMiddleware,
  handleUploadError,
  validateRequest(uploadPropertyPhotosSchema, 'body'),
  uploadPropertyPhotos
);

/**
 * @route   POST /api/uploads/message-attachment
 * @desc    Upload message attachment
 * @access  Private
 */
router.post(
  '/message-attachment',
  uploadMessageFile,
  handleUploadError,
  validateRequest(uploadMessageAttachmentSchema, 'body'),
  uploadMessageAttachment
);

/**
 * @route   POST /api/uploads/bulk
 * @desc    Bulk upload images
 * @access  Private
 */
router.post(
  '/bulk',
  uploadMultipleImages,
  handleUploadError,
  validateRequest(bulkUploadSchema, 'body'),
  bulkUploadImages
);

/**
 * @route   DELETE /api/uploads/:publicId
 * @desc    Delete uploaded image
 * @access  Private
 */
router.delete(
  '/:publicId',
  deleteUploadedImage
);

/**
 * @route   POST /api/uploads/signed-url
 * @desc    Generate signed upload URL for direct client uploads
 * @access  Private
 */
router.post(
  '/signed-url',
  validateRequest(generateUploadUrlSchema, 'body'),
  generateUploadUrl
);

/**
 * @route   GET /api/uploads/health
 * @desc    Health check for upload service
 * @access  Private
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Upload service is healthy',
    timestamp: new Date().toISOString(),
    services: {
      cloudinary: 'connected',
      imageOptimization: 'available',
      fileValidation: 'active'
    }
  });
});

export default router;
