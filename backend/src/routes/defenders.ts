import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { AuthRequest, requireTeamAccess } from '../middleware/auth';

const router = Router();

const createDefenderSchema = z.object({
  teamId: z.string(),
  name: z.string().min(1).max(100),
  jerseyNumber: z.string().optional(),
  position: z.string().optional(),
  notes: z.string().optional(),
});

const updateDefenderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  jerseyNumber: z.string().optional(),
  position: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

const bulkCreateDefendersSchema = z.object({
  teamId: z.string(),
  defenders: z.array(z.object({
    name: z.string().min(1).max(100),
    jerseyNumber: z.string().optional(),
    position: z.string().optional(),
  })),
});

// Get team defenders
router.get('/team/:teamId', requireTeamAccess('VIEWER'), async (req: AuthRequest, res, next) => {
  try {
    const defenders = await prisma.defender.findMany({
      where: { 
        teamId: req.params.teamId,
      },
      include: {
        statistics: true,
        _count: {
          select: {
            matchups: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    
    res.json(defenders);
  } catch (error) {
    next(error);
  }
});

// Create defender
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createDefenderSchema.parse(req.body);
    
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
    
    const defender = await prisma.defender.create({
      data: {
        teamId: data.teamId,
        name: data.name,
        jerseyNumber: data.jerseyNumber,
        position: data.position,
        notes: data.notes,
      },
    });
    
    res.status(201).json(defender);
  } catch (error) {
    next(error);
  }
});

// Bulk create defenders
router.post('/bulk', async (req: AuthRequest, res, next) => {
  try {
    const data = bulkCreateDefendersSchema.parse(req.body);
    
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
    
    const defenders = await prisma.defender.createMany({
      data: data.defenders.map(d => ({
        teamId: data.teamId,
        name: d.name,
        jerseyNumber: d.jerseyNumber,
        position: d.position,
      })),
    });
    
    res.status(201).json({ 
      count: defenders.count,
      message: `Created ${defenders.count} defenders`,
    });
  } catch (error) {
    next(error);
  }
});

// Update defender
router.put('/:defenderId', async (req: AuthRequest, res, next) => {
  try {
    const data = updateDefenderSchema.parse(req.body);
    
    // Get defender to check team access
    const defender = await prisma.defender.findUnique({
      where: { id: req.params.defenderId },
    });
    
    if (!defender) {
      return res.status(404).json({ error: 'Defender not found' });
    }
    
    // Verify team access
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: req.user!.id,
          teamId: defender.teamId,
        },
      },
    });
    
    if (!member || member.role === 'VIEWER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const updated = await prisma.defender.update({
      where: { id: req.params.defenderId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.jerseyNumber !== undefined && { jerseyNumber: data.jerseyNumber }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
    
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete defender (hard delete)
router.delete('/:defenderId', async (req: AuthRequest, res, next) => {
  try {
    // Get defender to check team access
    const defender = await prisma.defender.findUnique({
      where: { id: req.params.defenderId },
    });
    
    if (!defender) {
      return res.status(404).json({ error: 'Defender not found' });
    }
    
    // Verify team access
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: req.user!.id,
          teamId: defender.teamId,
        },
      },
    });
    
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Hard delete the defender
    await prisma.defender.delete({
      where: { id: req.params.defenderId },
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Get defender statistics
router.get('/:defenderId/stats', async (req: AuthRequest, res, next) => {
  try {
    const { gameId } = req.query;
    
    const defender = await prisma.defender.findUnique({
      where: { id: req.params.defenderId },
      include: {
        statistics: gameId ? {
          where: { gameId: gameId as string },
        } : true,
        matchups: {
          include: {
            point: {
              select: {
                id: true,
                gotBreak: true,
                gameId: true,
              },
            },
          },
        },
      },
    });
    
    if (!defender) {
      return res.status(404).json({ error: 'Defender not found' });
    }
    
    // Calculate statistics
    const stats = {
      totalGames: new Set(defender.matchups.map(m => m.point.gameId)).size,
      totalPoints: defender.matchups.length,
      totalBreaks: defender.matchups.filter(m => m.point.gotBreak).length,
      breakPercentage: defender.matchups.length > 0 
        ? Math.round((defender.matchups.filter(m => m.point.gotBreak).length / defender.matchups.length) * 100)
        : 0,
      matchupResults: defender.matchups.reduce((acc, m) => {
        if (m.result) {
          acc[m.result] = (acc[m.result] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
    };
    
    res.json({
      defender,
      stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;