import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { AppSidebar } from './components/sidebar'
import { Header } from './components/header'
import { ChatArea } from './components/chat-area'
import { ServerHealth } from './components/server-health'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

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

const ChatLayout = () => {
  const navigate = useNavigate()
  const { chatId } = useParams()

  const createNewChat = () => {
    navigate(`/chat/new-${Date.now()}`);
  }

  useEffect(() => {
    if (!chatId) {
      createNewChat()
    }
  }, [chatId])

  useThemeInit()

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden w-full">
        <AppSidebar onNewChat={createNewChat} />
        <SidebarInset className="flex-1 flex flex-col">
          <Header />
          <ChatArea key={chatId} conversationId={chatId} />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

const ServersLayout = () => {
  const navigate = useNavigate()
  useThemeInit()

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden w-full">
        <AppSidebar onNewChat={() => navigate(`/chat/new-${Date.now()}`)} />
        <SidebarInset className="flex-1 flex flex-col">
          <Header />
          <ServerHealth onBack={() => navigate('/')} />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatLayout />} />
        <Route path="/chat/:chatId" element={<ChatLayout />} />
        <Route path="/servers" element={<ServersLayout />} />
      </Routes>
      <Toaster className="chat-toaster" position="top-center" expand={false} closeButton />
    </Router>
  )
}

export default App