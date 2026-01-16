#!/bin/bash

# Deployment script for SolTrack Trade Tracker
# Usage: ./deploy.sh

set -e

echo "🚀 Starting trade tracker deployment..."

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
    echo -e "${YELLOW}Warning: .env file not found in trade_tracker directory.${NC}"
    echo "You may need to create a .env file with the required environment variables."
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm ci --production=false

# Build the application
echo -e "${GREEN}Building application...${NC}"
npm run build

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 process if running
echo -e "${GREEN}Stopping existing PM2 process...${NC}"
pm2 stop soltrack-trade-tracker || true
pm2 delete soltrack-trade-tracker || true

# Start the application with PM2
echo -e "${GREEN}Starting application with PM2...${NC}"
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
echo -e "${GREEN}Setting up PM2 startup script...${NC}"
pm2 startup | grep -v PM2 || true

echo -e "${GREEN}✅ Trade tracker deployment completed successfully!${NC}"
echo ""
echo "Useful commands:"
echo "  pm2 status soltrack-trade-tracker  - Check application status"
echo "  pm2 logs soltrack-trade-tracker    - View application logs"
echo "  pm2 restart soltrack-trade-tracker - Restart the application"
echo "  pm2 stop soltrack-trade-tracker    - Stop the application"
echo "  pm2 monit                         - Monitor application resources"
