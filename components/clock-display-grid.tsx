'use client'

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check, Clock } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

interface DisplayGridProps {
  displays: Array<{
    id: string;
    name: string;
  }>;
  selectedDisplays: string[];
  onDisplayClick: (id: string, index: number, multiSelect: boolean) => void;  // Updated signature
}

export function ClockDisplayGrid({ displays, selectedDisplays, onDisplayClick }: DisplayGridProps) {
  const gridClass = cn(
    "grid gap-4 mb-6",
    displays.length === 4 ? 'grid-cols-5' : 'grid-cols-4'
  )

  return (
    <div className={gridClass}>
      {displays.map((display, index) => (
        <div
          key={display.id}
          className={cn(
            "relative aspect-video rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center cursor-pointer transition-all duration-300",
            selectedDisplays.includes(display.id) && "ring-4 ring-foreground",
            "hover:bg-gradient-to-br hover:from-blue-500 hover:to-blue-800"
          )}
          onClick={(e) => {
            e.preventDefault();
            onDisplayClick(display.id, index, e.ctrlKey || e.metaKey);
            // Remove the invoke call since we're handling display selection in the parent component
          }}
        >
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 bg-background/50 text-foreground border-0"
          >
            {display.id}
          </Badge>
          {selectedDisplays.includes(display.id) ? (
            <Clock className="w-16 h-16 text-white" />
          ) : (
            <span className="text-6xl font-bold text-white">{index + 1}</span>
          )}
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
