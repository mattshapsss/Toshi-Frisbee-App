import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, username: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, username: true },
      });
      req.user = user || undefined;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

export const requireTeamAccess = (requiredRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const teamId = req.params.teamId || req.body.teamId;
      
      if (!teamId) {
        return res.status(400).json({ error: 'Team ID required' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: req.user.id,
            teamId: teamId,
          },
        },
      });

      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const roleHierarchy = {
        VIEWER: 0,
        MEMBER: 1,
        ADMIN: 2,
        OWNER: 3,
      };

      if (roleHierarchy[membership.role] < roleHierarchy[requiredRole]) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authorization error' });
    }
  };
};