import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppSidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

function useThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored) {
      document.documentElement.classList.add(stored)
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.add('light')
    }
  }, [])
}

export function CostShell({ children }) {
  useThemeInit()
  const navigate = useNavigate()

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden w-full">
        <AppSidebar onNewChat={() => navigate(`/chat/new-${Date.now()}`)} />
        <SidebarInset className="flex-1 flex flex-col">
          <Header />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
