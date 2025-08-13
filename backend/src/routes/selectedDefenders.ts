import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth';
import { io } from '../server';

const router = Router();

const updateSelectedDefendersSchema = z.object({
  defenderIds: z.array(z.string()).max(7),
});

// Get selected defenders for a game
router.get('/game/:gameId', async (req: AuthRequest, res, next) => {
  try {
    const { gameId } = req.params;
    
    // Verify game exists and user has access
    const game = await prisma.game.findUnique({
      where: { id: gameId },
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
    
    if (game.team.members.length === 0 && !game.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const selectedDefenders = await prisma.selectedDefender.findMany({
      where: { gameId },
      include: {
        defender: true,
      },
    });
    
    res.json(selectedDefenders);
  } catch (error) {
    next(error);
  }
});

// Update selected defenders for a game
router.put('/game/:gameId', async (req: AuthRequest, res, next) => {
  try {
    const { gameId } = req.params;
    const data = updateSelectedDefendersSchema.parse(req.body);
    
    // Verify game exists and user has write access
    const game = await prisma.game.findUnique({
      where: { id: gameId },
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
    if (!member || member.role === 'VIEWER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Validate defender IDs
    if (data.defenderIds.length > 7) {
      return res.status(400).json({ error: 'Maximum 7 defenders can be selected' });
    }
    
    // Verify all defenders belong to the team
    const defenders = await prisma.defender.findMany({
      where: {
        id: { in: data.defenderIds },
        teamId: game.teamId,
      },
    });
    
    if (defenders.length !== data.defenderIds.length) {
      return res.status(400).json({ error: 'Invalid defender IDs' });
    }
    
    // Update selected defenders in a transaction
    const selectedDefenders = await prisma.$transaction(async (tx) => {
      // Delete existing selections
      await tx.selectedDefender.deleteMany({
        where: { gameId },
      });
      
      // Create new selections
      const created = await tx.selectedDefender.createMany({
        data: data.defenderIds.map(defenderId => ({
          gameId,
          defenderId,
        })),
      });
      
      // Return the new selections with defender details
      return await tx.selectedDefender.findMany({
        where: { gameId },
        include: {
          defender: true,
        },
      });
    });
    
    // Remove defenders from current point if they're not selected anymore
    const currentPointDefenders = await prisma.currentPointDefender.findMany({
      where: {
        offensivePlayer: {
          gameId,
        },
        defenderId: {
          notIn: data.defenderIds,
        },
      },
      select: {
        id: true,
        offensivePlayerId: true,
      },
    });
    
    // Delete unselected defenders from current point
    if (currentPointDefenders.length > 0) {
      await prisma.currentPointDefender.deleteMany({
        where: {
          id: {
            in: currentPointDefenders.map(cpd => cpd.id),
          },
        },
      });
      
      // Emit events for removed current point defenders
      for (const cpd of currentPointDefenders) {
        io.to(`game:${gameId}`).emit('current-point-defender-updated', {
          offensivePlayerId: cpd.offensivePlayerId,
          defenderId: null,
        });
      }
    }
    
    // Emit WebSocket event for selected defenders update
    io.to(`game:${gameId}`).emit('selected-defenders-updated', selectedDefenders);
    
    res.json(selectedDefenders);
  } catch (error) {
    next(error);
  }
});

export default router;