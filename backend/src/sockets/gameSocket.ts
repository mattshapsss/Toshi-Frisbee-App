import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma, redis } from '../server';
import { z } from 'zod';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  gameId?: string;
}

const pointUpdateSchema = z.object({
  gameId: z.string(),
  gotBreak: z.boolean(),
  matchups: z.array(z.object({
    offensivePlayerId: z.string(),
    defenderId: z.string().optional(),
  })),
});

const matchupUpdateSchema = z.object({
  gameId: z.string(),
  matchupId: z.string(),
  defenderId: z.string().optional(),
});

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.userId = user.id;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected`);
    
    // Join game room
    socket.on('join-game', async (gameId: string) => {
      try {
        // Verify game access
        const game = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            team: {
              include: {
                members: {
                  where: { userId: socket.userId },
                },
              },
            },
          },
        });
        
        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }
        
        if (!game.isPublic && game.team.members.length === 0) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
        
        // Leave previous room if any
        if (socket.gameId) {
          socket.leave(`game:${socket.gameId}`);
          await updateGameSession(socket.gameId, socket.userId!, false);
        }
        
        // Join new room
        socket.gameId = gameId;
        socket.join(`game:${gameId}`);
        
        // Create or update game session
        await prisma.gameSession.upsert({
          where: {
            gameId_userId: {
              gameId: gameId,
              userId: socket.userId!,
            },
          },
          update: {
            socketId: socket.id,
            isActive: true,
            lastPing: new Date(),
          },
          create: {
            gameId: gameId,
            userId: socket.userId!,
            socketId: socket.id,
            isActive: true,
          },
        });
        
        // Notify others in the room
        socket.to(`game:${gameId}`).emit('user-joined', {
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
        
        // Send current game state
        const gameState = await getGameState(gameId);
        socket.emit('game-state', gameState);
        
        // Send active users
        const activeSessions = await prisma.gameSession.findMany({
          where: {
            gameId: gameId,
            isActive: true,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });
        
        socket.emit('active-users', activeSessions.map(s => s.user));
        
      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });
    
    // Leave game room
    socket.on('leave-game', async () => {
      if (socket.gameId) {
        socket.leave(`game:${socket.gameId}`);
        await updateGameSession(socket.gameId, socket.userId!, false);
        
        socket.to(`game:${socket.gameId}`).emit('user-left', {
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
        
        socket.gameId = undefined;
      }
    });
    
    // Real-time point updates
    socket.on('point-update', async (data) => {
      try {
        const validated = pointUpdateSchema.parse(data);
        
        if (socket.gameId !== validated.gameId) {
          socket.emit('error', { message: 'Not in this game room' });
          return;
        }
        
        // Broadcast to all users in the game room
        io.to(`game:${validated.gameId}`).emit('point-updated', {
          ...validated,
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
        
        // Store in Redis for temporary state
        await redis.setEx(
          `game:${validated.gameId}:current-point`,
          300, // 5 minutes TTL
          JSON.stringify({
            ...validated,
            userId: socket.userId,
            timestamp: new Date().toISOString(),
          })
        );
        
      } catch (error) {
        console.error('Error updating point:', error);
        socket.emit('error', { message: 'Invalid point data' });
      }
    });
    
    // Real-time matchup updates
    socket.on('matchup-update', async (data) => {
      try {
        const validated = matchupUpdateSchema.parse(data);
        
        if (socket.gameId !== validated.gameId) {
          socket.emit('error', { message: 'Not in this game room' });
          return;
        }
        
        // Broadcast to all users in the game room
        io.to(`game:${validated.gameId}`).emit('matchup-updated', {
          ...validated,
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        console.error('Error updating matchup:', error);
        socket.emit('error', { message: 'Invalid matchup data' });
      }
    });
    
    // Player position updates
    socket.on('player-position-update', async (data) => {
      const { gameId, playerId, position, isBench } = data;
      
      if (socket.gameId !== gameId) {
        socket.emit('error', { message: 'Not in this game room' });
        return;
      }
      
      io.to(`game:${gameId}`).emit('player-position-updated', {
        playerId,
        position,
        isBench,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Typing indicators
    socket.on('typing-start', async (data) => {
      if (socket.gameId) {
        socket.to(`game:${socket.gameId}`).emit('user-typing', {
          userId: socket.userId,
          field: data.field,
        });
      }
    });
    
    socket.on('typing-stop', async (data) => {
      if (socket.gameId) {
        socket.to(`game:${socket.gameId}`).emit('user-stopped-typing', {
          userId: socket.userId,
          field: data.field,
        });
      }
    });
    
    // Cursor position sharing (for collaborative editing)
    socket.on('cursor-position', async (data) => {
      if (socket.gameId) {
        socket.to(`game:${socket.gameId}`).emit('cursor-moved', {
          userId: socket.userId,
          ...data,
        });
      }
    });
    
    // Available defender updates
    socket.on('available-defender-add', async (data) => {
      const { gameId, playerId, defenderId } = data;
      
      if (socket.gameId !== gameId) {
        socket.emit('error', { message: 'Not in this game room' });
        return;
      }
      
      io.to(`game:${gameId}`).emit('available-defender-added', {
        playerId,
        defenderId,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });
    
    socket.on('available-defender-remove', async (data) => {
      const { gameId, playerId, defenderId } = data;
      
      if (socket.gameId !== gameId) {
        socket.emit('error', { message: 'Not in this game room' });
        return;
      }
      
      io.to(`game:${gameId}`).emit('available-defender-removed', {
        playerId,
        defenderId,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Current point defender updates
    socket.on('current-point-defender-set', async (data) => {
      const { gameId, playerId, defenderId } = data;
      
      if (socket.gameId !== gameId) {
        socket.emit('error', { message: 'Not in this game room' });
        return;
      }
      
      io.to(`game:${gameId}`).emit('current-point-defender-updated', {
        playerId,
        defenderId,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });
    
    socket.on('current-point-clear', async (data) => {
      const { gameId } = data;
      
      if (socket.gameId !== gameId) {
        socket.emit('error', { message: 'Not in this game room' });
        return;
      }
      
      io.to(`game:${gameId}`).emit('current-point-cleared', {
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.userId} disconnected`);
      
      if (socket.gameId) {
        await updateGameSession(socket.gameId, socket.userId!, false);
        
        socket.to(`game:${socket.gameId}`).emit('user-left', {
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
      }
    });
    
    // Heartbeat for connection monitoring
    socket.on('ping', async () => {
      socket.emit('pong');
      
      if (socket.gameId && socket.userId) {
        await prisma.gameSession.updateMany({
          where: {
            gameId: socket.gameId,
            userId: socket.userId,
          },
          data: {
            lastPing: new Date(),
          },
        });
      }
    });
  });
};

// Helper functions
async function updateGameSession(gameId: string, userId: string, isActive: boolean) {
  try {
    await prisma.gameSession.updateMany({
      where: {
        gameId: gameId,
        userId: userId,
      },
      data: {
        isActive: isActive,
        ...(isActive ? {} : { leftAt: new Date() }),
      },
    });
    
    if (!isActive) {
      await prisma.activity.create({
        data: {
          gameId: gameId,
          userId: userId,
          type: 'USER_LEFT',
          description: 'User left the game',
        },
      });
    } else {
      await prisma.activity.create({
        data: {
          gameId: gameId,
          userId: userId,
          type: 'USER_JOINED',
          description: 'User joined the game',
        },
      });
    }
  } catch (error) {
    console.error('Error updating game session:', error);
  }
}

async function getGameState(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
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
        take: 10, // Last 10 points
      },
      team: {
        include: {
          defenders: {
            where: { active: true },
            orderBy: { name: 'asc' },
          },
        },
      },
    },
  });
  
  // Check Redis for current point state
  const currentPointKey = `game:${gameId}:current-point`;
  const currentPointData = await redis.get(currentPointKey);
  
  return {
    game,
    currentPoint: currentPointData ? JSON.parse(currentPointData) : null,
  };
}