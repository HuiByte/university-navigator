import type { Metadata } from "next"
import "./globals.css"
import { SidebarProvider, AppSidebar, MobileTopBar } from "@/components/layout/app-sidebar"
import { SessionProvider } from "@/components/SessionProvider"
import { Toaster } from "@/components/ui/sonner"

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
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}
