import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { open } from '@tauri-apps/plugin-dialog';

export default function TauriImports() {
  return null; // This component doesn't render anything
}

// Export the Tauri functions
export const tauriImports = {
  invoke,
  convertFileSrc,
  WebviewWindow,
  open,
}; 