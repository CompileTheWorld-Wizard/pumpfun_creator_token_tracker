import { Request, Response, NextFunction } from 'express';

/**
 * Shared authentication middleware
 * Checks if user is authenticated via session (from auth server)
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
 * Get shared session configuration (must match auth server)
 */
export const getSessionConfig = () => {
  const SESSION_SECRET = process.env.SESSION_SECRET || 'soltrack-shared-secret-change-in-production';
  const useHttps = process.env.USE_HTTPS === 'true';
  let cookieDomain = process.env.SESSION_COOKIE_DOMAIN;
  const sameSiteValue: 'none' | 'lax' | 'strict' = 'lax';
  const secureCookie = useHttps;
  
  return {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: secureCookie,
      httpOnly: true,
      sameSite: sameSiteValue,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
    name: 'soltrack.sid', // Must match auth server
  };
};
