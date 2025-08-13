# Railway Deployment Guide - Complete Instructions

## Overview
This guide documents the complete process for deploying the Ultimate D-Line Manager (Node.js/React monorepo) to Railway, including all the issues encountered and their solutions.

## Prerequisites
- GitHub repository with your code
- Railway account (railway.app)
- Patience (Railway can be finicky with monorepos)

## Project Structure Required
```
/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   ├── tsconfig.json
│   └── railway.json
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── railway.json
└── README.md
```

## Step 1: Critical Backend Preparations

### 1.1 Fix Server Binding (CRITICAL!)
The backend MUST bind to `0.0.0.0`, not `localhost`:

```javascript
// backend/src/server.ts
const PORT = process.env.PORT || 5000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
```

**Why this matters**: Railway's internal networking requires binding to all interfaces.

### 1.2 Add Trust Proxy Setting
```javascript
// backend/src/server.ts
// Trust proxy for Railway/production environments
app.set('trust proxy', 1);
```

**Why this matters**: Prevents rate limiter errors with Railway's proxy setup.

### 1.3 Handle CommonJS vs ESM Issues
Use compatible package versions:
```json
{
  "dependencies": {
    "nanoid": "^3.3.7",  // v3 for CommonJS, not v5 which is ESM-only
    // ... other deps
  }
}
```

### 1.4 TypeScript Configuration
Relax strict checking for deployment:
```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": false,
    "skipLibCheck": true
  }
}
```

### 1.5 Backend package.json Scripts
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy"
  }
}
```

### 1.6 Backend railway.json
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npx prisma generate && npm run build"
  },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Step 2: Critical Frontend Preparations

### 2.1 Install Static Server
```bash
cd frontend
npm install serve --save
```

### 2.2 Update package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "serve -s dist -l $PORT",
    "preview": "vite preview"
  }
}
```

### 2.3 Fix PostCSS Config
Use CommonJS syntax:
```javascript
// frontend/postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 2.4 TypeScript Configuration
```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false,
    "skipLibCheck": true
  }
}
```

### 2.5 Add Vite Environment Types
```typescript
// frontend/src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### 2.6 Frontend railway.json
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Step 3: Railway Setup (The Right Way)

### 3.1 Create Services
1. Create new project in Railway
2. Add **THREE separate services** (ORDER MATTERS!):
   - **First**: PostgreSQL (from database menu)
   - **Second**: Backend (from GitHub repo)
   - **Third**: Frontend (from GitHub repo)

### 3.2 Configure PostgreSQL Service
Railway will auto-provision this. Note the connection string for later.

### 3.3 Configure Backend Service

#### CRITICAL: Set Root Directory FIRST!
1. Go to Settings → Service
2. Set **Root Directory**: `/backend`
3. **Deploy will fail if you don't do this before first deployment!**

#### Environment Variables
Click on the Backend service → Variables tab and add:

```env
# Database - Use Railway's reference variable
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Authentication - Generate secure random strings!
JWT_SECRET=<generate-random-32-char-string>
JWT_REFRESH_SECRET=<generate-different-32-char-string>

# CORS - Use actual frontend URL after it deploys
FRONTEND_URL=https://your-frontend-production.up.railway.app

# Node Environment
NODE_ENV=production

# Port - Railway auto-injects this
PORT=${{PORT}}

# Optional Redis (if you add Redis service)
REDIS_URL=${{Redis.REDIS_URL}}
```

### 3.4 Configure Frontend Service

#### CRITICAL: Set Root Directory FIRST!
1. Go to Settings → Service
2. Set **Root Directory**: `/frontend`

#### Environment Variables
```env
# Backend URLs - Use actual deployed backend URL!
VITE_API_URL=https://your-backend-production.up.railway.app/api
VITE_WS_URL=wss://your-backend-production.up.railway.app

# Port - Railway auto-injects
PORT=${{PORT}}
```

**IMPORTANT**: Don't use placeholder URLs! Use the actual Railway-generated URLs from your backend service.

## Step 4: Database Setup

### 4.1 Initial Schema Push
After backend is deployed, run locally with Railway's database URL:

```bash
cd backend

# Get the DATABASE_URL from Railway PostgreSQL service
DATABASE_URL="postgresql://postgres:password@host.railway.internal:5432/railway" \
npx prisma db push --accept-data-loss
```

### 4.2 Alternative: Use Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Run migrations
railway run npx prisma migrate deploy
```

## Step 5: Deployment Process

### 5.1 Push to GitHub
```bash
git add .
git commit -m "Railway deployment configuration"
git push origin main
```

### 5.2 Monitor Deployment
1. Watch each service's logs in Railway dashboard
2. Backend should show: "Server running on http://0.0.0.0:PORT"
3. Frontend should show: "Serving at http://0.0.0.0:PORT"

### 5.3 Common Deployment Order Issues
If services fail:
1. Ensure PostgreSQL is fully deployed first
2. Backend needs DATABASE_URL from PostgreSQL
3. Frontend needs backend URL to be active

## Step 6: Post-Deployment Verification

### 6.1 Test Endpoints
```bash
# Backend health check
curl https://your-backend.railway.app/health

# Frontend
open https://your-frontend.railway.app
```

### 6.2 Check WebSocket Connection
Open browser console on frontend and look for:
```
Socket connected
```

## Common Issues and Solutions

### Issue: "Cannot find module" or "npm not found"
**Solution**: 
- Ensure root directory is set correctly
- Check that package.json exists in the service root
- Verify railway.json is present

### Issue: Prisma Client Not Generated
**Solution**: 
Add to backend build command:
```json
"buildCommand": "npm ci && npx prisma generate && npm run build"
```

### Issue: CORS Errors
**Solution**: 
- Set `FRONTEND_URL` in backend to exact frontend URL (no trailing slash!)
- Ensure backend binds to `0.0.0.0`
- Check that credentials are included in frontend API calls

### Issue: WebSocket Connection Fails
**Solution**:
- Use `wss://` not `ws://` for production
- Don't add `/socket.io` to the WS URL
- Ensure Socket.io versions match between frontend and backend

### Issue: Database Connection Timeout
**Solution**:
- Add to DATABASE_URL: `?connection_limit=1&connect_timeout=300`
- Use Railway's internal URL format for better performance
- Ensure Prisma binary target is correct

### Issue: Build Fails with TypeScript Errors
**Solution**:
- Set `"strict": false` in tsconfig.json
- Add `"skipLibCheck": true`
- Or change build to skip TS checking: `"build": "vite build"`

### Issue: Frontend Shows Blank Page
**Solution**:
- Check that environment variables are set
- Rebuild after changing env vars
- Verify API URL is correct in network tab

### Issue: Rate Limiter X-Forwarded-For Error
**Solution**:
Add to backend server.ts:
```javascript
app.set('trust proxy', 1);
```

## Environment Variable Tips

### Generate Secure Secrets
```bash
# For JWT_SECRET and JWT_REFRESH_SECRET
openssl rand -base64 32
```

### Railway Variable References
Use Railway's variable references for service communication:
- `${{Postgres.DATABASE_URL}}` - Auto-links to PostgreSQL
- `${{Backend.RAILWAY_PUBLIC_DOMAIN}}` - References backend domain

## Debugging Tips

1. **Always Check Logs First**
   - Railway Dashboard → Service → Logs
   - Look for startup errors
   - Check environment variable loading

2. **Use Railway CLI for Testing**
   ```bash
   railway logs
   railway run npm run dev
   ```

3. **Database Issues**
   ```bash
   # Connect to production database
   railway run npx prisma studio
   ```

4. **Environment Variables Not Working?**
   - Redeploy after changing variables
   - Check for typos in variable names
   - Ensure no quotes in Railway dashboard values

## Production Checklist

- [ ] Backend binds to `0.0.0.0`
- [ ] Trust proxy is enabled
- [ ] Frontend uses `serve` package
- [ ] Root directories set for both services
- [ ] No hardcoded localhost URLs
- [ ] Environment variables use actual URLs
- [ ] Database migrations run successfully
- [ ] CORS configured with production URL
- [ ] JWT secrets are secure random strings
- [ ] WebSocket URL uses `wss://` protocol

## Monitoring & Maintenance

### Health Checks
Add to each railway.json:
```json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60
  }
}
```

### Auto-Restart on Failure
Already configured in railway.json with:
```json
"restartPolicyType": "ON_FAILURE",
"restartPolicyMaxRetries": 3
```

### Logs and Metrics
- View real-time logs in Railway dashboard
- Set up log drains for persistence
- Monitor memory and CPU usage in Metrics tab

## Scaling Considerations

### When You Need More Resources
1. Upgrade Railway plan for more resources
2. Add Redis for session management
3. Consider database connection pooling
4. Implement caching strategies

### Database Optimizations
```sql
-- Add indexes for common queries
CREATE INDEX idx_games_team_id ON games(team_id);
CREATE INDEX idx_offensive_players_game_id ON offensive_players(game_id);
```

## Final Notes

Railway deployment can be tricky with monorepos, but following this guide should get you deployed successfully. The key points to remember:

1. **Set root directories BEFORE first deploy**
2. **Use actual URLs, not placeholders**
3. **Bind backend to 0.0.0.0**
4. **Check logs immediately if something fails**
5. **Environment variables are crucial - double-check them**

When in doubt, check the logs and ensure your environment variables are correct!

## Support

If you encounter issues not covered here:
1. Check Railway's documentation
2. Visit Railway's Discord community
3. Review the deployment logs carefully
4. Ensure all prerequisites are met

Good luck with your deployment! 🚀