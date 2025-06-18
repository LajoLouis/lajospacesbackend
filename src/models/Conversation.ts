import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  messageType: 'text' | 'image' | 'file' | 'location' | 'property_share' | 'system';
  content: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    propertyId?: Types.ObjectId;
    systemMessageType?: 'match_created' | 'match_expired' | 'user_joined' | 'user_left';
  };
  
  // Message status
  status: 'sent' | 'delivered' | 'read' | 'failed';
  deliveredAt?: Date;
  readAt?: Date;
  
  // Message reactions and interactions
  reactions?: {
    userId: Types.ObjectId;
    reaction: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
    createdAt: Date;
  }[];
  
  // Message threading (for replies)
  replyTo?: Types.ObjectId;
  isEdited: boolean;
  editedAt?: Date;
  originalContent?: string;
  
  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversation extends Document {
  // Participants
  participants: Types.ObjectId[];
  participantDetails: {
    userId: Types.ObjectId;
    joinedAt: Date;
    leftAt?: Date;
    role: 'member' | 'admin';
    isActive: boolean;
    lastSeenAt?: Date;
    unreadCount: number;
    isMuted: boolean;
    mutedUntil?: Date;
  }[];
  
  // Conversation metadata
  conversationType: 'direct' | 'group' | 'support';
  title?: string; // For group conversations
  description?: string;
  avatar?: string;
  
  // Related entities
  matchId?: Types.ObjectId; // If conversation started from a match
  propertyId?: Types.ObjectId; // If conversation is about a specific property
  
  // Last message info
  lastMessage?: {
    messageId: Types.ObjectId;
    content: string;
    senderId: Types.ObjectId;
    messageType: string;
    sentAt: Date;
  };
  
  // Conversation settings
  settings: {
    allowFileSharing: boolean;
    allowLocationSharing: boolean;
    allowPropertySharing: boolean;
    maxParticipants: number;
    autoDeleteMessages: boolean;
    autoDeleteAfterDays?: number;
    requireApprovalForNewMembers: boolean;
  };
  
  // Conversation status
  status: 'active' | 'archived' | 'blocked' | 'deleted';
  isActive: boolean;
  
  // Analytics
  analytics: {
    totalMessages: number;
    totalParticipants: number;
    averageResponseTime: number; // in minutes
    lastActivityAt: Date;
    messagesThisWeek: number;
    messagesThisMonth: number;
  };
  
  // Moderation
  moderationFlags: {
    isReported: boolean;
    reportedBy?: Types.ObjectId[];
    reportReason?: string[];
    moderatedBy?: Types.ObjectId;
    moderatedAt?: Date;
    moderationAction?: 'none' | 'warning' | 'restricted' | 'suspended';
  };
  
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  addParticipant(userId: Types.ObjectId): Promise<void>;
  removeParticipant(userId: Types.ObjectId): Promise<void>;
  updateLastMessage(message: IMessage): Promise<void>;
  markAsRead(userId: Types.ObjectId, messageId?: Types.ObjectId): Promise<void>;
  getUnreadCount(userId: Types.ObjectId): number;
  isParticipant(userId: Types.ObjectId): boolean;
  canUserSendMessage(userId: Types.ObjectId): boolean;
}

// Message Schema
const MessageSchema = new Schema<IMessage>({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'location', 'property_share', 'system'],
    default: 'text',
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000,
    trim: true
  },
  metadata: {
    fileName: { type: String, trim: true },
    fileSize: { type: Number, min: 0 },
    fileType: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    thumbnailUrl: { type: String, trim: true },
    location: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      address: { type: String, trim: true }
    },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    systemMessageType: {
      type: String,
      enum: ['match_created', 'match_expired', 'user_joined', 'user_left']
    }
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent',
    index: true
  },
  deliveredAt: { type: Date, index: true },
  readAt: { type: Date, index: true },
  reactions: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reaction: {
      type: String,
      enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry'],
      required: true
    },
    createdAt: { type: Date, default: Date.now }
  }],
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  originalContent: { type: String },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Conversation Schema
const ConversationSchema = new Schema<IConversation>({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  participantDetails: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    unreadCount: { type: Number, default: 0, min: 0 },
    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date }
  }],
  conversationType: {
    type: String,
    enum: ['direct', 'group', 'support'],
    default: 'direct',
    index: true
  },
  title: { type: String, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  avatar: { type: String, trim: true },
  matchId: { type: Schema.Types.ObjectId, ref: 'Match', index: true },
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', index: true },
  lastMessage: {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    content: { type: String, maxlength: 200 },
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    messageType: { type: String },
    sentAt: { type: Date }
  },
  settings: {
    allowFileSharing: { type: Boolean, default: true },
    allowLocationSharing: { type: Boolean, default: true },
    allowPropertySharing: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 2, min: 2, max: 50 },
    autoDeleteMessages: { type: Boolean, default: false },
    autoDeleteAfterDays: { type: Number, min: 1, max: 365 },
    requireApprovalForNewMembers: { type: Boolean, default: false }
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked', 'deleted'],
    default: 'active',
    index: true
  },
  isActive: { type: Boolean, default: true, index: true },
  analytics: {
    totalMessages: { type: Number, default: 0, min: 0 },
    totalParticipants: { type: Number, default: 0, min: 0 },
    averageResponseTime: { type: Number, default: 0, min: 0 },
    lastActivityAt: { type: Date, default: Date.now },
    messagesThisWeek: { type: Number, default: 0, min: 0 },
    messagesThisMonth: { type: Number, default: 0, min: 0 }
  },
  moderationFlags: {
    isReported: { type: Boolean, default: false },
    reportedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reportReason: [{ type: String, trim: true }],
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    moderationAction: {
      type: String,
      enum: ['none', 'warning', 'restricted', 'suspended'],
      default: 'none'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, status: 1 });
MessageSchema.index({ conversationId: 1, status: 1, createdAt: -1 });
MessageSchema.index({ replyTo: 1 });
MessageSchema.index({ isDeleted: 1, createdAt: -1 });

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ 'participantDetails.userId': 1 });
ConversationSchema.index({ matchId: 1 });
ConversationSchema.index({ propertyId: 1 });
ConversationSchema.index({ status: 1, isActive: 1 });
ConversationSchema.index({ 'lastMessage.sentAt': -1 });
ConversationSchema.index({ 'analytics.lastActivityAt': -1 });

// Compound index for user conversations
ConversationSchema.index({
  participants: 1,
  status: 1,
  'analytics.lastActivityAt': -1
});

// Instance methods for Conversation
ConversationSchema.methods.addParticipant = async function(userId: Types.ObjectId): Promise<void> {
  if (!this.isParticipant(userId)) {
    this.participants.push(userId);
    this.participantDetails.push({
      userId,
      joinedAt: new Date(),
      role: 'member',
      isActive: true,
      lastSeenAt: new Date(),
      unreadCount: 0,
      isMuted: false
    });
    this.analytics.totalParticipants = this.participants.length;
    await this.save();
  }
};

ConversationSchema.methods.removeParticipant = async function(userId: Types.ObjectId): Promise<void> {
  const participantIndex = this.participants.findIndex((p: Types.ObjectId) => p.toString() === userId.toString());
  if (participantIndex > -1) {
    this.participants.splice(participantIndex, 1);

    const detailIndex = this.participantDetails.findIndex((pd: any) => pd.userId.toString() === userId.toString());
    if (detailIndex > -1) {
      this.participantDetails[detailIndex].isActive = false;
      this.participantDetails[detailIndex].leftAt = new Date();
    }

    this.analytics.totalParticipants = this.participants.length;
    await this.save();
  }
};

ConversationSchema.methods.updateLastMessage = async function(message: IMessage): Promise<void> {
  this.lastMessage = {
    messageId: message._id,
    content: message.content.substring(0, 200),
    senderId: message.senderId,
    messageType: message.messageType,
    sentAt: message.createdAt
  };

  this.analytics.lastActivityAt = new Date();
  this.analytics.totalMessages += 1;

  // Update unread counts for other participants
  this.participantDetails.forEach((pd: any) => {
    if (pd.userId.toString() !== message.senderId.toString() && pd.isActive) {
      pd.unreadCount += 1;
    }
  });

  await this.save();
};

ConversationSchema.methods.markAsRead = async function(userId: Types.ObjectId, messageId?: Types.ObjectId): Promise<void> {
  const participantDetail = this.participantDetails.find((pd: any) =>
    pd.userId.toString() === userId.toString()
  );

  if (participantDetail) {
    participantDetail.unreadCount = 0;
    participantDetail.lastSeenAt = new Date();
    await this.save();

    // Mark specific message as read if provided
    if (messageId) {
      await Message.findByIdAndUpdate(messageId, {
        status: 'read',
        readAt: new Date()
      });
    }
  }
};

ConversationSchema.methods.getUnreadCount = function(userId: Types.ObjectId): number {
  const participantDetail = this.participantDetails.find((pd: any) =>
    pd.userId.toString() === userId.toString()
  );
  return participantDetail ? participantDetail.unreadCount : 0;
};

ConversationSchema.methods.isParticipant = function(userId: Types.ObjectId): boolean {
  return this.participants.some((p: Types.ObjectId) => p.toString() === userId.toString());
};

ConversationSchema.methods.canUserSendMessage = function(userId: Types.ObjectId): boolean {
  if (!this.isParticipant(userId)) return false;
  if (this.status !== 'active') return false;

  const participantDetail = this.participantDetails.find((pd: any) =>
    pd.userId.toString() === userId.toString()
  );

  return participantDetail ? participantDetail.isActive : false;
};

// Pre-save middleware
ConversationSchema.pre('save', function(next) {
  // Update analytics
  this.analytics.totalParticipants = this.participants.length;

  // Ensure at least 2 participants for direct conversations
  if (this.conversationType === 'direct' && this.participants.length !== 2) {
    return next(new Error('Direct conversations must have exactly 2 participants'));
  }

  next();
});

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
