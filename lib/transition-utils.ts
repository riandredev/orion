import { convertFileSrc } from '@tauri-apps/api/core';

export const TRANSITION_DURATION = 0; // Set to 0 for immediate transitions

// Remove transition effects
export const TRANSITION_CLASS = ""; // No transition effects

export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
};

export const prepareImageUrl = (path: string): string => {
  return convertFileSrc(decodeURIComponent(path));
};
