import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Conversation, Message } from '../models/Conversation';
import { Match } from '../models/Match';
import { User } from '../models/User.model';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';
import { catchAsync } from '../utils/catchAsync';

/**
 * Create a new conversation
 */
export const createConversation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { 
    participantIds, 
    conversationType = 'direct',
    title,
    description,
    matchId,
    propertyId 
  } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Validate participants
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      throw new AppError('Participant IDs are required', 400);
    }

    // Add current user to participants if not already included
    const allParticipants = [...new Set([userId.toString(), ...participantIds])];

    // For direct conversations, ensure exactly 2 participants
    if (conversationType === 'direct' && allParticipants.length !== 2) {
      throw new AppError('Direct conversations must have exactly 2 participants', 400);
    }

    // Check if direct conversation already exists
    if (conversationType === 'direct') {
      const existingConversation = await Conversation.findOne({
        conversationType: 'direct',
        participants: { $all: allParticipants, $size: 2 },
        status: { $ne: 'deleted' }
      });

      if (existingConversation) {
        return res.json({
          success: true,
          data: { conversation: existingConversation },
          message: 'Conversation already exists'
        });
      }
    }

    // Verify all participants exist
    const users = await User.find({ _id: { $in: allParticipants } });
    if (users.length !== allParticipants.length) {
      throw new AppError('One or more participants not found', 404);
    }

    // Create participant details
    const participantDetails = allParticipants.map(participantId => ({
      userId: new Types.ObjectId(participantId),
      joinedAt: new Date(),
      role: participantId === userId.toString() ? 'admin' : 'member',
      isActive: true,
      lastSeenAt: new Date(),
      unreadCount: 0,
      isMuted: false
    }));

    // Create conversation
    const conversation = new Conversation({
      participants: allParticipants.map(id => new Types.ObjectId(id)),
      participantDetails,
      conversationType,
      title: conversationType === 'group' ? title : undefined,
      description: conversationType === 'group' ? description : undefined,
      matchId: matchId ? new Types.ObjectId(matchId) : undefined,
      propertyId: propertyId ? new Types.ObjectId(propertyId) : undefined,
      settings: {
        allowFileSharing: true,
        allowLocationSharing: true,
        allowPropertySharing: true,
        maxParticipants: conversationType === 'direct' ? 2 : 50,
        autoDeleteMessages: false,
        requireApprovalForNewMembers: conversationType === 'group'
      },
      analytics: {
        totalMessages: 0,
        totalParticipants: allParticipants.length,
        averageResponseTime: 0,
        lastActivityAt: new Date(),
        messagesThisWeek: 0,
        messagesThisMonth: 0
      }
    });

    await conversation.save();

    // Populate conversation with participant details
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', 'firstName lastName avatar email accountType')
      .populate('matchId', 'compatibilityScore matchType status')
      .populate('propertyId', 'title propertyType location pricing photos');

    // If conversation is created from a match, create a system message
    if (matchId) {
      const match = await Match.findById(matchId);
      if (match) {
        const systemMessage = new Message({
          conversationId: conversation._id,
          senderId: userId,
          receiverId: allParticipants.find(id => id !== userId.toString()),
          messageType: 'system',
          content: `You matched! Start your conversation here.`,
          metadata: {
            systemMessageType: 'match_created'
          },
          status: 'delivered'
        });

        await systemMessage.save();
        await conversation.updateLastMessage(systemMessage);
      }
    }

    logger.info(`Created ${conversationType} conversation ${conversation._id} with ${allParticipants.length} participants`);

    return res.status(201).json({
      success: true,
      data: { conversation: populatedConversation },
      message: 'Conversation created successfully'
    });

  } catch (error) {
    logger.error('Error creating conversation:', error);
    throw new AppError('Failed to create conversation', 500);
  }
});

/**
 * Get user's conversations
 */
export const getUserConversations = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { 
    page = 1, 
    limit = 20, 
    status = 'active',
    conversationType,
    search 
  } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Build query
    const query: any = {
      participants: userId,
      status: status === 'all' ? { $ne: 'deleted' } : status
    };

    if (conversationType && conversationType !== 'all') {
      query.conversationType = conversationType;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [conversations, totalCount] = await Promise.all([
      Conversation.find(query)
        .populate('participants', 'firstName lastName avatar email accountType isOnline lastActiveAt')
        .populate('lastMessage.senderId', 'firstName lastName avatar')
        .populate('matchId', 'compatibilityScore matchType status')
        .populate('propertyId', 'title propertyType location pricing photos')
        .sort({ 'analytics.lastActivityAt': -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Conversation.countDocuments(query)
    ]);

    // Format conversations with user-specific data
    const formattedConversations = conversations.map(conversation => {
      const userParticipantDetail = conversation.participantDetails.find(
        (pd: any) => pd.userId.toString() === userId.toString()
      );

      return {
        ...conversation,
        unreadCount: userParticipantDetail?.unreadCount || 0,
        isMuted: userParticipantDetail?.isMuted || false,
        lastSeenAt: userParticipantDetail?.lastSeenAt,
        // For direct conversations, get the other participant's info
        otherParticipant: conversation.conversationType === 'direct' 
          ? conversation.participants.find((p: any) => p._id.toString() !== userId.toString())
          : null
      };
    });

    return res.json({
      success: true,
      data: {
        conversations: formattedConversations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum)
        }
      }
    });

  } catch (error) {
    logger.error('Error getting user conversations:', error);
    throw new AppError('Failed to get conversations', 500);
  }
});

/**
 * Get conversation by ID
 */
export const getConversationById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
      status: { $ne: 'deleted' }
    })
    .populate('participants', 'firstName lastName avatar email accountType isOnline lastActiveAt')
    .populate('matchId', 'compatibilityScore matchType status matchReason')
    .populate('propertyId', 'title propertyType location pricing photos amenities');

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Get user-specific data
    const userParticipantDetail = conversation.participantDetails.find(
      (pd: any) => pd.userId.toString() === userId.toString()
    );

    const formattedConversation = {
      ...conversation.toObject(),
      unreadCount: userParticipantDetail?.unreadCount || 0,
      isMuted: userParticipantDetail?.isMuted || false,
      lastSeenAt: userParticipantDetail?.lastSeenAt,
      canSendMessage: conversation.canUserSendMessage(new Types.ObjectId(userId)),
      otherParticipant: conversation.conversationType === 'direct' 
        ? conversation.participants.find((p: any) => p._id.toString() !== userId.toString())
        : null
    };

    return res.json({
      success: true,
      data: { conversation: formattedConversation }
    });

  } catch (error) {
    logger.error('Error getting conversation:', error);
    throw new AppError('Failed to get conversation', 500);
  }
});

/**
 * Update conversation
 */
export const updateConversation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  const updates = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
      status: { $ne: 'deleted' }
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Check if user has permission to update (admin role for group conversations)
    if (conversation.conversationType === 'group') {
      const userParticipantDetail = conversation.participantDetails.find(
        (pd: any) => pd.userId.toString() === userId.toString()
      );

      if (!userParticipantDetail || userParticipantDetail.role !== 'admin') {
        throw new AppError('Only admins can update group conversations', 403);
      }
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'description', 'avatar', 'settings'];
    const updateData: any = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    const updatedConversation = await Conversation.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('participants', 'firstName lastName avatar email accountType');

    logger.info(`Updated conversation ${id} by user ${userId}`);

    return res.json({
      success: true,
      data: { conversation: updatedConversation },
      message: 'Conversation updated successfully'
    });

  } catch (error) {
    logger.error('Error updating conversation:', error);
    throw new AppError('Failed to update conversation', 500);
  }
});

/**
 * Archive conversation
 */
export const archiveConversation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: id,
        participants: userId,
        status: { $ne: 'deleted' }
      },
      { status: 'archived' },
      { new: true }
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    logger.info(`Archived conversation ${id} by user ${userId}`);

    return res.json({
      success: true,
      message: 'Conversation archived successfully'
    });

  } catch (error) {
    logger.error('Error archiving conversation:', error);
    throw new AppError('Failed to archive conversation', 500);
  }
});

/**
 * Delete conversation
 */
export const deleteConversation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: id,
        participants: userId,
        status: { $ne: 'deleted' }
      },
      { status: 'deleted' },
      { new: true }
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    logger.info(`Deleted conversation ${id} by user ${userId}`);

    return res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting conversation:', error);
    throw new AppError('Failed to delete conversation', 500);
  }
});

/**
 * Mute/unmute conversation
 */
export const toggleMuteConversation = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  const { isMuted, mutedUntil } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
      status: { $ne: 'deleted' }
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Update user's mute status
    const participantDetail = conversation.participantDetails.find(
      (pd: any) => pd.userId.toString() === userId.toString()
    );

    if (participantDetail) {
      participantDetail.isMuted = isMuted;
      if (mutedUntil) {
        participantDetail.mutedUntil = new Date(mutedUntil);
      } else {
        delete participantDetail.mutedUntil;
      }
      await conversation.save();
    }

    logger.info(`${isMuted ? 'Muted' : 'Unmuted'} conversation ${id} by user ${userId}`);

    return res.json({
      success: true,
      data: {
        isMuted,
        mutedUntil
      },
      message: `Conversation ${isMuted ? 'muted' : 'unmuted'} successfully`
    });

  } catch (error) {
    logger.error('Error toggling mute conversation:', error);
    throw new AppError('Failed to toggle mute conversation', 500);
  }
});
