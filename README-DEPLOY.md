# Deployment Guide for SolTrack on Ubuntu Server

This guide will help you deploy SolTrack on an Ubuntu server using PM2.

## Prerequisites

- Ubuntu server (18.04 or later)
- Node.js (v18 or later)
- PostgreSQL database
- npm or yarn

## Installation Steps

### 1. Install Node.js (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PM2 globally

```bash
sudo npm install -g pm2
```

### 3. Clone or upload your project

```bash
cd /path/to/your/project
# or
git clone <your-repo-url>
cd soltrack
```

### 4. Install PostgreSQL (if not already installed)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### 5. Create database and user

```bash
sudo -u postgres psql
```

In PostgreSQL shell:
```sql
CREATE DATABASE soltrack;
CREATE USER soltrack_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE soltrack TO soltrack_user;
\q
```

### 6. Configure environment variables

Create a `.env` file in the project root:

```bash
nano .env
```

Add the following variables:

```env
# Server Configuration
NODE_ENV=production
PORT=5005

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=soltrack
DB_USER=soltrack_user
DB_PASSWORD=your_password

# Session Secret (generate a random string)
SESSION_SECRET=your-secret-key-change-this-to-random-string

# CORS Configuration (comma-separated list of allowed origins)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Ladysbug/GRPC Configuration
GRPC_URL=your_grpc_endpoint
X_TOKEN=your_x_token

# Optional: If using HTTPS, set secure cookies
# COOKIE_SECURE=true
```

### 7. Make deployment script executable

```bash
chmod +x deploy.sh
```

### 8. Run deployment script

```bash
./deploy.sh
```

Or manually:

```bash
# Install dependencies
npm ci

# Build ladysbug (if needed)
cd ladysbug && npm install && npm run build && cd ..

# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## PM2 Management Commands

### View Status
```bash
pm2 status
```

### View Logs
```bash
# All logs
pm2 logs soltrack

# Only error logs
pm2 logs soltrack --err

# Only output logs
pm2 logs soltrack --out

# Follow logs in real-time
pm2 logs soltrack --lines 100
```

### Restart Application
```bash
pm2 restart soltrack
```

### Stop Application
```bash
pm2 stop soltrack
```

### Delete Application from PM2
```bash
pm2 delete soltrack
```

### Monitor Resources
```bash
pm2 monit
```

### Save Current PM2 Configuration
```bash
pm2 save
```

## Setting up Reverse Proxy (Nginx)

If you want to use Nginx as a reverse proxy:

### 1. Install Nginx

```bash
sudo apt install nginx
```

### 2. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/soltrack
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (optional, if using SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:5005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/soltrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL Certificate (Let's Encrypt)

If you want to use HTTPS:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Troubleshooting

### Check if the application is running
```bash
pm2 status
```

### Check application logs
```bash
pm2 logs soltrack --lines 50
```

### Check if port is in use
```bash
sudo netstat -tulpn | grep 5005
```

### Check database connection
```bash
psql -h localhost -U soltrack_user -d soltrack
```

### Restart PM2 after system reboot
PM2 should automatically restart if you ran `pm2 startup`. If not:
```bash
pm2 startup
# Follow the instructions it provides
pm2 save
```

## Updating the Application

1. Pull latest changes (if using git):
```bash
git pull
```

2. Run deployment script:
```bash
./deploy.sh
```

Or manually:
```bash
npm ci
npm run build
pm2 restart soltrack
```

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `production` |
| `PORT` | Server port | No | `5005` |
| `DB_HOST` | PostgreSQL host | Yes | - |
| `DB_PORT` | PostgreSQL port | No | `5432` |
| `DB_NAME` | Database name | Yes | - |
| `DB_USER` | Database user | Yes | - |
| `DB_PASSWORD` | Database password | Yes | - |
| `SESSION_SECRET` | Session encryption secret | Yes | - |
| `ALLOWED_ORIGINS` | CORS allowed origins | No | - |
| `GRPC_URL` | Ladysbug GRPC endpoint | Yes | - |
| `X_TOKEN` | Ladysbug authentication token | Yes | - |
| `COOKIE_SECURE` | Use secure cookies (HTTPS) | No | `false` |

## Security Notes

1. **Never commit `.env` file** - It contains sensitive information
2. **Use strong SESSION_SECRET** - Generate a random string
3. **Set ALLOWED_ORIGINS** - Restrict CORS in production
4. **Use HTTPS in production** - Set `COOKIE_SECURE=true` when using HTTPS
5. **Keep dependencies updated** - Regularly run `npm audit` and `npm update`
6. **Use firewall** - Only expose necessary ports (80, 443)

## Monitoring

### PM2 Monitoring Dashboard
```bash
pm2 plus
```

### System Resources
```bash
pm2 monit
```

### Application Health Check
```bash
curl http://localhost:5005/api/health
```

