"use client"

import * as React from "react"
import * as Portal from "@radix-ui/react-portal"

const ScaledPortal = React.forwardRef<
  React.ElementRef<typeof Portal.Root>,
  React.ComponentPropsWithoutRef<typeof Portal.Root>
>(({ children, ...props }, ref) => {
  const [mainContentRect, setMainContentRect] = React.useState<DOMRect | null>(null)
  const hasChildren = React.Children.count(children) > 0

  React.useEffect(() => {
    const mainContent = document.querySelector('.main-content')
    if (!mainContent) return

    const updateRect = () => {
      setMainContentRect(mainContent.getBoundingClientRect())
    }

    const observer = new ResizeObserver(updateRect)
    observer.observe(mainContent)
    updateRect()

    return () => observer.disconnect()
  }, [])

  if (!mainContentRect || !hasChildren) return null

  return (
    <Portal.Root {...props} ref={ref}>
      <div 
        style={{ 
          position: 'fixed',
          top: mainContentRect.top,
          left: mainContentRect.left,
          width: mainContentRect.width,
          height: mainContentRect.height,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      >
        {children}
      </div>
    </Portal.Root>
  )
})
ScaledPortal.displayName = "ScaledPortal"

export { ScaledPortal }