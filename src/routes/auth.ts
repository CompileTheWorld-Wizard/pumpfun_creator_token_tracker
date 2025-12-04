import { Router, Request, Response } from 'express';

const router = Router();

// Hardcoded password
const ADMIN_PASSWORD = 'admin123';

// Login endpoint
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password === ADMIN_PASSWORD) {
    // Set session
    (req.session as any).authenticated = true;
    (req.session as any).userId = 'admin';
    
    return res.json({ 
      success: true, 
      message: 'Login successful' 
    });
  } else {
    return res.status(401).json({ 
      error: 'Invalid password' 
    });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check authentication status
router.get('/check', (req: Request, res: Response) => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  res.json({ authenticated: isAuthenticated });
});

export default router;

