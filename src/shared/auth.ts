import { Request, Response, NextFunction } from 'express';

/**
 * Shared authentication middleware
 * Checks if user is authenticated via session
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  
  if (!isAuthenticated) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  next();
};

/**
 * Check if user is authenticated (helper function)
 */
export const isAuthenticated = (req: Request): boolean => {
  return (req.session as any)?.authenticated === true;
};

/**
 * Get shared session configuration for all servers
 */
export const getSessionConfig = () => {
  const SESSION_SECRET = process.env.SESSION_SECRET || 'soltrack-shared-secret-change-in-production';
  
  return {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production' && process.env.USE_HTTPS === 'true',
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/', // Available for all paths
    },
    name: 'soltrack.sid', // Unified session cookie name for all servers
  };
};
