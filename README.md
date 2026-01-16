# SolTrack - Independent Projects Structure

This repository contains 4 completely independent Node.js projects. Each project has its own:
- `package.json` and dependencies
- `node_modules/` folder
- `ecosystem.config.cjs` for PM2
- `deploy.sh` script
- Build output (`dist/`)
- Logs directory

Only the root `package.json` and git repository are shared.

## Project Structure

```
soltrack/
├── frontend/              # Independent Frontend + Auth Server
│   ├── src/              # Vue frontend source code
│   ├── server.ts         # Express auth server
│   ├── package.json      # Frontend dependencies
│   ├── ecosystem.config.cjs  # PM2 config for frontend
│   ├── deploy.sh         # Deployment script for frontend
│   ├── node_modules/     # Frontend dependencies
│   ├── dist/             # Frontend build output
│   └── logs/            # Frontend logs
│
├── creator_tracker/      # Independent Creator Tracking Server
│   ├── src/              # Server source code
│   ├── server.ts         # Main server file
│   ├── package.json      # Creator tracker dependencies
│   ├── ecosystem.config.cjs  # PM2 config for creator tracker
│   ├── deploy.sh         # Deployment script for creator tracker
│   ├── node_modules/     # Creator tracker dependencies
│   ├── dist/             # Creator tracker build output
│   └── logs/             # Creator tracker logs
│
├── fund_tracker/         # Independent Fund Tracking Server
│   ├── src/              # Server source code
│   ├── server.ts         # Main server file
│   ├── package.json      # Fund tracker dependencies
│   ├── ecosystem.config.cjs  # PM2 config for fund tracker
│   ├── deploy.sh         # Deployment script for fund tracker
│   ├── node_modules/     # Fund tracker dependencies
│   ├── dist/             # Fund tracker build output
│   └── logs/             # Fund tracker logs
│
├── trade_tracker/        # Independent Trade Tracking Server
│   ├── src/              # Server source code
│   ├── server.ts         # Main server file
│   ├── package.json      # Trade tracker dependencies
│   ├── ecosystem.config.cjs  # PM2 config for trade tracker
│   ├── deploy.sh         # Deployment script for trade tracker
│   ├── node_modules/     # Trade tracker dependencies
│   ├── dist/             # Trade tracker build output
│   └── logs/             # Trade tracker logs
│
├── package.json          # Root package.json (orchestration only)
└── README.md             # This file
```

## Port Configuration

- **Frontend/Auth Server**: Port 5004
- **Creator Tracker**: Port 5005
- **Fund Tracker**: Port 5006
- **Trade Tracker**: Port 5007

## Development

### Install Dependencies

Each project manages its own dependencies independently:

```bash
# Install all dependencies (orchestration script)
npm run install:all

# Or install individually:
cd frontend && npm install
cd creator_tracker && npm install
cd fund_tracker && npm install
cd trade_tracker && npm install
```

### Run Development Servers

```bash
# Run all apps in development mode (orchestration)
npm run dev

# Or run individually from each project directory:
cd frontend && npm run dev
cd creator_tracker && npm run dev
cd fund_tracker && npm run dev
cd trade_tracker && npm run dev
```

### Build

```bash
# Build all projects (orchestration)
npm run build

# Or build individually from each project directory:
cd frontend && npm run build
cd creator_tracker && npm run build
cd fund_tracker && npm run build
cd trade_tracker && npm run build
```

## Deployment

Each project can be deployed independently:

### Frontend Deployment

```bash
cd frontend
npm run pm2:deploy
# or
./deploy.sh
```

### Creator Tracker Deployment

```bash
cd creator_tracker
npm run pm2:deploy
# or
./deploy.sh
```

### Fund Tracker Deployment

```bash
cd fund_tracker
npm run pm2:deploy
# or
./deploy.sh
```

### Trade Tracker Deployment

```bash
cd trade_tracker
npm run pm2:deploy
# or
./deploy.sh
```

### PM2 Commands (from within each project)

```bash
npm run pm2:start      # Start the app
npm run pm2:stop       # Stop the app
npm run pm2:restart    # Restart the app
npm run pm2:logs       # View logs
npm run pm2:status    # Check status
npm run pm2:monit      # Monitor resources
```

## Authentication

- Authentication is centralized in the **frontend/auth server**
- All tracker servers use the same Redis session store
- Session cookie name: `soltrack.sid`
- All servers share the same session configuration

## Environment Variables

Each project should have its own `.env` file in its directory. They should share:
- `REDIS_HOST` - Redis server host
- `REDIS_PORT` - Redis server port
- `REDIS_PASSWORD` - Redis password (if required)
- `REDIS_SESSION_DB` - Redis database for sessions (default: 1)
- `SESSION_SECRET` - Session secret (must be same across all servers)
- `SESSION_COOKIE_DOMAIN` - Cookie domain (if using subdomains)
- `USE_HTTPS` - Set to 'true' for HTTPS
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL config

## Complete Independence

Each project is completely independent:
- ✅ Own `package.json` and dependencies
- ✅ Own `node_modules/` folder
- ✅ Own `ecosystem.config.cjs` for PM2
- ✅ Own `deploy.sh` script
- ✅ Own build output (`dist/`)
- ✅ Own logs directory
- ✅ Can be deployed separately
- ✅ Can be developed separately
- ✅ No shared code between projects

Only shared:
- Root `package.json` (for orchestration convenience)
- Git repository
