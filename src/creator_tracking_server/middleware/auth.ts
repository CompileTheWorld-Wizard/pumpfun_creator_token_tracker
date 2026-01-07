import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  
  if (!isAuthenticated) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  next();
};

