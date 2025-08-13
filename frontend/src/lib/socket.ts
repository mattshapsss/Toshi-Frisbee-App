import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

class SocketManager {
  private socket: Socket | null = null;
  private gameId: string | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) {
      console.error('No auth token available for socket connection');
      return;
    }

    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5001';
    
    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupGlobalListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.gameId = null;
    }
  }

  private setupGlobalListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.emit('socket-connected');
      
      // Rejoin game room if we were in one
      if (this.gameId) {
        this.joinGame(this.gameId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.emit('socket-disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
      this.emit('socket-error', error);
    });

    // Game events
    this.socket.on('game-state', (data) => {
      this.emit('game-state', data);
    });

    this.socket.on('active-users', (users) => {
      this.emit('active-users', users);
    });

    this.socket.on('user-joined', (data) => {
      this.emit('user-joined', data);
    });

    this.socket.on('user-left', (data) => {
      this.emit('user-left', data);
    });

    this.socket.on('point-updated', (data) => {
      this.emit('point-updated', data);
    });

    this.socket.on('matchup-updated', (data) => {
      this.emit('matchup-updated', data);
    });

    this.socket.on('player-position-updated', (data) => {
      this.emit('player-position-updated', data);
    });

    this.socket.on('user-typing', (data) => {
      this.emit('user-typing', data);
    });

    this.socket.on('user-stopped-typing', (data) => {
      this.emit('user-stopped-typing', data);
    });

    this.socket.on('cursor-moved', (data) => {
      this.emit('cursor-moved', data);
    });

    // Heartbeat
    this.socket.on('pong', () => {
      this.emit('pong');
    });

    // Start heartbeat
    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Every 30 seconds
  }

  joinGame(gameId: string) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      this.connect();
      setTimeout(() => this.joinGame(gameId), 1000);
      return;
    }

    this.gameId = gameId;
    this.socket.emit('join-game', gameId);
  }

  leaveGame() {
    if (!this.socket?.connected) return;
    
    this.socket.emit('leave-game');
    this.gameId = null;
  }

  updatePoint(data: {
    gameId: string;
    gotBreak: boolean;
    matchups: Array<{
      offensivePlayerId: string;
      defenderId?: string;
    }>;
  }) {
    if (!this.socket?.connected) return;
    this.socket.emit('point-update', data);
  }

  updateMatchup(data: {
    gameId: string;
    matchupId: string;
    defenderId?: string;
  }) {
    if (!this.socket?.connected) return;
    this.socket.emit('matchup-update', data);
  }

  updatePlayerPosition(data: {
    gameId: string;
    playerId: string;
    position?: string;
    isBench?: boolean;
  }) {
    if (!this.socket?.connected) return;
    this.socket.emit('player-position-update', data);
  }

  startTyping(field: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('typing-start', { field });
  }

  stopTyping(field: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('typing-stop', { field });
  }

  updateCursor(data: { x: number; y: number; element?: string }) {
    if (!this.socket?.connected) return;
    this.socket.emit('cursor-position', data);
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getCurrentGameId(): string | null {
    return this.gameId;
  }
}

export const socketManager = new SocketManager();