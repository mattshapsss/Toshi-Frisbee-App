import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { AuthRequest, requireTeamAccess } from '../middleware/auth';
import { generateSlug, generateInviteCode } from '../lib/utils';

const router = Router();

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

const inviteMemberSchema = z.object({
  emailOrUsername: z.string(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

// Get user's teams
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const teams = await prisma.teamMember.findMany({
      where: { userId: req.user!.id },
      include: {
        team: {
          include: {
            _count: {
              select: {
                members: true,
                defenders: true,
                games: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    
    res.json(teams.map(tm => ({
      ...tm.team,
      role: tm.role,
      joinedAt: tm.joinedAt,
    })));
  } catch (error) {
    next(error);
  }
});

// Create team
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createTeamSchema.parse(req.body);
    
    const team = await prisma.team.create({
      data: {
        name: data.name,
        description: data.description,
        slug: await generateSlug(data.name),
        inviteCode: generateInviteCode(),
        members: {
          create: {
            userId: req.user!.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            defenders: true,
            games: true,
          },
        },
      },
    });
    
    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
});

// Get team details
router.get('/:teamId', requireTeamAccess('VIEWER'), async (req: AuthRequest, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
        defenders: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
        games: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            defenders: true,
            games: true,
          },
        },
      },
    });
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(team);
  } catch (error) {
    next(error);
  }
});

// Update team
router.put('/:teamId', requireTeamAccess('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const data = updateTeamSchema.parse(req.body);
    
    const team = await prisma.team.update({
      where: { id: req.params.teamId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: {
        _count: {
          select: {
            members: true,
            defenders: true,
            games: true,
          },
        },
      },
    });
    
    res.json(team);
  } catch (error) {
    next(error);
  }
});

// Delete team
router.delete('/:teamId', requireTeamAccess('OWNER'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.team.delete({
      where: { id: req.params.teamId },
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Invite member
router.post('/:teamId/members', requireTeamAccess('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const data = inviteMemberSchema.parse(req.body);
    
    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.emailOrUsername },
          { username: data.emailOrUsername },
        ],
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId: req.params.teamId,
        },
      },
    });
    
    if (existingMember) {
      return res.status(409).json({ error: 'User is already a team member' });
    }
    
    // Add member
    const member = await prisma.teamMember.create({
      data: {
        userId: user.id,
        teamId: req.params.teamId,
        role: data.role,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
    
    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

// Update member role
router.put('/:teamId/members/:memberId', requireTeamAccess('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
    });
    
    const data = schema.parse(req.body);
    
    // Can't change owner role
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId: req.params.teamId,
        userId: req.params.memberId,
      },
    });
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    if (member.role === 'OWNER') {
      return res.status(403).json({ error: 'Cannot change owner role' });
    }
    
    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: { role: data.role },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
    
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Remove member
router.delete('/:teamId/members/:memberId', requireTeamAccess('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId: req.params.teamId,
        userId: req.params.memberId,
      },
    });
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    if (member.role === 'OWNER') {
      return res.status(403).json({ error: 'Cannot remove team owner' });
    }
    
    await prisma.teamMember.delete({
      where: { id: member.id },
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Join team by invite code
router.post('/join', async (req: AuthRequest, res, next) => {
  try {
    const { inviteCode } = req.body;
    
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code required' });
    }
    
    // Find team by invite code
    const team = await prisma.team.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });
    
    if (!team) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }
    
    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: req.user!.id,
          teamId: team.id,
        },
      },
    });
    
    if (existingMember) {
      return res.status(409).json({ error: 'You are already a member of this team' });
    }
    
    // Add as member
    const member = await prisma.teamMember.create({
      data: {
        userId: req.user!.id,
        teamId: team.id,
        role: 'MEMBER',
      },
      include: {
        team: true,
      },
    });
    
    res.json(member);
  } catch (error) {
    next(error);
  }
});

// Get team invite code
router.get('/:teamId/invite-code', requireTeamAccess('MEMBER'), async (req: AuthRequest, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      select: { inviteCode: true },
    });
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json({ inviteCode: team.inviteCode });
  } catch (error) {
    next(error);
  }
});

// Leave team
router.post('/:teamId/leave', requireTeamAccess('VIEWER'), async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: req.user!.id,
          teamId: req.params.teamId,
        },
      },
    });
    
    if (!member) {
      return res.status(404).json({ error: 'Not a member of this team' });
    }
    
    if (member.role === 'OWNER') {
      // Check if there are other admins
      const otherAdmins = await prisma.teamMember.count({
        where: {
          teamId: req.params.teamId,
          role: { in: ['OWNER', 'ADMIN'] },
          userId: { not: req.user!.id },
        },
      });
      
      if (otherAdmins === 0) {
        return res.status(403).json({ 
          error: 'Cannot leave team as the only admin. Promote another member first.' 
        });
      }
    }
    
    await prisma.teamMember.delete({
      where: { id: member.id },
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;