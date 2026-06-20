/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-17 22:47:55
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 10:29:53
 * @FilePath: \AI创作力大赛\university-navigator\src\app\layout.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import type { Metadata } from "next"
import "./globals.css"
import { SidebarProvider, AppSidebar, MobileTopBar } from "@/components/layout/app-sidebar"
import { SessionProvider } from "@/components/SessionProvider"

export const metadata: Metadata = {
  title: "大学导航员 - University Navigator",
  description: "智能大学规划与导航助手",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <SessionProvider>
          <SidebarProvider>
            <div className="flex h-screen overflow-hidden">
              <AppSidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <MobileTopBar />
                <main className="flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-6xl p-4 md:p-6">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
