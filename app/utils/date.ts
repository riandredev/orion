export function formatDate(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[date.getDay()];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dateNum = String(date.getDate()).padStart(2, '0');
    
    return `${day} ${year}/${month}/${dateNum}`;
  }
  
  