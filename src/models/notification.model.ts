import mongoose, { Document, Schema } from 'mongoose';

// Notification types
export enum NotificationType {
  // User-related
  WELCOME = 'welcome',
  EMAIL_VERIFIED = 'email_verified',
  PROFILE_UPDATED = 'profile_updated',
  
  // Property-related
  PROPERTY_POSTED = 'property_posted',
  PROPERTY_APPROVED = 'property_approved',
  PROPERTY_REJECTED = 'property_rejected',
  PROPERTY_EXPIRED = 'property_expired',
  PROPERTY_FAVORITED = 'property_favorited',
  
  // Match-related
  NEW_MATCH = 'new_match',
  MATCH_REQUEST = 'match_request',
  MATCH_ACCEPTED = 'match_accepted',
  MATCH_DECLINED = 'match_declined',
  
  // Message-related
  NEW_MESSAGE = 'new_message',
  MESSAGE_REQUEST = 'message_request',
  
  // System-related
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  MAINTENANCE = 'maintenance',
  SECURITY_ALERT = 'security_alert',
  
  // Payment-related (future)
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring'
}

// Notification priority levels
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Notification delivery channels
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push', // For future mobile app
  SMS = 'sms'    // For future SMS integration
}

// Notification interface
export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  
  // Related entities
  relatedEntity?: {
    type: 'user' | 'property' | 'match' | 'message' | 'conversation';
    id: mongoose.Types.ObjectId;
  };
  
  // Delivery tracking
  deliveryStatus: {
    [key in NotificationChannel]?: {
      sent: boolean;
      sentAt?: Date;
      delivered?: boolean;
      deliveredAt?: Date;
      error?: string;
    };
  };
  
  // User interaction
  read: boolean;
  readAt?: Date;
  clicked: boolean;
  clickedAt?: Date;
  dismissed: boolean;
  dismissedAt?: Date;
  
  // Metadata
  data?: Record<string, any>;
  expiresAt?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Notification schema
const notificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true,
    index: true
  },
  
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  priority: {
    type: String,
    enum: Object.values(NotificationPriority),
    default: NotificationPriority.MEDIUM,
    index: true
  },
  
  channels: [{
    type: String,
    enum: Object.values(NotificationChannel),
    required: true
  }],
  
  relatedEntity: {
    type: {
      type: String,
      enum: ['user', 'property', 'match', 'message', 'conversation']
    },
    id: {
      type: Schema.Types.ObjectId,
      refPath: 'relatedEntity.type'
    }
  },
  
  deliveryStatus: {
    type: Map,
    of: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      error: String
    },
    default: {}
  },
  
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  
  readAt: Date,
  
  clicked: {
    type: Boolean,
    default: false
  },
  
  clickedAt: Date,
  
  dismissed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  dismissedAt: Date,
  
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for checking if notification is actionable
notificationSchema.virtual('isActionable').get(function() {
  return !this.read && !this.dismissed && !this.isExpired;
});

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsClicked = function() {
  this.clicked = true;
  this.clickedAt = new Date();
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
  }
  return this.save();
};

notificationSchema.methods.dismiss = function() {
  this.dismissed = true;
  this.dismissedAt = new Date();
  return this.save();
};

notificationSchema.methods.updateDeliveryStatus = function(
  channel: NotificationChannel,
  status: { sent?: boolean; delivered?: boolean; error?: string }
) {
  if (!this.deliveryStatus) {
    this.deliveryStatus = new Map();
  }
  
  const currentStatus = this.deliveryStatus.get(channel) || {};
  
  if (status.sent !== undefined) {
    currentStatus.sent = status.sent;
    currentStatus.sentAt = new Date();
  }
  
  if (status.delivered !== undefined) {
    currentStatus.delivered = status.delivered;
    currentStatus.deliveredAt = new Date();
  }
  
  if (status.error !== undefined) {
    currentStatus.error = status.error;
  }
  
  this.deliveryStatus.set(channel, currentStatus);
  return this.save();
};

// Static methods
notificationSchema.statics.getUnreadCount = function(userId: mongoose.Types.ObjectId) {
  return this.countDocuments({
    userId,
    read: false,
    dismissed: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

notificationSchema.statics.markAllAsRead = function(userId: mongoose.Types.ObjectId) {
  return this.updateMany(
    {
      userId,
      read: false,
      dismissed: false
    },
    {
      $set: {
        read: true,
        readAt: new Date()
      }
    }
  );
};

notificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Set default expiration for certain notification types (30 days)
  if (!this.expiresAt && this.isNew) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    this.expiresAt = thirtyDaysFromNow;
  }
  
  next();
});

// Create and export the model
export const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
