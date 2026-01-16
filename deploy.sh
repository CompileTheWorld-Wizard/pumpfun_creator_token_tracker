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

# Install and build frontend app
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd frontend
npm ci --production=false
echo -e "${GREEN}Building frontend...${NC}"
npm run build
cd ..

# Install and build creator_tracker app
echo -e "${GREEN}Installing creator_tracker dependencies...${NC}"
cd creator_tracker
npm ci --production=false
echo -e "${GREEN}Building creator_tracker...${NC}"
npm run build
cd ..

# Install and build fund_tracker app
echo -e "${GREEN}Installing fund_tracker dependencies...${NC}"
cd fund_tracker
npm ci --production=false
echo -e "${GREEN}Building fund_tracker...${NC}"
npm run build
cd ..

# Install and build trade_tracker app
echo -e "${GREEN}Installing trade_tracker dependencies...${NC}"
cd trade_tracker
npm ci --production=false
echo -e "${GREEN}Building trade_tracker...${NC}"
npm run build
cd ..

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 processes if running
echo -e "${GREEN}Stopping existing PM2 processes...${NC}"
pm2 stop all || true
pm2 delete all || true

# Start the applications with PM2
echo -e "${GREEN}Starting applications with PM2...${NC}"
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
echo -e "${GREEN}Setting up PM2 startup script...${NC}"
pm2 startup | grep -v PM2 || true

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check application status"
echo "  pm2 logs             - View application logs"
echo "  pm2 restart all      - Restart all applications"
echo "  pm2 stop all         - Stop all applications"
echo "  pm2 monit            - Monitor application resources"
