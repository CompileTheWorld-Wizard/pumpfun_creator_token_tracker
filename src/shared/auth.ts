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
  const useHttps = process.env.USE_HTTPS === 'true';
  
  // Cookie domain configuration
  // When behind nginx reverse proxy, we need to set the domain correctly
  // Leading dot (e.g., '.dillwifit.com') allows subdomains
  // Without dot (e.g., 'dillwifit.com') is more restrictive
  let cookieDomain = process.env.SESSION_COOKIE_DOMAIN;
  
  // If domain is set with leading dot, use it as-is
  // If domain is set without leading dot, use it as-is (browsers handle both)
  // If not set, don't set domain (cookie will be set for exact hostname)
  
  // Determine sameSite value
  // For HTTPS with reverse proxy, use 'lax' (same-site) instead of 'none'
  // 'none' is only needed for true cross-origin (different domains)
  // Since nginx and backend are same origin from browser's perspective, 'lax' works
  const sameSiteValue: 'none' | 'lax' | 'strict' = useHttps ? 'lax' : 'lax';
  
  return {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: useHttps, // true for HTTPS, false for HTTP
      httpOnly: true, // Prevents JavaScript access
      sameSite: sameSiteValue, // 'lax' works for same-site requests through reverse proxy
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/', // Available for all paths
      ...(cookieDomain ? { domain: cookieDomain } : {}), // Set domain if configured
    },
    name: 'soltrack.sid', // Unified session cookie name for all servers
  };
};
