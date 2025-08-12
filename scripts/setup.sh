#!/bin/bash

echo "🚀 Ultimate D-Line Manager Setup Script"
echo "======================================="
echo ""

# Check for required tools
echo "📋 Checking requirements..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ All requirements met!"
echo ""

# Create environment file if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env file..."
    cp backend/.env.example backend/.env
    echo "   Please edit backend/.env with your configuration"
    echo ""
fi

# Build and start services
echo "🔨 Building Docker containers..."
docker-compose build

echo ""
echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

echo ""
echo "🗄️  Running database migrations..."
docker-compose exec -T backend npx prisma migrate deploy

echo ""
echo "✨ Setup complete!"
echo ""
echo "📱 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo "   Database: localhost:5432"
echo "   Redis:    localhost:6379"
echo ""
echo "📚 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose down"
echo "   Reset database:   docker-compose exec backend npx prisma migrate reset"
echo "   Prisma Studio:    docker-compose exec backend npx prisma studio"
echo ""
echo "🎉 Happy coding!"