import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import gameRoutes from './routes/games.js';
import defenderRoutes from './routes/defenders.js';
import pointRoutes from './routes/points.js';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

dotenv.config({ path: '.env.test' });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

export const prisma = new PrismaClient();
export const redis = {
  get: async () => null,
  setEx: async () => null,
  quit: async () => null,
}; // Mock Redis for testing

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', authenticateToken, teamRoutes);
app.use('/api/games', authenticateToken, gameRoutes);
app.use('/api/defenders', authenticateToken, defenderRoutes);
app.use('/api/points', authenticateToken, pointRoutes);

// Public game access
app.get('/api/public/games/:shareCode', async (req, res, next) => {
  try {
    const game = await prisma.game.findUnique({
      where: { shareCode: req.params.shareCode },
      include: {
        team: true,
        offensivePlayers: {
          orderBy: [{ isBench: 'asc' }, { order: 'asc' }],
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
          orderBy: { pointNumber: 'desc' },
        },
      },
    });

    if (!game || !game.isPublic) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    next(error);
  }
});

// Basic WebSocket setup (simplified)
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-game', (gameId) => {
    socket.join(`game:${gameId}`);
    console.log(`Socket ${socket.id} joined game ${gameId}`);
  });
  
  socket.on('leave-game', () => {
    socket.rooms.forEach(room => {
      if (room.startsWith('game:')) {
        socket.leave(room);
      }
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
});