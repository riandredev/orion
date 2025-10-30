'use client'

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check } from 'lucide-react'

interface DisplayGridProps {
  displays: Array<{
    id: string;
    name: string;
  }>;
  selectedDisplays: string[];
  onDisplayClick: (id: string, index: number, multiSelect: boolean) => void;
}

export function DisplayGrid({ displays, selectedDisplays, onDisplayClick }: DisplayGridProps) {
  const gridClass = cn(
    "grid gap-4",  // Removed mb-6 since we're adding the Alert above
    displays.length === 4 ? 'grid-cols-5' : 'grid-cols-4'
  )

  return (
    <div className={gridClass}>
      {displays.map((display, index) => (
        <div
          key={display.id}
          className={cn(
            "relative aspect-video rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center cursor-pointer transition-all duration-300",
            selectedDisplays.includes(display.id) && "ring-2 ring-white",
            "hover:bg-gradient-to-br hover:from-blue-500 hover:to-blue-800"
          )}
          onClick={(e) => {
            e.preventDefault(); // Prevent any default selection behavior
            onDisplayClick(display.id, index, e.ctrlKey || e.metaKey);
          }}
        >
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 bg-background/50 text-foreground border-0"
          >
            {display.id}
          </Badge>
          <span className="text-4xl font-bold text-white">{index + 1}</span>
          {selectedDisplays.includes(display.id) && (
            <div className="absolute bottom-2 right-2 bg-white rounded-full p-1">
              <Check className="w-4 h-4 text-blue-600" />
            </div>
          )}
        </div>
      ))}
      {[...Array(Math.max(0, 4 - displays.length))].map((_, index) => (
        <div
          key={`placeholder-${index}`}
          className="aspect-video rounded-lg bg-muted-foreground/25 flex items-center justify-center"
        >
          <span className="text-4xl font-bold text-muted-foreground/50">N/A</span>
        </div>
      ))}
    </div>
  )
}
