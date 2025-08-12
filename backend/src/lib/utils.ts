import { nanoid } from 'nanoid';
import { prisma } from '../server';

export const generateSlug = async (name: string, retries = 0): Promise<string> => {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  
  const slug = retries === 0 ? baseSlug : `${baseSlug}-${nanoid(6)}`;
  
  // Check if slug exists
  const existing = await prisma.team.findUnique({
    where: { slug },
  });
  
  if (existing) {
    return generateSlug(name, retries + 1);
  }
  
  return slug;
};

export const generateGameSlug = async (name: string, retries = 0): Promise<string> => {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  
  const slug = retries === 0 ? baseSlug : `${baseSlug}-${nanoid(6)}`;
  
  // Check if slug exists
  const existing = await prisma.game.findUnique({
    where: { slug },
  });
  
  if (existing) {
    return generateGameSlug(name, retries + 1);
  }
  
  return slug;
};

export const generateShareCode = (): string => {
  return nanoid(10);
};

export const generateInviteCode = (): string => {
  // Generate a 6-character alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const calculateBreakPercentage = (breaks: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((breaks / total) * 100);
};

export const parseWindDirection = (degrees: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
};

export const validateGameAccess = async (gameId: string, userId: string): Promise<boolean> => {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      team: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });
  
  if (!game) return false;
  if (game.isPublic) return true;
  if (game.team.members.length > 0) return true;
  
  return false;
};

export const logActivity = async (
  gameId: string,
  userId: string,
  type: any,
  description: string,
  metadata?: any
) => {
  try {
    await prisma.activity.create({
      data: {
        gameId,
        userId,
        type,
        description,
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};