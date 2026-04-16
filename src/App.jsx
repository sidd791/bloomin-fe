import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/auth-context'
import { AppSidebar } from './components/sidebar'
import { Header } from './components/header'
import { ChatArea } from './components/chat-area'
import { ServerHealth } from './components/server-health'
import { AuthPage } from './pages/auth-page'
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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

const ChatLayout = () => {
  const navigate = useNavigate()
  const { chatId } = useParams()

  const createNewChat = () => {
    navigate(`/chat/new-${Date.now()}`)
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
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
          <Route path="/chat/:chatId" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
          <Route path="/servers" element={<ProtectedRoute><ServersLayout /></ProtectedRoute>} />
        </Routes>
        <Toaster className="chat-toaster" position="top-center" expand={false} closeButton />
      </AuthProvider>
    </Router>
  )
}

export default App
