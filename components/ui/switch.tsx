"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  shape?: "round" | "rect"
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, shape = "round", ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Base sizing and layout
      shape === "rect" ? "h-6 w-11" : "h-6 w-12",
      "peer relative inline-flex shrink-0 cursor-pointer items-center border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      // Shape
      shape === "rect" ? "rounded-md" : "rounded-full",
      // Colors
      "data-[state=checked]:bg-[var(--accent-color)] data-[state=unchecked]:bg-muted-foreground/20",
      className
    )}
    {...props}
    ref={ref}
  >
    {/* Track labels: show on opposite side of thumb */}
    <span
      className={cn(
        "absolute left-2.5 select-none text-[10px] font-semibold pointer-events-none",
        // Visible only when checked
        "data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-0",
        // Color tuned for checked (primary) background
        "text-white"
      )}
    >
      |
    </span>
    <span
      className={cn(
        "absolute right-1.5 select-none text-[12px] pointer-events-none",
        // Visible only when unchecked
        "data-[state=checked]:opacity-0 data-[state=unchecked]:opacity-100",
        // Color tuned for off (input) background
        "text-foreground/70"
      )}
    >
      O
    </span>

    <SwitchPrimitives.Thumb
      className={cn(
        // Size and transition
        "pointer-events-none block h-5 w-5 bg-background shadow-lg ring-0 transition-transform",
        // Positioning varies by shape due to width
        shape === "rect"
          ? "data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0"
          : "data-[state=checked]:translate-x-7 data-[state=unchecked]:translate-x-0",
        // Shape
        shape === "rect" ? "rounded-sm" : "rounded-full"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
