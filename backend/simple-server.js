const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient({
  datasourceUrl: 'file:./test.db'
});

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Helper functions
const generateId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  jwt.verify(token, 'test-secret', async (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    next();
  });
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });
    
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword
      }
    });
    
    // Create default team
    const team = await prisma.team.create({
      data: {
        name: `${username}'s Team`,
        slug: `${username.toLowerCase()}-team`,
        inviteCode: generateId(),
        members: {
          create: {
            userId: user.id,
            role: 'OWNER'
          }
        }
      }
    });
    
    // Generate token
    const accessToken = jwt.sign({ userId: user.id }, 'test-secret', { expiresIn: '7d' });
    
    res.json({
      user: { id: user.id, email, username },
      accessToken,
      refreshToken: accessToken
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const accessToken = jwt.sign({ userId: user.id }, 'test-secret', { expiresIn: '7d' });
    
    res.json({
      user: { 
        id: user.id, 
        email: user.email, 
        username: user.username 
      },
      accessToken,
      refreshToken: accessToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Teams Routes
app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const teams = await prisma.teamMember.findMany({
      where: { userId: req.user.id },
      include: {
        team: {
          include: {
            _count: {
              select: {
                members: true,
                defenders: true,
                games: true
              }
            }
          }
        }
      }
    });
    
    res.json(teams.map(tm => ({
      ...tm.team,
      role: tm.role
    })));
  } catch (error) {
    console.error('Teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.post('/api/teams', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const team = await prisma.team.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        inviteCode: generateId(),
        members: {
          create: {
            userId: req.user.id,
            role: 'OWNER'
          }
        }
      }
    });
    res.json(team);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Games Routes
app.get('/api/games', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.query;
    const games = await prisma.game.findMany({
      where: teamId ? { teamId } : {
        team: {
          members: {
            some: { userId: req.user.id }
          }
        }
      },
      include: {
        team: true,
        _count: {
          select: {
            points: true,
            offensivePlayers: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(games);
  } catch (error) {
    console.error('Games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.post('/api/games', authenticateToken, async (req, res) => {
  try {
    const { teamId, name, isPublic } = req.body;
    const game = await prisma.game.create({
      data: {
        teamId,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        shareCode: generateId(),
        createdById: req.user.id,
        isPublic: isPublic || false
      },
      include: {
        team: true
      }
    });
    res.json(game);
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

app.get('/api/games/:gameId', authenticateToken, async (req, res) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.gameId },
      include: {
        team: {
          include: {
            defenders: {
              where: { active: true }
            }
          }
        },
        offensivePlayers: {
          orderBy: [{ isBench: 'asc' }, { order: 'asc' }]
        },
        points: {
          include: {
            matchups: {
              include: {
                offensivePlayer: true,
                defender: true
              }
            }
          },
          orderBy: { pointNumber: 'asc' }
        }
      }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    console.error('Game fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Defenders Routes
app.get('/api/defenders/team/:teamId', authenticateToken, async (req, res) => {
  try {
    const defenders = await prisma.defender.findMany({
      where: { 
        teamId: req.params.teamId,
        active: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(defenders);
  } catch (error) {
    console.error('Defenders error:', error);
    res.status(500).json({ error: 'Failed to fetch defenders' });
  }
});

app.post('/api/defenders', authenticateToken, async (req, res) => {
  try {
    const { teamId, name } = req.body;
    const defender = await prisma.defender.create({
      data: { teamId, name }
    });
    res.json(defender);
  } catch (error) {
    console.error('Create defender error:', error);
    res.status(500).json({ error: 'Failed to create defender' });
  }
});

// Offensive Players Routes
app.post('/api/games/:gameId/offensive-players', authenticateToken, async (req, res) => {
  try {
    const { name, position } = req.body;
    const player = await prisma.offensivePlayer.create({
      data: {
        gameId: req.params.gameId,
        name,
        position: position || 'CUTTER'
      }
    });
    res.json(player);
  } catch (error) {
    console.error('Create offensive player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Points Routes
app.post('/api/points', authenticateToken, async (req, res) => {
  try {
    const { gameId, gotBreak, matchups } = req.body;
    
    // Get next point number
    const lastPoint = await prisma.point.findFirst({
      where: { gameId },
      orderBy: { pointNumber: 'desc' }
    });
    
    const pointNumber = (lastPoint?.pointNumber || 0) + 1;
    
    const point = await prisma.point.create({
      data: {
        gameId,
        pointNumber,
        gotBreak,
        matchups: {
          create: matchups.map(m => ({
            offensivePlayerId: m.offensivePlayerId,
            defenderId: m.defenderId
          }))
        }
      },
      include: {
        matchups: {
          include: {
            offensivePlayer: true,
            defender: true
          }
        }
      }
    });
    
    res.json(point);
  } catch (error) {
    console.error('Create point error:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

app.delete('/api/points/:pointId', authenticateToken, async (req, res) => {
  try {
    await prisma.point.delete({
      where: { id: req.params.pointId }
    });
    res.status(204).send();
  } catch (error) {
    console.error('Delete point error:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Simple test server running on http://localhost:${PORT}`);
  console.log('Database: SQLite (test.db)');
  console.log('Ready for testing!');
});