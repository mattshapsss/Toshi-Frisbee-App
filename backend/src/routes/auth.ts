import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../server';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
});

const loginSchema = z.object({
  emailOrUsername: z.string(),
  password: z.string(),
});

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '30d' }
  );
  
  return { accessToken, refreshToken };
};

// Register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
        ],
      },
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        error: existingUser.email === data.email 
          ? 'Email already registered' 
          : 'Username already taken' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });
    
    // Generate tokens
    const tokens = generateTokens(user.id);
    
    res.status(201).json({
      user,
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate tokens
    const tokens = generateTokens(user.id);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'secret') as any;
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const tokens = generateTokens(user.id);
    
    res.json({
      user,
      ...tokens,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    next(error);
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
        teams: {
          include: {
            team: true,
          },
        },
      },
    });
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update password
router.put('/password', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    });
    
    const data = schema.parse(req.body);
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Update username
router.put('/username', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
    });
    
    const data = schema.parse(req.body);
    
    // Check if username is already taken
    const existingUser = await prisma.user.findFirst({
      where: {
        username: data.username,
        NOT: { id: req.user!.id }
      }
    });
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { username: data.username },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      }
    });
    
    res.json({ user: updatedUser, message: 'Username updated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;