import { Router } from 'express';
import { z } from 'zod';
import { prisma, io } from '../server';
import { AuthRequest } from '../middleware/auth';
import { validateGameAccess, logActivity } from '../lib/utils';

const router = Router();

const createPointSchema = z.object({
  gameId: z.string(),
  gotBreak: z.boolean(),
  notes: z.string().optional(),
  windSpeed: z.number().optional(),
  windDirection: z.string().optional(),
  matchups: z.array(z.object({
    offensivePlayerId: z.string(),
    defenderId: z.string().optional(),
    result: z.enum(['SHUTDOWN', 'CONTAINED', 'SCORED_ON', 'NEUTRAL']).optional(),
    notes: z.string().optional(),
  })),
  selectedDefenderIds: z.array(z.string()).optional(),
});

const updatePointSchema = z.object({
  gotBreak: z.boolean().optional(),
  notes: z.string().optional(),
  windSpeed: z.number().optional(),
  windDirection: z.string().optional(),
});

const updateMatchupSchema = z.object({
  defenderId: z.string().optional(),
  result: z.enum(['SHUTDOWN', 'CONTAINED', 'SCORED_ON', 'NEUTRAL']).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Get game points
router.get('/game/:gameId', async (req: AuthRequest, res, next) => {
  try {
    // Check access
    const hasAccess = await validateGameAccess(req.params.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const points = await prisma.point.findMany({
      where: { gameId: req.params.gameId },
      include: {
        matchups: {
          include: {
            offensivePlayer: true,
            defender: true,
          },
        },
      },
      orderBy: { pointNumber: 'asc' },
    });
    
    res.json(points);
  } catch (error) {
    next(error);
  }
});

// Create point
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createPointSchema.parse(req.body);
    
    // Check access
    const hasAccess = await validateGameAccess(data.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get next point number
    const lastPoint = await prisma.point.findFirst({
      where: { gameId: data.gameId },
      orderBy: { pointNumber: 'desc' },
    });
    
    const pointNumber = (lastPoint?.pointNumber || 0) + 1;
    
    // Get all unique defenders (from matchups and selectedDefenderIds)
    const allDefenderIds = new Set<string>();
    
    // Add defenders from matchups
    data.matchups.forEach(m => {
      if (m.defenderId) allDefenderIds.add(m.defenderId);
    });
    
    // Add selected defenders
    if (data.selectedDefenderIds) {
      data.selectedDefenderIds.forEach(id => allDefenderIds.add(id));
    }

    // Create point with matchups
    const point = await prisma.point.create({
      data: {
        gameId: data.gameId,
        pointNumber,
        gotBreak: data.gotBreak,
        notes: data.notes,
        windSpeed: data.windSpeed,
        windDirection: data.windDirection,
        selectedDefenderIds: data.selectedDefenderIds || [],
        matchups: {
          create: data.matchups.map(m => ({
            offensivePlayerId: m.offensivePlayerId,
            defenderId: m.defenderId,
            result: m.result,
            notes: m.notes,
          })),
        },
      },
      include: {
        matchups: {
          include: {
            offensivePlayer: true,
            defender: true,
          },
        },
      },
    });
    
    // Update statistics for ALL defenders who played (selected defenders)
    for (const defenderId of allDefenderIds) {
      await prisma.defenderStats.upsert({
        where: {
          defenderId_gameId: {
            defenderId,
            gameId: data.gameId,
          },
        },
        update: {
          pointsPlayed: { increment: 1 },
          ...(data.gotBreak && { breaks: { increment: 1 } }),
          ...(!data.gotBreak && { noBreaks: { increment: 1 } }),
        },
        create: {
          defenderId,
          gameId: data.gameId,
          pointsPlayed: 1,
          breaks: data.gotBreak ? 1 : 0,
          noBreaks: data.gotBreak ? 0 : 1,
        },
      });
    }
    
    await logActivity(
      data.gameId,
      req.user!.id,
      'POINT_ADDED',
      `Added point #${pointNumber} (${data.gotBreak ? 'Break' : 'No Break'})`
    );
    
    // Emit socket event for real-time updates
    io.to(`game:${data.gameId}`).emit('point-created', {
      point,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.status(201).json(point);
  } catch (error) {
    next(error);
  }
});

// Update point
router.put('/:pointId', async (req: AuthRequest, res, next) => {
  try {
    const data = updatePointSchema.parse(req.body);
    
    // Get point to check game access
    const existingPoint = await prisma.point.findUnique({
      where: { id: req.params.pointId },
    });
    
    if (!existingPoint) {
      return res.status(404).json({ error: 'Point not found' });
    }
    
    // Check access
    const hasAccess = await validateGameAccess(existingPoint.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const point = await prisma.point.update({
      where: { id: req.params.pointId },
      data: {
        ...(data.gotBreak !== undefined && { gotBreak: data.gotBreak }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.windSpeed !== undefined && { windSpeed: data.windSpeed }),
        ...(data.windDirection !== undefined && { windDirection: data.windDirection }),
      },
      include: {
        matchups: {
          include: {
            offensivePlayer: true,
            defender: true,
          },
        },
      },
    });
    
    // Update defender statistics if gotBreak changed
    if (data.gotBreak !== undefined && data.gotBreak !== existingPoint.gotBreak) {
      for (const matchup of point.matchups) {
        if (matchup.defenderId) {
          await prisma.defenderStats.update({
            where: {
              defenderId_gameId: {
                defenderId: matchup.defenderId,
                gameId: existingPoint.gameId,
              },
            },
            data: {
              breaks: data.gotBreak 
                ? { increment: 1 } 
                : { decrement: 1 },
              noBreaks: data.gotBreak 
                ? { decrement: 1 } 
                : { increment: 1 },
            },
          });
        }
      }
    }
    
    await logActivity(
      existingPoint.gameId,
      req.user!.id,
      'POINT_EDITED',
      `Edited point #${existingPoint.pointNumber}`
    );
    
    // Emit socket event for real-time updates
    io.to(`game:${existingPoint.gameId}`).emit('point-updated', {
      point,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.json(point);
  } catch (error) {
    next(error);
  }
});

// Delete point
router.delete('/:pointId', async (req: AuthRequest, res, next) => {
  try {
    // Get point to check game access
    const point = await prisma.point.findUnique({
      where: { id: req.params.pointId },
      include: {
        matchups: true,
      },
    });
    
    if (!point) {
      return res.status(404).json({ error: 'Point not found' });
    }
    
    // Check access
    const hasAccess = await validateGameAccess(point.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update defender statistics
    for (const matchup of point.matchups) {
      if (matchup.defenderId) {
        await prisma.defenderStats.update({
          where: {
            defenderId_gameId: {
              defenderId: matchup.defenderId,
              gameId: point.gameId,
            },
          },
          data: {
            pointsPlayed: { decrement: 1 },
            ...(point.gotBreak && { breaks: { decrement: 1 } }),
            ...(!point.gotBreak && { noBreaks: { decrement: 1 } }),
          },
        });
      }
    }
    
    // Delete point (matchups will be cascade deleted)
    await prisma.point.delete({
      where: { id: req.params.pointId },
    });
    
    // Renumber remaining points
    const remainingPoints = await prisma.point.findMany({
      where: { 
        gameId: point.gameId,
        pointNumber: { gt: point.pointNumber },
      },
      orderBy: { pointNumber: 'asc' },
    });
    
    for (const p of remainingPoints) {
      await prisma.point.update({
        where: { id: p.id },
        data: { pointNumber: p.pointNumber - 1 },
      });
    }
    
    await logActivity(
      point.gameId,
      req.user!.id,
      'POINT_DELETED',
      `Deleted point #${point.pointNumber}`
    );
    
    // Emit socket event for real-time updates
    io.to(`game:${point.gameId}`).emit('point-deleted', {
      pointId: req.params.pointId,
      pointNumber: point.pointNumber,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Update matchup
router.put('/:pointId/matchups/:matchupId', async (req: AuthRequest, res, next) => {
  try {
    const data = updateMatchupSchema.parse(req.body);
    
    // Get matchup to check access
    const matchup = await prisma.matchup.findUnique({
      where: { id: req.params.matchupId },
      include: {
        point: true,
      },
    });
    
    if (!matchup || matchup.pointId !== req.params.pointId) {
      return res.status(404).json({ error: 'Matchup not found' });
    }
    
    // Check access
    const hasAccess = await validateGameAccess(matchup.point.gameId, req.user!.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update defender statistics if defender changed
    if (data.defenderId !== undefined && data.defenderId !== matchup.defenderId) {
      // Remove stats from old defender
      if (matchup.defenderId) {
        await prisma.defenderStats.update({
          where: {
            defenderId_gameId: {
              defenderId: matchup.defenderId,
              gameId: matchup.point.gameId,
            },
          },
          data: {
            pointsPlayed: { decrement: 1 },
            ...(matchup.point.gotBreak && { breaks: { decrement: 1 } }),
            ...(!matchup.point.gotBreak && { noBreaks: { decrement: 1 } }),
          },
        });
      }
      
      // Add stats to new defender
      if (data.defenderId) {
        await prisma.defenderStats.upsert({
          where: {
            defenderId_gameId: {
              defenderId: data.defenderId,
              gameId: matchup.point.gameId,
            },
          },
          update: {
            pointsPlayed: { increment: 1 },
            ...(matchup.point.gotBreak && { breaks: { increment: 1 } }),
            ...(!matchup.point.gotBreak && { noBreaks: { increment: 1 } }),
          },
          create: {
            defenderId: data.defenderId,
            gameId: matchup.point.gameId,
            pointsPlayed: 1,
            breaks: matchup.point.gotBreak ? 1 : 0,
            noBreaks: matchup.point.gotBreak ? 0 : 1,
          },
        });
      }
    }
    
    const updated = await prisma.matchup.update({
      where: { id: req.params.matchupId },
      data: {
        ...(data.defenderId !== undefined && { defenderId: data.defenderId }),
        ...(data.result !== undefined && { result: data.result }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        offensivePlayer: true,
        defender: true,
      },
    });
    
    await logActivity(
      matchup.point.gameId,
      req.user!.id,
      'MATCHUP_CHANGED',
      `Updated matchup in point #${matchup.point.pointNumber}`
    );
    
    // Emit socket event for real-time updates
    io.to(`game:${matchup.point.gameId}`).emit('matchup-updated', {
      matchup: updated,
      pointId: req.params.pointId,
      userId: req.user!.id,
      timestamp: new Date().toISOString(),
    });
    
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;