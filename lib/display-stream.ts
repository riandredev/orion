import { emit, listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

export interface DisplayStreamOptions {
  type: string;
  sourceId: string;
  source: string;
}

/**
 * Manages all display streams in the application
 */
export class DisplayStreamManager {
  private activeStreams: Map<string, string> = new Map();
  private windowMap: Map<string, string> = new Map();

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    // Listen for frame updates from the Rust backend
    listen<[number, number, Uint8Array]>('frame-update', (event) => {
      // Forward to all projections and other components that need it
      this.notifyFrameUpdate(event.payload);
    });
  }

  private async notifyFrameUpdate(frameData: [number, number, Uint8Array]) {
    try {
      // Send to the projection window if it exists
      const projectionWindow = await WebviewWindow.getByLabel('projection');
      if (projectionWindow) {
        await projectionWindow.emit('frame-update', frameData);
      }
    } catch (error) {
      console.error('Failed to notify frame update:', error);
    }
  }

  async startStream(options: DisplayStreamOptions): Promise<void> {
    const { type, sourceId, source } = options;
    const streamId = Date.now().toString();

    try {
      // Store the relationship between source and streamId
      this.activeStreams.set(source, streamId);

      // Start the stream via Tauri backend
      await invoke('start_stream');

      // Notify the projection component about the new stream
      const projectionWindow = await WebviewWindow.getByLabel('projection');
      if (projectionWindow) {
        await projectionWindow.emit('stream-update', {
          type,
          content: sourceId,
          source,
          streamId,
          isActive: true
        });
      } else {
        console.warn('Projection window not found, stream update not sent');
      }

      console.log(`Stream started: ${type} from ${source} with ID ${streamId}`);
    } catch (error) {
      console.error('Failed to start stream:', error);
      this.activeStreams.delete(source);
      throw error;
    }
  }

  async stopStream(type: string, source: string): Promise<void> {
    try {
      // Check if we have an active stream for this source
      const streamId = this.activeStreams.get(source);
      if (!streamId) {
        console.log(`No active stream found for source: ${source}`);
        return;
      }

      // Remove from our internal tracking
      this.activeStreams.delete(source);

      // Notify the projection component that the stream is being stopped
      const projectionWindow = await WebviewWindow.getByLabel('projection');
      if (projectionWindow) {
        await projectionWindow.emit('stream-update', {
          type,
          source,
          streamId,
          isActive: false
        });
      } else {
        console.warn('Projection window not found, stream stop not sent');
      }

      // If no more active streams, stop the backend stream
      if (this.activeStreams.size === 0) {
        await invoke('stop_stream');
        console.log('All streams stopped, backend stream stopped');
      } else {
        console.log(`Stream for ${source} stopped, but other streams are still active`);
      }
    } catch (error) {
      console.error('Failed to stop stream:', error);
      throw error;
    }
  }

  async updateWindowMapping(source: string, windowLabel: string): Promise<void> {
    this.windowMap.set(source, windowLabel);
  }

  async getWindowForSource(source: string): Promise<string | undefined> {
    return this.windowMap.get(source);
  }

  hasActiveStream(source: string): boolean {
    return this.activeStreams.has(source);
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }
}

// Create a singleton instance with a safe web-preview fallback
class NoopDisplayStreamManager {
  private activeStreams: Map<string, string> = new Map();
  private windowMap: Map<string, string> = new Map();

  async startStream(_options: DisplayStreamOptions): Promise<void> { /* noop for web preview */ }
  async stopStream(_type: string, _source: string): Promise<void> { /* noop for web preview */ }
  async updateWindowMapping(source: string, windowLabel: string): Promise<void> {
    this.windowMap.set(source, windowLabel);
  }
  async getWindowForSource(source: string): Promise<string | undefined> { return this.windowMap.get(source); }
  hasActiveStream(source: string): boolean { return this.activeStreams.has(source); }
  getActiveStreamCount(): number { return this.activeStreams.size; }
}

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__
export const displayStream = isTauri ? new DisplayStreamManager() : new NoopDisplayStreamManager();
