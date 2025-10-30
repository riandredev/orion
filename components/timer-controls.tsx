import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Button } from "@/components/ui/button"
import { Timer } from "@nine-thirty-five/material-icons-react/rounded"

export function TimerControls() {
  const handleStop = async () => {
    try {
      // Stop any active streams first
      await invoke('stop_stream');

      // Emit stop event before closing windows to ensure clean cleanup
      window.dispatchEvent(new CustomEvent('stopTimer', {
        detail: { source: 'main-stop' }
      }));

      // Close all windows
      const windowLabels = [
        ...await invoke<string[]>('get_hymn_windows'),
        ...await invoke<string[]>('get_image_windows'),
        ...await invoke<string[]>('get_bible_windows')
      ];

      await Promise.all(windowLabels.map(async (label) => {
        const window = await WebviewWindow.getByLabel(label);
        if (window) await window.close();
      }));

      // Clear current states
      await invoke('clear_current_image');
    } catch (error) {
      console.error('Error during stop:', error);
    }
  };

  return (
    <Button
      variant="destructive"
      onClick={handleStop}
      className="gap-2"
    >
      <Timer className="h-5 w-5" />
      Stop All
    </Button>
  );
}
