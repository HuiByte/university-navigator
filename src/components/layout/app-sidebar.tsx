"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AuthButtons } from "@/components/AuthButtons"
import {
  Map,
  GitBranch,
  CheckSquare,
  BarChart3,
  PanelLeftClose,
  PanelLeft,
  GraduationCap,
  Menu,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

// Sidebar Context
type SidebarContextType = {
  isCollapsed: boolean
  toggle: () => void
  isMobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggle: () => {},
  isMobileOpen: false,
  setMobileOpen: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

// 导航项配置
const navItems = [
  {
    title: "规划页",
    href: "/plan",
    icon: Map,
  },
  {
    title: "路线图",
    href: "/roadmap",
    icon: GitBranch,
  },
  {
    title: "任务页",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    title: "进度页",
    href: "/progress",
    icon: BarChart3,
  },
]

// Sidebar Provider
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setMobileOpen] = useState(false)
  const toggle = useCallback(() => setIsCollapsed((prev) => !prev), [])

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle, isMobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

// 移动端顶部导航栏
export function MobileTopBar() {
  const { isMobileOpen, setMobileOpen } = useSidebar()

  return (
    <div className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-4 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMobileOpen(true)}
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-3 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-primary" />
        <span className="text-base font-semibold">大学导航员</span>
      </div>
    </div>
  )
}

// Sidebar 主组件
export function AppSidebar() {
  const { isCollapsed, toggle, isMobileOpen, setMobileOpen } = useSidebar()
  const pathname = usePathname()

  // 路由变化时关闭移动端侧边栏
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  // 导航内容（桌面端和移动端共用）
  const navContent = (
    <>
      {/* Logo 区域 */}
      <div className="flex h-14 items-center border-b px-4">
        <GraduationCap className="h-6 w-6 shrink-0 text-sidebar-primary" />
        {(!isCollapsed || isMobileOpen) && (
          <span className="ml-2 text-lg font-semibold whitespace-nowrap">
            大学导航员
          </span>
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link key={item.href} href={item.href}>
              <span
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70",
                  isCollapsed && !isMobileOpen && "justify-center px-2"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span>{item.title}</span>}
              </span>
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* 用户认证区域 */}
      <div className="p-2">
        <AuthButtons />
      </div>

      {/* 折叠按钮（仅桌面端显示） */}
      <div className="hidden p-2 md:block">
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={toggle}
        >
          {isCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* 桌面端侧边栏 */}
      <aside
        className={cn(
          "relative hidden h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 md:flex",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {navContent}
      </aside>

      {/* 移动端遮罩层 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 移动端侧边栏（滑入抽屉） */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* 关闭按钮 */}
        <div className="absolute right-2 top-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {navContent}
      </aside>
    </>
  )
}
