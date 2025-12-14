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
    
    // Check if preset exists and if it's the default
    const checkResult = await pool.query(
      'SELECT id, is_default FROM tbl_soltrack_scoring_settings WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }
    
    // Prevent deletion of default preset
    if (checkResult.rows[0].is_default) {
      res.status(400).json({ error: 'Cannot delete the default preset. Please set another preset as default first.' });
      return;
    }
    
    const result = await pool.query(
      'DELETE FROM tbl_soltrack_scoring_settings WHERE id = $1 RETURNING id',
      [id]
    );
    
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

// Get currently applied settings
router.get('/applied/get', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT 
        preset_id,
        settings,
        applied_at,
        updated_at
      FROM tbl_soltrack_applied_settings
      ORDER BY applied_at DESC
      LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      // If no applied settings, return default preset
      const defaultResult = await pool.query(
        `SELECT 
          id,
          settings
        FROM tbl_soltrack_scoring_settings
        WHERE is_default = TRUE
        LIMIT 1`
      );
      
      if (defaultResult.rows.length === 0) {
        res.status(404).json({ error: 'No default preset found' });
        return;
      }
      
      const defaultRow = defaultResult.rows[0];
      res.json({
        presetId: defaultRow.id,
        settings: defaultRow.settings,
        appliedAt: null,
        updatedAt: null
      });
      return;
    }
    
    const row = result.rows[0];
    res.json({
      presetId: row.preset_id,
      settings: row.settings,
      appliedAt: row.applied_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    console.error('Error fetching applied settings:', error);
    res.status(500).json({ 
      error: 'Error fetching applied settings' 
    });
  }
});

// Apply settings (validate and save)
router.post('/applied/apply', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { settings, presetId } = req.body;
    
    if (!settings) {
      res.status(400).json({ error: 'Settings are required' });
      return;
    }
    
    // Validate settings
    const validationErrors: string[] = [];
    
    // Validate tracking time
    if (typeof settings.trackingTimeSeconds !== 'number' || 
        settings.trackingTimeSeconds < 15 || 
        settings.trackingTimeSeconds > 120) {
      validationErrors.push('Tracking time must be between 15 and 120 seconds');
    }
    
    // Validate ranges (check for overlaps, valid min/max, etc.)
    const validateRanges = (ranges: any[], name: string) => {
      if (!Array.isArray(ranges)) {
        validationErrors.push(`${name} must be an array`);
        return;
      }
      
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        if (typeof range.min !== 'number' || typeof range.max !== 'number' || typeof range.score !== 'number') {
          validationErrors.push(`${name} range ${i + 1} must have valid min, max, and score`);
        }
        if (range.min < 0 || range.max > 100 || range.min >= range.max) {
          validationErrors.push(`${name} range ${i + 1} has invalid min/max values`);
        }
      }
    };
    
    validateRanges(settings.winRate || [], 'Win Rate');
    validateRanges(settings.avgAthMcap || [], 'Avg ATH MCap');
    validateRanges(settings.medianAthMcap || [], 'Median ATH MCap');
    validateRanges(settings.avgRugRate || [], 'Avg Rug Rate');
    
    // Validate time bucket ranges
    if (Array.isArray(settings.avgRugRateByTimeBucket)) {
      for (let i = 0; i < settings.avgRugRateByTimeBucket.length; i++) {
        const range = settings.avgRugRateByTimeBucket[i];
        if (typeof range.min !== 'number' || typeof range.max !== 'number' || typeof range.score !== 'number') {
          validationErrors.push(`Avg Rug Rate by Time Bucket range ${i + 1} must have valid min, max, and score`);
        }
        if (range.min < 0 || range.min >= range.max) {
          validationErrors.push(`Avg Rug Rate by Time Bucket range ${i + 1} has invalid min/max values`);
        }
      }
    }
    
    // Validate multiplier configs
    if (Array.isArray(settings.multiplierConfigs)) {
      for (let i = 0; i < settings.multiplierConfigs.length; i++) {
        const config = settings.multiplierConfigs[i];
        if (typeof config.multiplier !== 'number' || config.multiplier <= 0) {
          validationErrors.push(`Multiplier config ${i + 1} must have a valid multiplier`);
        }
        validateRanges(config.ranges || [], `Multiplier ${config.multiplier}x`);
      }
    }
    
    if (validationErrors.length > 0) {
      res.status(400).json({ 
        error: 'Validation failed',
        errors: validationErrors
      });
      return;
    }
    
    // Upsert applied settings (delete all and insert new, or update if exists)
    await pool.query('DELETE FROM tbl_soltrack_applied_settings');
    
    // Insert new applied settings
    const result = await pool.query(
      `INSERT INTO tbl_soltrack_applied_settings (id, preset_id, settings, applied_at, updated_at)
       VALUES (1, $1, $2, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE 
       SET preset_id = EXCLUDED.preset_id,
           settings = EXCLUDED.settings,
           updated_at = NOW()
       RETURNING preset_id, settings, applied_at, updated_at`,
      [presetId || null, JSON.stringify(settings)]
    );
    
    const row = result.rows[0];
    res.json({
      presetId: row.preset_id,
      settings: row.settings,
      appliedAt: row.applied_at,
      updatedAt: row.updated_at
    });
  } catch (error: any) {
    console.error('Error applying settings:', error);
    res.status(500).json({ 
      error: 'Error applying settings' 
    });
  }
});

export default router;

