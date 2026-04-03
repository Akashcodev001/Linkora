# Linkora Deployment Guide

This guide covers deploying Linkora (Frontend, Backend, AI Service) via **Docker**, **Render**, or **Vercel + Render** (recommended).

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- ✅ All tests pass locally (`npm test` in each service)
- ✅ Frontend builds successfully (`npm run build`)
- ✅ Secrets are secure (JWT_SECRET, API keys, etc.)
- ✅ GitHub repo is up to date (`git push origin main`)
- ✅ MongoDB and Redis are configured for your chosen platform

---

## 🐳 Option 1: Docker Compose (Local VM or Cloud VM)

**Best for:** Single-server deployment, development/staging, full control

### Step 1: Prepare Environment

```bash
cd /path/to/Linkora
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# .env
MONGODB_URI=mongodb://mongodb:27017/linkora
REDIS_URL=redis://redis:6379
JWT_SECRET=your-super-secret-jwt-key-min-64-chars
AI_SERVICE_INTERNAL_KEY=your-super-secret-ai-key-min-64-chars
OPENAI_API_KEY=sk-your-openai-key
MISTRAL_API_KEY=your-mistral-key
```

### Step 2: Build and Deploy

```bash
# From repository root
docker compose build
docker compose up -d
```

Verify services are running:
```bash
docker compose ps
```

Expected output:
```
linkora-mongodb  - UP
linkora-redis    - UP
linkora-qdrant   - UP
linkora-backend  - UP (port 3000)
linkora-ai-service - UP (port 5001)
```

### Step 3: Verify Deployment

```bash
# Check Backend health
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3000/api/health

# Check AI Service health (requires internal key)
curl -H "X-Internal-Key: $AI_SERVICE_INTERNAL_KEY" http://localhost:5001/health
```

### Step 4: Access Services

- **Frontend:** http://localhost:3000 (served by Frontend)
- **Backend API:** http://localhost:3000/api
- **AI Service:** http://localhost:5001 (internal only)
- **MongoDB:** localhost:27017
- **Redis:** localhost:6379
- **Qdrant:** http://localhost:6333

### Step 5: Logs & Monitoring

```bash
# View logs for all services
docker compose logs -f

# View specific service
docker compose logs -f backend
docker compose logs -f ai-service
```

### Cleanup

```bash
# Stop all services
docker compose down

# Remove volumes (careful - deletes data)
docker compose down -v
```

---

## 🎯 Option 2: Render.com Deployment

**Best for:** Managed platform, auto-scaling, easy GitHub integration

### Prerequisites

1. Create a [Render account](https://render.com)
2. Connect your GitHub repository
3. Have MongoDB Atlas cluster (free tier available)
4. Have Redis instance (Render offers Redis add-on)

### Step 1: Create MongoDB Atlas Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/Linkora?retryWrites=true&w=majority`

### Step 2: Create Redis Instance (on Render)

1. Go to Render Dashboard
2. Create new → Redis
3. Name: `linkora-redis`
4. Copy connection URL

### Step 3: Deploy Backend Service

1. Render Dashboard → Create New → Web Service
2. **Connect Repository:** Select your Linkora GitHub repo
3. **Build Settings:**
   - Name: `linkora-backend`
   - Runtime: Node
   - Root Directory: `Backend`
   - Build Command: `npm ci`
   - Start Command: `npm start`

4. **Environment Variables:**
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/Linkora?retryWrites=true&w=majority
   REDIS_URL=redis://default:password@redis-instance-url:6379
   JWT_SECRET=your-super-secret-jwt-key-min-64-chars
   FRONTEND_URL=https://linkora-frontend.vercel.app
   BACKEND_URL=https://linkora-backend.onrender.com
   AI_SERVICE_INTERNAL_KEY=your-super-secret-ai-key
   ```

5. **Plan:** Choose Free or Paid
6. Click Deploy

### Step 4: Deploy AI Service

1. Render Dashboard → Create New → Web Service
2. **Connect Repository:** Same GitHub repo
3. **Build Settings:**
   - Name: `linkora-ai-service`
   - Runtime: Node
   - Root Directory: `ai-service`
   - Build Command: `npm ci`
   - Start Command: `npm start`

4. **Environment Variables:** (Same as Backend)
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://...
   REDIS_URL=redis://...
   AI_SERVICE_INTERNAL_KEY=your-super-secret-ai-key
   OPENAI_API_KEY=sk-your-openai-key
   ```

5. Click Deploy

### Step 5: Deploy Frontend (Static Site on Render)

1. Render Dashboard → Create New → Static Site
2. **Connect Repository:** Same GitHub repo
3. **Build Settings:**
   - Name: `linkora-frontend`
   - Build Command: `npm ci && npm run build`
   - Publish Directory: `dist`

4. **Environment Variables:**
   ```
   VITE_API_URL=https://linkora-backend.onrender.com/api
   ```

5. Click Deploy

### Step 6: Configure OAuth Callbacks

After deployment, update OAuth provider callback URLs:

**Google Console:**
- Authorized redirect URIs:
  - `https://linkora-backend.onrender.com/api/auth/google/callback`

**GitHub OAuth Settings:**
- Authorization callback URL:
  - `https://linkora-backend.onrender.com/api/auth/github/callback`

### Verify Deployment

```bash
# Check Backend
curl https://linkora-backend.onrender.com/api/health

# Check Frontend loads
curl https://linkora-frontend.onrender.com
```

---

## 🚀 Option 3: Vercel + Render (Recommended)

**Best for:** Optimal performance, Vercel for static frontend, Render for backend

### Frontend: Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Import Project → Select Linkora GitHub repo
3. **Framework:** Vite
4. **Root Directory:** `Frontend`
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`
7. **Environment Variables:**
   ```
   VITE_API_URL=https://linkora-backend.onrender.com/api
   ```
8. Deploy

Your frontend will be at `https://linkora-frontend.vercel.app`

### Backend & AI Service: Deploy to Render

Follow **Option 2** steps (Deploy Backend and AI Service to Render).

### Final Configuration

1. **Update Frontend .env:**
   ```
   VITE_API_URL=https://linkora-backend.onrender.com/api
   ```

2. **OAuth Callbacks:**
   ```
   https://linkora-backend.onrender.com/api/auth/google/callback
   https://linkora-backend.onrender.com/api/auth/github/callback
   ```

3. **Backend Environment:**
   ```
   FRONTEND_URL=https://linkora-frontend.vercel.app
   BACKEND_URL=https://linkora-backend.onrender.com
   ```

---

## 🔐 Security Best Practices

### Required for Production

- [ ] Use strong, unique secrets (64+ characters)
- [ ] Store secrets in environment variables (never commit)
- [ ] Enable HTTPS (automatic on Vercel/Render)
- [ ] Use MongoDB Atlas with IP whitelist
- [ ] Enable Redis authentication
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS origins properly
- [ ] Rotate JWT secrets periodically

### Environment Templates

**Production .env:**
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/Linkora
REDIS_URL=redis://user:pass@redis-host:6379
JWT_SECRET=generate-with: openssl rand -base64 32
AI_SERVICE_INTERNAL_KEY=generate-with: openssl rand -base64 32
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
QDRANT_URL=http://qdrant:6333
```

---

## 📊 Comparison Table

| Option | Cost | Complexity | Auto-scale | Best For |
|--------|------|------------|-----------|----------|
| Docker Compose | Low (self-hosted) | Medium | Manual | Dev, Staging, Simple prod |
| Render | Free-$$$ | Low | Auto | Small-medium prod |
| Vercel + Render | Free-$$$ | Low | Auto | Full-stack prod |

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check logs
docker compose logs backend

# Common issues:
# - MONGODB_URI not set
# - Redis connection failed
# - Port 3000 already in use
```

### AI Service tests failing
```bash
# Run locally first
cd ai-service
npm test

# Check environment variables
echo $OPENAI_API_KEY
echo $AI_SERVICE_INTERNAL_KEY
```

### Frontend not connecting to Backend
```bash
# Verify API URL
echo $VITE_API_URL

# Check CORS on backend
# Backend should have correct FRONTEND_URL
```

### OAuth not working
- Verify callback URLs match exactly
- Check client ID/secret in OAuth provider console
- Ensure HTTPS is enabled (Render/Vercel have this by default)

---

## 📈 Monitoring & Logs

### Render
- Build logs: Dashboard → Service → Logs
- Runtime logs: Dashboard → Service → Runtime Logs

### Vercel
- Deployment logs: Project → Deployments
- Runtime logs: Project → Analytics → Logs

### Docker
```bash
docker compose logs -f [service-name]
docker stats
```

---

## 🔄 Redeployment

### Docker
```bash
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Render
- Automatic on `git push origin main` (by default)
- Manual: Dashboard → Service → Manual Redeploy

### Vercel
- Automatic on `git push origin main`
- Manual: Project → Deployments → Redeploy

---

## 📞 Support

For issues, check:
1. Service logs (specific to your platform)
2. `.env` variables are set correctly
3. Database/Redis connectivity
4. GitHub Actions workflows (CI/CD status)

Good luck! 🚀
