import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import {
  uploadPhoto,
  deletePhoto,
  setPrimaryPhoto,
  getPhotos,
  reorderPhotos,
  getUploadGuidelines
} from '../controllers/photo.controller';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file upload
  },
  fileFilter: (_req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});

// Health check
router.get('/health', (_req, res) => {
  res.json({ 
    message: 'Photo routes working', 
    timestamp: new Date().toISOString(),
    endpoints: {
      uploadPhoto: 'POST /upload',
      getPhotos: 'GET /',
      deletePhoto: 'DELETE /:photoId',
      setPrimary: 'PATCH /:photoId/primary',
      reorderPhotos: 'PATCH /reorder',
      guidelines: 'GET /guidelines'
    }
  });
});

// Public routes
router.get('/guidelines', getUploadGuidelines);

// Protected routes (authentication required)
router.use(authenticate);

// Get user's photos
router.get('/', getPhotos);

// Upload photo
router.post('/upload',
  upload.single('photo'),
  uploadPhoto
);

// Delete photo
router.delete('/:photoId', deletePhoto);

// Set primary photo
router.patch('/:photoId/primary', setPrimaryPhoto);

// Reorder photos
router.patch('/reorder', reorderPhotos);

export default router;
