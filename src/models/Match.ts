import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMatch extends Document {
  // Core match information
  userId: Types.ObjectId;
  targetId: Types.ObjectId; // Can be another user or property
  targetType: 'user' | 'property';
  matchType: 'roommate' | 'housing' | 'mutual';
  
  // Match status and interactions
  status: 'pending' | 'matched' | 'rejected' | 'expired' | 'blocked';
  userAction: 'none' | 'liked' | 'passed' | 'super_liked';
  targetAction: 'none' | 'liked' | 'passed' | 'super_liked';
  
  // Compatibility and scoring
  compatibilityScore: number; // 0-100 percentage
  compatibilityFactors: {
    location: number;
    budget: number;
    lifestyle: number;
    preferences: number;
    schedule: number;
    cleanliness: number;
    socialLevel: number;
    overall: number;
  };
  
  // Match details
  matchedAt?: Date;
  expiresAt: Date;
  lastInteractionAt: Date;
  
  // Conversation and communication
  conversationId?: Types.ObjectId;
  hasMessaged: boolean;
  lastMessageAt?: Date;
  
  // Match context and reasoning
  matchReason: string[];
  commonInterests: string[];
  sharedPreferences: string[];
  
  // Analytics and tracking
  viewedAt?: Date;
  viewCount: number;
  responseTime?: number; // Time taken to respond in minutes
  
  // Nigerian market specific
  locationProximity: number; // Distance in kilometers
  budgetCompatibility: number; // Budget overlap percentage
  stateMatch: boolean; // Same Nigerian state
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  isExpired(): boolean;
  isMutualMatch(): boolean;
  calculateCompatibility(): number;
  extendExpiration(days: number): void;
}

// Match preferences interface
export interface IMatchPreferences extends Document {
  userId: Types.ObjectId;
  
  // Basic preferences
  isActive: boolean;
  maxDistance: number; // in kilometers
  ageRange: { min: number; max: number };
  genderPreference: 'male' | 'female' | 'any';
  
  // Budget preferences
  budgetRange: { min: number; max: number };
  budgetFlexibility: number; // 0-100 percentage
  
  // Location preferences
  preferredStates: string[];
  preferredCities: string[];
  preferredAreas: string[];
  locationFlexibility: number; // 0-100 percentage
  
  // Lifestyle preferences
  lifestyle: {
    smoking: 'yes' | 'no' | 'occasionally' | 'no_preference';
    drinking: 'yes' | 'no' | 'occasionally' | 'no_preference';
    pets: 'love' | 'okay' | 'allergic' | 'no_preference';
    parties: 'love' | 'okay' | 'rarely' | 'never' | 'no_preference';
    guests: 'frequent' | 'occasional' | 'rare' | 'never' | 'no_preference';
    cleanliness: 'very_clean' | 'clean' | 'average' | 'relaxed' | 'no_preference';
    noise_level: 'quiet' | 'moderate' | 'lively' | 'no_preference';
  };
  
  // Schedule and routine
  schedule: {
    work_schedule: 'day_shift' | 'night_shift' | 'flexible' | 'student' | 'no_preference';
    sleep_schedule: 'early_bird' | 'night_owl' | 'flexible' | 'no_preference';
    social_level: 'very_social' | 'social' | 'moderate' | 'private' | 'no_preference';
  };
  
  // Property preferences (for housing matches)
  propertyPreferences: {
    propertyTypes: string[];
    amenities: string[];
    minimumBedrooms: number;
    minimumBathrooms: number;
    furnished: 'yes' | 'no' | 'partial' | 'no_preference';
    parking: 'required' | 'preferred' | 'not_needed';
    security: 'required' | 'preferred' | 'not_needed';
  };
  
  // Roommate preferences
  roommatePreferences: {
    occupation: string[];
    education_level: string[];
    relationship_status: string[];
    has_children: 'yes' | 'no' | 'no_preference';
    religion: string[];
    languages: string[];
  };
  
  // Deal breakers
  dealBreakers: string[];
  
  // Matching settings
  matchingSettings: {
    auto_like_high_compatibility: boolean; // Auto-like matches above 85%
    compatibility_threshold: number; // Minimum compatibility to show (0-100)
    daily_match_limit: number;
    show_distance: boolean;
    show_last_active: boolean;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

const MatchSchema = new Schema<IMatch>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: ['user', 'property'],
    required: true,
    index: true
  },
  matchType: {
    type: String,
    enum: ['roommate', 'housing', 'mutual'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'matched', 'rejected', 'expired', 'blocked'],
    default: 'pending',
    index: true
  },
  userAction: {
    type: String,
    enum: ['none', 'liked', 'passed', 'super_liked'],
    default: 'none'
  },
  targetAction: {
    type: String,
    enum: ['none', 'liked', 'passed', 'super_liked'],
    default: 'none'
  },
  compatibilityScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
    index: true
  },
  compatibilityFactors: {
    location: { type: Number, min: 0, max: 100, default: 0 },
    budget: { type: Number, min: 0, max: 100, default: 0 },
    lifestyle: { type: Number, min: 0, max: 100, default: 0 },
    preferences: { type: Number, min: 0, max: 100, default: 0 },
    schedule: { type: Number, min: 0, max: 100, default: 0 },
    cleanliness: { type: Number, min: 0, max: 100, default: 0 },
    socialLevel: { type: Number, min: 0, max: 100, default: 0 },
    overall: { type: Number, min: 0, max: 100, default: 0 }
  },
  matchedAt: {
    type: Date,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  lastInteractionAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  hasMessaged: {
    type: Boolean,
    default: false,
    index: true
  },
  lastMessageAt: {
    type: Date,
    index: true
  },
  matchReason: [{
    type: String,
    trim: true
  }],
  commonInterests: [{
    type: String,
    trim: true
  }],
  sharedPreferences: [{
    type: String,
    trim: true
  }],
  viewedAt: {
    type: Date,
    index: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  responseTime: {
    type: Number, // in minutes
    min: 0
  },
  locationProximity: {
    type: Number,
    min: 0,
    index: true
  },
  budgetCompatibility: {
    type: Number,
    min: 0,
    max: 100,
    index: true
  },
  stateMatch: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
MatchSchema.index({ userId: 1, status: 1 });
MatchSchema.index({ userId: 1, matchType: 1, status: 1 });
MatchSchema.index({ targetId: 1, targetType: 1 });
MatchSchema.index({ compatibilityScore: -1, status: 1 });
MatchSchema.index({ expiresAt: 1, status: 1 });
MatchSchema.index({ createdAt: -1 });
MatchSchema.index({ locationProximity: 1, compatibilityScore: -1 });

// Prevent duplicate matches
MatchSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });

// Methods
MatchSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt && this.status === 'pending';
};

MatchSchema.methods.isMutualMatch = function(): boolean {
  return this.userAction === 'liked' && this.targetAction === 'liked';
};

MatchSchema.methods.calculateCompatibility = function(): number {
  const factors = this.compatibilityFactors;
  const weights = {
    location: 0.20,
    budget: 0.20,
    lifestyle: 0.15,
    preferences: 0.15,
    schedule: 0.10,
    cleanliness: 0.10,
    socialLevel: 0.10
  };
  
  const weightedScore = 
    (factors.location * weights.location) +
    (factors.budget * weights.budget) +
    (factors.lifestyle * weights.lifestyle) +
    (factors.preferences * weights.preferences) +
    (factors.schedule * weights.schedule) +
    (factors.cleanliness * weights.cleanliness) +
    (factors.socialLevel * weights.socialLevel);
  
  this.compatibilityFactors.overall = Math.round(weightedScore);
  this.compatibilityScore = this.compatibilityFactors.overall;
  
  return this.compatibilityScore;
};

MatchSchema.methods.extendExpiration = function(days: number): void {
  const currentExpiry = new Date(this.expiresAt);
  currentExpiry.setDate(currentExpiry.getDate() + days);
  this.expiresAt = currentExpiry;
};

// Pre-save middleware
MatchSchema.pre('save', function(next) {
  // Auto-calculate compatibility if not set
  if (this.isModified('compatibilityFactors') || this.isNew) {
    this.calculateCompatibility();
  }
  
  // Set match status based on actions
  if (this.userAction === 'liked' && this.targetAction === 'liked' && this.status === 'pending') {
    this.status = 'matched';
    this.matchedAt = new Date();
  } else if ((this.userAction === 'passed' || this.targetAction === 'passed') && this.status === 'pending') {
    this.status = 'rejected';
  }
  
  // Update last interaction time
  if (this.isModified('userAction') || this.isModified('targetAction')) {
    this.lastInteractionAt = new Date();
  }
  
  next();
});

const MatchPreferencesSchema = new Schema<IMatchPreferences>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  maxDistance: {
    type: Number,
    min: 1,
    max: 1000,
    default: 50 // 50km default
  },
  ageRange: {
    min: { type: Number, min: 18, max: 100, default: 18 },
    max: { type: Number, min: 18, max: 100, default: 65 }
  },
  genderPreference: {
    type: String,
    enum: ['male', 'female', 'any'],
    default: 'any'
  },
  budgetRange: {
    min: { type: Number, min: 0, default: 0 },
    max: { type: Number, min: 0, default: 1000000 }
  },
  budgetFlexibility: {
    type: Number,
    min: 0,
    max: 100,
    default: 20
  },
  preferredStates: [{
    type: String,
    trim: true
  }],
  preferredCities: [{
    type: String,
    trim: true
  }],
  preferredAreas: [{
    type: String,
    trim: true
  }],
  locationFlexibility: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  lifestyle: {
    smoking: {
      type: String,
      enum: ['yes', 'no', 'occasionally', 'no_preference'],
      default: 'no_preference'
    },
    drinking: {
      type: String,
      enum: ['yes', 'no', 'occasionally', 'no_preference'],
      default: 'no_preference'
    },
    pets: {
      type: String,
      enum: ['love', 'okay', 'allergic', 'no_preference'],
      default: 'no_preference'
    },
    parties: {
      type: String,
      enum: ['love', 'okay', 'rarely', 'never', 'no_preference'],
      default: 'no_preference'
    },
    guests: {
      type: String,
      enum: ['frequent', 'occasional', 'rare', 'never', 'no_preference'],
      default: 'no_preference'
    },
    cleanliness: {
      type: String,
      enum: ['very_clean', 'clean', 'average', 'relaxed', 'no_preference'],
      default: 'no_preference'
    },
    noise_level: {
      type: String,
      enum: ['quiet', 'moderate', 'lively', 'no_preference'],
      default: 'no_preference'
    }
  },
  schedule: {
    work_schedule: {
      type: String,
      enum: ['day_shift', 'night_shift', 'flexible', 'student', 'no_preference'],
      default: 'no_preference'
    },
    sleep_schedule: {
      type: String,
      enum: ['early_bird', 'night_owl', 'flexible', 'no_preference'],
      default: 'no_preference'
    },
    social_level: {
      type: String,
      enum: ['very_social', 'social', 'moderate', 'private', 'no_preference'],
      default: 'no_preference'
    }
  },
  propertyPreferences: {
    propertyTypes: [{
      type: String,
      enum: ['apartment', 'house', 'condo', 'studio', 'duplex', 'bungalow', 'mansion']
    }],
    amenities: [{
      type: String,
      trim: true
    }],
    minimumBedrooms: {
      type: Number,
      min: 0,
      max: 20,
      default: 1
    },
    minimumBathrooms: {
      type: Number,
      min: 1,
      max: 20,
      default: 1
    },
    furnished: {
      type: String,
      enum: ['yes', 'no', 'partial', 'no_preference'],
      default: 'no_preference'
    },
    parking: {
      type: String,
      enum: ['required', 'preferred', 'not_needed'],
      default: 'preferred'
    },
    security: {
      type: String,
      enum: ['required', 'preferred', 'not_needed'],
      default: 'preferred'
    }
  },
  roommatePreferences: {
    occupation: [{
      type: String,
      trim: true
    }],
    education_level: [{
      type: String,
      trim: true
    }],
    relationship_status: [{
      type: String,
      trim: true
    }],
    has_children: {
      type: String,
      enum: ['yes', 'no', 'no_preference'],
      default: 'no_preference'
    },
    religion: [{
      type: String,
      trim: true
    }],
    languages: [{
      type: String,
      trim: true
    }]
  },
  dealBreakers: [{
    type: String,
    trim: true
  }],
  matchingSettings: {
    auto_like_high_compatibility: {
      type: Boolean,
      default: false
    },
    compatibility_threshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 60
    },
    daily_match_limit: {
      type: Number,
      min: 1,
      max: 100,
      default: 20
    },
    show_distance: {
      type: Boolean,
      default: true
    },
    show_last_active: {
      type: Boolean,
      default: true
    }
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for match preferences
MatchPreferencesSchema.index({ userId: 1 });
MatchPreferencesSchema.index({ isActive: 1 });
MatchPreferencesSchema.index({ 'budgetRange.min': 1, 'budgetRange.max': 1 });
MatchPreferencesSchema.index({ maxDistance: 1 });

export const Match = mongoose.model<IMatch>('Match', MatchSchema);
export const MatchPreferences = mongoose.model<IMatchPreferences>('MatchPreferences', MatchPreferencesSchema);
