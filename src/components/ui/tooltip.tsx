import * as React from "react"
import { cn } from "@/lib/utils"

const TooltipProvider = React.forwardRef<
  React.ElementRef<typeof React.Fragment>,
  React.ComponentPropsWithoutRef<typeof React.Fragment>
>(({ ...props }, ref) => <React.Fragment ref={ref} {...props} />)
TooltipProvider.displayName = "TooltipProvider"

// 简化的 Tooltip 组件，后续可用 shadcn/ui 替换
const Tooltip = ({ children }: { children: React.ReactNode }) => <>{children}</>

const TooltipTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
