# Migration Guide: From Local State to Full-Stack Application

This guide explains how to migrate your existing Ultimate D-Line app to use the new backend.

## Architecture Changes

### Before (Local State Only)
- All data stored in React component state
- No persistence between sessions
- Single-user only
- No real-time collaboration

### After (Full-Stack Application)
- PostgreSQL database for persistent storage
- Redis for caching and session management
- JWT authentication for secure multi-user access
- WebSocket real-time updates for collaboration
- RESTful API for all CRUD operations

## Key Integration Points

### 1. Authentication
Your app now requires users to sign up and log in:
```typescript
// Login
const { user, accessToken, refreshToken } = await authApi.login({
  emailOrUsername: 'user@example.com',
  password: 'password123'
});

// Store tokens
useAuthStore.getState().login(user, accessToken, refreshToken);
```

### 2. Team & Roster Management
Instead of local `globalRoster` state, defenders are now team-based:
```typescript
// Create team
const team = await teamsApi.create({ name: 'Tufts Ultimate' });

// Add defenders to team
const defender = await defendersApi.create({
  teamId: team.id,
  name: 'Player Name',
  jerseyNumber: '7'
});
```

### 3. Game Management
Games are now persistent with unique URLs:
```typescript
// Create game
const game = await gamesApi.create({
  teamId: team.id,
  name: 'Tufts vs Opponent',
  isPublic: true // Makes game accessible via share link
});

// Share link: https://yourapp.com/game/public/{game.shareCode}
```

### 4. Real-time Updates
WebSocket integration for live collaboration:
```typescript
// Join game room
socketManager.joinGame(gameId);

// Listen for updates
socketManager.on('point-updated', (data) => {
  // Update local state with new point data
});

// Send updates
socketManager.updatePoint({
  gameId,
  gotBreak: true,
  matchups: [...]
});
```

### 5. Data Migration Path

To migrate existing localStorage data:

1. Export current data from browser:
```javascript
const exportData = {
  games: localStorage.getItem('games'),
  roster: localStorage.getItem('roster')
};
console.log(JSON.stringify(exportData));
```

2. Import to new system via API:
```typescript
// Create team
const team = await teamsApi.create({ name: 'Migrated Team' });

// Import defenders
for (const defender of oldRoster) {
  await defendersApi.create({
    teamId: team.id,
    name: defender.name
  });
}

// Import games
for (const oldGame of oldGames) {
  const game = await gamesApi.create({
    teamId: team.id,
    name: oldGame.name
  });
  
  // Add offensive players
  for (const player of oldGame.offensivePlayers) {
    await gamesApi.addOffensivePlayer(game.id, player);
  }
  
  // Add points
  for (const point of oldGame.savedPoints) {
    await pointsApi.create({
      gameId: game.id,
      gotBreak: point.gotBreak,
      matchups: point.matchups
    });
  }
}
```

## Component Updates

### Before: Local State
```jsx
const [games, setGames] = useState([]);
const [currentGame, setCurrentGame] = useState(null);

const createNewGame = () => {
  const newGame = { id: Date.now(), name: gameName };
  setGames([...games, newGame]);
};
```

### After: API Integration
```jsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { gamesApi } from '../lib/api';

const { data: games } = useQuery({
  queryKey: ['games'],
  queryFn: gamesApi.list
});

const createGameMutation = useMutation({
  mutationFn: gamesApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries(['games']);
  }
});

const createNewGame = () => {
  createGameMutation.mutate({
    teamId: currentTeam.id,
    name: gameName
  });
};
```

## Environment Setup

### Development
1. Copy environment template:
```bash
cp backend/.env.example backend/.env
```

2. Start with Docker:
```bash
docker-compose up
```

3. Run migrations:
```bash
docker-compose exec backend npx prisma migrate dev
```

### Production (Railway)
1. Push to GitHub
2. Connect repository to Railway
3. Add PostgreSQL and Redis services
4. Set environment variables
5. Deploy

## Common Issues & Solutions

### CORS Errors
Ensure `FRONTEND_URL` is set correctly in backend `.env`

### WebSocket Connection Failed
Check that Socket.io client URL matches backend URL

### Database Connection Issues
Verify `DATABASE_URL` format:
```
postgresql://user:password@host:5432/database
```

### Authentication Errors
- Tokens expire after 7 days
- Refresh tokens valid for 30 days
- Auto-refresh handled by API client

## Testing the Migration

1. Create test account
2. Create team and add defenders
3. Create game and add offensive players
4. Test real-time updates with multiple browser tabs
5. Verify data persistence after logout/login

## Rollback Plan

If issues arise, the original app code is preserved. To rollback:
1. Restore original component files
2. Remove API integration code
3. Disable authentication requirements

## Support

For issues or questions:
- Check logs: `docker-compose logs -f backend`
- Database GUI: `docker-compose exec backend npx prisma studio`
- API testing: Use Postman or similar tool

## Next Steps

1. Implement user profiles and avatars
2. Add game statistics and analytics
3. Create mobile app with React Native
4. Add team communication features
5. Implement tournament bracket management