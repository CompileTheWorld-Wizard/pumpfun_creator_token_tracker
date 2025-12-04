import { startStreaming, stopStreaming, getStreamingStatus } from '../streams/pumpfun.js';

/**
 * Start the pump.fun transaction stream
 */
export async function startStream(): Promise<void> {
  if (getStreamingStatus()) {
    throw new Error('Stream is already running');
  }

  await startStreaming();
}

/**
 * Stop the pump.fun transaction stream
 */
export async function stopStream(): Promise<void> {
  if (!getStreamingStatus()) {
    throw new Error('Stream is not running');
  }

  stopStreaming();
}

/**
 * Get the current streaming status
 */
export function getStatus(): boolean {
  return getStreamingStatus();
}

