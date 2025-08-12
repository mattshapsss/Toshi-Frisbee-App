# Ultimate D-Line Manager

A real-time collaborative web application for managing Ultimate Frisbee defensive line matchups and tracking game statistics.

## Features

- **Multi-user Real-time Collaboration**: Multiple users can manage the same game simultaneously with live updates via WebSockets
- **Team Management**: Create teams, invite members, manage rosters
- **Game Tracking**: Track defensive matchups, points, and player statistics
- **Unique Game URLs**: Share games with unique URLs for easy access
- **Authentication**: Secure JWT-based authentication system
- **Statistics Dashboard**: Track player performance across games
- **Mobile Responsive**: Works on all devices

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Socket.io-client, Zustand, React Query
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, Socket.io
- **Database**: PostgreSQL
- **Cache**: Redis
- **Deployment**: Docker, Railway

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Node.js 20+ (for local development without Docker)

### 1. Clone the repository
```bash
git clone <repository-url>
cd "Toshi Frisbee App"
```

### 2. Set up environment variables
```bash
# Copy the example env file
cp backend/.env.example backend/.env

# Edit backend/.env with your settings
# Important: Change JWT_SECRET in production!
```

### 3. Start with Docker Compose
```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 4. Initialize the database
```bash
# Run database migrations
docker-compose exec backend npx prisma migrate dev

# (Optional) Seed the database with sample data
docker-compose exec backend npm run db:seed
```

## Local Development (without Docker)

### Backend Setup
```bash
cd backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install

# Start development server
npm run dev
```

## Database Management

### Prisma Studio (GUI for database)
```bash
cd backend
npx prisma studio
```

### Create a new migration
```bash
cd backend
npx prisma migrate dev --name your_migration_name
```

### Reset database
```bash
cd backend
npx prisma migrate reset
```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/password` - Update password

### Team Endpoints
- `GET /api/teams` - List user's teams
- `POST /api/teams` - Create team
- `GET /api/teams/:teamId` - Get team details
- `PUT /api/teams/:teamId` - Update team
- `DELETE /api/teams/:teamId` - Delete team
- `POST /api/teams/:teamId/members` - Invite member
- `DELETE /api/teams/:teamId/members/:memberId` - Remove member

### Game Endpoints
- `GET /api/games` - List games
- `POST /api/games` - Create game
- `GET /api/games/:gameIdOrSlug` - Get game by ID or slug
- `PUT /api/games/:gameId` - Update game
- `DELETE /api/games/:gameId` - Delete game
- `GET /api/public/games/:shareCode` - Get public game (no auth required)

### Defender Endpoints
- `GET /api/defenders/team/:teamId` - List team defenders
- `POST /api/defenders` - Create defender
- `POST /api/defenders/bulk` - Bulk create defenders
- `PUT /api/defenders/:defenderId` - Update defender
- `DELETE /api/defenders/:defenderId` - Delete defender
- `GET /api/defenders/:defenderId/stats` - Get defender statistics

### Point Endpoints
- `GET /api/points/game/:gameId` - List game points
- `POST /api/points` - Create point
- `PUT /api/points/:pointId` - Update point
- `DELETE /api/points/:pointId` - Delete point
- `PUT /api/points/:pointId/matchups/:matchupId` - Update matchup

## WebSocket Events

### Client -> Server
- `join-game` - Join a game room
- `leave-game` - Leave current game room
- `point-update` - Update current point
- `matchup-update` - Update matchup
- `player-position-update` - Update player position
- `typing-start` - User started typing
- `typing-stop` - User stopped typing
- `cursor-position` - Share cursor position

### Server -> Client
- `game-state` - Full game state
- `active-users` - List of active users
- `user-joined` - User joined the game
- `user-left` - User left the game
- `point-updated` - Point was updated
- `matchup-updated` - Matchup was updated
- `player-position-updated` - Player position updated
- `user-typing` - User is typing
- `user-stopped-typing` - User stopped typing
- `cursor-moved` - User's cursor moved

## Deployment to Railway

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login to Railway
```bash
railway login
```

### 3. Create a new project
```bash
railway init
```

### 4. Add PostgreSQL and Redis
```bash
# In Railway dashboard, add:
# - PostgreSQL database
# - Redis database
```

### 5. Configure environment variables
Set these in Railway dashboard:
- `DATABASE_URL` - PostgreSQL connection string (auto-generated)
- `REDIS_URL` - Redis connection string (auto-generated)
- `JWT_SECRET` - Your secret key for JWT
- `FRONTEND_URL` - Your frontend URL
- `NODE_ENV` - Set to "production"

### 6. Deploy
```bash
railway up
```

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express server setup
│   │   ├── routes/            # API routes
│   │   ├── middleware/        # Express middleware
│   │   ├── sockets/           # WebSocket handlers
│   │   └── lib/               # Utilities
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── stores/            # Zustand stores
│   │   ├── lib/               # API client & utilities
│   │   └── App.tsx
│   └── package.json
├── docker-compose.yml         # Docker Compose configuration
└── railway.json              # Railway deployment config
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ultimate_dline"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
NODE_ENV="development"
PORT=5000
FRONTEND_URL="http://localhost:3000"
```

### Frontend (.env)
```env
VITE_API_URL="http://localhost:5000/api"
VITE_WS_URL="ws://localhost:5000"
```

## Testing

### Run backend tests
```bash
cd backend
npm test
```

### Run frontend tests
```bash
cd frontend
npm test
```

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Try: `docker-compose down -v` and restart

### WebSocket connection issues
- Check that backend is running
- Verify CORS settings
- Check browser console for errors

### Build issues
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Docker cache: `docker-compose build --no-cache`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT