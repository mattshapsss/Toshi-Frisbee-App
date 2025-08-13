import { Router } from 'express';
import { z } from 'zod';
import { prisma, io } from '../server';
import { AuthRequest } from '../middleware/auth';
import { generateGameSlug, generateShareCode, logActivity, validateGameAccess } from '../lib/utils';

const router = Router();

const createGameSchema = z.object({
  teamId: z.string(),
  name: z.string().min(1).max(100),
  opponent: z.string().optional(),
  location: z.string().optional(),
  gameDate: z.string().datetime().optional(),
  isPublic: z.boolean().default(false),
});

const updateGameSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  opponent: z.string().optional(),
  location: z.string().optional(),
  gameDate: z.string().datetime().optional(),
  isPublic: z.boolean().optional(),
  status: z.enum(['SETUP', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
});

const addOffensivePlayerSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.enum([
    'HANDLER', 'CENTER_HANDLER', 'RESET_HANDLER',
    'CUTTER', 'FRONT_OF_STACK', 'INITIATING_CUTTER', 
    'FILL_CUTTER', 'DEEP_CUTTER'
  ]).default('CUTTER'),
  jerseyNumber: z.string().optional(),
  isBench: z.boolean().default(false),
});

const updateOffensivePlayerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.enum([
    'HANDLER', 'CENTER_HANDLER', 'RESET_HANDLER',
    'CUTTER', 'FRONT_OF_STACK', 'INITIATING_CUTTER', 
    'FILL_CUTTER', 'DEEP_CUTTER'
  ]).optional(),
  jerseyNumber: z.string().optional(),
  isBench: z.boolean().optional(),
  order: z.number().optional(),
});

// Get user's games
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { teamId, status } = req.query;
    
    const games = await prisma.game.findMany({
      where: {
        ...(teamId && { teamId: teamId as string }),
        ...(status && { status: status as any }),
        team: {
          members: {
            some: { userId: req.user!.id },
          },
        },
      },
      include: {
        team: true,
        _count: {
          select: {
            points: true,
            offensivePlayers: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    
    res.json(games);
  } catch (error) {
    next(error);
  }
});

// Create game
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createGameSchema.parse(req.body);
    
    // Verify team access
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: req.user!.id,
          teamId: data.teamId,
        },
      },
    });
    
    if (!member || member.role === 'VIEWER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const game = await prisma.game.create({
      data: {
        name: data.name,
        slug: await generateGameSlug(data.name),
        shareCode: generateShareCode(),
        teamId: data.teamId,
        createdById: req.user!.id,
        opponent: data.opponent,
        location: data.location,
        gameDate: data.gameDate ? new Date(data.gameDate) : undefined,
        isPublic: data.isPublic,
      },
      include: {
        team: true,
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    await logActivity(
      game.id,
      req.user!.id,
      'GAME_CREATED',
      `Created game: ${game.name}`
    );
    
    res.status(201).json(game);
  } catch (error) {
    next(error);
  }
});

// Get game by ID or slug
router.get('/:gameIdOrSlug', async (req: AuthRequest, res, next) => {
  try {
    const game = await prisma.game.findFirst({
      where: {
        OR: [
          { id: req.params.gameIdOrSlug },
          { slug: req.params.gameIdOrSlug },
          { shareCode: req.params.gameIdOrSlug },
        ],
      },
      include: {
        team: true,
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        offensivePlayers: {
          orderBy: [{ isBench: 'asc' }, { order: 'asc' }],
          include: {
            availableDefenders: {
              include: {
                defender: true,
              },
            },
            currentPointDefender: {
              include: {
                defender: true,
              },
            },
          },
        },
        points: {
          include: {
            matchups: {
              include: {
                offensivePlayer: true,
                defender: true,
              },
            },
          },
          orderBy: { pointNumber: 'asc' },
        },
        _count: {
          select: {
            points: true,
            offensivePlayers: true,
            sessions: true,
          },
        },
      },
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Check access
    if (!game.isPublic) {
      const hasAccess = await validateGameAccess(game.id, req.user!.id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    res.json(game);
  } catch (error) {
    next(error);
  }
});

// Update game
router.put('/:gameId', async (req: AuthRequest, res, next) => {
  try {
    const data = updateGameSchema.parse(req.body);
    
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const game = await prisma.game.update({
      where: { id: req.params.gameId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.opponent !== undefined && { opponent: data.opponent }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.gameDate !== undefined && { 
          gameDate: data.gameDate ? new Date(data.gameDate) : null 
        }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(data.status && { status: data.status }),
      },
      include: {
        team: true,
        _count: {
          select: {
            points: true,
            offensivePlayers: true,
          },
        },
      },
    });
    
    if (data.status === 'IN_PROGRESS') {
      await logActivity(
        game.id,
        req.user!.id,
        'GAME_STARTED',
        `Started game: ${game.name}`
      );
    } else if (data.status === 'COMPLETED') {
      await logActivity(
        game.id,
        req.user!.id,
        'GAME_COMPLETED',
        `Completed game: ${game.name}`
      );
    }
    
    res.json(game);
  } catch (error) {
    next(error);
  }
});

// Delete game
router.delete('/:gameId', async (req: AuthRequest, res, next) => {
  try {
    // Check if user is team admin
    const game = await prisma.game.findUnique({
      where: { id: req.params.gameId },
      include: {
        team: {
          include: {
            members: {
              where: { userId: req.user!.id },
            },
          },
        },
      },
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const member = game.team.members[0];
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    await prisma.game.delete({
      where: { id: req.params.gameId },
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Add offensive player
router.post('/:gameId/offensive-players', async (req: AuthRequest, res, next) => {
  try {
    const data = addOffensivePlayerSchema.parse(req.body);
    
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get current count for ordering
    const count = await prisma.offensivePlayer.count({
      where: { gameId: req.params.gameId },
    });
    
    const player = await prisma.offensivePlayer.create({
      data: {
        gameId: req.params.gameId,
        name: data.name,
        position: data.position,
        jerseyNumber: data.jerseyNumber,
        isBench: data.isBench,
        order: count,
      },
    });
    
    await logActivity(
      req.params.gameId,
      req.user!.id,
      'PLAYER_ADDED',
      `Added offensive player: ${player.name}`
    );
    
    // Emit socket event for real-time updates
    io.to(`game:${req.params.gameId}`).emit('player-added', {
      player,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.status(201).json(player);
  } catch (error) {
    next(error);
  }
});

// Update offensive player
router.put('/:gameId/offensive-players/:playerId', async (req: AuthRequest, res, next) => {
  try {
    const data = updateOffensivePlayerSchema.parse(req.body);
    
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const player = await prisma.offensivePlayer.update({
      where: { 
        id: req.params.playerId,
        gameId: req.params.gameId,
      },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.position && { position: data.position }),
        ...(data.jerseyNumber !== undefined && { jerseyNumber: data.jerseyNumber }),
        ...(data.isBench !== undefined && { isBench: data.isBench }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
    
    // Emit socket event for real-time updates
    io.to(`game:${req.params.gameId}`).emit('player-updated', {
      player,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.json(player);
  } catch (error) {
    next(error);
  }
});

// Delete offensive player
router.delete('/:gameId/offensive-players/:playerId', async (req: AuthRequest, res, next) => {
  try {
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const player = await prisma.offensivePlayer.findUnique({
      where: { 
        id: req.params.playerId,
      },
    });
    
    if (!player || player.gameId !== req.params.gameId) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    await prisma.offensivePlayer.delete({
      where: { id: req.params.playerId },
    });
    
    await logActivity(
      req.params.gameId,
      req.user!.id,
      'PLAYER_REMOVED',
      `Removed offensive player: ${player.name}`
    );
    
    // Emit socket event for real-time updates
    io.to(`game:${req.params.gameId}`).emit('player-removed', {
      playerId: req.params.playerId,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Reorder offensive players
router.put('/:gameId/offensive-players/reorder', async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      playerIds: z.array(z.string()),
    });
    
    const data = schema.parse(req.body);
    
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update order for each player
    const updates = data.playerIds.map((id, index) => 
      prisma.offensivePlayer.update({
        where: { id },
        data: { order: index },
      })
    );
    
    await prisma.$transaction(updates);
    
    const players = await prisma.offensivePlayer.findMany({
      where: { gameId: req.params.gameId },
      orderBy: [{ isBench: 'asc' }, { order: 'asc' }],
    });
    
    res.json(players);
  } catch (error) {
    next(error);
  }
});

// Add available defender to offensive player
router.post('/:gameId/offensive-players/:playerId/available-defenders', async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      defenderId: z.string(),
    });
    
    const data = schema.parse(req.body);
    
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const availableDefender = await prisma.availableDefender.create({
      data: {
        offensivePlayerId: req.params.playerId,
        defenderId: data.defenderId,
      },
      include: {
        defender: true,
      },
    });
    
    // Emit socket event for real-time updates
    io.to(`game:${req.params.gameId}`).emit('available-defender-added', {
      playerId: req.params.playerId,
      defenderId: data.defenderId,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.status(201).json(availableDefender);
  } catch (error) {
    next(error);
  }
});

// Remove available defender from offensive player
router.delete('/:gameId/offensive-players/:playerId/available-defenders/:defenderId', async (req: AuthRequest, res, next) => {
  try {
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.availableDefender.delete({
      where: {
        offensivePlayerId_defenderId: {
          offensivePlayerId: req.params.playerId,
          defenderId: req.params.defenderId,
        },
      },
    });
    
    // Emit socket event for real-time updates
    io.to(`game:${req.params.gameId}`).emit('available-defender-removed', {
      playerId: req.params.playerId,
      defenderId: req.params.defenderId,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Set current point defender for offensive player
router.put('/:gameId/offensive-players/:playerId/current-point-defender', async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      defenderId: z.string().nullable(),
    });
    
    const data = schema.parse(req.body);
    
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Delete existing current point defender
    await prisma.currentPointDefender.deleteMany({
      where: { offensivePlayerId: req.params.playerId },
    });
    
    // Create new current point defender if defenderId provided
    if (data.defenderId) {
      const currentPointDefender = await prisma.currentPointDefender.create({
        data: {
          offensivePlayerId: req.params.playerId,
          defenderId: data.defenderId,
        },
        include: {
          defender: true,
        },
      });
      
      // Emit socket event for real-time updates
      io.to(`game:${req.params.gameId}`).emit('current-point-defender-updated', {
        playerId: req.params.playerId,
        defenderId: data.defenderId,
        userId: req.user!.id,
        timestamp: new Date().toISOString(),
      });
      
      res.json(currentPointDefender);
    } else {
      // Emit socket event for clearing current point defender
      io.to(`game:${req.params.gameId}`).emit('current-point-defender-updated', {
        playerId: req.params.playerId,
        defenderId: null,
        userId: req.user!.id,
        timestamp: new Date().toISOString(),
      });
      
      res.status(204).send();
    }
  } catch (error) {
    next(error);
  }
});

// Clear all current point defenders for a game
router.delete('/:gameId/current-point-defenders', async (req: AuthRequest, res, next) => {
  try {
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get all offensive players for this game
    const players = await prisma.offensivePlayer.findMany({
      where: { gameId: req.params.gameId },
      select: { id: true },
    });
    
    const playerIds = players.map(p => p.id);
    
    // Delete all current point defenders for these players
    await prisma.currentPointDefender.deleteMany({
      where: { offensivePlayerId: { in: playerIds } },
    });
    
    // Emit socket event for real-time updates
    io.to(`game:${req.params.gameId}`).emit('current-point-cleared', {
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;