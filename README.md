# Ultimate D-Line Manager 🥏

A real-time collaborative web application for managing Ultimate Frisbee defensive line matchups and tracking game statistics. Built for coaches and captains to efficiently manage defensive strategies during games with seamless multi-device synchronization.

## 🎯 Core Features

### Game Management
- **Call Your Line**: Select up to 7 defenders for the active point with visual feedback
  - Real-time selection sync across all coaches
  - Integration with matchup assignments - only selected defenders can be assigned
  - Load pre-built defensive lines instantly via dropdown
  - Visual indicators: blue for selected, gray for available, green dots for assigned
  - No disruptive warnings - smooth, silent validation
- **Real-time Collaboration**: Multiple coaches/captains can manage the same game simultaneously with instant updates via WebSockets
  - Proper room-based synchronization for all game events
  - Active user tracking and connection status
  - Optimistic UI updates with server reconciliation
- **Advanced Drag-and-Drop**: Full-featured player management for desktop and mobile
  - Reorder players within active roster or bench sections
  - Move players between active and bench with visual drop zones
  - Works with sorted tables - respects visual order
  - Mobile: Long-press (300ms) with haptic feedback
  - Desktop: Native HTML5 drag-and-drop
  - Auto-scroll when dragging near screen edges
  - Special handling for second-to-last position drops
- **Offensive Player Management**: Add, edit, reorder players with positions (Handler/Cutter)
  - Inline name editing
  - Position color coding (blue for handlers, green for cutters)
  - Drag to reorder or move to bench
- **Point Tracking**: Complete history with enhanced details
  - Shows selected defenders for each point (above matchups)
  - Break/no-break outcomes with timestamps
  - No defender requirement - can save points with just selections
  - Expandable point details with full matchup information
- **Sortable Tables**: All data tables feature sortable columns with persistent preferences
  - Click headers to sort by any column
  - Sort preferences saved in localStorage
  - Visual indicators for active sort direction

### Defensive Line Management
- **Build Lines**: Create and save defensive line combinations for quick deployment
  - Save up to 7 defenders per line with custom names
  - Edit and delete existing lines
  - Team-wide sharing of line configurations
  - Quick load during games via dropdown menu
- **Roster Management**: Bulk add defenders, track jersey numbers, and statistics
- **Player Availability**: Visual distinction between selected, available, and assigned defenders

### Team Features
- **Team-based System**: All data belongs to teams, not individual users
- **Simple Invite System**: 6-character team codes for easy team joining
- **Role Management**: Owner, Admin, and Member roles with appropriate permissions
- **Collaborative Lines**: All team members can view and use defensive lines

### Statistics & Analytics
- **Player Statistics**: Track points played, breaks, and break percentages
- **Selected Line Stats**: View performance metrics for the currently selected 7 defenders
- **Game History**: View past games and performance metrics
- **Point-by-Point Analysis**: Detailed breakdown of each defensive point
- **Sortable Statistics**: Sort players by any metric to identify top performers

### User Experience
- **Mobile Optimized**: Full functionality on mobile devices including "Complete game" button
- **Public Game Sharing**: Share read-only game views with unique URLs
- **Auto-save**: All changes are automatically saved
- **Visual Feedback**: Color-coded defender states and drag-drop indicators
- **Persistent Preferences**: Sort orders and view preferences saved locally

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

### Defensive Line Endpoints
- `GET /api/lines/team/:teamId` - List team defensive lines
- `POST /api/lines` - Create new defensive line
- `PUT /api/lines/:lineId` - Update line (name or defenders)
- `DELETE /api/lines/:lineId` - Delete defensive line

### Selected Defenders Endpoints
- `GET /api/selected-defenders/game/:gameId` - Get selected defenders for a game
- `PUT /api/selected-defenders/game/:gameId` - Update selected defenders (max 7)

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
- `ping` - Heartbeat to maintain connection

### Server → Client
- `game-state` - Initial game state on join
- `active-users` - List of connected users
- `player-added` - Offensive player added
- `player-updated` - Offensive player updated
- `player-removed` - Offensive player removed
- `players-reordered` - Player order changed
- `available-defender-added` - Potential matchup added
- `available-defender-removed` - Potential matchup removed
- `current-point-defender-updated` - Current defender assigned
- `current-point-cleared` - All current assignments cleared
- `point-created` - New point with selected defenders
- `point-updated` - Point outcome recorded
- `point-deleted` - Point removed
- `selected-defenders-updated` - Selected defenders for game changed (Call Your Line)
- `matchup-updated` - Individual matchup changed
- `user-joined` - User joined game room
- `user-left` - User left game room
- `pong` - Heartbeat response

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
│   │   │   ├── lines.ts       # Defensive line management
│   │   │   ├── selectedDefenders.ts # Selected defenders for games
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
│   │   │   ├── RosterPage.tsx # Team roster & line builder
│   │   │   └── StatisticsPage.tsx # Player stats
│   │   ├── components/        # Reusable components
│   │   │   ├── CallYourLine.tsx     # Defender selection UI
│   │   │   ├── BuildLines.tsx       # Line creation/management
│   │   │   └── SortableTableHeader.tsx # Column sorting
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

## 🚀 Recent Improvements

### Performance & UX Enhancements
- **Smoother Interactions**: Removed all disruptive popup warnings and alerts
- **Better Drag-and-Drop**: Fixed reordering issues with sorted tables
- **Enhanced Mobile**: Improved touch detection and haptic feedback
- **Real-time Sync**: Fixed WebSocket room naming for reliable updates
- **Visual Consistency**: Tile coloring works for bench players in matchups
- **Point History**: Now displays selected defenders above matchups

### Technical Improvements
- **WebSocket Stability**: Consistent room naming (`game:${gameId}`)
- **Drag-and-Drop Logic**: Handles visual order vs data order correctly
- **State Management**: Better handling of selected defenders
- **Database Efficiency**: Optimized queries for point creation
- **Error Handling**: Silent validation for better UX

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

## 📖 How to Use New Features

### Call Your Line (During Games)
1. **Navigate to Game Page**: Open an active game from your dashboard
2. **Select Defenders**: In the "Call Your Line" section above the matchups table:
   - Click defender tiles to select/deselect (max 7)
   - Selected defenders appear with blue background
   - Counter shows current selection (e.g., "5/7 selected")
3. **Load Pre-built Lines**: Use the dropdown menu to instantly load a saved defensive line
4. **Assign Matchups**: Only selected defenders can be assigned to offensive players
5. **Visual Feedback**: 
   - Selected defenders appear filled in potential matchups
   - Non-selected defenders appear lighter/disabled
   - Currently assigned defenders have a green indicator

### Build Defensive Lines (Roster Page)
1. **Navigate to Roster & Statistics**: Access from team dashboard
2. **Create New Line**:
   - Enter a descriptive name (e.g., "Zone Defense", "Starting 7")
   - Click defender tiles to select up to 7 players
   - Click "Create Line" to save
3. **Edit Existing Lines**:
   - Click edit icon on any line
   - Modify name or player selection
   - Save changes or cancel
4. **Delete Lines**: Click trash icon with confirmation
5. **Team Sharing**: All team members can view and use created lines

### Sortable Tables
1. **Click Column Headers**: Sort by any column (name, stats, position, etc.)
2. **Sort Indicators**: 
   - Up arrow = ascending order
   - Down arrow = descending order
   - Blue highlight = active sort
3. **Persistent Sorting**: Your sort preferences are saved locally

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