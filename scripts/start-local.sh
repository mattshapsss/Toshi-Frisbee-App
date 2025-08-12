#!/bin/bash

echo "🚀 Starting Ultimate D-Line Manager (Local Development)"
echo "======================================="
echo ""

# Check if backend/.env exists
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env file..."
    cp backend/.env.example backend/.env
fi

echo "🔨 Installing dependencies..."
echo ""

# Install backend dependencies
echo "📦 Installing backend packages..."
cd backend
npm install
npx prisma generate
cd ..

# Install frontend dependencies  
echo "📦 Installing frontend packages..."
cd frontend
npm install
cd ..

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🚀 Starting services..."
echo ""
echo "To start the application:"
echo ""
echo "1. Start PostgreSQL and Redis (using Docker):"
echo "   docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15"
echo "   docker run -d --name redis -p 6379:6379 redis:7"
echo ""
echo "2. In one terminal, start the backend:"
echo "   cd backend"
echo "   npx prisma migrate dev"
echo "   npm run dev"
echo ""
echo "3. In another terminal, start the frontend:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "📱 Then access the app at http://localhost:3000"
echo ""
echo "First time setup:"
echo "1. Register a new account"
echo "2. Create or join a team"
echo "3. Add defenders to your roster"
echo "4. Create a game and start tracking!"