/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-17 22:47:20
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-17 22:47:21
 * @FilePath: \AI创作力大赛\university-navigator\src\components\ui\tooltip.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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
