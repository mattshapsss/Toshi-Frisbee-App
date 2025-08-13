import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { AuthRequest, requireTeamAccess } from '../middleware/auth';
import { io } from '../server';

const router = Router();

const createLineSchema = z.object({
  teamId: z.string(),
  name: z.string().min(1).max(100),
  defenderIds: z.array(z.string()).max(7),
});

const updateLineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defenderIds: z.array(z.string()).max(7).optional(),
});

// Get team defensive lines
router.get('/team/:teamId', requireTeamAccess('VIEWER'), async (req: AuthRequest, res, next) => {
  try {
    const lines = await prisma.defensiveLine.findMany({
      where: { 
        teamId: req.params.teamId,
      },
      include: {
        defenders: {
          include: {
            defender: true,
          },
          orderBy: {
            order: 'asc',
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(lines);
  } catch (error) {
    next(error);
  }
});

// Create defensive line
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createLineSchema.parse(req.body);
    
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
    
    // Create line with defenders
    const line = await prisma.defensiveLine.create({
      data: {
        teamId: data.teamId,
        name: data.name,
        defenders: {
          create: data.defenderIds.map((defenderId, index) => ({
            defenderId,
            order: index,
          })),
        },
      },
      include: {
        defenders: {
          include: {
            defender: true,
          },
          orderBy: {
            order: 'asc',
          }
        },
      },
    });
    
    // Emit WebSocket event
    // Note: We don't emit WebSocket events for lines since they're team-level, not game-level
    // and we don't have team room joining logic
    
    res.status(201).json(line);
  } catch (error) {
    next(error);
  }
});

// Update defensive line
router.put('/:lineId', async (req: AuthRequest, res, next) => {
  try {
    const data = updateLineSchema.parse(req.body);
    const { lineId } = req.params;
    
    // Get line to verify team access
    const existingLine = await prisma.defensiveLine.findUnique({
      where: { id: lineId },
      include: { team: true },
    });
    
    if (!existingLine) {
      return res.status(404).json({ error: 'Line not found' });
    }
    
    // Verify team access
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: req.user!.id,
          teamId: existingLine.teamId,
        },
      },
    });
    
    if (!member || member.role === 'VIEWER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Start transaction to update line and defenders
    const line = await prisma.$transaction(async (tx) => {
      // Update name if provided
      if (data.name) {
        await tx.defensiveLine.update({
          where: { id: lineId },
          data: { name: data.name },
        });
      }
      
      // Update defenders if provided
      if (data.defenderIds) {
        // Delete existing defender associations
        await tx.defensiveLineDefender.deleteMany({
          where: { lineId },
        });
        
        // Create new defender associations
        await tx.defensiveLineDefender.createMany({
          data: data.defenderIds.map((defenderId, index) => ({
            lineId,
            defenderId,
            order: index,
          })),
        });
      }
      
      // Return updated line with defenders
      return await tx.defensiveLine.findUnique({
        where: { id: lineId },
        include: {
          defenders: {
            include: {
              defender: true,
            },
            orderBy: {
              order: 'asc',
            }
          },
        },
      });
    });
    
    // Emit WebSocket event
    // Note: We don't emit WebSocket events for lines since they're team-level, not game-level
    
    res.json(line);
  } catch (error) {
    next(error);
  }
});

// Delete defensive line
router.delete('/:lineId', async (req: AuthRequest, res, next) => {
  try {
    const { lineId } = req.params;
    
    // Get line to verify team access
    const line = await prisma.defensiveLine.findUnique({
      where: { id: lineId },
      include: { team: true },
    });
    
    if (!line) {
      return res.status(404).json({ error: 'Line not found' });
    }
    
    // Verify team access (only admin/owner)
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: req.user!.id,
          teamId: line.teamId,
        },
      },
    });
    
    if (!member || member.role === 'VIEWER' || member.role === 'MEMBER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    await prisma.defensiveLine.delete({
      where: { id: lineId },
    });
    
    // Emit WebSocket event
    // Note: We don't emit WebSocket events for lines since they're team-level, not game-level
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;