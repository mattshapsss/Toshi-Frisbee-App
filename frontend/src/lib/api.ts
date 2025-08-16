import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 for token refresh, not 403
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Only logout if refresh token is invalid or expired
        if (refreshError.response?.status === 401) {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      }
    }

    // Don't auto-logout on 403 (forbidden) - user just doesn't have access to this resource
    // Let the component handle the error
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: async (data: { email: string; username: string; password: string }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  login: async (data: { emailOrUsername: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  logout: async () => {
    useAuthStore.getState().logout();
  },

  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updatePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.put('/auth/password', data);
    return response.data;
  },
  
  updateUsername: async (data: { username: string }) => {
    const response = await api.put('/auth/username', data);
    return response.data;
  },
  
  deleteAccount: async (data: { password: string; confirmation: string }) => {
    const response = await api.delete('/auth/account', { data });
    return response.data;
  },
};

// Teams API
export const teamsApi = {
  list: async () => {
    const response = await api.get('/teams');
    return response.data;
  },

  create: async (data: { name: string; description?: string }) => {
    const response = await api.post('/teams', data);
    return response.data;
  },

  get: async (teamId: string) => {
    const response = await api.get(`/teams/${teamId}`);
    return response.data;
  },

  update: async (teamId: string, data: { name?: string; description?: string }) => {
    const response = await api.put(`/teams/${teamId}`, data);
    return response.data;
  },

  delete: async (teamId: string) => {
    await api.delete(`/teams/${teamId}`);
  },

  inviteMember: async (teamId: string, data: { emailOrUsername: string; role?: string }) => {
    const response = await api.post(`/teams/${teamId}/members`, data);
    return response.data;
  },

  removeMember: async (teamId: string, memberId: string) => {
    await api.delete(`/teams/${teamId}/members/${memberId}`);
  },

  leave: async (teamId: string) => {
    await api.post(`/teams/${teamId}/leave`);
  },
  
  joinByCode: async (inviteCode: string) => {
    const response = await api.post('/teams/join', { inviteCode });
    return response.data;
  },
  
  getInviteCode: async (teamId: string) => {
    const response = await api.get(`/teams/${teamId}/invite-code`);
    return response.data;
  },
};

// Games API
export const gamesApi = {
  list: async (params?: { teamId?: string; status?: string }) => {
    const response = await api.get('/games', { params });
    return response.data;
  },

  create: async (data: {
    teamId: string;
    name: string;
    opponent?: string;
    location?: string;
    gameDate?: string;
    isPublic?: boolean;
  }) => {
    const response = await api.post('/games', data);
    return response.data;
  },

  get: async (gameIdOrSlug: string) => {
    const response = await api.get(`/games/${gameIdOrSlug}`);
    return response.data;
  },

  getPublic: async (shareCode: string) => {
    const response = await axios.get(`${API_URL}/public/games/${shareCode}`);
    return response.data;
  },

  update: async (gameId: string, data: any) => {
    const response = await api.put(`/games/${gameId}`, data);
    return response.data;
  },

  delete: async (gameId: string) => {
    await api.delete(`/games/${gameId}`);
  },

  // Offensive Players
  addOffensivePlayer: async (gameId: string, data: {
    name: string;
    position?: string;
    jerseyNumber?: string;
    isBench?: boolean;
  }) => {
    const response = await api.post(`/games/${gameId}/offensive-players`, data);
    return response.data;
  },

  updateOffensivePlayer: async (gameId: string, playerId: string, data: any) => {
    const response = await api.put(`/games/${gameId}/offensive-players/${playerId}`, data);
    return response.data;
  },

  deleteOffensivePlayer: async (gameId: string, playerId: string) => {
    await api.delete(`/games/${gameId}/offensive-players/${playerId}`);
  },

  reorderOffensivePlayers: async (gameId: string, playerIds: string[]) => {
    const response = await api.put(`/games/${gameId}/offensive-players/reorder`, { playerIds });
    return response.data;
  },

  // Available Defenders
  addAvailableDefender: async (gameId: string, playerId: string, defenderId: string) => {
    const response = await api.post(`/games/${gameId}/offensive-players/${playerId}/available-defenders`, { defenderId });
    return response.data;
  },

  removeAvailableDefender: async (gameId: string, playerId: string, defenderId: string) => {
    await api.delete(`/games/${gameId}/offensive-players/${playerId}/available-defenders/${defenderId}`);
  },

  // Current Point Defenders
  setCurrentPointDefender: async (gameId: string, playerId: string, defenderId: string | null) => {
    const response = await api.put(`/games/${gameId}/offensive-players/${playerId}/current-point-defender`, { defenderId });
    return response.data;
  },

  clearCurrentPointDefenders: async (gameId: string) => {
    await api.delete(`/games/${gameId}/current-point-defenders`);
  },
};

// Defenders API
export const defendersApi = {
  listByTeam: async (teamId: string) => {
    const response = await api.get(`/defenders/team/${teamId}`);
    return response.data;
  },

  create: async (data: {
    teamId: string;
    name: string;
    position?: 'HANDLER' | 'HYBRID' | 'CUTTER';
    notes?: string;
  }) => {
    const response = await api.post('/defenders', data);
    return response.data;
  },

  bulkCreate: async (teamId: string, defenders: Array<{
    name: string;
    position?: 'HANDLER' | 'HYBRID' | 'CUTTER';
  }>) => {
    const response = await api.post('/defenders/bulk', { teamId, defenders });
    return response.data;
  },

  update: async (defenderId: string, data: any) => {
    const response = await api.put(`/defenders/${defenderId}`, data);
    return response.data;
  },

  delete: async (defenderId: string) => {
    await api.delete(`/defenders/${defenderId}`);
  },

  getStats: async (defenderId: string, gameId?: string) => {
    const response = await api.get(`/defenders/${defenderId}/stats`, {
      params: gameId ? { gameId } : undefined,
    });
    return response.data;
  },
};

// Points API
export const pointsApi = {
  listByGame: async (gameId: string) => {
    const response = await api.get(`/points/game/${gameId}`);
    return response.data;
  },

  create: async (data: {
    gameId: string;
    gotBreak: boolean;
    notes?: string;
    windSpeed?: number;
    windDirection?: string;
    matchups: Array<{
      offensivePlayerId: string;
      defenderId?: string;
      result?: string;
      notes?: string;
    }>;
    selectedDefenderIds?: string[];
  }) => {
    const response = await api.post('/points', data);
    return response.data;
  },

  update: async (pointId: string, data: any) => {
    const response = await api.put(`/points/${pointId}`, data);
    return response.data;
  },

  delete: async (pointId: string) => {
    await api.delete(`/points/${pointId}`);
  },

  updateMatchup: async (pointId: string, matchupId: string, data: {
    defenderId?: string;
    result?: string;
    notes?: string;
    isActive?: boolean;
  }) => {
    const response = await api.put(`/points/${pointId}/matchups/${matchupId}`, data);
    return response.data;
  },
};

// Defensive Lines API
export const linesApi = {
  listByTeam: async (teamId: string) => {
    const response = await api.get(`/lines/team/${teamId}`);
    return response.data;
  },

  create: async (data: {
    teamId: string;
    name: string;
    defenderIds: string[];
  }) => {
    const response = await api.post('/lines', data);
    return response.data;
  },

  update: async (lineId: string, data: {
    name?: string;
    defenderIds?: string[];
  }) => {
    const response = await api.put(`/lines/${lineId}`, data);
    return response.data;
  },

  delete: async (lineId: string) => {
    await api.delete(`/lines/${lineId}`);
  },
};

// Selected Defenders API
export const selectedDefendersApi = {
  getByGame: async (gameId: string) => {
    const response = await api.get(`/selected-defenders/game/${gameId}`);
    return response.data;
  },

  updateByGame: async (gameId: string, defenderIds: string[]) => {
    const response = await api.put(`/selected-defenders/game/${gameId}`, { defenderIds });
    return response.data;
  },
};