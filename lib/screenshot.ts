import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { Window } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// Standardized screenshot capture function for different display types
export async function captureScreenshot(
  type: 'hymn' | 'bible' | 'image',
  minInterval: number = 250,
  maxRetries: number = 3,
  isFirstInBurst: boolean = true
) {
  // Prevent multiple captures at once
  if (captureScreenshot.isCapturing) return null;

  // Throttle capture frequency (only if not part of a burst)
  const now = Date.now();
  if (isFirstInBurst === false && now - captureScreenshot.lastCaptureTime < minInterval) return null;

  captureScreenshot.isCapturing = true;
  captureScreenshot.lastCaptureTime = now;

  try {
    // Get current window and capture
    const currentWindow = await Window.getCurrent();
    const screenshot = await invoke<string>('capture_window_content', {
      window: currentWindow
    });

    // Validate screenshot data
    if (!screenshot || screenshot.length < 100) {
      throw new Error('Invalid screenshot data');
    }

    // Send to main window for preview
    const mainWindow = await WebviewWindow.getByLabel('main');
    if (mainWindow) {
      await mainWindow.emit('window-preview-update', {
        content: screenshot,
        displayId: currentWindow.label,
        type: type,
        fill: true
      });
    }

    // Reset retry count on success
    captureScreenshot.retryCount = 0;
    return screenshot;
  } catch (error) {
    console.error('Screenshot failed:', error);

    // Implement retry mechanism
    if (captureScreenshot.retryCount < maxRetries) {
      captureScreenshot.retryCount++;
      // Try again after a delay
      setTimeout(() => captureScreenshot(type, minInterval, maxRetries), 500);
    }
    return null;
  } finally {
    captureScreenshot.isCapturing = false;
  }
}

// Static properties
captureScreenshot.isCapturing = false;
captureScreenshot.lastCaptureTime = 0;
captureScreenshot.retryCount = 0;

// Function to capture multiple screenshots in a burst sequence
async function captureBurst(type: 'hymn' | 'bible' | 'image', frames: number = 5, interval: number = 150) {
  // Capture first frame immediately
  await captureScreenshot(type, 0, 3, true);
  
  // Schedule subsequent frames with short intervals
  for (let i = 1; i < frames; i++) {
    setTimeout(() => {
      captureScreenshot(type, 0, 3, false);
    }, i * interval);
  }
}

// Function to trigger screenshots based on element changes
export function setupScreenshotObserver(
  element: HTMLElement,
  type: 'hymn' | 'bible' | 'image'
) {
  if (!element) return { cleanup: () => {} };

  // Last change timestamp to detect significant changes
  let lastChangeTime = 0;
  const CHANGE_THRESHOLD = 500; // ms

  // Use MutationObserver to detect DOM changes
  const observer = new MutationObserver(() => {
    const now = Date.now();
    const timeSinceLastChange = now - lastChangeTime;
    lastChangeTime = now;
    
    // If it's been a while since the last change, this is likely a significant change
    // (like a verse change, not just a minor update), so capture a burst of frames
    if (timeSinceLastChange > CHANGE_THRESHOLD) {
      // Capture a burst of frames for transitions
      captureBurst(type, 5, 150);
    } else {
      // For minor updates, just capture one frame
      requestAnimationFrame(() => captureScreenshot(type));
    }
  });

  // Watch for changes in the element
  observer.observe(element, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  // Initial capture - delay slightly to ensure content is fully rendered
  setTimeout(() => captureBurst(type, 3, 250), 800);

  return {
    cleanup: () => observer.disconnect()
  };
}

// Legacy function for backward compatibility
export function setupScreenshotListener(element: HTMLElement) {
  return listen('capture-screenshot', async () => {
    await emit('screenshot-result', '');
  });
}
