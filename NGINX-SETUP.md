# Nginx Setup Guide

## Permission Issues Fix

The error `(13: Permission denied)` means nginx cannot read the files. Follow these steps:

### Step 1: Check nginx user
```bash
# Find out which user nginx runs as
ps aux | grep nginx
# Usually it's 'www-data' or 'nginx'
```

### Step 2: Fix directory permissions
```bash
# Make sure the directory and all parent directories are readable
# Option 1: Give nginx user read access (recommended)
sudo chmod 755 /home/scraper
sudo chmod 755 /home/scraper/pumpfun_creator_token_tracker
sudo chmod -R 755 /home/scraper/pumpfun_creator_token_tracker/dist-frontend

# Option 2: Add nginx user to your group (if you own the files)
sudo usermod -a -G scraper www-data  # or 'nginx' instead of 'www-data'
sudo chmod -R g+r /home/scraper/pumpfun_creator_token_tracker/dist-frontend

# Option 3: Make files world-readable (less secure, but works)
sudo chmod -R 644 /home/scraper/pumpfun_creator_token_tracker/dist-frontend
sudo find /home/scraper/pumpfun_creator_token_tracker/dist-frontend -type d -exec chmod 755 {} \;
```

### Step 3: Verify permissions
```bash
# Check if nginx can read the files
sudo -u www-data ls -la /home/scraper/pumpfun_creator_token_tracker/dist-frontend
# or
sudo -u nginx ls -la /home/scraper/pumpfun_creator_token_tracker/dist-frontend

# If this fails, permissions are still wrong
```

### Step 4: Alternative - Move files to standard location
If permission issues persist, consider moving files to a standard web directory:
```bash
# Copy files to /var/www (standard nginx location)
sudo mkdir -p /var/www/tool.dillwifit.com
sudo cp -r /home/scraper/pumpfun_creator_token_tracker/dist-frontend/* /var/www/tool.dillwifit.com/
sudo chown -R www-data:www-data /var/www/tool.dillwifit.com
sudo chmod -R 755 /var/www/tool.dillwifit.com

# Then update nginx config root to:
# root /var/www/tool.dillwifit.com;
```

## Upstream Connection Errors

If you see errors like `connect() failed (111: Unknown error)`, the Node.js servers aren't running or aren't accessible.

### Check if servers are running:
```bash
# Check if PM2 processes are running
pm2 status

# If not running, start them:
cd /home/scraper/pumpfun_creator_token_tracker
pm2 start ecosystem.config.cjs

# Check if ports are listening:
sudo netstat -tlnp | grep -E '5005|5006|5007'
# or
sudo ss -tlnp | grep -E '5005|5006|5007'
```

### Verify server accessibility:
```bash
# Test if servers respond locally
curl http://localhost:5005/api/status
curl http://localhost:5006/api/status
curl http://localhost:5007/api/status
```

## Complete Nginx Configuration

Make sure your `/etc/nginx/sites-available/tool.dillwifit.com` matches the corrected config:

```nginx
server {
    listen 443 ssl http2;
    server_name tool.dillwifit.com;

    ssl_certificate /etc/letsencrypt/live/tool.dillwifit.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tool.dillwifit.com/privkey.pem;
    include /etc/nginx/snippets/ssl-params.conf;

    # Use absolute path - update this to your actual path
    root /home/scraper/pumpfun_creator_token_tracker/dist-frontend;
    index index.html;

    access_log /var/log/nginx/tool.dillwifit.com_access.log;
    error_log /var/log/nginx/tool.dillwifit.com_error.log;

    # Serve static assets directly
    location /assets/ {
        try_files $uri =404;
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Creator tracking API (port 5005)
    location /api/ {
        proxy_pass http://127.0.0.1:5005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }

    # Trade tracking API (port 5007)
    location /trade-api/ {
        proxy_pass http://127.0.0.1:5007/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }

    # Fund tracking API (port 5006)
    location /fund-api/ {
        proxy_pass http://127.0.0.1:5006/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }

    # SPA fallback - must be last
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name tool.dillwifit.com;
    return 301 https://$server_name$request_uri;
}
```

## After Making Changes

1. **Test nginx configuration:**
   ```bash
   sudo nginx -t
   ```

2. **Reload nginx:**
   ```bash
   sudo systemctl reload nginx
   # or
   sudo service nginx reload
   ```

3. **Check logs if issues persist:**
   ```bash
   sudo tail -f /var/log/nginx/tool.dillwifit.com_error.log
   sudo tail -f /var/log/nginx/tool.dillwifit.com_access.log
   ```

## Troubleshooting

### Still getting permission denied?
```bash
# Check SELinux (if enabled)
getenforce
# If enforcing, you may need:
sudo setsebool -P httpd_read_user_content 1
```

### Files not found?
```bash
# Verify the path exists and has files
ls -la /home/scraper/pumpfun_creator_token_tracker/dist-frontend/
# Check if index.html exists
ls -la /home/scraper/pumpfun_creator_token_tracker/dist-frontend/index.html
```

### Upstream still failing?
- Ensure Node.js servers are running: `pm2 status`
- Check firewall: `sudo ufw status`
- Verify ports are bound to 127.0.0.1, not just localhost
- Check server logs: `pm2 logs`
