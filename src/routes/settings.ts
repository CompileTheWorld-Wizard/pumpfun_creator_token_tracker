import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db.js';

const router = Router();

// Get all scoring settings presets
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        name,
        settings,
        is_default,
        created_at,
        updated_at
      FROM tbl_soltrack_scoring_settings
      ORDER BY is_default DESC, created_at DESC`
    );
    
    res.json({ 
      presets: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        settings: row.settings,
        isDefault: row.is_default,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error: any) {
    console.error('Error fetching scoring settings:', error);
    res.status(500).json({ 
      error: 'Error fetching scoring settings' 
    });
  }
});

// Get a specific preset by ID
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        id,
        name,
        settings,
        is_default,
        created_at,
        updated_at
      FROM tbl_soltrack_scoring_settings
      WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      settings: row.settings,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    console.error('Error fetching scoring setting:', error);
    res.status(500).json({ 
      error: 'Error fetching scoring setting' 
    });
  }
});

// Get default preset
router.get('/default/get', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        name,
        settings,
        is_default,
        created_at,
        updated_at
      FROM tbl_soltrack_scoring_settings
      WHERE is_default = TRUE
      LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No default preset found' });
      return;
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      settings: row.settings,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    console.error('Error fetching default scoring setting:', error);
    res.status(500).json({ 
      error: 'Error fetching default scoring setting' 
    });
  }
});

// Create a new preset
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, settings, isDefault } = req.body;
    
    if (!name || !settings) {
      res.status(400).json({ error: 'Name and settings are required' });
      return;
    }
    
    // Validate settings structure
    if (typeof settings !== 'object') {
      res.status(400).json({ error: 'Settings must be an object' });
      return;
    }
    
    // If setting as default, unset other defaults
    if (isDefault) {
      await pool.query(
        'UPDATE tbl_soltrack_scoring_settings SET is_default = FALSE WHERE is_default = TRUE'
      );
    }
    
    const result = await pool.query(
      `INSERT INTO tbl_soltrack_scoring_settings (name, settings, is_default)
       VALUES ($1, $2, $3)
       RETURNING id, name, settings, is_default, created_at, updated_at`,
      [name, JSON.stringify(settings), isDefault || false]
    );
    
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      settings: row.settings,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'A preset with this name already exists' });
      return;
    }
    console.error('Error creating scoring setting:', error);
    res.status(500).json({ 
      error: 'Error creating scoring setting' 
    });
  }
});

// Update a preset
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, settings, isDefault } = req.body;
    
    // Check if preset exists
    const checkResult = await pool.query(
      'SELECT id FROM tbl_soltrack_scoring_settings WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }
    
    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (settings !== undefined) {
      if (typeof settings !== 'object') {
        res.status(400).json({ error: 'Settings must be an object' });
        return;
      }
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(settings));
    }
    
    if (isDefault !== undefined) {
      // If setting as default, unset other defaults
      if (isDefault) {
        await pool.query(
          'UPDATE tbl_soltrack_scoring_settings SET is_default = FALSE WHERE is_default = TRUE AND id != $1',
          [id]
        );
      }
      updates.push(`is_default = $${paramIndex++}`);
      values.push(isDefault);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await pool.query(
      `UPDATE tbl_soltrack_scoring_settings 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, settings, is_default, created_at, updated_at`,
      values
    );
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      settings: row.settings,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'A preset with this name already exists' });
      return;
    }
    console.error('Error updating scoring setting:', error);
    res.status(500).json({ 
      error: 'Error updating scoring setting' 
    });
  }
});

// Delete a preset
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM tbl_soltrack_scoring_settings WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting scoring setting:', error);
    res.status(500).json({ 
      error: 'Error deleting scoring setting' 
    });
  }
});

// Set default preset
router.post('/:id/set-default', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Check if preset exists
    const checkResult = await pool.query(
      'SELECT id FROM tbl_soltrack_scoring_settings WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }
    
    // Unset other defaults
    await pool.query(
      'UPDATE tbl_soltrack_scoring_settings SET is_default = FALSE WHERE is_default = TRUE'
    );
    
    // Set this as default
    const result = await pool.query(
      `UPDATE tbl_soltrack_scoring_settings 
       SET is_default = TRUE, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, settings, is_default, created_at, updated_at`,
      [id]
    );
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      settings: row.settings,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    console.error('Error setting default scoring setting:', error);
    res.status(500).json({ 
      error: 'Error setting default scoring setting' 
    });
  }
});

export default router;

