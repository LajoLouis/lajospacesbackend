import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Conversation, Message } from '../models/Conversation';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';
import { catchAsync } from '../utils/catchAsync';

/**
 * Get messages for a conversation with pagination
 */
export const getConversationMessages = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { conversationId } = req.params;
  const { 
    page = 1, 
    limit = 50, 
    before, // Message ID to get messages before (for pagination)
    after,  // Message ID to get messages after
    messageType,
    search
  } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      status: { $ne: 'deleted' }
    });

    if (!conversation) {
      throw new AppError('Conversation not found or access denied', 404);
    }

    // Build query
    const query: any = {
      conversationId,
      isDeleted: false
    };

    // Add message type filter
    if (messageType && messageType !== 'all') {
      query.messageType = messageType;
    }

    // Add search filter
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    // Handle cursor-based pagination
    if (before) {
      const beforeMessage = await Message.findById(before);
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    if (after) {
      const afterMessage = await Message.findById(after);
      if (afterMessage) {
        query.createdAt = { $gt: afterMessage.createdAt };
      }
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 messages per request
    const skip = (pageNum - 1) * limitNum;

    const [messages, totalCount] = await Promise.all([
      Message.find(query)
        .populate('senderId', 'firstName lastName avatar')
        .populate('receiverId', 'firstName lastName avatar')
        .populate('replyTo', 'content senderId messageType')
        .populate('metadata.propertyId', 'title propertyType location pricing photos')
        .sort({ createdAt: -1 }) // Most recent first
        .skip(before || after ? 0 : skip) // Skip only for regular pagination
        .limit(limitNum)
        .lean(),
      Message.countDocuments(query)
    ]);

    // Mark messages as delivered for the requesting user
    const undeliveredMessages = messages.filter(msg => 
      msg.receiverId.toString() === userId.toString() && 
      msg.status === 'sent'
    );

    if (undeliveredMessages.length > 0) {
      await Message.updateMany(
        {
          _id: { $in: undeliveredMessages.map(msg => msg._id) },
          status: 'sent'
        },
        {
          status: 'delivered',
          deliveredAt: new Date()
        }
      );
    }

    // Format messages for response
    const formattedMessages = messages.map(message => ({
      ...message,
      isSentByUser: message.senderId._id.toString() === userId.toString(),
      canEdit: message.senderId._id.toString() === userId.toString() && 
               message.messageType === 'text' && 
               !message.isDeleted,
      canDelete: message.senderId._id.toString() === userId.toString() && 
                 !message.isDeleted
    }));

    // Get pagination info
    const hasMore = totalCount > (pageNum * limitNum);
    const hasPrevious = pageNum > 1;

    return res.json({
      success: true,
      data: {
        messages: formattedMessages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
          hasMore,
          hasPrevious,
          // Cursor info for infinite scroll
          cursors: {
            before: messages.length > 0 ? messages[0]._id : null,
            after: messages.length > 0 ? messages[messages.length - 1]._id : null
          }
        },
        conversationInfo: {
          id: conversation._id,
          type: conversation.conversationType,
          participantCount: conversation.participants.length,
          unreadCount: conversation.getUnreadCount(new Types.ObjectId(userId))
        }
      }
    });

  } catch (error) {
    logger.error('Error getting conversation messages:', error);
    throw new AppError('Failed to get messages', 500);
  }
});

/**
 * Send a message
 */
export const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { conversationId } = req.params;
  const { content, messageType = 'text', metadata, replyTo } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!content || content.trim().length === 0) {
    throw new AppError('Message content is required', 400);
  }

  try {
    // Verify conversation and user permissions
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.canUserSendMessage(new Types.ObjectId(userId))) {
      throw new AppError('Cannot send message to this conversation', 403);
    }

    // Get receiver ID (for direct conversations)
    const receiverId = conversation.participants.find(p => p.toString() !== userId.toString());

    // Validate reply-to message if provided
    if (replyTo) {
      const replyToMessage = await Message.findOne({
        _id: replyTo,
        conversationId,
        isDeleted: false
      });

      if (!replyToMessage) {
        throw new AppError('Reply-to message not found', 404);
      }
    }

    // Create message
    const message = new Message({
      conversationId,
      senderId: userId,
      receiverId,
      messageType,
      content: content.trim(),
      metadata,
      replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
      status: 'sent'
    });

    await message.save();

    // Update conversation
    await conversation.updateLastMessage(message);

    // Populate message for response
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'firstName lastName avatar')
      .populate('receiverId', 'firstName lastName avatar')
      .populate('replyTo', 'content senderId messageType')
      .populate('metadata.propertyId', 'title propertyType location pricing photos');

    logger.info(`Message sent from ${userId} to conversation ${conversationId}`);

    return res.status(201).json({
      success: true,
      data: { message: populatedMessage },
      message: 'Message sent successfully'
    });

  } catch (error) {
    logger.error('Error sending message:', error);
    throw new AppError('Failed to send message', 500);
  }
});

/**
 * Edit a message
 */
export const editMessage = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { messageId } = req.params;
  const { content } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!content || content.trim().length === 0) {
    throw new AppError('Message content is required', 400);
  }

  try {
    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
      messageType: 'text',
      isDeleted: false
    });

    if (!message) {
      throw new AppError('Message not found or cannot be edited', 404);
    }

    // Check if message is too old to edit (24 hours)
    const messageAge = Date.now() - message.createdAt.getTime();
    const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours

    if (messageAge > maxEditAge) {
      throw new AppError('Message is too old to edit', 400);
    }

    // Store original content if not already edited
    if (!message.isEdited) {
      message.originalContent = message.content;
    }

    // Update message
    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();

    // Populate message for response
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'firstName lastName avatar')
      .populate('receiverId', 'firstName lastName avatar');

    logger.info(`Message ${messageId} edited by user ${userId}`);

    return res.json({
      success: true,
      data: { message: populatedMessage },
      message: 'Message edited successfully'
    });

  } catch (error) {
    logger.error('Error editing message:', error);
    throw new AppError('Failed to edit message', 500);
  }
});

/**
 * Delete a message
 */
export const deleteMessage = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { messageId } = req.params;
  const { deleteForEveryone = false } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
      isDeleted: false
    });

    if (!message) {
      throw new AppError('Message not found or already deleted', 404);
    }

    // Check if user can delete for everyone (within 1 hour)
    const messageAge = Date.now() - message.createdAt.getTime();
    const maxDeleteForEveryoneAge = 60 * 60 * 1000; // 1 hour

    if (deleteForEveryone && messageAge > maxDeleteForEveryoneAge) {
      throw new AppError('Message is too old to delete for everyone', 400);
    }

    // Soft delete message
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = new Types.ObjectId(userId);

    if (deleteForEveryone) {
      message.content = 'This message was deleted';
    }

    await message.save();

    logger.info(`Message ${messageId} deleted by user ${userId} (deleteForEveryone: ${deleteForEveryone})`);

    return res.json({
      success: true,
      data: {
        messageId,
        deletedForEveryone: deleteForEveryone
      },
      message: 'Message deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting message:', error);
    throw new AppError('Failed to delete message', 500);
  }
});

/**
 * React to a message
 */
export const reactToMessage = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { messageId } = req.params;
  const { reaction } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
  if (!reaction || !validReactions.includes(reaction)) {
    throw new AppError('Invalid reaction type', 400);
  }

  try {
    const message = await Message.findOne({
      _id: messageId,
      isDeleted: false
    });

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Verify user is participant in the conversation
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: userId
    });

    if (!conversation) {
      throw new AppError('Access denied', 403);
    }

    // Check if user already reacted
    const existingReactionIndex = message.reactions?.findIndex(
      r => r.userId.toString() === userId.toString()
    ) ?? -1;

    if (existingReactionIndex > -1) {
      // Update existing reaction
      message.reactions![existingReactionIndex].reaction = reaction;
      message.reactions![existingReactionIndex].createdAt = new Date();
    } else {
      // Add new reaction
      if (!message.reactions) {
        message.reactions = [];
      }
      message.reactions.push({
        userId: new Types.ObjectId(userId),
        reaction,
        createdAt: new Date()
      });
    }

    await message.save();

    logger.info(`User ${userId} reacted to message ${messageId} with ${reaction}`);

    return res.json({
      success: true,
      data: {
        messageId,
        reaction,
        reactions: message.reactions
      },
      message: 'Reaction added successfully'
    });

  } catch (error) {
    logger.error('Error reacting to message:', error);
    throw new AppError('Failed to react to message', 500);
  }
});

/**
 * Remove reaction from message
 */
export const removeReaction = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { messageId } = req.params;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const message = await Message.findOne({
      _id: messageId,
      isDeleted: false
    });

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Remove user's reaction
    if (message.reactions) {
      message.reactions = message.reactions.filter(
        r => r.userId.toString() !== userId.toString()
      );
      await message.save();
    }

    logger.info(`User ${userId} removed reaction from message ${messageId}`);

    return res.json({
      success: true,
      data: {
        messageId,
        reactions: message.reactions
      },
      message: 'Reaction removed successfully'
    });

  } catch (error) {
    logger.error('Error removing reaction:', error);
    throw new AppError('Failed to remove reaction', 500);
  }
});

/**
 * Mark messages as read
 */
export const markMessagesAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { conversationId } = req.params;
  const { messageIds } = req.body; // Optional: specific message IDs to mark as read

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Verify conversation access
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      status: { $ne: 'deleted' }
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    let query: any = {
      conversationId,
      receiverId: userId,
      status: { $in: ['sent', 'delivered'] }
    };

    // If specific message IDs provided, only mark those
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      query._id = { $in: messageIds };
    }

    // Update messages to read status
    const result = await Message.updateMany(query, {
      status: 'read',
      readAt: new Date()
    });

    // Update conversation unread count
    await conversation.markAsRead(new Types.ObjectId(userId));

    logger.info(`Marked ${result.modifiedCount} messages as read for user ${userId} in conversation ${conversationId}`);

    return res.json({
      success: true,
      data: {
        markedCount: result.modifiedCount,
        conversationId
      },
      message: 'Messages marked as read'
    });

  } catch (error) {
    logger.error('Error marking messages as read:', error);
    throw new AppError('Failed to mark messages as read', 500);
  }
});

/**
 * Search messages across conversations
 */
export const searchMessages = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { 
    query: searchQuery, 
    conversationId,
    messageType,
    page = 1,
    limit = 20,
    dateFrom,
    dateTo
  } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!searchQuery || (searchQuery as string).trim().length < 2) {
    throw new AppError('Search query must be at least 2 characters', 400);
  }

  try {
    // Get user's conversations
    const userConversations = await Conversation.find({
      participants: userId,
      status: { $ne: 'deleted' }
    }).select('_id');

    const conversationIds = userConversations.map(c => c._id);

    // Build search query
    const searchFilter: any = {
      conversationId: conversationId ? conversationId : { $in: conversationIds },
      content: { $regex: searchQuery, $options: 'i' },
      isDeleted: false
    };

    if (messageType && messageType !== 'all') {
      searchFilter.messageType = messageType;
    }

    if (dateFrom || dateTo) {
      searchFilter.createdAt = {};
      if (dateFrom) searchFilter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) searchFilter.createdAt.$lte = new Date(dateTo as string);
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [messages, totalCount] = await Promise.all([
      Message.find(searchFilter)
        .populate('senderId', 'firstName lastName avatar')
        .populate('conversationId', 'conversationType title participants')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Message.countDocuments(searchFilter)
    ]);

    return res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum)
        },
        searchQuery
      }
    });

  } catch (error) {
    logger.error('Error searching messages:', error);
    throw new AppError('Failed to search messages', 500);
  }
});
