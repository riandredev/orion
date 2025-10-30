export function parseNaturalDuration(input: string): { hours: number; minutes: number; seconds: number } {
    const hours = input.match(/(\d+)\s*h/)?.[1] || '0';
    const minutes = input.match(/(\d+)\s*m/)?.[1] || '0';
    const seconds = input.match(/(\d+)\s*s/)?.[1] || '0';
  
    return {
      hours: parseInt(hours),
      minutes: parseInt(minutes),
      seconds: parseInt(seconds)
    };
  }
  
  export function formatDuration(hours: number, minutes: number, seconds: number): string {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }
  
  export function addDurationToTime(time: string, duration: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const { hours: durationHours, minutes: durationMinutes } = parseNaturalDuration(duration);
  
    let totalMinutes = hours * 60 + minutes + durationHours * 60 + durationMinutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
  
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  }
  
  