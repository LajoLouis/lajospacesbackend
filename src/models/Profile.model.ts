import mongoose, { Document, Schema, Types } from 'mongoose';

// Profile interface
export interface IProfile extends Document {
  // User Reference
  userId: Types.ObjectId;

  // Personal Information
  bio: string;
  occupation: string;
  education: string;
  languages: string[];
  
  // Photos
  photos: {
    url: string;
    publicId: string;
    isPrimary: boolean;
    uploadedAt: Date;
  }[];

  // Lifestyle Preferences
  lifestyle: {
    smokingPolicy: 'no-smoking' | 'smoking-allowed' | 'outdoor-only' | 'no-preference';
    drinkingPolicy: 'no-drinking' | 'social-drinking' | 'regular-drinking' | 'no-preference';
    petPolicy: 'no-pets' | 'cats-only' | 'dogs-only' | 'all-pets' | 'no-preference';
    cleanlinessLevel: 'very-clean' | 'moderately-clean' | 'relaxed' | 'no-preference';
    noiseLevel: 'very-quiet' | 'moderate' | 'lively' | 'no-preference';
    guestPolicy: 'no-guests' | 'occasional-guests' | 'frequent-guests' | 'no-preference';
  };

  // Housing Preferences (for seekers)
  housingPreferences?: {
    propertyTypes: ('apartment' | 'house' | 'condo' | 'townhouse' | 'studio')[];
    budgetRange: {
      min: number;
      max: number;
    };
    preferredAreas: string[];
    moveInDate: Date;
    leaseDuration: 'short-term' | 'long-term' | 'flexible';
    roomType: 'private-room' | 'shared-room' | 'master-bedroom' | 'any';
    amenities: string[];
  };

  // Roommate Preferences
  roommatePreferences: {
    ageRange: {
      min: number;
      max: number;
    };
    genderPreference: 'male' | 'female' | 'any' | 'same-gender' | 'different-gender';
    occupationPreference: string[];
    lifestyleCompatibility: {
      smokingTolerance: 'no-smoking' | 'smoking-allowed' | 'outdoor-only' | 'no-preference';
      drinkingTolerance: 'no-drinking' | 'social-drinking' | 'regular-drinking' | 'no-preference';
      petTolerance: 'no-pets' | 'cats-only' | 'dogs-only' | 'all-pets' | 'no-preference';
      cleanlinessExpectation: 'very-clean' | 'moderately-clean' | 'relaxed' | 'no-preference';
      noiseExpectation: 'very-quiet' | 'moderate' | 'lively' | 'no-preference';
      guestTolerance: 'no-guests' | 'occasional-guests' | 'frequent-guests' | 'no-preference';
    };
  };

  // Interests & Hobbies
  interests: string[];
  hobbies: string[];

  // Social Media & Contact
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
  };

  // Verification & Trust
  verifications: {
    isBackgroundChecked: boolean;
    isIncomeVerified: boolean;
    isIdentityVerified: boolean;
    isReferenceChecked: boolean;
  };

  // Privacy Settings
  privacy: {
    showFullName: boolean;
    showAge: boolean;
    showLocation: boolean;
    showOccupation: boolean;
    showSocialMedia: boolean;
    allowMessagesFromUnmatched: boolean;
  };

  // Activity & Engagement
  profileViews: number;
  lastProfileUpdate: Date;
  isProfileComplete: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  calculateCompleteness(): number;
  addPhoto(url: string, publicId: string): void;
  removePhoto(publicId: string): void;
  setPrimaryPhoto(publicId: string): void;
  updateLastActivity(): void;
}

// Profile Schema
const ProfileSchema = new Schema<IProfile>({
  // User Reference
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true,
    index: true
  },

  // Personal Information
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },

  occupation: {
    type: String,
    trim: true,
    maxlength: [100, 'Occupation cannot exceed 100 characters'],
    default: ''
  },

  education: {
    type: String,
    trim: true,
    maxlength: [100, 'Education cannot exceed 100 characters'],
    default: ''
  },

  languages: [{
    type: String,
    trim: true,
    maxlength: [50, 'Language name cannot exceed 50 characters']
  }],

  // Photos
  photos: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Lifestyle Preferences
  lifestyle: {
    smokingPolicy: {
      type: String,
      enum: ['no-smoking', 'smoking-allowed', 'outdoor-only', 'no-preference'],
      default: 'no-preference'
    },
    drinkingPolicy: {
      type: String,
      enum: ['no-drinking', 'social-drinking', 'regular-drinking', 'no-preference'],
      default: 'no-preference'
    },
    petPolicy: {
      type: String,
      enum: ['no-pets', 'cats-only', 'dogs-only', 'all-pets', 'no-preference'],
      default: 'no-preference'
    },
    cleanlinessLevel: {
      type: String,
      enum: ['very-clean', 'moderately-clean', 'relaxed', 'no-preference'],
      default: 'no-preference'
    },
    noiseLevel: {
      type: String,
      enum: ['very-quiet', 'moderate', 'lively', 'no-preference'],
      default: 'no-preference'
    },
    guestPolicy: {
      type: String,
      enum: ['no-guests', 'occasional-guests', 'frequent-guests', 'no-preference'],
      default: 'no-preference'
    }
  },

  // Housing Preferences (for seekers)
  housingPreferences: {
    propertyTypes: [{
      type: String,
      enum: ['apartment', 'house', 'condo', 'townhouse', 'studio']
    }],
    budgetRange: {
      min: {
        type: Number,
        min: 0,
        default: 0
      },
      max: {
        type: Number,
        min: 0,
        default: 10000
      }
    },
    preferredAreas: [{
      type: String,
      trim: true
    }],
    moveInDate: {
      type: Date
    },
    leaseDuration: {
      type: String,
      enum: ['short-term', 'long-term', 'flexible'],
      default: 'flexible'
    },
    roomType: {
      type: String,
      enum: ['private-room', 'shared-room', 'master-bedroom', 'any'],
      default: 'any'
    },
    amenities: [{
      type: String,
      trim: true
    }]
  },

  // Roommate Preferences
  roommatePreferences: {
    ageRange: {
      min: {
        type: Number,
        min: 18,
        max: 100,
        default: 18
      },
      max: {
        type: Number,
        min: 18,
        max: 100,
        default: 65
      }
    },
    genderPreference: {
      type: String,
      enum: ['male', 'female', 'any', 'same-gender', 'different-gender'],
      default: 'any'
    },
    occupationPreference: [{
      type: String,
      trim: true
    }],
    lifestyleCompatibility: {
      smokingTolerance: {
        type: String,
        enum: ['no-smoking', 'smoking-allowed', 'outdoor-only', 'no-preference'],
        default: 'no-preference'
      },
      drinkingTolerance: {
        type: String,
        enum: ['no-drinking', 'social-drinking', 'regular-drinking', 'no-preference'],
        default: 'no-preference'
      },
      petTolerance: {
        type: String,
        enum: ['no-pets', 'cats-only', 'dogs-only', 'all-pets', 'no-preference'],
        default: 'no-preference'
      },
      cleanlinessExpectation: {
        type: String,
        enum: ['very-clean', 'moderately-clean', 'relaxed', 'no-preference'],
        default: 'no-preference'
      },
      noiseExpectation: {
        type: String,
        enum: ['very-quiet', 'moderate', 'lively', 'no-preference'],
        default: 'no-preference'
      },
      guestTolerance: {
        type: String,
        enum: ['no-guests', 'occasional-guests', 'frequent-guests', 'no-preference'],
        default: 'no-preference'
      }
    }
  },

  // Interests & Hobbies
  interests: [{
    type: String,
    trim: true,
    maxlength: [50, 'Interest cannot exceed 50 characters']
  }],

  hobbies: [{
    type: String,
    trim: true,
    maxlength: [50, 'Hobby cannot exceed 50 characters']
  }],

  // Social Media & Contact
  socialMedia: {
    instagram: {
      type: String,
      trim: true,
      match: [/^[a-zA-Z0-9._]+$/, 'Invalid Instagram username']
    },
    facebook: {
      type: String,
      trim: true
    },
    linkedin: {
      type: String,
      trim: true
    },
    twitter: {
      type: String,
      trim: true,
      match: [/^[a-zA-Z0-9_]+$/, 'Invalid Twitter username']
    }
  },

  // Verification & Trust
  verifications: {
    isBackgroundChecked: {
      type: Boolean,
      default: false
    },
    isIncomeVerified: {
      type: Boolean,
      default: false
    },
    isIdentityVerified: {
      type: Boolean,
      default: false
    },
    isReferenceChecked: {
      type: Boolean,
      default: false
    }
  },

  // Privacy Settings
  privacy: {
    showFullName: {
      type: Boolean,
      default: true
    },
    showAge: {
      type: Boolean,
      default: true
    },
    showLocation: {
      type: Boolean,
      default: true
    },
    showOccupation: {
      type: Boolean,
      default: true
    },
    showSocialMedia: {
      type: Boolean,
      default: false
    },
    allowMessagesFromUnmatched: {
      type: Boolean,
      default: false
    }
  },

  // Activity & Engagement
  profileViews: {
    type: Number,
    default: 0,
    min: 0
  },

  lastProfileUpdate: {
    type: Date,
    default: Date.now
  },

  isProfileComplete: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
ProfileSchema.index({ userId: 1 }, { unique: true });
ProfileSchema.index({ 'housingPreferences.budgetRange.min': 1 });
ProfileSchema.index({ 'housingPreferences.budgetRange.max': 1 });
ProfileSchema.index({ 'housingPreferences.moveInDate': 1 });
ProfileSchema.index({ 'roommatePreferences.ageRange.min': 1 });
ProfileSchema.index({ 'roommatePreferences.ageRange.max': 1 });
ProfileSchema.index({ 'roommatePreferences.genderPreference': 1 });
ProfileSchema.index({ interests: 1 });
ProfileSchema.index({ hobbies: 1 });
ProfileSchema.index({ isProfileComplete: 1 });
ProfileSchema.index({ lastProfileUpdate: -1 });

// Virtual for primary photo
ProfileSchema.virtual('primaryPhoto').get(function() {
  return this.photos.find((photo: any) => photo.isPrimary) || this.photos[0] || null;
});

// Virtual for photo count
ProfileSchema.virtual('photoCount').get(function() {
  return this.photos.length;
});

// Pre-save middleware to update profile completeness
ProfileSchema.pre('save', function(next) {
  this.isProfileComplete = this.calculateCompleteness() >= 80;
  this.lastProfileUpdate = new Date();
  next();
});

// Instance method to calculate profile completeness
ProfileSchema.methods.calculateCompleteness = function(): number {
  let score = 0;
  const maxScore = 100;

  // Basic information (40 points)
  if (this.bio && this.bio.length >= 50) score += 10;
  if (this.occupation) score += 10;
  if (this.education) score += 10;
  if (this.photos.length > 0) score += 10;

  // Lifestyle preferences (20 points)
  const lifestyleFields = Object.values(this.lifestyle);
  const completedLifestyle = lifestyleFields.filter(field => field !== 'no-preference').length;
  score += Math.round((completedLifestyle / lifestyleFields.length) * 20);

  // Roommate preferences (20 points)
  if (this.roommatePreferences.genderPreference !== 'any') score += 5;
  if (this.roommatePreferences.ageRange.min !== 18 || this.roommatePreferences.ageRange.max !== 65) score += 5;
  const compatibilityFields = Object.values(this.roommatePreferences.lifestyleCompatibility);
  const completedCompatibility = compatibilityFields.filter(field => field !== 'no-preference').length;
  score += Math.round((completedCompatibility / compatibilityFields.length) * 10);

  // Additional details (20 points)
  if (this.interests.length > 0) score += 5;
  if (this.hobbies.length > 0) score += 5;
  if (this.languages.length > 0) score += 5;
  if (this.housingPreferences && this.housingPreferences.propertyTypes.length > 0) score += 5;

  return Math.min(score, maxScore);
};

// Instance method to add photo
ProfileSchema.methods.addPhoto = function(url: string, publicId: string): void {
  // If this is the first photo, make it primary
  const isPrimary = this.photos.length === 0;

  this.photos.push({
    url,
    publicId,
    isPrimary,
    uploadedAt: new Date()
  });
};

// Instance method to remove photo
ProfileSchema.methods.removePhoto = function(publicId: string): void {
  const photoIndex = this.photos.findIndex((photo: any) => photo.publicId === publicId);

  if (photoIndex !== -1) {
    const wasRemovingPrimary = this.photos[photoIndex].isPrimary;
    this.photos.splice(photoIndex, 1);

    // If we removed the primary photo and there are other photos, make the first one primary
    if (wasRemovingPrimary && this.photos.length > 0) {
      this.photos[0].isPrimary = true;
    }
  }
};

// Instance method to set primary photo
ProfileSchema.methods.setPrimaryPhoto = function(publicId: string): void {
  // Remove primary status from all photos
  this.photos.forEach((photo: any) => {
    photo.isPrimary = false;
  });

  // Set the specified photo as primary
  const photo = this.photos.find((photo: any) => photo.publicId === publicId);
  if (photo) {
    photo.isPrimary = true;
  }
};

// Instance method to update last activity
ProfileSchema.methods.updateLastActivity = function(): void {
  this.lastProfileUpdate = new Date();
};

// Export the model
export const Profile = mongoose.model<IProfile>('Profile', ProfileSchema);
export default Profile;
