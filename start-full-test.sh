#!/bin/bash

echo "🚀 Starting Ultimate D-Line Manager - FULL TEST"
echo "==============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "tsx.*server" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "node.*simple-server" 2>/dev/null
sleep 2

# Backend setup
echo -e "${YELLOW}🔧 Setting up backend...${NC}"
cd backend

# Use SQLite for testing (no external dependencies needed)
export DATABASE_URL="file:./test.db"
export JWT_SECRET="test-secret-key-change-in-production"
export NODE_ENV="development"
export PORT=5000
export FRONTEND_URL="http://localhost:3000"
export REDIS_URL="redis://localhost:6379"

# Generate Prisma client for SQLite
echo "📦 Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.test.prisma

# Run migrations
echo "🗄️  Setting up database..."
npx prisma db push --schema=./prisma/schema.test.prisma --force-reset

# Start backend
echo -e "${GREEN}🚀 Starting backend server...${NC}"
nohup npx tsx src/server.ts > backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
for i in {1..10}; do
  if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running!${NC}"
    break
  fi
  if [ $i -eq 10 ]; then
    echo -e "${RED}❌ Backend failed to start. Check backend/backend.log${NC}"
    tail -20 backend/backend.log
    exit 1
  fi
  sleep 1
done

cd ..

# Frontend setup
echo ""
echo -e "${YELLOW}🎨 Setting up frontend...${NC}"
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  npm install
fi

# Start frontend
echo -e "${GREEN}🚀 Starting frontend server...${NC}"
VITE_API_URL="http://localhost:5000/api" VITE_WS_URL="ws://localhost:5000" nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend
echo "⏳ Waiting for frontend to start..."
for i in {1..15}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running!${NC}"
    break
  fi
  if [ $i -eq 15 ]; then
    echo -e "${RED}❌ Frontend failed to start. Check frontend/frontend.log${NC}"
    tail -20 frontend/frontend.log
    exit 1
  fi
  sleep 1
done

cd ..

# Success message
echo ""
echo -e "${GREEN}✨ Application is fully running!${NC}"
echo ""
echo "📱 Access Points:"
echo "   Frontend:    http://localhost:3000"
echo "   Backend API: http://localhost:5000/api"
echo "   Health:      http://localhost:5000/health"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend/backend.log"
echo "   Frontend: tail -f frontend/frontend.log"
echo ""
echo "🛑 To stop everything:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo -e "${YELLOW}🧪 Test Instructions:${NC}"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Click 'Register' and create an account"
echo "3. Your team will be created automatically"
echo "4. Go to Roster page and add some defenders"
echo "5. Create a new game from home page"
echo "6. Add offensive players in the game"
echo "7. Assign defenders and track points"
echo "8. Open another browser (incognito) to test multi-user"
echo ""
echo "PIDs saved to .test-pids"
echo "$BACKEND_PID" > .test-pids
echo "$FRONTEND_PID" >> .test-pids