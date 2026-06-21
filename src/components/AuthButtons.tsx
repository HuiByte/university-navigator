"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

/** GitHub 图标（lucide-react v1 已移除品牌图标，使用内联 SVG） */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

/**
 * 认证按钮组件
 * 根据登录状态显示不同按钮：
 * - 未登录：显示 GitHub 登录按钮
 * - 已登录：显示用户信息和退出登录按钮
 */
export function AuthButtons() {
  const { data: session, status } = useSession()

  // 加载中状态
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    )
  }

  // 已登录：显示用户信息和退出按钮
  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? "用户头像"}
              className="h-8 w-8 shrink-0 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {session.user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {session.user.name ?? "用户"}
            </p>
            {session.user.email && (
              <p className="truncate text-xs text-muted-foreground">
                {session.user.email}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors",
            "hover:bg-destructive/10 hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="退出登录"
          title="退出登录"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // 未登录：显示 GitHub 登录按钮
  return (
    <button
      onClick={() => signIn("github", { callbackUrl: "/" })}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5",
        "bg-[#24292f] text-sm font-medium text-white",
        "transition-colors hover:bg-[#24292f]/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50"
      )}
    >
      <GithubIcon className="h-5 w-5" />
      使用 GitHub 登录
    </button>
  )
}
