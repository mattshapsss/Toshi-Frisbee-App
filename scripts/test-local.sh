#!/bin/bash

echo "🧪 Testing Ultimate D-Line Manager Locally"
echo "=========================================="
echo ""

# Kill any existing processes on our ports
echo "📍 Cleaning up ports..."
lsof -ti:5000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Backend setup
echo "🔧 Setting up backend..."
cd backend

# Use SQLite for testing (no PostgreSQL needed)
export DATABASE_URL="file:./test.db"
export JWT_SECRET="test-secret-key"
export NODE_ENV="development"
export PORT=5000
export FRONTEND_URL="http://localhost:3000"

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.test.prisma

# Run migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.test.prisma 2>/dev/null || \
npx prisma db push --schema=./prisma/schema.test.prisma

# Start backend with nohup
echo "🚀 Starting backend server..."
nohup npx tsx src/server.test.ts > backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend is running!"
else
    echo "❌ Backend failed to start. Check backend/backend.log"
    exit 1
fi

cd ..

# Frontend setup
echo ""
echo "🎨 Setting up frontend..."
cd frontend

# Set environment variables
export VITE_API_URL="http://localhost:5000/api"
export VITE_WS_URL="ws://localhost:5000"

# Start frontend with nohup
echo "🚀 Starting frontend server..."
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

cd ..

# Wait for frontend to start
sleep 5

echo ""
echo "✨ Application is running!"
echo ""
echo "📱 Access Points:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo "   Health:   http://localhost:5000/health"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend/backend.log"
echo "   Frontend: tail -f frontend/frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   OR: pkill -f tsx && pkill -f vite"
echo ""
echo "🧪 Test Flow:"
echo "1. Open http://localhost:3000"
echo "2. Register new account"
echo "3. Team is auto-created"
echo "4. Add defenders to roster"
echo "5. Create a game"
echo "6. Add offensive players"
echo "7. Track points with Break/No Break"
echo ""
echo "Process IDs saved to: .test-pids"
echo "$BACKEND_PID" > .test-pids
echo "$FRONTEND_PID" >> .test-pids