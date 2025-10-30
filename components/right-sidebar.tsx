"use client"

import { useEffect, useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { Slideshow } from "@nine-thirty-five/material-icons-react/rounded"

// Sample slide data - in a real implementation, this would come from your store
const sampleSlides = [
  { id: 1, type: "Image", title: "Welcome Slide", thumbnail: "📷" },
  { id: 2, type: "Hymn", title: "Amazing Grace", thumbnail: "🎵" },
  { id: 3, type: "Bible", title: "John 3:16", thumbnail: "📖" },
  { id: 4, type: "Video", title: "Announcement Video", thumbnail: "🎬" },
  { id: 5, type: "Image", title: "Closing Slide", thumbnail: "📷" },
]

export default function RightSidebar() {
  const [isOpen, setIsOpen] = useState(false)

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when using modifiers
      if (e.ctrlKey || e.altKey || e.metaKey) return

      // Ignore when typing in inputs/textareas or contentEditable
      const ae = document.activeElement as HTMLElement | null
      const isTyping = !!ae && (
        ae.tagName === "INPUT" ||
        ae.tagName === "TEXTAREA" ||
        ae.isContentEditable === true
      )
      if (isTyping) return

      if (e.key.toLowerCase() === "o") {
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <SidebarProvider
      defaultOpen={false}
      cookieName="rightSidebar:state"
      className="pointer-events-none"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      {/* Right overlay sidebar */}
      <Sidebar side="right" collapsible="offcanvas" className="border-l border-border/40 bg-sidebar-background w-80">
        <SidebarHeader className="border-b border-border/40">
          {/* Small label styled like main sidebar */}
          <div className="px-1 pt-2">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Slide Playlist
            </h4>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarGroup>
            <div className="space-y-2">
              {sampleSlides.map((slide) => (
                <div
                  key={slide.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer border border-border/40"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-background/80 flex items-center justify-center rounded-sm border border-border/40">
                    <span className="text-lg">{slide.thumbnail}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{slide.title}</div>
                    <div className="text-xs text-muted-foreground">{slide.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-border/40 p-2">
          <div className="text-xs text-center text-muted-foreground">
            Drag and drop reordering coming soon
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  )
}