import { Router } from 'express';
import multer from 'multer';
import {
  uploadPropertyPhotos,
  getPropertyPhotos,
  deletePropertyPhoto,
  setPrimaryPhoto,
  reorderPropertyPhotos,
  updatePhotoDetails,
  getPhotoGuidelines
} from '../controllers/propertyPhoto.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest, validateFileUpload, validateObjectId } from '../middleware/validation';
import {
  propertyPhotoSchema,
  reorderPhotosSchema
} from '../validators/property.validators';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // Max 10 files per upload
  },
  fileFilter: (_req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Public routes
router.get('/guidelines', getPhotoGuidelines);

// Protected routes (authentication required)
router.use(authenticate);

// Property photo routes
router.get('/:id/photos', validateObjectId('id'), getPropertyPhotos);

router.post(
  '/:id/photos',
  validateObjectId('id'),
  upload.array('photos', 10),
  validateFileUpload({
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    required: true,
    maxFiles: 10
  }),
  uploadPropertyPhotos
);

router.delete(
  '/:id/photos/:photoId',
  validateObjectId('id'),
  deletePropertyPhoto
);

router.patch(
  '/:id/photos/:photoId/primary',
  validateObjectId('id'),
  setPrimaryPhoto
);

router.patch(
  '/:id/photos/:photoId',
  validateObjectId('id'),
  validateRequest(propertyPhotoSchema),
  updatePhotoDetails
);

router.patch(
  '/:id/photos/reorder',
  validateObjectId('id'),
  validateRequest(reorderPhotosSchema),
  reorderPropertyPhotos
);

export default router;
