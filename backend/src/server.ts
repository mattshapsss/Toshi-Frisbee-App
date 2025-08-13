import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import teamRoutes from './routes/teams';
import gameRoutes from './routes/games';
import defenderRoutes from './routes/defenders';
import pointRoutes from './routes/points';
import exportRoutes from './routes/export';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers } from './sockets/gameSocket';
import { createRedisClient } from './lib/redis';

dotenv.config();

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

export const prisma = new PrismaClient();
export const redis = createRedisClient();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // limit auth attempts
  message: 'Too many authentication attempts',
});

// Trust proxy for Railway/production environments
app.set('trust proxy', 1);

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
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/teams', authenticateToken, teamRoutes);
app.use('/api/games', authenticateToken, gameRoutes);
app.use('/api/defenders', authenticateToken, defenderRoutes);
app.use('/api/points', authenticateToken, pointRoutes);
app.use('/api/export', exportRoutes);

// Public game access (read-only)
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

// WebSocket setup
setupSocketHandlers(io);

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  
  await prisma.$disconnect();
  await redis.quit();
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const PORT = process.env.PORT || 5000;

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});