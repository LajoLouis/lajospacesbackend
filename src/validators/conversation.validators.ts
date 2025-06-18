import Joi from 'joi';

/**
 * Create conversation validation schema
 */
export const createConversationSchema = Joi.object({
  participantIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(49)
    .required()
    .messages({
      'array.min': 'At least one participant is required',
      'array.max': 'Maximum 49 participants allowed',
      'string.pattern.base': 'Invalid participant ID format'
    }),
  
  conversationType: Joi.string()
    .valid('direct', 'group', 'support')
    .default('direct')
    .messages({
      'any.only': 'Conversation type must be direct, group, or support'
    }),
  
  title: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .when('conversationType', {
      is: 'group',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.min': 'Title must be at least 1 character',
      'string.max': 'Title cannot exceed 100 characters',
      'any.required': 'Title is required for group conversations'
    }),
  
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  matchId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid match ID format'
    }),
  
  propertyId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid property ID format'
    })
});

/**
 * Update conversation validation schema
 */
export const updateConversationSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Title must be at least 1 character',
      'string.max': 'Title cannot exceed 100 characters'
    }),
  
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  avatar: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'Avatar must be a valid URL'
    }),
  
  settings: Joi.object({
    allowFileSharing: Joi.boolean().optional(),
    allowLocationSharing: Joi.boolean().optional(),
    allowPropertySharing: Joi.boolean().optional(),
    maxParticipants: Joi.number().min(2).max(50).optional(),
    autoDeleteMessages: Joi.boolean().optional(),
    autoDeleteAfterDays: Joi.number().min(1).max(365).optional(),
    requireApprovalForNewMembers: Joi.boolean().optional()
  }).optional()
});

/**
 * Send message validation schema
 */
export const sendMessageSchema = Joi.object({
  content: Joi.string()
    .trim()
    .min(1)
    .max(5000)
    .required()
    .messages({
      'string.empty': 'Message content is required',
      'string.min': 'Message must be at least 1 character',
      'string.max': 'Message cannot exceed 5000 characters'
    }),
  
  messageType: Joi.string()
    .valid('text', 'image', 'file', 'location', 'property_share', 'system')
    .default('text')
    .messages({
      'any.only': 'Invalid message type'
    }),
  
  metadata: Joi.object({
    fileName: Joi.string().trim().max(255).optional(),
    fileSize: Joi.number().min(0).max(100 * 1024 * 1024).optional(), // 100MB max
    fileType: Joi.string().trim().max(100).optional(),
    imageUrl: Joi.string().uri().optional(),
    thumbnailUrl: Joi.string().uri().optional(),
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      address: Joi.string().trim().max(500).optional()
    }).optional(),
    propertyId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    systemMessageType: Joi.string()
      .valid('match_created', 'match_expired', 'user_joined', 'user_left')
      .optional()
  }).optional(),
  
  replyTo: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid reply-to message ID format'
    })
});

/**
 * Edit message validation schema
 */
export const editMessageSchema = Joi.object({
  content: Joi.string()
    .trim()
    .min(1)
    .max(5000)
    .required()
    .messages({
      'string.empty': 'Message content is required',
      'string.min': 'Message must be at least 1 character',
      'string.max': 'Message cannot exceed 5000 characters'
    })
});

/**
 * Delete message validation schema
 */
export const deleteMessageSchema = Joi.object({
  deleteForEveryone: Joi.boolean()
    .default(false)
    .optional()
});

/**
 * React to message validation schema
 */
export const reactToMessageSchema = Joi.object({
  reaction: Joi.string()
    .valid('like', 'love', 'laugh', 'wow', 'sad', 'angry')
    .required()
    .messages({
      'any.only': 'Invalid reaction type',
      'any.required': 'Reaction is required'
    })
});

/**
 * Mark messages as read validation schema
 */
export const markAsReadSchema = Joi.object({
  messageIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .optional()
    .messages({
      'string.pattern.base': 'Invalid message ID format'
    })
});

/**
 * Conversation query validation schema
 */
export const conversationQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1).optional(),
  limit: Joi.number().min(1).max(100).default(20).optional(),
  status: Joi.string()
    .valid('active', 'archived', 'blocked', 'deleted', 'all')
    .default('active')
    .optional(),
  conversationType: Joi.string()
    .valid('direct', 'group', 'support', 'all')
    .default('all')
    .optional(),
  search: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters'
    })
});

/**
 * Message query validation schema
 */
export const messageQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1).optional(),
  limit: Joi.number().min(1).max(100).default(50).optional(),
  before: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid message ID format for before parameter'
    }),
  after: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid message ID format for after parameter'
    }),
  messageType: Joi.string()
    .valid('text', 'image', 'file', 'location', 'property_share', 'system', 'all')
    .default('all')
    .optional(),
  search: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters'
    })
});

/**
 * Search messages validation schema
 */
export const searchMessagesSchema = Joi.object({
  query: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Search query is required',
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters'
    }),
  
  conversationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid conversation ID format'
    }),
  
  messageType: Joi.string()
    .valid('text', 'image', 'file', 'location', 'property_share', 'system', 'all')
    .default('all')
    .optional(),
  
  page: Joi.number().min(1).default(1).optional(),
  limit: Joi.number().min(1).max(50).default(20).optional(),
  
  dateFrom: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'Date from must be in ISO format'
    }),
  
  dateTo: Joi.date()
    .iso()
    .min(Joi.ref('dateFrom'))
    .optional()
    .messages({
      'date.format': 'Date to must be in ISO format',
      'date.min': 'Date to must be after date from'
    })
});

/**
 * Mute conversation validation schema
 */
export const muteConversationSchema = Joi.object({
  isMuted: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Mute status is required',
      'boolean.base': 'Mute status must be a boolean'
    }),
  
  mutedUntil: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.format': 'Muted until must be in ISO format',
      'date.min': 'Muted until must be in the future'
    })
});

/**
 * Add participant validation schema
 */
export const addParticipantSchema = Joi.object({
  participantIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least one participant is required',
      'array.max': 'Maximum 10 participants can be added at once',
      'string.pattern.base': 'Invalid participant ID format'
    })
});

/**
 * Remove participant validation schema
 */
export const removeParticipantSchema = Joi.object({
  participantId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid participant ID format',
      'any.required': 'Participant ID is required'
    })
});

/**
 * File upload validation schema
 */
export const fileUploadSchema = Joi.object({
  messageType: Joi.string()
    .valid('image', 'file')
    .required()
    .messages({
      'any.only': 'Message type must be image or file',
      'any.required': 'Message type is required'
    }),
  
  caption: Joi.string()
    .trim()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Caption cannot exceed 500 characters'
    })
});

export default {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  reactToMessageSchema,
  markAsReadSchema,
  conversationQuerySchema,
  messageQuerySchema,
  searchMessagesSchema,
  muteConversationSchema,
  addParticipantSchema,
  removeParticipantSchema,
  fileUploadSchema
};
