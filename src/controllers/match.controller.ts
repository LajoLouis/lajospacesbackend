import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Match } from '../models/Match';
import { MatchingService } from '../services/matchingService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';
import { catchAsync } from '../utils/catchAsync';

/**
 * Get potential matches for the authenticated user
 */
export const getMatches = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { 
    type = 'both', // 'roommate', 'housing', 'both'
    limit = 20,
    page = 1
  } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  let matches: any[] = [];

  try {
    if (type === 'roommate' || type === 'both') {
      const roommateMatches = await MatchingService.findRoommateMatches(
        new Types.ObjectId(userId),
        type === 'roommate' ? parseInt(limit as string) : Math.ceil(parseInt(limit as string) / 2)
      );
      matches.push(...roommateMatches);
    }

    if (type === 'housing' || type === 'both') {
      const housingMatches = await MatchingService.findHousingMatches(
        new Types.ObjectId(userId),
        type === 'housing' ? parseInt(limit as string) : Math.ceil(parseInt(limit as string) / 2)
      );
      matches.push(...housingMatches);
    }

    // Sort by compatibility score
    matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Apply pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedMatches = matches.slice(startIndex, endIndex);

    // Log match activity
    logger.info(`Generated ${matches.length} matches for user ${userId}`, {
      userId,
      matchType: type,
      totalMatches: matches.length,
      avgCompatibility: matches.length > 0 ? matches.reduce((sum, m) => sum + m.compatibilityScore, 0) / matches.length : 0
    });

    return res.json({
      success: true,
      data: {
        matches: paginatedMatches,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: matches.length,
          pages: Math.ceil(matches.length / limitNum)
        },
        summary: {
          totalMatches: matches.length,
          roommateMatches: matches.filter(m => m.type === 'user').length,
          housingMatches: matches.filter(m => m.type === 'property').length,
          averageCompatibility: matches.length > 0 ? Math.round(matches.reduce((sum, m) => sum + m.compatibilityScore, 0) / matches.length) : 0
        }
      }
    });

  } catch (error) {
    logger.error('Error getting matches:', error);
    throw new AppError('Failed to get matches', 500);
  }
});

/**
 * Swipe on a match (like, pass, super like)
 */
export const swipeMatch = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { targetId, targetType, action } = req.body;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!['liked', 'passed', 'super_liked'].includes(action)) {
    throw new AppError('Invalid action. Must be liked, passed, or super_liked', 400);
  }

  if (!['user', 'property'].includes(targetType)) {
    throw new AppError('Invalid target type. Must be user or property', 400);
  }

  try {
    // Check if match already exists
    let match = await Match.findOne({ userId, targetId, targetType });

    if (!match) {
      // Calculate compatibility and create new match
      const compatibilityFactors = targetType === 'user'
        ? await MatchingService.calculateUserCompatibility(new Types.ObjectId(userId), new Types.ObjectId(targetId))
        : await MatchingService.calculatePropertyCompatibility(new Types.ObjectId(userId), new Types.ObjectId(targetId));

      const newMatch = await MatchingService.createMatch(
        new Types.ObjectId(userId),
        new Types.ObjectId(targetId),
        targetType,
        compatibilityFactors
      );

      match = await Match.findById(newMatch._id);
    }

    if (!match) {
      throw new AppError('Failed to create or find match', 500);
    }

    // Update user action
    match.userAction = action;
    match.lastInteractionAt = new Date();

    // Calculate response time if this is the first action
    if (match.viewedAt && !match.responseTime) {
      const responseTimeMs = new Date().getTime() - match.viewedAt.getTime();
      match.responseTime = Math.round(responseTimeMs / (1000 * 60)); // Convert to minutes
    }

    // Check if it's a mutual match (for user-to-user matches)
    let isMutualMatch = false;
    if (targetType === 'user' && action === 'liked') {
      // Check if the target user has also liked this user
      const reverseMatch = await Match.findOne({ 
        userId: targetId, 
        targetId: userId, 
        targetType: 'user',
        userAction: 'liked'
      });

      if (reverseMatch) {
        isMutualMatch = true;
        match.status = 'matched';
        match.matchedAt = new Date();
        reverseMatch.status = 'matched';
        reverseMatch.matchedAt = new Date();
        await reverseMatch.save();
      }
    }

    // For property matches, it's a match if user likes the property
    if (targetType === 'property' && action === 'liked') {
      match.status = 'matched';
      match.matchedAt = new Date();
    }

    // If user passed, mark as rejected
    if (action === 'passed') {
      match.status = 'rejected';
    }

    await match.save();

    // Log swipe activity
    logger.info(`User ${userId} ${action} ${targetType} ${targetId}`, {
      userId,
      targetId,
      targetType,
      action,
      isMutualMatch,
      compatibilityScore: match.compatibilityScore
    });

    return res.json({
      success: true,
      data: {
        matchId: match._id,
        action,
        isMutualMatch,
        status: match.status,
        compatibilityScore: match.compatibilityScore,
        matchedAt: match.matchedAt
      },
      message: isMutualMatch ? 'It\'s a match! 🎉' : `You ${action} this ${targetType}`
    });

  } catch (error) {
    logger.error('Error processing swipe:', error);
    throw new AppError('Failed to process swipe', 500);
  }
});

/**
 * Get user's match history
 */
export const getMatchHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { 
    status = 'all', // 'all', 'matched', 'pending', 'rejected'
    type = 'all', // 'all', 'roommate', 'housing'
    page = 1,
    limit = 20,
    sortBy = 'lastInteractionAt',
    sortOrder = 'desc'
  } = req.query;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Build query
    const query: any = { userId };

    if (status !== 'all') {
      query.status = status;
    }

    if (type !== 'all') {
      query.matchType = type;
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const [matches, totalCount] = await Promise.all([
      Match.find(query)
        .populate('targetId', 'firstName lastName email accountType title propertyType location pricing')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Match.countDocuments(query)
    ]);

    // Format matches for response
    const formattedMatches = matches.map(match => ({
      id: match._id,
      targetId: match.targetId,
      targetType: match.targetType,
      matchType: match.matchType,
      status: match.status,
      userAction: match.userAction,
      targetAction: match.targetAction,
      compatibilityScore: match.compatibilityScore,
      compatibilityFactors: match.compatibilityFactors,
      matchReason: match.matchReason,
      distance: match.locationProximity,
      matchedAt: match.matchedAt,
      lastInteractionAt: match.lastInteractionAt,
      hasMessaged: match.hasMessaged,
      expiresAt: match.expiresAt,
      isExpired: match.expiresAt < new Date()
    }));

    return res.json({
      success: true,
      data: {
        matches: formattedMatches,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum)
        },
        summary: {
          total: totalCount,
          matched: await Match.countDocuments({ userId, status: 'matched' }),
          pending: await Match.countDocuments({ userId, status: 'pending' }),
          rejected: await Match.countDocuments({ userId, status: 'rejected' }),
          expired: await Match.countDocuments({ userId, status: 'expired' })
        }
      }
    });

  } catch (error) {
    logger.error('Error getting match history:', error);
    throw new AppError('Failed to get match history', 500);
  }
});

/**
 * Get a specific match by ID
 */
export const getMatchById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const match = await Match.findOne({ _id: id, userId })
      .populate('targetId', 'firstName lastName email accountType title propertyType location pricing amenities photos')
      .lean();

    if (!match) {
      throw new AppError('Match not found', 404);
    }

    // Mark as viewed if not already viewed
    if (!match.viewedAt) {
      await Match.findByIdAndUpdate(id, { 
        viewedAt: new Date(),
        $inc: { viewCount: 1 }
      });
    }

    return res.json({
      success: true,
      data: { match }
    });

  } catch (error) {
    logger.error('Error getting match by ID:', error);
    throw new AppError('Failed to get match', 500);
  }
});
