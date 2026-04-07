import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Search, SquarePen, MoreHorizontal, Trash2, Activity } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { SearchDialog } from './search-dialog'
import { APIService } from '../services/api.service'
import { gatewayWs } from '../services/gateway-ws'

export function AppSidebar({ onNewChat }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [wsReady, setWsReady] = useState(gatewayWs.connected)
  const navigate = useNavigate()
  const location = useLocation()

  const currentChatId = location.pathname.includes('/chat/')
    ? location.pathname.split('/chat/')[1]
    : null

  const fetchConversations = async () => {
    try {
      const history = await APIService.getConversationsList()
      setChatHistory(history)
    } catch (err) {
      console.error('Failed to fetch sidebar conversations:', err)
    }
  }

  const handleDelete = async (sessionKey) => {
    try {
      await APIService.deleteConversation(sessionKey)
      setChatHistory((prev) => prev.filter((item) => String(item.id) !== String(sessionKey)))

      if (currentChatId === String(sessionKey)) {
        navigate('/')
      }
      toast.success('Conversation deleted successfully.')
    } catch (err) {
      console.error('Failed to delete conversation:', err)
      toast.error('Failed to delete conversation. Please try again.')
    }
  }

  const openDeleteConfirm = (sessionKey) => {
    setDeleteTargetId(sessionKey)
    setIsDeleteOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetId || isDeleting) return

    setIsDeleting(true)
    try {
      await handleDelete(deleteTargetId)
      setIsDeleteOpen(false)
      setDeleteTargetId(null)
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    gatewayWs.connect()

    const unsubConnected = gatewayWs.on('_connected', () => {
      setWsReady(true)
      fetchConversations()
    })

    const unsubSessionsChanged = gatewayWs.on('sessions.changed', () => {
      fetchConversations()
    })

    if (gatewayWs.connected) {
      fetchConversations()
    }

    window.addEventListener('chat-created', fetchConversations)

    return () => {
      unsubConnected()
      unsubSessionsChanged()
      window.removeEventListener('chat-created', fetchConversations)
    }
  }, [])

  return (
    <Sidebar>
      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open)
          if (!open) setDeleteTargetId(null)
        }}
      >
        <DialogContent className="p-6 rounded-lg">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>This action can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SidebarHeader className="p-4">
        <Button variant="ghost" className="w-full justify-start" onClick={onNewChat}>
          <SquarePen className="mr-2 h-4 w-4" />
          New chat
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start mt-2"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          Search chats
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            Your chats
            {!wsReady && (
              <span className="ml-2 text-xs text-muted-foreground">(connecting...)</span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatHistory.map((item) => {
                const chatId = item.id
                return (
                  <SidebarMenuItem key={chatId || Math.random()}>
                    <div className="flex items-center justify-between group">
                      <SidebarMenuButton asChild className="flex-1">
                        <Link
                          to={`/chat/${chatId}`}
                          className="text-sm whitespace-nowrap overflow-hidden text-ellipsis block w-full px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring rounded-md"
                        >
                          {item.title || 'New conversation'}
                        </Link>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => openDeleteConfirm(chatId)}
                          >
                            <Trash2 className="mr-2 h-3 w-3" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => navigate('/servers')}
        >
          <Activity className="mr-2 h-4 w-4" />
          Server Health
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
