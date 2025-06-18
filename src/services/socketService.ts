import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User } from '../models/User.model';
import { Conversation, Message } from '../models/Conversation';
import { logger } from '../utils/logger';


interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

interface OnlineUser {
  userId: string;
  socketId: string;
  lastSeen: Date;
  status: 'online' | 'away' | 'busy' | 'offline';
}

interface TypingUser {
  userId: string;
  conversationId: string;
  timestamp: Date;
}

export class SocketService {
  private io: SocketIOServer;
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private typingUsers: Map<string, TypingUser> = new Map();
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startCleanupInterval();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = (user as any)._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User ${socket.userId} connected with socket ${socket.id}`);
      
      // Handle user connection
      this.handleUserConnect(socket);

      // Message events
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));
      socket.on('message_delivered', (data) => this.handleMessageDelivered(socket, data));
      socket.on('message_read', (data) => this.handleMessageRead(socket, data));
      socket.on('edit_message', (data) => this.handleEditMessage(socket, data));
      socket.on('delete_message', (data) => this.handleDeleteMessage(socket, data));
      socket.on('react_to_message', (data) => this.handleMessageReaction(socket, data));

      // Conversation events
      socket.on('join_conversation', (data) => this.handleJoinConversation(socket, data));
      socket.on('leave_conversation', (data) => this.handleLeaveConversation(socket, data));
      socket.on('create_conversation', (data) => this.handleCreateConversation(socket, data));

      // Typing events
      socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));

      // Status events
      socket.on('status_change', (data) => this.handleStatusChange(socket, data));

      // Disconnect event
      socket.on('disconnect', () => this.handleUserDisconnect(socket));
    });
  }

  private async handleJoinConversation(socket: AuthenticatedSocket, data: any): Promise<void> {
    const { conversationId } = data;

    if (!socket.userId || !conversationId) return;

    try {
      // Verify user is participant in conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
        status: 'active'
      });

      if (conversation) {
        socket.join(`conversation_${conversationId}`);
        logger.debug(`User ${socket.userId} joined conversation ${conversationId}`);

        socket.emit('conversation_joined', { conversationId });
      } else {
        socket.emit('error', { message: 'Cannot join conversation' });
      }
    } catch (error) {
      logger.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  private async handleLeaveConversation(socket: AuthenticatedSocket, data: any): Promise<void> {
    const { conversationId } = data;

    if (!conversationId) return;

    socket.leave(`conversation_${conversationId}`);
    logger.debug(`User ${socket.userId} left conversation ${conversationId}`);

    socket.emit('conversation_left', { conversationId });
  }

  private async handleCreateConversation(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { participantIds, conversationType = 'direct', title, matchId } = data;

      if (!socket.userId || !participantIds) {
        socket.emit('error', { message: 'Invalid conversation data' });
        return;
      }

      // Add current user to participants
      const allParticipants = [...new Set([socket.userId, ...participantIds])];

      // Create conversation (simplified version)
      const conversation = new Conversation({
        participants: allParticipants.map(id => new Types.ObjectId(id)),
        participantDetails: allParticipants.map(participantId => ({
          userId: new Types.ObjectId(participantId),
          joinedAt: new Date(),
          role: participantId === socket.userId ? 'admin' : 'member',
          isActive: true,
          lastSeenAt: new Date(),
          unreadCount: 0,
          isMuted: false
        })),
        conversationType,
        title: conversationType === 'group' ? title : undefined,
        matchId: matchId ? new Types.ObjectId(matchId) : undefined,
        settings: {
          allowFileSharing: true,
          allowLocationSharing: true,
          allowPropertySharing: true,
          maxParticipants: conversationType === 'direct' ? 2 : 50,
          autoDeleteMessages: false,
          requireApprovalForNewMembers: false
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

      // Join all participants to the conversation room
      allParticipants.forEach(participantId => {
        const userSocketIds = this.userSockets.get(participantId);
        if (userSocketIds) {
          userSocketIds.forEach(socketId => {
            this.io.to(socketId).socketsJoin(`conversation_${conversation._id}`);
          });
        }
      });

      // Notify all participants
      this.io.to(`conversation_${conversation._id}`).emit('conversation_created', {
        conversation: conversation.toObject()
      });

      logger.info(`Conversation ${conversation._id} created by user ${socket.userId}`);
    } catch (error) {
      logger.error('Error creating conversation:', error);
      socket.emit('error', { message: 'Failed to create conversation' });
    }
  }

  private async handleEditMessage(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { messageId, content } = data;

      if (!socket.userId || !messageId || !content) {
        socket.emit('error', { message: 'Invalid edit data' });
        return;
      }

      const message = await Message.findOne({
        _id: messageId,
        senderId: socket.userId,
        messageType: 'text',
        isDeleted: false
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found or cannot be edited' });
        return;
      }

      // Check if message is too old to edit (24 hours)
      const messageAge = Date.now() - message.createdAt.getTime();
      if (messageAge > 24 * 60 * 60 * 1000) {
        socket.emit('error', { message: 'Message is too old to edit' });
        return;
      }

      // Store original content if not already edited
      if (!message.isEdited) {
        message.originalContent = message.content;
      }

      message.content = content.trim();
      message.isEdited = true;
      message.editedAt = new Date();

      await message.save();

      // Broadcast edit to conversation
      this.io.to(`conversation_${message.conversationId}`).emit('message_edited', {
        messageId,
        content: message.content,
        isEdited: true,
        editedAt: message.editedAt
      });

      logger.info(`Message ${messageId} edited by user ${socket.userId}`);
    } catch (error) {
      logger.error('Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  }

  private async handleDeleteMessage(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { messageId, deleteForEveryone = false } = data;

      if (!socket.userId || !messageId) {
        socket.emit('error', { message: 'Invalid delete data' });
        return;
      }

      const message = await Message.findOne({
        _id: messageId,
        senderId: socket.userId,
        isDeleted: false
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found or already deleted' });
        return;
      }

      // Check if user can delete for everyone (within 1 hour)
      const messageAge = Date.now() - message.createdAt.getTime();
      if (deleteForEveryone && messageAge > 60 * 60 * 1000) {
        socket.emit('error', { message: 'Message is too old to delete for everyone' });
        return;
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedBy = new Types.ObjectId(socket.userId);

      if (deleteForEveryone) {
        message.content = 'This message was deleted';
      }

      await message.save();

      // Broadcast deletion to conversation
      this.io.to(`conversation_${message.conversationId}`).emit('message_deleted', {
        messageId,
        deletedForEveryone: deleteForEveryone,
        deletedBy: socket.userId
      });

      logger.info(`Message ${messageId} deleted by user ${socket.userId}`);
    } catch (error) {
      logger.error('Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  }

  private async handleMessageReaction(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { messageId, reaction } = data;

      if (!socket.userId || !messageId || !reaction) {
        socket.emit('error', { message: 'Invalid reaction data' });
        return;
      }

      const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
      if (!validReactions.includes(reaction)) {
        socket.emit('error', { message: 'Invalid reaction type' });
        return;
      }

      const message = await Message.findOne({
        _id: messageId,
        isDeleted: false
      });

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Verify user is participant in the conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        participants: socket.userId
      });

      if (!conversation) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Check if user already reacted
      const existingReactionIndex = message.reactions?.findIndex(
        r => r.userId.toString() === socket.userId
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
          userId: new Types.ObjectId(socket.userId),
          reaction,
          createdAt: new Date()
        });
      }

      await message.save();

      // Broadcast reaction to conversation
      this.io.to(`conversation_${message.conversationId}`).emit('message_reaction', {
        messageId,
        userId: socket.userId,
        reaction,
        reactions: message.reactions
      });

      logger.info(`User ${socket.userId} reacted to message ${messageId} with ${reaction}`);
    } catch (error) {
      logger.error('Error reacting to message:', error);
      socket.emit('error', { message: 'Failed to react to message' });
    }
  }

  private handleUserConnect(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    // Add to online users
    this.onlineUsers.set(socket.userId, {
      userId: socket.userId,
      socketId: socket.id,
      lastSeen: new Date(),
      status: 'online'
    });

    // Track multiple sockets per user
    const userSocketIds = this.userSockets.get(socket.userId) || [];
    userSocketIds.push(socket.id);
    this.userSockets.set(socket.userId, userSocketIds);

    // Join user to their conversation rooms
    this.joinUserConversations(socket);

    // Broadcast online status to contacts
    this.broadcastUserStatus(socket.userId, 'online');

    // Send online users list to the connected user
    socket.emit('online_users', Array.from(this.onlineUsers.values()));
  }

  private async joinUserConversations(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.userId) return;

    try {
      const conversations = await Conversation.find({
        participants: socket.userId,
        status: 'active'
      }).select('_id');

      conversations.forEach(conversation => {
        socket.join(`conversation_${conversation._id}`);
      });

      logger.info(`User ${socket.userId} joined ${conversations.length} conversation rooms`);
    } catch (error) {
      logger.error('Error joining user conversations:', error);
    }
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { conversationId, content, messageType = 'text', metadata } = data;

      if (!socket.userId || !conversationId || !content) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Verify user can send message to this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.canUserSendMessage(new Types.ObjectId(socket.userId))) {
        socket.emit('error', { message: 'Cannot send message to this conversation' });
        return;
      }

      // Get receiver ID (for direct conversations)
      const receiverId = conversation.participants.find(p => p.toString() !== socket.userId);

      // Create message
      const message = new Message({
        conversationId,
        senderId: socket.userId,
        receiverId,
        messageType,
        content: content.trim(),
        metadata,
        status: 'sent'
      });

      await message.save();

      // Update conversation last message
      await conversation.updateLastMessage(message);

      // Populate message for response
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'firstName lastName avatar')
        .populate('receiverId', 'firstName lastName avatar');

      // Emit to conversation room
      this.io.to(`conversation_${conversationId}`).emit('new_message', {
        message: populatedMessage,
        conversationId
      });

      // Send delivery confirmation to sender
      socket.emit('message_sent', {
        tempId: data.tempId,
        message: populatedMessage
      });

      // Update message status to delivered if receiver is online
      if (receiverId && this.onlineUsers.has(receiverId.toString())) {
        message.status = 'delivered';
        message.deliveredAt = new Date();
        await message.save();

        this.io.to(`conversation_${conversationId}`).emit('message_delivered', {
          messageId: message._id,
          deliveredAt: message.deliveredAt
        });
      }

      logger.info(`Message sent from ${socket.userId} to conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handleMessageDelivered(_socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { messageId } = data;

      const message = await Message.findByIdAndUpdate(messageId, {
        status: 'delivered',
        deliveredAt: new Date()
      }, { new: true });

      if (message) {
        this.io.to(`conversation_${message.conversationId}`).emit('message_delivered', {
          messageId,
          deliveredAt: message.deliveredAt
        });
      }
    } catch (error) {
      logger.error('Error updating message delivery status:', error);
    }
  }

  private async handleMessageRead(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { messageId, conversationId } = data;

      if (!socket.userId) return;

      // Update message status
      const message = await Message.findByIdAndUpdate(messageId, {
        status: 'read',
        readAt: new Date()
      }, { new: true });

      if (message) {
        // Update conversation unread count
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          await conversation.markAsRead(new Types.ObjectId(socket.userId), new Types.ObjectId(messageId));
        }

        // Notify sender about read status
        this.io.to(`conversation_${conversationId}`).emit('message_read', {
          messageId,
          readAt: message.readAt,
          readBy: socket.userId
        });
      }
    } catch (error) {
      logger.error('Error updating message read status:', error);
    }
  }

  private async handleTypingStart(socket: AuthenticatedSocket, data: any): Promise<void> {
    const { conversationId } = data;
    
    if (!socket.userId || !conversationId) return;

    const typingKey = `${socket.userId}_${conversationId}`;
    this.typingUsers.set(typingKey, {
      userId: socket.userId,
      conversationId,
      timestamp: new Date()
    });

    // Broadcast typing status to other participants
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      conversationId,
      isTyping: true
    });
  }

  private async handleTypingStop(socket: AuthenticatedSocket, data: any): Promise<void> {
    const { conversationId } = data;
    
    if (!socket.userId || !conversationId) return;

    const typingKey = `${socket.userId}_${conversationId}`;
    this.typingUsers.delete(typingKey);

    // Broadcast typing stop to other participants
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      conversationId,
      isTyping: false
    });
  }

  private handleStatusChange(socket: AuthenticatedSocket, data: any): void {
    const { status } = data;
    
    if (!socket.userId || !['online', 'away', 'busy'].includes(status)) return;

    const user = this.onlineUsers.get(socket.userId);
    if (user) {
      user.status = status;
      user.lastSeen = new Date();
      this.onlineUsers.set(socket.userId, user);
      
      this.broadcastUserStatus(socket.userId, status);
    }
  }

  private handleUserDisconnect(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    logger.info(`User ${socket.userId} disconnected from socket ${socket.id}`);

    // Remove socket from user's socket list
    const userSocketIds = this.userSockets.get(socket.userId) || [];
    const updatedSocketIds = userSocketIds.filter(id => id !== socket.id);
    
    if (updatedSocketIds.length > 0) {
      this.userSockets.set(socket.userId, updatedSocketIds);
    } else {
      // User has no more active sockets
      this.userSockets.delete(socket.userId);
      this.onlineUsers.delete(socket.userId);
      
      // Broadcast offline status
      this.broadcastUserStatus(socket.userId, 'offline');
    }

    // Clear typing status
    for (const [key, typingUser] of this.typingUsers.entries()) {
      if (typingUser.userId === socket.userId) {
        this.typingUsers.delete(key);
        socket.to(`conversation_${typingUser.conversationId}`).emit('user_typing', {
          userId: socket.userId,
          conversationId: typingUser.conversationId,
          isTyping: false
        });
      }
    }
  }

  private broadcastUserStatus(userId: string, status: string): void {
    this.io.emit('user_status_change', {
      userId,
      status,
      lastSeen: new Date()
    });
  }

  private startCleanupInterval(): void {
    // Clean up old typing indicators every 30 seconds
    setInterval(() => {
      const now = new Date();
      for (const [key, typingUser] of this.typingUsers.entries()) {
        if (now.getTime() - typingUser.timestamp.getTime() > 30000) { // 30 seconds
          this.typingUsers.delete(key);
          this.io.to(`conversation_${typingUser.conversationId}`).emit('user_typing', {
            userId: typingUser.userId,
            conversationId: typingUser.conversationId,
            isTyping: false
          });
        }
      }
    }, 30000);
  }

  // Public methods for external use
  public getOnlineUsers(): OnlineUser[] {
    return Array.from(this.onlineUsers.values());
  }

  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  public getUserStatus(userId: string): string {
    const user = this.onlineUsers.get(userId);
    return user ? user.status : 'offline';
  }

  public sendNotificationToUser(userId: string, notification: any): void {
    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds) {
      userSocketIds.forEach(socketId => {
        this.io.to(socketId).emit('notification', notification);
      });
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
