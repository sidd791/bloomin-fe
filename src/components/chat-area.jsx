import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, ArrowUp, ArrowDown, Square, Scale, Brain, Zap, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { RotatingHeadlines } from './rotating-headlines'
import { AttachmentChip, AttachmentBadge } from './attachment-chip'
import { APIService } from '../services/api.service'
import { chatStreamManager, loadMessages, saveMessages } from '../services/chat-stream-manager'
import { useFileUpload } from '../hooks/use-file-upload'
import { ACCEPT_STRING, UPLOAD_MAX_FILES, UPLOAD_STATUS } from '../lib/file-upload'
import { toast } from 'sonner'

function normalizeServerMessages(serverMessages) {
  return serverMessages.map((msg, idx) => ({
    id: msg.id || `server-${idx}-${Date.now()}`,
    content: msg.content || '',
    isUser: msg.role === 'user',
    timestamp: msg.created_at || new Date().toISOString(),
    isTypingStream: false,
    clientMessageId: msg.client_message_id || null,
    attachments: msg.attachments?.length ? msg.attachments : null,
    responseTime: msg.latency_ms ? (msg.latency_ms / 1000).toFixed(1) : null,
    meta: msg.model || msg.mode || msg.total_cost != null ? {
      mode: msg.mode || null,
      usage: {
        total_tokens: (msg.input_tokens || 0) + (msg.output_tokens || 0) || null,
        cost_usd: msg.total_cost || null,
      },
    } : null,
    isError: !!msg.error_kind,
  }))
}

const CHAT_MODES = [
  {
    value: 'auto',
    label: 'Auto',
    icon: Zap,
    tooltip: 'Smart mode — automatically picks the best model for each message.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    icon: Scale,
    tooltip: 'Same agent power, less thinking. Faster replies, capped at ~150 words.',
  },
  {
    value: 'thinking',
    label: 'Thinking',
    icon: Brain,
    tooltip: 'Full reasoning. Multiple tool calls, in-depth answers. Slower.',
  },
]

const TRUNCATE_LIMIT = 200

function HistoryUnavailableCard() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-center max-w-2xl mx-auto">
      <div className="flex justify-center mb-2">
        <AlertCircle className="h-5 w-5 text-amber-500" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">
        Message history isn't on this device
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
        This conversation was started in a different browser, or its earlier
        messages were interrupted before they could be saved. The original
        text isn't available here, but you can keep chatting — new turns
        will be saved on this browser.
      </p>
    </div>
  )
}

function ExpandableUserMessage({ content, renderMessageContent }) {
  const [expanded, setExpanded] = useState(false)
  const isTruncatable = content.length > TRUNCATE_LIMIT

  const displayText = !isTruncatable || expanded
    ? content
    : content.slice(0, TRUNCATE_LIMIT) + '...'

  return (
    <div
      className={`rounded-2xl px-4 sm:px-5 py-3 text-sm whitespace-pre-wrap break-words bg-pink-500 text-white shadow-md min-w-0 overflow-hidden ${isTruncatable ? 'cursor-pointer select-none' : ''}`}
      onClick={isTruncatable ? () => setExpanded((prev) => !prev) : undefined}
    >
      {renderMessageContent(displayText)}
      {isTruncatable && (
        <span className="inline-flex items-center gap-1 ml-1 text-white/70 text-xs align-middle">
          {expanded ? <ChevronUp className="h-3.5 w-3.5 inline" /> : <ChevronDown className="h-3.5 w-3.5 inline" />}
        </span>
      )}
    </div>
  )
}

export function ChatArea({ conversationId }) {
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatMode, setChatMode] = useState('auto')
  const [isDragOver, setIsDragOver] = useState(false)
  const [historyMissing, setHistoryMissing] = useState(false)

  const {
    attachments,
    addFiles,
    removeAttachment,
    retryUpload,
    clearAttachments,
    hasUploading,
    getAttachmentsPayload,
    canAttachMore,
  } = useFileUpload()

  const sessionIdRef = useRef(
    conversationId && !String(conversationId).startsWith('new-') ? conversationId : null,
  )
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)
  const messagesRef = useRef(messages)
  const scrollContainerRef = useRef(null)
  const userScrolledUpRef = useRef(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const wheelListenerRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom <= 50) {
      userScrolledUpRef.current = false
      setShowScrollButton(false)
    }
  }, [])

  const scrollContainerCallbackRef = useCallback((node) => {
    if (wheelListenerRef.current?.el) {
      const prev = wheelListenerRef.current
      prev.el.removeEventListener('wheel', prev.onWheel)
      prev.el.removeEventListener('touchmove', prev.onTouch)
      wheelListenerRef.current = null
    }

    scrollContainerRef.current = node
    if (!node) return

    const onWheel = (e) => {
      if (e.deltaY < 0) {
        userScrolledUpRef.current = true
        setShowScrollButton(true)
      }
    }
    const onTouch = (() => {
      let lastY = null
      return (e) => {
        const y = e.touches[0]?.clientY
        if (lastY !== null && y > lastY) {
          userScrolledUpRef.current = true
          setShowScrollButton(true)
        }
        lastY = y
      }
    })()

    node.addEventListener('wheel', onWheel, { passive: true })
    node.addEventListener('touchmove', onTouch, { passive: true })
    wheelListenerRef.current = { el: node, onWheel, onTouch }
  }, [])

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom()
    }
    messagesRef.current = messages
  }, [messages, scrollToBottom])

  const applyStreamState = useCallback((state) => {
    if (!state) {
      setIsTyping(false)
      setIsStreaming(false)
      return
    }
    setMessages(state.messages.map((msg) => ({ ...msg })))
    setIsTyping(state.isTyping)
    setIsStreaming(state.isStreaming)
  }, [])

  const handleStreamEvent = useCallback((event, payload) => {
    if (event === 'state') {
      applyStreamState(payload)
      return
    }
    if (event === 'complete' || event === 'error') {
      setMessages(payload.messages.map((msg) => ({ ...msg, isTypingStream: false })))
      setIsTyping(false)
      setIsStreaming(false)
      if (event === 'error' && payload.error?.status === 502) {
        toast.error('AI service unavailable')
      }
    }
  }, [applyStreamState])

  const newSessionUnsubRef = useRef(null)

  useEffect(() => {
    return () => {
      if (newSessionUnsubRef.current) {
        newSessionUnsubRef.current()
        newSessionUnsubRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!conversationId || String(conversationId).startsWith('new-')) {
      setMessages([])
      sessionIdRef.current = null
      setHistoryMissing(false)
      setIsTyping(false)
      setIsStreaming(false)
      clearAttachments()
      return undefined
    }

    sessionIdRef.current = conversationId
    const activeState = chatStreamManager.getState(conversationId)
    if (activeState) {
      applyStreamState(activeState)
      setHistoryMissing(false)
    } else {
      const local = loadMessages(conversationId)
      setMessages(local.map((msg) => ({ ...msg, isTypingStream: false })))
      setHistoryMissing(local.length === 0)
      setIsTyping(false)
      setIsStreaming(false)

      APIService.getSessionMessages(conversationId)
        .then((serverMessages) => {
          if (sessionIdRef.current !== conversationId) return
          if (serverMessages?.length) {
            const normalized = normalizeServerMessages(serverMessages)
            setMessages(normalized)
            saveMessages(conversationId, normalized)
            setHistoryMissing(false)
          }
        })
        .catch(() => {
          // API unavailable — localStorage fallback already applied above
        })
    }
    loadSessionAttachments(conversationId, loadMessages(conversationId))

    const unsubscribe = chatStreamManager.subscribe(conversationId, handleStreamEvent)

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, applyStreamState, handleStreamEvent])

  const loadSessionAttachments = async (sessionId, storedMessages) => {
    try {
      const serverAttachments = await APIService.getSessionAttachments(sessionId)
      if (!serverAttachments?.length) return

      const attachmentMap = new Map()
      for (const att of serverAttachments) {
        const key = att.client_message_id
        if (!attachmentMap.has(key)) attachmentMap.set(key, [])
        attachmentMap.get(key).push(att)
      }

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.clientMessageId && attachmentMap.has(msg.clientMessageId)) {
            return { ...msg, attachments: attachmentMap.get(msg.clientMessageId) }
          }
          return msg
        }),
      )
    } catch {
      // Attachments are decorative; don't block the chat
    }
  }

  const handleFileSelect = useCallback((files) => {
    if (!files?.length) return
    const results = addFiles(files)
    for (const r of results) {
      if (r.error && !r.attachment) {
        toast.error(r.error)
      }
    }
  }, [addFiles])

  const handleFileInputChange = (event) => {
    handleFileSelect(event.target.files)
    event.target.value = ''
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer?.files?.length) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [handleFileSelect])

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      handleFileSelect(files)
    }
  }, [handleFileSelect])

  const handleScrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false
    setShowScrollButton(false)
    scrollToBottom()
  }, [scrollToBottom])

  const handleStop = () => {
    const sessionId = sessionIdRef.current
    if (sessionId) {
      chatStreamManager.abortStream(sessionId)
    }
  }

  const callChatAPI = async (message, sessionId, mode, { clientMessageId, attachments: attachmentsPayload, initialMessages } = {}) => {
    await chatStreamManager.startStream({
      sessionId,
      message,
      mode,
      clientMessageId,
      attachments: attachmentsPayload,
      initialMessages,
      assistantMessageId: Date.now() + 1,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (hasUploading) {
      toast.info('Please wait — files are still uploading...')
      return
    }

    const text = inputValue.trim()
    const attachmentsPayload = getAttachmentsPayload()
    const hasAttachments = attachmentsPayload.length > 0
    const hasText = text.length > 0

    if (!hasText && !hasAttachments) return

    userScrolledUpRef.current = false

    const clientMessageId = hasAttachments ? crypto.randomUUID() : null

    const messageAttachments = hasAttachments
      ? attachments
          .filter((a) => a.status === UPLOAD_STATUS.READY)
          .map((a) => ({
            file_id: a.fileId,
            filename: a.filename,
            mime_type: a.mimeType,
            preview_url: a.previewUrl,
            localPreview: a.localPreview,
          }))
      : null

    const userMessage = {
      id: Date.now(),
      content: text,
      isUser: true,
      timestamp: new Date().toISOString(),
      isTypingStream: false,
      attachments: messageAttachments,
      clientMessageId,
    }

    const messagesWithUser = [...messagesRef.current, userMessage]
    setMessages(messagesWithUser)
    setHistoryMissing(false)
    setInputValue('')
    clearAttachments()
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px'
    }

    let sessionId = sessionIdRef.current
    let isNewSession = false

    if (!sessionId) {
      try {
        const label = text.length > 40 ? text.substring(0, 40) + '...' : (text || 'File analysis')
        const result = await APIService.createSession(label)
        sessionId = result?.id
        sessionIdRef.current = sessionId
        isNewSession = true
        saveMessages(sessionId, [userMessage])
      } catch {
        toast.error('Failed to create session. Please try again.')
        return
      }
    }

    const apiText = text || (hasAttachments ? `Please analyze the attached file(s).` : '')

    if (isNewSession) {
      window.history.replaceState({}, '', `/chat/${sessionId}`)
      window.dispatchEvent(new Event('chat-created'))

      if (newSessionUnsubRef.current) newSessionUnsubRef.current()
      newSessionUnsubRef.current = chatStreamManager.subscribe(sessionId, handleStreamEvent)
    }

    await callChatAPI(apiText, sessionId, chatMode, {
      clientMessageId,
      attachments: attachmentsPayload,
      initialMessages: messagesWithUser,
    })
  }

  const canSend = (inputValue.trim() || attachments.some((a) => a.status === UPLOAD_STATUS.READY)) && !hasUploading

  const renderModeSelector = () => (
    <div className="flex items-center justify-center mb-2">
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/50 border border-border/50">
        {CHAT_MODES.map(({ value, label, icon: Icon, tooltip }) => (
          <button
            key={value}
            type="button"
            onClick={() => setChatMode(value)}
            title={tooltip}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
              chatMode === value
                ? 'bg-pink-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderAttachmentChips = () => {
    if (attachments.length === 0) return null
    return (
      <div className="px-4 pt-4 pb-2 flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <AttachmentChip
            key={attachment.localId}
            attachment={attachment}
            onRemove={removeAttachment}
            onRetry={retryUpload}
          />
        ))}
      </div>
    )
  }

  const renderInputForm = () => (
    <form onSubmit={handleSubmit} className="w-full">
      {renderModeSelector()}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col bg-muted/30 border-2 rounded-[28px] overflow-hidden transition-all shadow-sm ${
          isDragOver
            ? 'border-pink-400 bg-pink-500/5 ring-2 ring-pink-500/20'
            : 'border-pink-500 focus-within:border-pink-600 focus-within:ring-2 focus-within:ring-pink-500/20'
        }`}
      >
        {isDragOver && (
          <div className="px-4 pt-4 pb-2 flex items-center justify-center">
            <div className="text-sm text-pink-500 font-medium py-3">
              Drop files here to attach
            </div>
          </div>
        )}

        {!isDragOver && renderAttachmentChips()}

        <div className="relative flex items-end min-h-[56px]">
          <div className="absolute left-3 bottom-0 flex items-center gap-1 pb-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_STRING}
              onChange={handleFileInputChange}
              className="hidden"
              multiple
            />
            <button
              type="button"
              onClick={() => canAttachMore && fileInputRef.current?.click()}
              className={`p-2 rounded-full transition-colors flex items-center justify-center ${
                canAttachMore
                  ? 'hover:bg-pink-500/10 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              title={canAttachMore ? 'Attach files' : `Maximum ${UPLOAD_MAX_FILES} files`}
            >
              <Plus className="h-5 w-5 text-pink-500 hover:text-pink-600 transition" />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
            placeholder="Ask anything"
            rows={1}
            className="w-full bg-transparent border-none focus:outline-none pl-16 pr-14 sm:pr-24 py-4 text-base resize-none"
            style={{ minHeight: '56px', maxHeight: '200px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
          />

          <div className="absolute right-3 bottom-0 flex items-center gap-1 pb-2">
            {isStreaming ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-pink-500 text-white hover:bg-pink-600 transition-colors"
                onClick={handleStop}
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <div className="relative">
                {hasUploading && (
                  <div className="absolute -top-8 right-0 whitespace-nowrap text-xs text-pink-500 bg-background border rounded-md px-2 py-1 shadow-sm">
                    Files still processing...
                  </div>
                )}
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 rounded-full transition-colors ${
                    canSend
                      ? 'bg-pink-500 text-white hover:bg-pink-600'
                      : 'bg-pink-500/10 text-pink-500 hover:bg-pink-500/20'
                  }`}
                  disabled={!canSend}
                >
                  <ArrowUp className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Bloombrain can make mistakes. Consider checking important information.
        </p>
      </div>
    </form>
  )

  const renderMessageContent = (text = '') => {
    if (typeof text !== 'string') text = text?.text ?? String(text ?? '')
    return text.split(/(\*\*[^*]+\*\*)/g).map((segment, index) => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return <strong key={index}>{segment.slice(2, -2)}</strong>
      }
      return <React.Fragment key={index}>{segment}</React.Fragment>
    })
  }

  const renderMessageAttachments = (msg) => {
    const atts = msg.attachments
    if (!atts?.length) return null
    return (
      <div className="flex flex-wrap gap-1.5">
        {atts.map((att, i) => (
          <AttachmentBadge key={att.file_id || i} attachment={att} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background relative">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-3xl flex flex-col items-center gap-8">
            {historyMissing ? <HistoryUnavailableCard /> : <RotatingHeadlines />}
            <div className="w-full">{renderInputForm()}</div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollContainerCallbackRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-2 py-3 sm:p-4 w-full flex flex-col items-center [scrollbar-gutter:stable]">
            <div className="w-full max-w-4xl space-y-4 sm:space-y-6 pb-4 sm:pb-6 mt-2 sm:mt-4">
              {messages.filter((msg) => msg.content?.trim() || msg.attachments?.length).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex w-full min-w-0 ${
                    msg.isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.isUser ? (
                    <div className="flex flex-col items-end gap-2 max-w-[92%] sm:max-w-[80%] min-w-0">
                      {renderMessageAttachments(msg)}
                      {msg.content && (
                        <ExpandableUserMessage
                          content={msg.content}
                          renderMessageContent={renderMessageContent}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 max-w-[92%] sm:max-w-[80%] min-w-0">
                      <div className="rounded-2xl px-4 sm:px-5 py-3 text-sm whitespace-pre-wrap break-words bg-muted/50 text-foreground border shadow-sm overflow-hidden">
                        {renderMessageContent(msg.content)}
                        {msg.isTypingStream && (
                          <span className="animate-pulse opacity-70 ml-[2px]">|</span>
                        )}
                      </div>
                      {(msg.responseTime || msg.meta) && (
                        <div className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground/60 flex-wrap">
                          {msg.meta?.mode && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 font-medium">
                              {msg.meta.mode === 'auto' ? 'Auto ⚡' : msg.meta.mode === 'thinking' ? 'Thinking' : msg.meta.mode === 'balanced' ? 'Balanced' : msg.meta.mode}
                            </span>
                          )}
                          {msg.responseTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {msg.responseTime}s
                            </span>
                          )}
                          {msg.meta?.usage?.total_tokens != null && (
                            <span className="flex items-center gap-1">
                              {msg.meta.usage.total_tokens} tokens
                            </span>
                          )}
                          {msg.meta?.usage?.cost_usd != null && (
                            <span className="flex items-center gap-1 text-pink-500/70 font-medium">
                              ${msg.meta.usage.cost_usd.toFixed(4)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex w-full justify-start">
                  <div className="max-w-[92%] sm:max-w-[80%] rounded-2xl px-4 sm:px-5 py-4 text-foreground flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-pink-500/80 animate-bounce cursor-default" />
                      <div className="w-2 h-2 rounded-full bg-pink-500/80 animate-bounce [animation-delay:-.3s] cursor-default" />
                      <div className="w-2 h-2 rounded-full bg-pink-500/80 animate-bounce [animation-delay:-.5s] cursor-default" />
                    </div>
                    <span className="text-sm text-muted-foreground animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {showScrollButton && (
            <div className="absolute bottom-[140px] left-1/2 -translate-x-1/2 z-10">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full shadow-lg bg-background/90 backdrop-blur border-border/80 hover:bg-muted transition-all"
                onClick={handleScrollToBottom}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="w-full bg-background/95 backdrop-blur border-t px-2 py-3 sm:p-4 flex justify-center shrink-0">
            <div className="w-full max-w-4xl">{renderInputForm()}</div>
          </div>
        </>
      )}
    </div>
  )
}
