import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { startStream, stopStream, getStatus } from '../services/stream';

const router = Router();

// Start streaming endpoint
router.post('/start', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    if (getStatus()) {
      res.status(400).json({ 
        success: false, 
        error: 'Stream is already running' 
      });
      return;
    }

    await startStream();
    res.json({ 
      success: true, 
      message: 'Stream started successfully',
      status: getStatus()
    });
  } catch (error: any) {
    console.error('Error starting stream:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to start stream' 
    });
  }
});

// Stop streaming endpoint
router.post('/stop', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!getStatus()) {
      res.status(400).json({ 
        success: false, 
        error: 'Stream is not running' 
      });
      return;
    }

    await stopStream();
    res.json({ 
      success: true, 
      message: 'Stream stopped successfully',
      status: getStatus()
    });
  } catch (error: any) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to stop stream' 
    });
  }
});

// Get streaming status endpoint
router.get('/status', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ 
      success: true, 
      status: getStatus() 
    });
  } catch (error: any) {
    console.error('Error getting stream status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get stream status' 
    });
  }
});

export default router;

