import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, MessageCircle, Plus } from 'lucide-react'
import { APIService } from '../services/api.service'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

function groupByDate(conversations) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(todayStart)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups = { Today: [], 'This week': [], Older: [] }

  for (const conv of conversations) {
    const d = conv.created_at ? new Date(conv.created_at) : null
    if (!d || d >= todayStart) {
      groups['Today'].push(conv)
    } else if (d >= weekAgo) {
      groups['This week'].push(conv)
    } else {
      groups['Older'].push(conv)
    }
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

export function SearchDialog({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return
    setSearchQuery('')
    APIService.getConversationsList()
      .then(setConversations)
      .catch(() => setConversations([]))
  }, [isOpen])

  const filtered = searchQuery
    ? conversations.filter(c =>
        (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations

  const groups = groupByDate(filtered)

  const handleSelect = (conv) => {
    onClose()
    navigate(`/chat/${conv.id}`)
  }

  const handleNewChat = () => {
    onClose()
    navigate('/')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-0 max-w-md rounded-lg">
        <VisuallyHidden>
          <DialogTitle>Search chats</DialogTitle>
        </VisuallyHidden>

        <div className="flex items-center border-b px-4 py-3 bg-background">
          <Search className="h-4 w-4 text-muted-foreground mr-3" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 bg-background max-h-[60vh] overflow-y-auto">
          <Button
            variant="ghost"
            className="w-full justify-start space-x-2 h-10"
            onClick={handleNewChat}
          >
            <Plus className="h-4 w-4" />
            <span>New chat</span>
          </Button>

          {groups.length === 0 && searchQuery && (
            <p className="text-sm text-muted-foreground px-2 py-4 text-center">
              No chats found
            </p>
          )}

          {groups.map(([label, items]) => (
            <div key={label} className="mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {label}
              </h4>
              <div className="space-y-1">
                {items.map((conv) => (
                  <Button
                    key={conv.id}
                    variant="ghost"
                    className="w-full justify-start space-x-2 h-10 px-2 hover:bg-muted"
                    onClick={() => handleSelect(conv)}
                  >
                    <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{conv.title}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
