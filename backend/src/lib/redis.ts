export const createRedisClient = () => {
  // Check if Redis URL is provided
  if (!process.env.REDIS_URL || process.env.REDIS_URL === 'redis://localhost:6379') {
    // Return mock client for development/testing
    console.log('Redis not configured, using mock client');
    return {
      connect: async () => {},
      on: () => {},
      get: async () => null,
      set: async () => {},
      setEx: async () => {},
      del: async () => {},
      quit: async () => {},
      isOpen: true,
    };
  }

  // For production, use actual Redis
  const { createClient } = require('redis');
  const client = createClient({
    url: process.env.REDIS_URL,
  });

  client.on('error', (err: any) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Connected to Redis');
  });

  client.connect();

  return client;
};

export type RedisClient = ReturnType<typeof createRedisClient>;