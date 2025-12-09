import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db.js';

const router = Router();

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    // Get password hash from database
    const result = await pool.query(
      'SELECT password_hash FROM passwords ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ 
        error: 'Password not configured. Please contact administrator.' 
      });
    }

    const passwordHash = result.rows[0].password_hash;

    // Compare password with hash
    const isValid = await bcrypt.compare(password, passwordHash);

    if (isValid) {
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
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check authentication status
router.get('/check', (req: Request, res: Response) => {
  const isAuthenticated = (req.session as any)?.authenticated === true;
  res.json({ authenticated: isAuthenticated });
});

// Change password endpoint (requires authentication)
router.post('/change-password', async (req: Request, res: Response) => {
  // Check authentication
  const isAuthenticated = (req.session as any)?.authenticated === true;
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      error: 'Current password and new password are required' 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      error: 'New password must be at least 6 characters long' 
    });
  }

  try {
    // Get current password hash
    const result = await pool.query(
      'SELECT password_hash FROM passwords ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ 
        error: 'Password not configured' 
      });
    }

    const currentPasswordHash = result.rows[0].password_hash;

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, currentPasswordHash);

    if (!isValid) {
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await pool.query(
      'INSERT INTO passwords (password_hash) VALUES ($1)',
      [newPasswordHash]
    );

    return res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Clear database endpoint (requires authentication and password verification)
router.post('/clear-database', async (req: Request, res: Response) => {
  // Check authentication
  const isAuthenticated = (req.session as any)?.authenticated === true;
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ 
      error: 'Password is required' 
    });
  }

  try {
    // Get current password hash
    const result = await pool.query(
      'SELECT password_hash FROM passwords ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ 
        error: 'Password not configured' 
      });
    }

    const passwordHash = result.rows[0].password_hash;

    // Verify password
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!isValid) {
      return res.status(401).json({ 
        error: 'Invalid password' 
      });
    }

    // Clear all data from database (except passwords table)
    await pool.query('TRUNCATE TABLE created_tokens CASCADE');
    await pool.query('TRUNCATE TABLE blacklist_creator CASCADE');

    console.log('[ClearDatabase] Database cleared successfully');

    return res.json({ 
      success: true, 
      message: 'Database cleared successfully' 
    });
  } catch (error: any) {
    console.error('Clear database error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

export default router;

