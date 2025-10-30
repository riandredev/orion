import { cn } from "@/lib/utils"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Shuffle, GripVertical, MoreVertical, Edit, Trash} from 'lucide-react'
import { Stop } from '@nine-thirty-five/material-icons-react/rounded';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState, useRef, useEffect } from "react"

interface SortableItemProps {
  id: string
  content: string
  className?: string
  isDragging?: boolean
  isActive?: boolean
  onButtonClick: (item: string) => void
  onRandomClick: (item: string) => void
  onStopClick?: (item: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

export function SortableItem({
  id,
  content,
  isDragging: externalDragging,
  isActive,
  onButtonClick,
  onRandomClick,
  onStopClick,
  onEdit,
  onDelete,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // State to track if we're manually overriding the button state
  const [overrideState, setOverrideState] = useState<boolean | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Determine if the button should show the stop icon
  const showStopIcon = overrideState !== null ? overrideState : isActive;

  // Handle wheel event for toggling between shuffle and stop
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    // Toggle button state based on scroll direction
    // Scroll down = stop button, scroll up = shuffle button
    setOverrideState(e.deltaY > 0);
  };

  // Set up wheel event listener when hovering
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleMouseEnter = () => {
      button.addEventListener('wheel', handleWheel, { passive: false });
    };

    const handleMouseLeave = () => {
      button.removeEventListener('wheel', handleWheel);
      setOverrideState(null); // Reset override when mouse leaves
    };

    button.addEventListener('mouseenter', handleMouseEnter);
    button.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      button.removeEventListener('mouseenter', handleMouseEnter);
      button.removeEventListener('mouseleave', handleMouseLeave);
      button.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    height: isDragging ? 'auto' : undefined,
    width: isDragging ? 'auto' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex",
        isDragging && "ring-2 ring-primary ring-offset-2 rounded-md"
      )}
      {...attributes}
    >
      <Button
        variant="ghost"
        className={cn(
          "flex-1 h-10 sm:h-11 md:h-12 text-base sm:text-lg bg-foreground/5 hover:bg-foreground/10 active:bg-foreground/20 rounded-r-none relative pl-6 sm:pl-7 md:pl-8",
          isDragging && "bg-foreground/10"
        )}
        onClick={() => onButtonClick(content)}
      >
        <div
          className="absolute left-2 cursor-grab text-muted-foreground hover:text-foreground h-full flex items-center touch-manipulation"
          {...listeners}
        >
          <GripVertical className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        
        <span className="flex-1 text-center">{content}</span>
        
        <div
          className="absolute right-2 flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span className="cursor-pointer inline-flex items-center justify-center text-muted-foreground hover:text-foreground p-0 -mr-2">
                <MoreVertical className="h-5 w-5 md:h-6 md:w-6" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(id)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Button>
      <Button
        ref={buttonRef}
        variant="ghost"
        onClick={() => showStopIcon ? onStopClick?.(content) : onRandomClick(content)}
        className={cn(
          "h-10 sm:h-11 md:h-12 w-9 sm:w-10 md:w-11 text-center hover:text-background rounded-l-none",
          showStopIcon
            ? "bg-red-500/25 text-red-500 hover:bg-red-500/50"
            : "bg-muted-foreground/50 text-foreground hover:bg-muted-foreground active:bg-muted-foreground/80",
          isDragging && (showStopIcon ? "bg-red-500/35" : "bg-muted-foreground/60")
        )}
      >
        {showStopIcon ? (
          <Stop className="h-5 w-5" />
        ) : (
          <Shuffle className="h-5 w-5 md:h-6 md:w-6" />
        )}
      </Button>
    </div>
  )
}
