// Simple test server to verify the app works
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory data store
const users = [];
const teams = [];
const games = [];
const defenders = [];

// Helper function
const generateId = () => Math.random().toString(36).substring(7);

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body;
  
  // Check if user exists
  if (users.find(u => u.email === email || u.username === username)) {
    return res.status(409).json({ error: 'User already exists' });
  }
  
  // Create user
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: generateId(),
    email,
    username,
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  
  // Create default team
  const team = {
    id: generateId(),
    name: `${username}'s Team`,
    inviteCode: generateId().toUpperCase().substring(0, 6),
    members: [{ userId: user.id, role: 'OWNER' }],
    createdAt: new Date().toISOString()
  };
  teams.push(team);
  
  // Generate token
  const accessToken = jwt.sign({ userId: user.id }, 'secret', { expiresIn: '7d' });
  
  res.json({
    user: { id: user.id, email, username, createdAt: user.createdAt },
    accessToken,
    refreshToken: accessToken
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { emailOrUsername, password } = req.body;
  
  const user = users.find(u => 
    u.email === emailOrUsername || u.username === emailOrUsername
  );
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const accessToken = jwt.sign({ userId: user.id }, 'secret', { expiresIn: '7d' });
  
  res.json({
    user: { 
      id: user.id, 
      email: user.email, 
      username: user.username, 
      createdAt: user.createdAt 
    },
    accessToken,
    refreshToken: accessToken
  });
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  jwt.verify(token, 'secret', (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    next();
  });
};

// Teams endpoints
app.get('/api/teams', authenticateToken, (req, res) => {
  const userTeams = teams.filter(t => 
    t.members.some(m => m.userId === req.userId)
  );
  res.json(userTeams);
});

app.post('/api/teams', authenticateToken, (req, res) => {
  const { name } = req.body;
  const team = {
    id: generateId(),
    name,
    inviteCode: generateId().toUpperCase().substring(0, 6),
    members: [{ userId: req.userId, role: 'OWNER' }],
    createdAt: new Date().toISOString()
  };
  teams.push(team);
  res.json(team);
});

// Games endpoints
app.get('/api/games', authenticateToken, (req, res) => {
  const { teamId } = req.query;
  const teamGames = games.filter(g => 
    !teamId || g.teamId === teamId
  );
  res.json(teamGames);
});

app.post('/api/games', authenticateToken, (req, res) => {
  const { teamId, name, isPublic } = req.body;
  const game = {
    id: generateId(),
    teamId,
    name,
    isPublic: isPublic || false,
    shareCode: generateId(),
    offensivePlayers: [],
    points: [],
    createdAt: new Date().toISOString(),
    createdById: req.userId
  };
  games.push(game);
  res.json(game);
});

app.get('/api/games/:gameId', authenticateToken, (req, res) => {
  const game = games.find(g => g.id === req.params.gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  // Add team info
  game.team = teams.find(t => t.id === game.teamId);
  game.team.defenders = defenders.filter(d => d.teamId === game.teamId);
  
  res.json(game);
});

// Defenders endpoints
app.get('/api/defenders/team/:teamId', authenticateToken, (req, res) => {
  const teamDefenders = defenders.filter(d => d.teamId === req.params.teamId);
  res.json(teamDefenders);
});

app.post('/api/defenders', authenticateToken, (req, res) => {
  const { teamId, name } = req.body;
  const defender = {
    id: generateId(),
    teamId,
    name,
    createdAt: new Date().toISOString()
  };
  defenders.push(defender);
  res.json(defender);
});

// Offensive players endpoints
app.post('/api/games/:gameId/offensive-players', authenticateToken, (req, res) => {
  const game = games.find(g => g.id === req.params.gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const player = {
    id: generateId(),
    ...req.body,
    gameId: req.params.gameId
  };
  
  game.offensivePlayers.push(player);
  res.json(player);
});

// Points endpoints
app.post('/api/points', authenticateToken, (req, res) => {
  const { gameId, gotBreak, matchups } = req.body;
  const game = games.find(g => g.id === gameId);
  
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const point = {
    id: generateId(),
    gameId,
    gotBreak,
    matchups,
    pointNumber: game.points.length + 1,
    createdAt: new Date().toISOString()
  };
  
  game.points.push(point);
  res.json(point);
});

app.delete('/api/points/:pointId', authenticateToken, (req, res) => {
  games.forEach(game => {
    const index = game.points.findIndex(p => p.id === req.params.pointId);
    if (index !== -1) {
      game.points.splice(index, 1);
    }
  });
  res.status(204).send();
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log('Ready to accept requests!');
  console.log('\nTest credentials:');
  console.log('- Register with any email/username/password');
  console.log('- Teams are created automatically');
  console.log('- All data is in-memory (resets on restart)');
});