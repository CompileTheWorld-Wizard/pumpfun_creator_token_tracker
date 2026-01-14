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
  
  // Extract domain from hostname (remove port if present)
  // For IP addresses or hostnames, we want to share cookies across ports
  // Note: Browsers don't share cookies across different ports by default
  // We'll use sameSite: 'none' with secure for cross-origin, or rely on manual cookie forwarding
  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN; // Can be set to share cookies
  
  // Determine sameSite value - use 'none' for HTTPS cross-origin, 'lax' for HTTP
  const sameSiteValue: 'none' | 'lax' = useHttps ? 'none' : 'lax';
  
  return {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: useHttps, // true only if using HTTPS
      httpOnly: true,
      // For cross-port requests: 
      // - With HTTPS: use 'none' to allow cross-origin cookie sharing
      // - Without HTTPS: use 'lax' (browsers won't share cookies across ports on HTTP)
      // Note: For HTTP cross-port, frontend will need to manually forward cookies
      sameSite: sameSiteValue,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/', // Available for all paths
      ...(cookieDomain ? { domain: cookieDomain } : {}), // Only set if explicitly configured
    },
    name: 'soltrack.sid', // Unified session cookie name for all servers
  };
};
