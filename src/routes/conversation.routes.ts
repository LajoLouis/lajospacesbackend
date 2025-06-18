import { Router } from 'express';
import {
  createConversation,
  getUserConversations,
  getConversationById,
  updateConversation,
  archiveConversation,
  deleteConversation,
  toggleMuteConversation
} from '../controllers/conversation.controller';
import {
  getConversationMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  removeReaction,
  markMessagesAsRead,
  searchMessages
} from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest, validateObjectId } from '../middleware/validation';
import {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  reactToMessageSchema,
  markAsReadSchema,
  searchMessagesSchema,
  conversationQuerySchema,
  messageQuerySchema
} from '../validators/conversation.validators';

const router = Router();

// All conversation routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation
 * @access  Private
 */
router.post(
  '/',
  validateRequest(createConversationSchema, 'body'),
  createConversation
);

/**
 * @route   GET /api/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
router.get(
  '/',
  validateRequest(conversationQuerySchema, 'query'),
  getUserConversations
);

/**
 * @route   GET /api/conversations/:id
 * @desc    Get conversation by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateObjectId('id'),
  getConversationById
);

/**
 * @route   PUT /api/conversations/:id
 * @desc    Update conversation
 * @access  Private
 */
router.put(
  '/:id',
  validateObjectId('id'),
  validateRequest(updateConversationSchema, 'body'),
  updateConversation
);

/**
 * @route   POST /api/conversations/:id/archive
 * @desc    Archive conversation
 * @access  Private
 */
router.post(
  '/:id/archive',
  validateObjectId('id'),
  archiveConversation
);

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Delete conversation
 * @access  Private
 */
router.delete(
  '/:id',
  validateObjectId('id'),
  deleteConversation
);

/**
 * @route   POST /api/conversations/:id/mute
 * @desc    Mute/unmute conversation
 * @access  Private
 */
router.post(
  '/:id/mute',
  validateObjectId('id'),
  toggleMuteConversation
);

// Message routes

/**
 * @route   GET /api/conversations/:conversationId/messages
 * @desc    Get messages for a conversation
 * @access  Private
 */
router.get(
  '/:conversationId/messages',
  validateObjectId('conversationId'),
  validateRequest(messageQuerySchema, 'query'),
  getConversationMessages
);

/**
 * @route   POST /api/conversations/:conversationId/messages
 * @desc    Send a message
 * @access  Private
 */
router.post(
  '/:conversationId/messages',
  validateObjectId('conversationId'),
  validateRequest(sendMessageSchema, 'body'),
  sendMessage
);

/**
 * @route   PUT /api/conversations/:conversationId/messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
router.put(
  '/:conversationId/messages/:messageId',
  validateObjectId('conversationId'),
  validateObjectId('messageId'),
  validateRequest(editMessageSchema, 'body'),
  editMessage
);

/**
 * @route   DELETE /api/conversations/:conversationId/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete(
  '/:conversationId/messages/:messageId',
  validateObjectId('conversationId'),
  validateObjectId('messageId'),
  validateRequest(deleteMessageSchema, 'body'),
  deleteMessage
);

/**
 * @route   POST /api/conversations/:conversationId/messages/:messageId/react
 * @desc    React to a message
 * @access  Private
 */
router.post(
  '/:conversationId/messages/:messageId/react',
  validateObjectId('conversationId'),
  validateObjectId('messageId'),
  validateRequest(reactToMessageSchema, 'body'),
  reactToMessage
);

/**
 * @route   DELETE /api/conversations/:conversationId/messages/:messageId/react
 * @desc    Remove reaction from message
 * @access  Private
 */
router.delete(
  '/:conversationId/messages/:messageId/react',
  validateObjectId('conversationId'),
  validateObjectId('messageId'),
  removeReaction
);

/**
 * @route   POST /api/conversations/:conversationId/messages/read
 * @desc    Mark messages as read
 * @access  Private
 */
router.post(
  '/:conversationId/messages/read',
  validateObjectId('conversationId'),
  validateRequest(markAsReadSchema, 'body'),
  markMessagesAsRead
);

/**
 * @route   GET /api/conversations/search/messages
 * @desc    Search messages across conversations
 * @access  Private
 */
router.get(
  '/search/messages',
  validateRequest(searchMessagesSchema, 'query'),
  searchMessages
);

export default router;
