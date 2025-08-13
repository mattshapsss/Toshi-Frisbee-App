# Railway Deployment Guide - Lessons Learned

## Overview
This guide documents the complete process for deploying a Node.js/React monorepo to Railway, based on real deployment experience with the Ultimate D-Line Manager app.

## Prerequisites
- GitHub repository with your code
- Railway account (railway.app)
- PostgreSQL database (can be created in Railway)

## Project Structure Required
```
/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile (optional but recommended)
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile (optional but recommended)
└── package.json (root - optional)
```

## Step 1: Prepare Backend for Deployment

### 1.1 Fix Server Binding
The backend MUST bind to `0.0.0.0`, not `localhost`:

```javascript
// server.ts
const PORT = process.env.PORT || 5000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
```

### 1.2 Handle CommonJS vs ESM Issues
Use compatible package versions:
```json
{
  "dependencies": {
    "nanoid": "^3.3.7",  // v3 for CommonJS, not v5
    // ... other deps
  }
}
```

### 1.3 TypeScript Configuration
Relax strict checking for deployment:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": false
  }
}
```

### 1.4 Create Backend Dockerfile
```dockerfile
FROM node:18-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
ENV PRISMA_BINARY_TARGET=linux-musl-openssl-3.0.x
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]
```

### 1.5 Backend package.json Scripts
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy"
  }
}
```

## Step 2: Prepare Frontend for Deployment

### 2.1 Install Static Server
```bash
npm install serve --save
```

### 2.2 Update package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "serve -s dist -l $PORT"
  }
}
```

### 2.3 Fix PostCSS Config
Use CommonJS syntax:
```javascript
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 2.4 TypeScript Configuration
Disable strict checking:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false
  }
}
```

### 2.5 Add Vite Environment Types
```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### 2.6 Create Frontend Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

EXPOSE 3000

# Start with serve
CMD ["sh", "-c", "npx serve -s dist -l $PORT"]
```

### 2.7 Remove Hardcoded URLs
Update `.env.production`:
```env
# Don't use placeholders!
VITE_API_URL=https://your-actual-backend.railway.app/api
VITE_WS_URL=https://your-actual-backend.railway.app
```

## Step 3: Railway Setup

### 3.1 Create Services
1. Create new project in Railway
2. Add **THREE separate services**:
   - PostgreSQL (from database menu)
   - Backend (from GitHub repo)
   - Frontend (from GitHub repo)

### 3.2 Configure Backend Service

#### Set Root Directory
- Go to Settings → Service
- Set **Root Directory**: `/backend`

#### Environment Variables
```env
# Database (Railway auto-injects from PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Or use direct URL with SSL
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# Authentication
JWT_SECRET=<generate-random-32-char-string>
JWT_REFRESH_SECRET=<generate-different-32-char-string>

# CORS
FRONTEND_URL=https://your-frontend.railway.app

# Prisma
PRISMA_BINARY_TARGET=linux-musl

# Port (Railway auto-injects)
PORT=${{PORT}}
```

### 3.3 Configure Frontend Service

#### Set Root Directory
**CRITICAL**: Set this BEFORE first deploy!
- Go to Settings → Service
- Set **Root Directory**: `/frontend`

#### Environment Variables
```env
# Backend URLs
VITE_API_URL=https://your-backend.railway.app/api
VITE_WS_URL=https://your-backend.railway.app

# Port (Railway auto-injects)
PORT=${{PORT}}
```

## Step 4: Database Setup

### 4.1 Initial Schema Push
Run locally with Railway's database URL:
```bash
cd backend
DATABASE_URL="postgresql://..." npx prisma db push --accept-data-loss
```

### 4.2 For Production Migrations
Add to backend start command:
```json
{
  "deploy": {
    "startCommand": "npx prisma migrate deploy && npm run start"
  }
}
```

## Step 5: Deployment

### 5.1 Push to GitHub
```bash
git add .
git commit -m "Deployment configuration"
git push origin main
```

### 5.2 Railway Auto-Deploy
Railway will automatically:
1. Detect pushes to GitHub
2. Build using Dockerfile (if present) or Nixpacks
3. Deploy services

### 5.3 Verify Deployment
1. Check logs for each service
2. Test backend health: `https://backend.railway.app/health`
3. Access frontend: `https://frontend.railway.app`

## Common Issues and Solutions

### Issue: "npm not found" in Frontend
**Solution**: Create Dockerfile or ensure nixpacks.toml exists

### Issue: Prisma OpenSSL Errors
**Solution**: 
- Add to backend Dockerfile: `RUN apk add --no-cache openssl openssl-dev`
- Set env: `PRISMA_BINARY_TARGET=linux-musl`

### Issue: CORS Errors
**Solution**: 
- Backend needs: `FRONTEND_URL=https://exact-frontend-url.railway.app`
- Check backend binds to `0.0.0.0` not `localhost`

### Issue: Frontend Can't Connect to Backend
**Solution**:
- Check `VITE_API_URL` is set correctly
- Don't use placeholder URLs like `your-backend.railway.app`
- Rebuild frontend after changing env vars

### Issue: ESM/CommonJS Conflicts
**Solution**:
- Use older versions of ESM-only packages (e.g., nanoid@3 not nanoid@5)
- Or convert to dynamic imports

### Issue: TypeScript Build Errors
**Solution**:
- Set `"strict": false` in tsconfig.json
- Or skip TypeScript checking: change `"build": "tsc && vite build"` to `"build": "vite build"`

### Issue: Port Binding
**Solution**:
- Always use `$PORT` environment variable
- Never hardcode ports
- Bind to `0.0.0.0` not `127.0.0.1`

## Tips for Success

1. **Test Locally First**
   ```bash
   PORT=3001 npm run start  # Backend
   PORT=3000 npm run build && npm run start  # Frontend
   ```

2. **Use Dockerfiles**
   - More control than Nixpacks
   - Consistent builds
   - Easier debugging

3. **Check Logs Immediately**
   - Railway dashboard → Service → Logs
   - Look for startup errors
   - Check environment variables loaded correctly

4. **Environment Variables**
   - Set them in Railway dashboard, not in code
   - Use Railway's reference variables: `${{Postgres.DATABASE_URL}}`
   - Restart service after changing vars

5. **Monorepo Structure**
   - Set root directories correctly
   - Each service needs its own package.json
   - Don't use npm workspaces with Railway

## Generate Secure Secrets
```bash
# Generate JWT secrets
openssl rand -base64 32
```

## Final Checklist
- [ ] Backend binds to 0.0.0.0
- [ ] Frontend uses `serve` for static hosting
- [ ] No hardcoded URLs in production files
- [ ] Environment variables set in Railway
- [ ] Root directories configured
- [ ] Database migrations run
- [ ] CORS configured correctly
- [ ] TypeScript builds successfully
- [ ] No ESM/CommonJS conflicts

## Working Example Files

### backend/railway.json
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npx prisma generate && npm run build"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### frontend/railway.json
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

## Conclusion
Railway deployment requires attention to detail, especially around:
- Environment variables
- Port binding
- CORS configuration
- Package compatibility

Follow this guide step-by-step, and your deployment should succeed. When in doubt, check the logs!