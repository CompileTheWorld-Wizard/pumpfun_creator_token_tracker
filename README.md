# SolTrack - Independent Projects Structure

This repository contains 4 completely independent Node.js projects:

## Project Structure

```
soltrack/
├── frontend/              # Main frontend app with Vue + Vite + Auth Server
│   ├── src/              # Vue frontend source code
│   ├── server.ts         # Express auth server
│   ├── package.json      # Frontend dependencies
│   ├── tsconfig.json     # Frontend TypeScript config
│   └── vite.config.ts    # Vite configuration
│
├── creator_tracker/      # Independent Creator Tracking Server
│   ├── src/              # Server source code
│   ├── server.ts         # Main server file
│   ├── package.json      # Creator tracker dependencies
│   └── tsconfig.json     # Creator tracker TypeScript config
│
├── fund_tracker/         # Independent Fund Tracking Server
│   ├── src/              # Server source code
│   ├── server.ts         # Main server file
│   ├── package.json      # Fund tracker dependencies
│   └── tsconfig.json     # Fund tracker TypeScript config
│
├── trade_tracker/        # Independent Trade Tracking Server
│   ├── src/              # Server source code
│   ├── server.ts         # Main server file
│   ├── package.json      # Trade tracker dependencies
│   └── tsconfig.json     # Trade tracker TypeScript config
│
├── ecosystem.config.cjs  # PM2 configuration for all apps
├── deploy.sh            # Deployment script
└── package.json          # Root package.json (orchestration only)
```

## Port Configuration

- **Frontend/Auth Server**: Port 5004
- **Creator Tracker**: Port 5005
- **Fund Tracker**: Port 5006
- **Trade Tracker**: Port 5007

## Development

### Install Dependencies

```bash
# Install all dependencies for all projects
npm run install:all

# Or install individually:
cd frontend && npm install
cd creator_tracker && npm install
cd fund_tracker && npm install
cd trade_tracker && npm install
```

### Run Development Servers

```bash
# Run all apps in development mode
npm run dev

# Or run individually:
npm run dev:frontend    # Frontend + Auth server
npm run dev:creator     # Creator tracker
npm run dev:fund        # Fund tracker
npm run dev:trade       # Trade tracker
```

### Build

```bash
# Build all projects
npm run build

# Or build individually:
npm run build:frontend
npm run build:creator
npm run build:fund
npm run build:trade
```

## Deployment

### Using PM2

```bash
# Deploy all apps
npm run pm2:deploy
# or
./deploy.sh

# PM2 commands:
npm run pm2:start      # Start all apps
npm run pm2:stop       # Stop all apps
npm run pm2:restart    # Restart all apps
npm run pm2:status     # Check status
npm run pm2:logs       # View logs
```

## Authentication

- Authentication is centralized in the **frontend/auth server**
- All tracker servers use the same Redis session store
- Session cookie name: `soltrack.sid`
- All servers share the same session configuration

## Environment Variables

Each project can have its own `.env` file, but they should share:
- `REDIS_HOST` - Redis server host
- `REDIS_PORT` - Redis server port
- `REDIS_PASSWORD` - Redis password (if required)
- `REDIS_SESSION_DB` - Redis database for sessions (default: 1)
- `SESSION_SECRET` - Session secret (must be same across all servers)
- `SESSION_COOKIE_DOMAIN` - Cookie domain (if using subdomains)
- `USE_HTTPS` - Set to 'true' for HTTPS
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL config

## Independent Projects

Each tracker is completely independent:
- Own `package.json` and dependencies
- Own `tsconfig.json` configuration
- Own source code and build output
- Can be deployed separately
- No shared code between trackers

The frontend is also completely self-contained with:
- Vue.js frontend
- Vite build system
- Express auth server
- All frontend assets and configuration
