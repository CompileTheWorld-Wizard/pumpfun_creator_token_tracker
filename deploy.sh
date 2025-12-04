#!/bin/bash

# Deployment script for SolTrack on Ubuntu server
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 is not installed. Installing PM2...${NC}"
    npm install -g pm2
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with the required environment variables."
    exit 1
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm ci --production=false

# Build ladysbug if needed
if [ -d "ladysbug" ]; then
    echo -e "${GREEN}Building ladysbug...${NC}"
    cd ladysbug
    npm install
    npm run build
    cd ..
fi

# Build the application
echo -e "${GREEN}Building application...${NC}"
npm run build

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 process if running
echo -e "${GREEN}Stopping existing PM2 process...${NC}"
pm2 stop soltrack || true
pm2 delete soltrack || true

# Start the application with PM2
echo -e "${GREEN}Starting application with PM2...${NC}"
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
echo -e "${GREEN}Setting up PM2 startup script...${NC}"
pm2 startup | grep -v PM2 || true

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Useful commands (using npm scripts):"
echo "  npm run pm2:status   - Check application status"
echo "  npm run pm2:logs     - View application logs"
echo "  npm run pm2:restart  - Restart the application"
echo "  npm run pm2:stop     - Stop the application"
echo "  npm run pm2:monit    - Monitor application resources"
echo "  npm run pm2:deploy   - Full deployment"
echo ""
echo "Or use PM2 directly:"
echo "  pm2 status          - Check application status"
echo "  pm2 logs soltrack   - View application logs"
echo "  pm2 restart soltrack - Restart the application"
echo "  pm2 stop soltrack   - Stop the application"
echo "  pm2 monit           - Monitor application resources"

