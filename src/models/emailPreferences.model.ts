import mongoose, { Document, Schema } from 'mongoose';

// Email preference categories
export interface EmailPreferences {
  // Account & Security
  accountSecurity: {
    loginAlerts: boolean;
    passwordChanges: boolean;
    emailChanges: boolean;
    securityAlerts: boolean;
  };
  
  // Property & Housing
  propertyUpdates: {
    newListings: boolean;
    priceChanges: boolean;
    statusUpdates: boolean;
    favoriteUpdates: boolean;
    nearbyProperties: boolean;
  };
  
  // Roommate Matching
  roommateMatching: {
    newMatches: boolean;
    matchRequests: boolean;
    matchAcceptance: boolean;
    profileViews: boolean;
    compatibilityUpdates: boolean;
  };
  
  // Messages & Communication
  messaging: {
    newMessages: boolean;
    messageRequests: boolean;
    conversationUpdates: boolean;
    offlineMessages: boolean;
  };
  
  // Marketing & Promotions
  marketing: {
    newsletters: boolean;
    promotions: boolean;
    tips: boolean;
    surveys: boolean;
    productUpdates: boolean;
  };
  
  // System & Platform
  system: {
    maintenanceAlerts: boolean;
    systemUpdates: boolean;
    policyChanges: boolean;
    featureAnnouncements: boolean;
  };
}

// Email frequency options
export enum EmailFrequency {
  IMMEDIATE = 'immediate',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  NEVER = 'never'
}

// Email preferences document interface
export interface IEmailPreferences extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  
  // Email preferences by category
  preferences: EmailPreferences;
  
  // Global settings
  globalSettings: {
    emailEnabled: boolean;
    frequency: EmailFrequency;
    quietHours: {
      enabled: boolean;
      startTime: string; // HH:MM format
      endTime: string;   // HH:MM format
      timezone: string;
    };
    unsubscribeAll: boolean;
  };
  
  // Delivery preferences
  deliverySettings: {
    format: 'html' | 'text' | 'both';
    language: string;
    timezone: string;
  };
  
  // Tracking
  lastUpdated: Date;
  updatedBy: 'user' | 'system' | 'admin';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Default email preferences
const defaultPreferences: EmailPreferences = {
  accountSecurity: {
    loginAlerts: true,
    passwordChanges: true,
    emailChanges: true,
    securityAlerts: true
  },
  propertyUpdates: {
    newListings: true,
    priceChanges: true,
    statusUpdates: true,
    favoriteUpdates: true,
    nearbyProperties: false
  },
  roommateMatching: {
    newMatches: true,
    matchRequests: true,
    matchAcceptance: true,
    profileViews: false,
    compatibilityUpdates: true
  },
  messaging: {
    newMessages: true,
    messageRequests: true,
    conversationUpdates: false,
    offlineMessages: true
  },
  marketing: {
    newsletters: true,
    promotions: false,
    tips: true,
    surveys: false,
    productUpdates: true
  },
  system: {
    maintenanceAlerts: true,
    systemUpdates: true,
    policyChanges: true,
    featureAnnouncements: true
  }
};

// Email preferences schema
const emailPreferencesSchema = new Schema<IEmailPreferences>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  preferences: {
    accountSecurity: {
      loginAlerts: { type: Boolean, default: true },
      passwordChanges: { type: Boolean, default: true },
      emailChanges: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true }
    },
    
    propertyUpdates: {
      newListings: { type: Boolean, default: true },
      priceChanges: { type: Boolean, default: true },
      statusUpdates: { type: Boolean, default: true },
      favoriteUpdates: { type: Boolean, default: true },
      nearbyProperties: { type: Boolean, default: false }
    },
    
    roommateMatching: {
      newMatches: { type: Boolean, default: true },
      matchRequests: { type: Boolean, default: true },
      matchAcceptance: { type: Boolean, default: true },
      profileViews: { type: Boolean, default: false },
      compatibilityUpdates: { type: Boolean, default: true }
    },
    
    messaging: {
      newMessages: { type: Boolean, default: true },
      messageRequests: { type: Boolean, default: true },
      conversationUpdates: { type: Boolean, default: false },
      offlineMessages: { type: Boolean, default: true }
    },
    
    marketing: {
      newsletters: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      tips: { type: Boolean, default: true },
      surveys: { type: Boolean, default: false },
      productUpdates: { type: Boolean, default: true }
    },
    
    system: {
      maintenanceAlerts: { type: Boolean, default: true },
      systemUpdates: { type: Boolean, default: true },
      policyChanges: { type: Boolean, default: true },
      featureAnnouncements: { type: Boolean, default: true }
    }
  },
  
  globalSettings: {
    emailEnabled: {
      type: Boolean,
      default: true
    },
    frequency: {
      type: String,
      enum: Object.values(EmailFrequency),
      default: EmailFrequency.IMMEDIATE
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '22:00' },
      endTime: { type: String, default: '08:00' },
      timezone: { type: String, default: 'Africa/Lagos' }
    },
    unsubscribeAll: {
      type: Boolean,
      default: false
    }
  },
  
  deliverySettings: {
    format: {
      type: String,
      enum: ['html', 'text', 'both'],
      default: 'html'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'Africa/Lagos'
    }
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  updatedBy: {
    type: String,
    enum: ['user', 'system', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
emailPreferencesSchema.index({ userId: 1 });
emailPreferencesSchema.index({ 'globalSettings.emailEnabled': 1 });
emailPreferencesSchema.index({ updatedAt: -1 });

// Virtual for checking if emails are globally disabled
emailPreferencesSchema.virtual('emailsDisabled').get(function() {
  return !this.globalSettings.emailEnabled || this.globalSettings.unsubscribeAll;
});

// Instance methods
emailPreferencesSchema.methods.updatePreference = function(
  category: keyof EmailPreferences,
  setting: string,
  value: boolean
) {
  if (this.preferences[category] && this.preferences[category].hasOwnProperty(setting)) {
    this.preferences[category][setting] = value;
    this.lastUpdated = new Date();
    this.updatedBy = 'user';
    return this.save();
  }
  throw new Error(`Invalid preference: ${category}.${setting}`);
};

emailPreferencesSchema.methods.updateGlobalSetting = function(
  setting: string,
  value: any
) {
  if (this.globalSettings.hasOwnProperty(setting)) {
    this.globalSettings[setting] = value;
    this.lastUpdated = new Date();
    this.updatedBy = 'user';
    return this.save();
  }
  throw new Error(`Invalid global setting: ${setting}`);
};

emailPreferencesSchema.methods.unsubscribeAll = function() {
  this.globalSettings.unsubscribeAll = true;
  this.globalSettings.emailEnabled = false;
  this.lastUpdated = new Date();
  this.updatedBy = 'user';
  return this.save();
};

emailPreferencesSchema.methods.resubscribe = function() {
  this.globalSettings.unsubscribeAll = false;
  this.globalSettings.emailEnabled = true;
  this.lastUpdated = new Date();
  this.updatedBy = 'user';
  return this.save();
};

emailPreferencesSchema.methods.shouldSendEmail = function(
  category: keyof EmailPreferences,
  setting: string
): boolean {
  // Check if emails are globally disabled
  if (this.emailsDisabled) {
    return false;
  }
  
  // Check specific preference
  if (this.preferences[category] && this.preferences[category].hasOwnProperty(setting)) {
    return this.preferences[category][setting];
  }
  
  return false;
};

emailPreferencesSchema.methods.isInQuietHours = function(): boolean {
  if (!this.globalSettings.quietHours.enabled) {
    return false;
  }
  
  const now = new Date();
  const timezone = this.deliverySettings.timezone;
  
  // Convert current time to user's timezone
  const userTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  }).format(now);
  
  const currentTime = userTime;
  const startTime = this.globalSettings.quietHours.startTime;
  const endTime = this.globalSettings.quietHours.endTime;
  
  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  } else {
    return currentTime >= startTime && currentTime <= endTime;
  }
};

// Static methods
emailPreferencesSchema.statics.createDefault = function(userId: mongoose.Types.ObjectId) {
  return this.create({
    userId,
    preferences: defaultPreferences,
    globalSettings: {
      emailEnabled: true,
      frequency: EmailFrequency.IMMEDIATE,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'Africa/Lagos'
      },
      unsubscribeAll: false
    },
    deliverySettings: {
      format: 'html',
      language: 'en',
      timezone: 'Africa/Lagos'
    }
  });
};

emailPreferencesSchema.statics.getByUserId = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ userId });
};

// Pre-save middleware
emailPreferencesSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Create and export the model
export const EmailPreferences = mongoose.model<IEmailPreferences>('EmailPreferences', emailPreferencesSchema);

export default EmailPreferences;
