#!/bin/bash

echo "🚀 Starting Ultimate D-Line Manager with Virtual Environment"
echo "==========================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "tsx.*server" 2>/dev/null
pkill -f "vite" 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 2

# Create Python virtual environment for any Python tools if needed
if [ ! -d "venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Backend setup
echo -e "${YELLOW}🔧 Starting Backend Server...${NC}"
cd backend

# Set environment variables
export DATABASE_URL="file:./test.db"
export JWT_SECRET="test-secret-key-change-in-production"
export NODE_ENV="development"
export PORT=5001
export FRONTEND_URL="http://localhost:3000"

# Ensure database is set up
echo "📦 Setting up database..."
npx prisma generate --schema=./prisma/schema.test.prisma 2>/dev/null
npx prisma db push --schema=./prisma/schema.test.prisma --force-reset 2>/dev/null

# Start backend with nohup
echo -e "${GREEN}🚀 Starting backend server on port 5001...${NC}"
nohup npx tsx src/server.ts > backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
for i in {1..15}; do
  if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running!${NC}"
    break
  fi
  if [ $i -eq 15 ]; then
    echo -e "${RED}❌ Backend failed to start. Check backend/backend.log${NC}"
    tail -20 backend/backend.log
    exit 1
  fi
  sleep 1
done

cd ..

# Frontend setup
echo ""
echo -e "${YELLOW}🎨 Starting Frontend Server...${NC}"
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  npm install
fi

# Set environment variables and start frontend with nohup
echo -e "${GREEN}🚀 Starting frontend server on port 3000...${NC}"
VITE_API_URL="http://localhost:5001/api" VITE_WS_URL="ws://localhost:5001" nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
for i in {1..20}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running!${NC}"
    break
  fi
  if [ $i -eq 20 ]; then
    echo -e "${RED}❌ Frontend failed to start. Check frontend/frontend.log${NC}"
    tail -20 frontend/frontend.log
    exit 1
  fi
  sleep 1
done

cd ..

# Save PIDs for later cleanup
echo "$BACKEND_PID" > .server-pids
echo "$FRONTEND_PID" >> .server-pids

# Success message
echo ""
echo -e "${GREEN}✨ Application is fully running!${NC}"
echo ""
echo "📱 Access Points:"
echo "   Frontend:    http://localhost:3000"
echo "   Backend API: http://localhost:5001/api"
echo "   Health:      http://localhost:5001/health"
echo ""
echo "📊 Available Features:"
echo "   • User registration and authentication"
echo "   • Team creation with invite codes"
echo "   • Drag-and-drop defender assignments"
echo "   • Real-time game collaboration"
echo "   • Export game data (JSON/CSV)"
echo "   • Game statistics tracking"
echo ""
echo "📝 Test Credentials:"
echo "   User 1: testuser / test@example.com"
echo "   Team: Toshi Ultimate (invite: AUDM7X)"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend/backend.log"
echo "   Frontend: tail -f frontend/frontend.log"
echo ""
echo "🛑 To stop everything:"
echo "   ./stop-servers.sh"
echo "   OR"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo -e "${YELLOW}Ready for testing!${NC}"