# Railway Deployment Guide

## Overview
This is a monorepo containing both frontend (React) and backend (Node.js/Express) services.

## Setup Instructions

### 1. Create Railway Project
1. Go to [Railway](https://railway.app) and create a new project
2. Choose "Deploy from GitHub repo" and select `Toshi-Frisbee-App`

### 2. Create Services

#### Backend Service
1. Click "New Service" → "GitHub Repo" 
2. Select your repo
3. **Important Settings:**
   - Set **Root Directory**: `/backend`
   - Set **Start Command**: `npm run prisma:migrate && npm run start`
   - The service will auto-detect Node.js and use Nixpacks

#### Frontend Service  
1. Click "New Service" → "GitHub Repo"
2. Select your repo again
3. **Important Settings:**
   - Set **Root Directory**: `/frontend`
   - Set **Start Command**: `npm run preview`
   - The service will auto-detect Node.js and use Nixpacks

#### PostgreSQL Database
1. Click "New Service" → "Database" → "PostgreSQL"
2. Railway will provision a PostgreSQL instance

### 3. Environment Variables

#### Backend Service Variables
```env
# Database (Railway will auto-inject these from PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Auth
JWT_SECRET=your-secure-jwt-secret-here
JWT_REFRESH_SECRET=your-secure-refresh-secret-here

# Redis (optional - for production)
REDIS_URL=redis://default:password@host:6379

# Server
PORT=3001
NODE_ENV=production
```

#### Frontend Service Variables
```env
# Backend API URL (use Railway internal URL)
VITE_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}

# Port (Railway will auto-inject)
PORT=${{PORT}}
```

### 4. Service Dependencies

In Railway dashboard:
1. Go to Backend service → Settings → Deploy
2. Add PostgreSQL as a dependency (ensures DB is ready before backend starts)

### 5. Deploy Order

1. PostgreSQL will deploy first
2. Backend will deploy after PostgreSQL is ready
3. Frontend can deploy in parallel

### 6. Custom Domains (Optional)

For each service:
1. Go to Settings → Networking
2. Add your custom domain
3. Update DNS records as instructed

## File Structure

```
/
├── backend/
│   ├── railway.json      # Backend Railway config
│   ├── nixpacks.toml     # Backend Nixpacks config
│   └── package.json      # Backend dependencies
├── frontend/
│   ├── railway.json      # Frontend Railway config
│   ├── nixpacks.toml     # Frontend Nixpacks config
│   └── package.json      # Frontend dependencies
└── package.json          # Root package (workspace config)
```

## Troubleshooting

### "No start command could be found" Error
- Ensure Root Directory is set correctly for each service
- Check that package.json has proper start scripts
- Verify nixpacks.toml is in the service directory

### Database Connection Issues
- Ensure DATABASE_URL is properly set using Railway's reference variables
- Check that Prisma migrations run successfully
- Verify PostgreSQL service is running

### Frontend Can't Connect to Backend
- Use Railway's internal networking when possible
- Ensure CORS is configured for production domains
- Check that backend's public domain is exposed

## Monitoring

- View logs: Service → Logs tab
- Check metrics: Service → Metrics tab
- Set up health checks in railway.json for auto-restarts