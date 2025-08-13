# Ultimate D-Line Manager

A real-time collaborative web application for managing Ultimate Frisbee defensive line matchups and tracking game statistics. Built for coaches and captains to efficiently manage defensive strategies during games.

## 🎯 Core Features

### Game Management
- **Real-time Collaboration**: Multiple coaches/captains can manage the same game simultaneously with instant updates via WebSockets
- **Drag-and-Drop Interface**: Intuitive player management with desktop and mobile support
- **Offensive Player Management**: Add, edit, reorder players with positions (Handler/Cutter)
- **Bench Management**: Separate active players and bench with visual indicators
- **Point Tracking**: Track breaks, no-breaks, and detailed matchup history

### Team Features
- **Team-based System**: All data belongs to teams, not individual users
- **Simple Invite System**: 6-character team codes for easy team joining
- **Role Management**: Owner, Admin, and Member roles with appropriate permissions
- **Roster Management**: Bulk add defenders, track jersey numbers, and statistics

### Statistics & Analytics
- **Player Statistics**: Track throws, catches, drops, turnovers, and break percentages
- **Game History**: View past games and performance metrics
- **Point-by-Point Analysis**: Detailed breakdown of each defensive point

### User Experience
- **Mobile Optimized**: Full drag-and-drop support on mobile devices with touch gestures
- **Public Game Sharing**: Share read-only game views with unique URLs
- **Auto-save**: All changes are automatically saved
- **Visual Feedback**: Blue line indicators for drop positions during drag operations

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **Zustand** for state management
- **TanStack Query** (React Query) for data fetching
- **Socket.io Client** for real-time updates
- **React Router** for navigation

### Backend
- **Node.js** with Express and TypeScript
- **Prisma ORM** for database management
- **PostgreSQL** for data persistence
- **Redis** for caching and session management
- **Socket.io** for WebSocket connections
- **JWT** for authentication
- **Bcrypt** for password hashing

### Deployment
- **Railway** for production hosting
- **Docker** for containerization
- **GitHub Actions** for CI/CD

## 📦 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Node.js 20+ (for local development without Docker)
- Git

### 1. Clone the repository
```bash
git clone https://github.com/mattshapsss/Toshi-Frisbee-App.git
cd "Toshi Frisbee App"
```

### 2. Set up environment variables
```bash
# Copy the example env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

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

## 💻 Local Development (without Docker)

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

# Set up environment variables
cp .env.example .env
# Edit .env if needed

# Start development server
npm run dev
```

## 🗄️ Database Management

### Prisma Studio (GUI for database)
```bash
cd backend
npx prisma studio
```

### Database Operations
```bash
# Create a new migration
cd backend
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Push schema changes without migration (development only)
npx prisma db push
```

## 📡 API Documentation

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
- `DELETE /api/teams/:teamId` - Delete team (owner only)
- `POST /api/teams/join` - Join team with invite code
- `DELETE /api/teams/:teamId/members/:userId` - Remove member
- `PUT /api/teams/:teamId/members/:userId/role` - Update member role

### Game Endpoints
- `GET /api/games` - List team games
- `POST /api/games` - Create game
- `GET /api/games/:gameIdOrSlug` - Get game by ID or slug
- `PUT /api/games/:gameId` - Update game details
- `DELETE /api/games/:gameId` - Delete game
- `GET /api/public/games/:shareCode` - Get public game (no auth)
- `PUT /api/games/:gameId/status` - Update game status

### Offensive Player Management
- `POST /api/games/:gameId/offensive-players` - Add offensive player
- `PUT /api/games/:gameId/offensive-players/:playerId` - Update player
- `DELETE /api/games/:gameId/offensive-players/:playerId` - Remove player
- `PUT /api/games/:gameId/offensive-players/reorder` - Reorder players
- `POST /api/games/:gameId/offensive-players/:playerId/available-defenders` - Add potential matchup
- `DELETE /api/games/:gameId/offensive-players/:playerId/available-defenders/:defenderId` - Remove potential matchup
- `PUT /api/games/:gameId/offensive-players/:playerId/current-point-defender` - Set current defender

### Defender Endpoints
- `GET /api/defenders/team/:teamId` - List team defenders
- `POST /api/defenders` - Create defender
- `POST /api/defenders/bulk` - Bulk create defenders
- `PUT /api/defenders/:defenderId` - Update defender
- `DELETE /api/defenders/:defenderId` - Delete defender (admin/owner only)
- `GET /api/defenders/:defenderId/stats` - Get defender statistics

### Point Endpoints
- `GET /api/points/game/:gameId` - List game points
- `POST /api/points` - Create point
- `PUT /api/points/:pointId` - Update point outcome
- `DELETE /api/points/:pointId` - Delete point
- `POST /api/points/:pointId/clear` - Clear current point assignments

## 🔌 WebSocket Events

### Client → Server
- `join-game` - Join a game room for real-time updates
- `leave-game` - Leave current game room

### Server → Client
- `game-updated` - Game details changed
- `player-added` - Offensive player added
- `player-updated` - Offensive player updated
- `player-removed` - Offensive player removed
- `players-reordered` - Player order changed
- `available-defender-added` - Potential matchup added
- `available-defender-removed` - Potential matchup removed
- `current-point-defender-updated` - Current defender assigned
- `current-point-cleared` - All current assignments cleared
- `point-created` - New point started
- `point-updated` - Point outcome recorded
- `point-deleted` - Point removed
- `user-joined` - User joined game
- `user-left` - User left game

## 🚢 Deployment to Railway

### 1. Prerequisites
- Railway account
- GitHub repository connected

### 2. Environment Variables (Railway Dashboard)
```env
# Database (auto-provided by Railway PostgreSQL)
DATABASE_URL=postgresql://...

# Redis (auto-provided by Railway Redis)
REDIS_URL=redis://...

# Application
JWT_SECRET=your-secure-secret-key
NODE_ENV=production
FRONTEND_URL=https://your-frontend.railway.app

# Frontend variables
VITE_API_URL=https://your-backend.railway.app/api
VITE_WS_URL=wss://your-backend.railway.app
```

### 3. Deploy
Railway will automatically deploy from your GitHub repository on push to main branch.

## 📁 Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express server & Socket.io setup
│   │   ├── routes/            # API route handlers
│   │   │   ├── auth.ts        # Authentication routes
│   │   │   ├── teams.ts       # Team management
│   │   │   ├── games.ts       # Game & player management
│   │   │   ├── defenders.ts   # Defender routes
│   │   │   └── points.ts      # Point tracking
│   │   ├── middleware/        
│   │   │   └── auth.ts        # JWT authentication
│   │   ├── sockets/           
│   │   │   └── gameSocket.ts  # Real-time game updates
│   │   └── lib/               
│   │       └── utils.ts       # Helper functions
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Database migrations
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/             # Route components
│   │   │   ├── HomePage.tsx   # Dashboard
│   │   │   ├── GamePage.tsx   # Main game interface
│   │   │   ├── RosterPage.tsx # Team roster management
│   │   │   └── StatisticsPage.tsx # Player stats
│   │   ├── components/        # Reusable components
│   │   ├── stores/            # Zustand state stores
│   │   │   ├── authStore.ts   # Authentication state
│   │   │   └── gameStore.ts   # Game state
│   │   ├── lib/               
│   │   │   ├── api.ts         # API client
│   │   │   └── socket.ts      # WebSocket manager
│   │   └── App.tsx            # Root component
│   └── package.json
├── docker-compose.yml         # Docker configuration
├── railway.json              # Railway deployment config
└── README.md                 # This file
```

## 🔧 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ultimate_dline"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-secret-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-key"

# Server
NODE_ENV="development"
PORT=5000

# Frontend
FRONTEND_URL="http://localhost:3000"
```

### Frontend (.env)
```env
# API Configuration
VITE_API_URL="http://localhost:5000/api"
VITE_WS_URL="ws://localhost:5000"
```

## 🧪 Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test

# Run e2e tests (if configured)
npm run test:e2e
```

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker ps

# Verify DATABASE_URL
echo $DATABASE_URL

# Reset database
cd backend
npx prisma migrate reset
```

### WebSocket Connection Issues
- Ensure backend is running on correct port
- Check CORS settings in backend
- Verify VITE_WS_URL in frontend .env
- Check browser console for connection errors

### Build Issues
```bash
# Clear all caches and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Docker cache
docker-compose down -v
docker-compose build --no-cache
```

### Common Errors
- **"Cannot find module"**: Run `npm install` in the affected directory
- **"Prisma client not generated"**: Run `npx prisma generate` in backend
- **"Port already in use"**: Kill the process using the port or change PORT in .env
- **"Invalid token"**: Clear localStorage and login again

## 👥 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Keep commits focused and descriptive
- Ensure all tests pass before submitting PR

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Built for the Ultimate Frisbee community
- Inspired by the need for better defensive line management tools
- Special thanks to all contributors and testers

## 📞 Support

For issues, feature requests, or questions:
- Open an issue on [GitHub](https://github.com/mattshapsss/Toshi-Frisbee-App/issues)
- Contact the development team

---

**Made with ❤️ for Ultimate Frisbee teams everywhere**