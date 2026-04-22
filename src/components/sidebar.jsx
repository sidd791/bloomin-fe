import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Search, SquarePen, MoreHorizontal, Trash2, Activity, Wrench, ChevronDown, ChevronUp, Music, Radar, LayoutTemplate } from 'lucide-react'
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

const INITIAL_CHAT_COUNT = 5

export function AppSidebar({ onNewChat }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [isChatsExpanded, setIsChatsExpanded] = useState(false)
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
      if (err.status !== 401) {
        console.error('Failed to fetch sidebar conversations:', err)
      }
    }
  }

  const handleDelete = async (sessionId) => {
    try {
      await APIService.deleteConversation(sessionId)
      setChatHistory((prev) => prev.filter((item) => String(item.id) !== String(sessionId)))
      localStorage.removeItem(`messages_${sessionId}`)

      if (currentChatId === String(sessionId)) {
        navigate('/')
      }
      toast.success('Conversation deleted successfully.')
    } catch (err) {
      if (err.status === 404) {
        setChatHistory((prev) => prev.filter((item) => String(item.id) !== String(sessionId)))
        toast.error('Session not found. Refreshing list.')
        fetchConversations()
      } else {
        console.error('Failed to delete conversation:', err)
        toast.error('Failed to delete conversation. Please try again.')
      }
    }
  }

  const openDeleteConfirm = (sessionId) => {
    setDeleteTargetId(sessionId)
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
    fetchConversations()
    window.addEventListener('chat-created', fetchConversations)
    return () => window.removeEventListener('chat-created', fetchConversations)
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
          <SidebarGroupLabel>Your chats</SidebarGroupLabel>
          <SidebarGroupContent>
            {(() => {
              const visibleChats = chatHistory.slice(0, INITIAL_CHAT_COUNT)
              const overflowChats = chatHistory.slice(INITIAL_CHAT_COUNT)
              const hasOverflow = overflowChats.length > 0

              const renderChatItem = (item) => {
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
              }

              return (
                <>
                  <SidebarMenu>{visibleChats.map(renderChatItem)}</SidebarMenu>

                  {hasOverflow && (
                    <>
                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                          isChatsExpanded
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'grid-rows-[0fr] opacity-0'
                        }`}
                        aria-hidden={!isChatsExpanded}
                      >
                        <div className="overflow-hidden min-h-0">
                          <SidebarMenu>{overflowChats.map(renderChatItem)}</SidebarMenu>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsChatsExpanded((prev) => !prev)}
                        aria-expanded={isChatsExpanded}
                        className="mt-1 flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {isChatsExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5 transition-transform duration-300" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300" />
                            See more ({overflowChats.length})
                          </>
                        )}
                      </button>
                    </>
                  )}
                </>
              )
            })()}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setIsToolsOpen((prev) => !prev)}
            aria-expanded={isToolsOpen}
          >
            <Wrench className="mr-2 h-4 w-4" />
            <span className="flex-1 text-left">Bloombrain Tools</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isToolsOpen ? 'rotate-180' : ''}`}
            />
          </Button>
          {isToolsOpen && (
            <div className="mt-1 ml-2 flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                asChild
              >
                <a href="/tiktok-scraper/" target="_blank" rel="noopener noreferrer">
                  <Music className="mr-2 h-4 w-4" />
                  TikTok Scraper
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                asChild
              >
                <a href="/reddit-scraper/" target="_blank" rel="noopener noreferrer">
                  <Radar className="mr-2 h-4 w-4" />
                  Reddit Scraper
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                asChild
              >
                <a href="/landing-page/" target="_blank" rel="noopener noreferrer">
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Landing Pages
                </a>
              </Button>
            </div>
          )}
        </div>
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
