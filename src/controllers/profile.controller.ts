import { Request, Response, NextFunction } from 'express';
import { AppError, catchAsync } from '../middleware/errorHandler';
import { logHelpers } from '../utils/logger';
import User from '../models/User.model';
import Profile from '../models/Profile.model';
import { Types } from 'mongoose';

/**
 * Get user's complete profile
 */
export const getProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const profile = await Profile.findOne({ userId: req.user.userId }).populate('userId');
  
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  logHelpers.userAction(req.user.userId, 'profile_viewed');

  res.json({
    success: true,
    data: {
      profile: {
        id: profile._id,
        userId: profile.userId,
        bio: profile.bio,
        occupation: profile.occupation,
        education: profile.education,
        languages: profile.languages,
        photos: profile.photos,
        lifestyle: profile.lifestyle,
        housingPreferences: profile.housingPreferences,
        roommatePreferences: profile.roommatePreferences,
        interests: profile.interests,
        hobbies: profile.hobbies,
        socialMedia: profile.socialMedia,
        verifications: profile.verifications,
        privacy: profile.privacy,
        profileViews: profile.profileViews,
        isProfileComplete: profile.isProfileComplete,
        completeness: profile.calculateCompleteness(),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      }
    }
  });
});

/**
 * Update user profile
 */
export const updateProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const {
    bio,
    occupation,
    education,
    languages,
    lifestyle,
    housingPreferences,
    roommatePreferences,
    interests,
    hobbies,
    socialMedia,
    privacy
  } = req.body;

  const profile = await Profile.findOne({ userId: req.user.userId });
  
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  // Update allowed fields
  if (bio !== undefined) profile.bio = bio;
  if (occupation !== undefined) profile.occupation = occupation;
  if (education !== undefined) profile.education = education;
  if (languages !== undefined) profile.languages = languages;
  if (lifestyle !== undefined) profile.lifestyle = { ...profile.lifestyle, ...lifestyle };
  if (housingPreferences !== undefined) profile.housingPreferences = { ...profile.housingPreferences, ...housingPreferences };
  if (roommatePreferences !== undefined) profile.roommatePreferences = { ...profile.roommatePreferences, ...roommatePreferences };
  if (interests !== undefined) profile.interests = interests;
  if (hobbies !== undefined) profile.hobbies = hobbies;
  if (socialMedia !== undefined) profile.socialMedia = { ...profile.socialMedia, ...socialMedia };
  if (privacy !== undefined) profile.privacy = { ...profile.privacy, ...privacy };

  await profile.save();

  logHelpers.userAction(req.user.userId, 'profile_updated', { 
    updatedFields: Object.keys(req.body),
    completeness: profile.calculateCompleteness()
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      profile: {
        id: profile._id,
        completeness: profile.calculateCompleteness(),
        isProfileComplete: profile.isProfileComplete,
        updatedAt: profile.updatedAt
      }
    }
  });
});

/**
 * Get public profile by user ID
 */
export const getPublicProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400, true, 'INVALID_USER_ID');
  }

  const profile = await Profile.findOne({ userId }).populate({
    path: 'userId',
    select: 'firstName lastName dateOfBirth gender location isEmailVerified isPhoneVerified accountType createdAt'
  });

  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  const user = profile.userId as any;

  // Check privacy settings and filter data accordingly
  const publicProfile: any = {
    id: profile._id,
    userId: profile.userId,
    bio: profile.bio,
    occupation: profile.privacy.showOccupation ? profile.occupation : null,
    education: profile.education,
    languages: profile.languages,
    photos: profile.photos,
    lifestyle: profile.lifestyle,
    interests: profile.interests,
    hobbies: profile.hobbies,
    verifications: profile.verifications,
    isProfileComplete: profile.isProfileComplete,
    createdAt: profile.createdAt
  };

  // Add user data based on privacy settings
  if (user) {
    publicProfile.user = {
      firstName: profile.privacy.showFullName ? user.firstName : user.firstName.charAt(0) + '.',
      lastName: profile.privacy.showFullName ? user.lastName : user.lastName.charAt(0) + '.',
      age: profile.privacy.showAge ? user.getAge() : null,
      gender: user.gender,
      location: profile.privacy.showLocation ? user.location : null,
      accountType: user.accountType,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      memberSince: user.createdAt
    };
  }

  // Add social media if allowed
  if (profile.privacy.showSocialMedia && profile.socialMedia) {
    publicProfile.socialMedia = profile.socialMedia;
  }

  // Increment profile views (if not viewing own profile)
  if (!req.user || req.user.userId !== userId) {
    profile.profileViews += 1;
    await profile.save();
  }

  // Log profile view
  if (req.user) {
    logHelpers.userAction(req.user.userId, 'profile_viewed_other', { viewedUserId: userId });
  }

  res.json({
    success: true,
    data: {
      profile: publicProfile
    }
  });
});

/**
 * Update profile privacy settings
 */
export const updatePrivacySettings = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const { privacy } = req.body;

  const profile = await Profile.findOne({ userId: req.user.userId });
  
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  // Update privacy settings
  profile.privacy = { ...profile.privacy, ...privacy };
  await profile.save();

  logHelpers.userAction(req.user.userId, 'privacy_settings_updated', { newSettings: privacy });

  res.json({
    success: true,
    message: 'Privacy settings updated successfully',
    data: {
      privacy: profile.privacy
    }
  });
});

/**
 * Get profile completion status
 */
export const getProfileCompletion = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const profile = await Profile.findOne({ userId: req.user.userId });
  const user = await User.findById(req.user.userId);
  
  if (!profile || !user) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  const profileCompleteness = profile.calculateCompleteness();
  const userCompleteness = user.calculateProfileCompletion();

  // Detailed completion breakdown
  const completionDetails = {
    overall: Math.round((profileCompleteness + userCompleteness) / 2),
    user: {
      score: userCompleteness,
      missing: [] as string[]
    },
    profile: {
      score: profileCompleteness,
      missing: [] as string[]
    }
  };

  // Check what's missing from user profile
  if (!user.phoneNumber) completionDetails.user.missing.push('Phone number');
  if (!user.isEmailVerified) completionDetails.user.missing.push('Email verification');
  if (!user.location?.city) completionDetails.user.missing.push('City');
  if (!user.location?.state) completionDetails.user.missing.push('State');

  // Check what's missing from extended profile
  if (!profile.bio || profile.bio.length < 50) completionDetails.profile.missing.push('Bio (50+ characters)');
  if (!profile.occupation) completionDetails.profile.missing.push('Occupation');
  if (!profile.education) completionDetails.profile.missing.push('Education');
  if (profile.photos.length === 0) completionDetails.profile.missing.push('Profile photos');
  if (profile.interests.length === 0) completionDetails.profile.missing.push('Interests');
  if (profile.hobbies.length === 0) completionDetails.profile.missing.push('Hobbies');

  res.json({
    success: true,
    data: {
      completion: completionDetails,
      isComplete: completionDetails.overall >= 80,
      nextSteps: [
        ...completionDetails.user.missing,
        ...completionDetails.profile.missing
      ].slice(0, 3) // Show top 3 missing items
    }
  });
});

/**
 * Delete profile (soft delete)
 */
export const deleteProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const profile = await Profile.findOne({ userId: req.user.userId });
  
  if (!profile) {
    throw new AppError('Profile not found', 404, true, 'PROFILE_NOT_FOUND');
  }

  // Soft delete - clear sensitive data but keep record
  profile.bio = '';
  profile.occupation = '';
  profile.education = '';
  profile.languages = [];
  profile.photos = [];
  profile.interests = [];
  profile.hobbies = [];
  profile.socialMedia = {};
  profile.set('housingPreferences', undefined);
  
  await profile.save();

  logHelpers.userAction(req.user.userId, 'profile_deleted');

  res.json({
    success: true,
    message: 'Profile data cleared successfully'
  });
});

export default {
  getProfile,
  updateProfile,
  getPublicProfile,
  updatePrivacySettings,
  getProfileCompletion,
  deleteProfile
};
