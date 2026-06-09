import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, ArrowUp, Square, Scale, Brain, Zap, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { RotatingHeadlines } from './rotating-headlines'
import { AttachmentChip, AttachmentBadge } from './attachment-chip'
import { APIService } from '../services/api.service'
import { useFileUpload } from '../hooks/use-file-upload'
import { ACCEPT_STRING, UPLOAD_MAX_FILES, UPLOAD_STATUS } from '../lib/file-upload'
import { toast } from 'sonner'

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

function loadMessages(sessionId) {
  if (!sessionId) return []
  try {
    const raw = localStorage.getItem(`messages_${sessionId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMessages(sessionId, messages) {
  if (!sessionId) return
  const serializable = messages.map(({ id, content, isUser, timestamp, attachments, responseTime, clientMessageId, meta }) => ({
    id, content, isUser, timestamp, attachments, responseTime, clientMessageId, meta,
  }))
  localStorage.setItem(`messages_${sessionId}`, JSON.stringify(serializable))
}

const TRUNCATE_LIMIT = 200
const STREAM_SAVE_THROTTLE_MS = 800

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
  const targetTextRef = useRef('')
  const revealedLenRef = useRef(0)
  const revealTimerRef = useRef(null)
  const abortControllerRef = useRef(null)
  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)
  // Session id currently being streamed into (used to persist partial replies
  // under the right key even after navigation).
  const streamingSessionIdRef = useRef(null)
  // Mirror of `messages` for synchronous access inside cleanup paths.
  const messagesRef = useRef(messages)
  // Timestamp of the last streaming-snapshot save, for throttling.
  const lastStreamSaveAtRef = useRef(0)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
    messagesRef.current = messages
  }, [messages])

  // Throttled snapshot save during streaming. Captures whatever has been
  // revealed so far so partial replies survive navigation/refresh.
  const persistStreamingSnapshot = (snapshot, force = false) => {
    const sid = streamingSessionIdRef.current
    if (!sid) return
    const now = Date.now()
    if (!force && now - lastStreamSaveAtRef.current < STREAM_SAVE_THROTTLE_MS) return
    lastStreamSaveAtRef.current = now
    try {
      saveMessages(sid, snapshot)
    } catch {
      // localStorage quota / serialization errors are non-fatal
    }
  }

  // Force-flush the current partial reply under the streaming session id and
  // tear down any in-flight stream. Used when the user navigates between
  // chats or the component unmounts.
  const flushAndCleanupStream = () => {
    if (streamingSessionIdRef.current && messagesRef.current?.length) {
      try {
        saveMessages(streamingSessionIdRef.current, messagesRef.current)
      } catch {
        // ignore
      }
      streamingSessionIdRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    stopReveal()
    setIsStreaming(false)
    setIsTyping(false)
  }

  useEffect(() => {
    // Switching to any chat (real or new-) — flush any partial assistant reply
    // from the previous chat under its own session id before we tear down state.
    if (sessionIdRef.current !== conversationId) {
      flushAndCleanupStream()
    }

    if (!conversationId || String(conversationId).startsWith('new-')) {
      setMessages([])
      sessionIdRef.current = null
      setHistoryMissing(false)
      clearAttachments()
      return
    }
    sessionIdRef.current = conversationId
    const stored = loadMessages(conversationId)
    setMessages(
      stored.map((msg) => ({ ...msg, isTypingStream: false })),
    )
    setHistoryMissing(stored.length === 0)
    loadSessionAttachments(conversationId, stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

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

  useEffect(() => {
    return () => {
      // Component unmount: persist whatever streamed in before we vanish.
      if (streamingSessionIdRef.current && messagesRef.current?.length) {
        try {
          saveMessages(streamingSessionIdRef.current, messagesRef.current)
        } catch {
          // ignore
        }
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      stopReveal()
    }
  }, [])

  const handleStop = () => {
    abortControllerRef.current?.abort()
    stopReveal()
    setIsStreaming(false)
    setIsTyping(false)
    // Save whatever streamed in before the user pressed stop.
    if (streamingSessionIdRef.current && messagesRef.current?.length) {
      try {
        saveMessages(streamingSessionIdRef.current, messagesRef.current)
      } catch {
        // ignore
      }
      streamingSessionIdRef.current = null
    }
  }

  const startReveal = (msgId) => {
    if (revealTimerRef.current) return
    revealTimerRef.current = setInterval(() => {
      const target = targetTextRef.current
      if (revealedLenRef.current < target.length) {
        const remaining = target.length - revealedLenRef.current
        const speed = remaining > 300 ? 3 : remaining > 100 ? 2 : 1
        revealedLenRef.current = Math.min(revealedLenRef.current + speed, target.length)
        const revealed = target.slice(0, revealedLenRef.current)
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === msgId ? { ...msg, content: revealed } : msg,
          )
          persistStreamingSnapshot(updated)
          return updated
        })
      }
    }, 30)
  }

  const stopReveal = () => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }

  const callChatAPI = async (message, sessionId, mode, { clientMessageId, attachments: attachmentsPayload } = {}) => {
    setIsTyping(true)
    setIsStreaming(true)
    const assistantMessageId = Date.now() + 1
    const startTime = performance.now()
    targetTextRef.current = ''
    revealedLenRef.current = 0
    streamingSessionIdRef.current = sessionId
    lastStreamSaveAtRef.current = 0

    const controller = new AbortController()
    abortControllerRef.current = controller
    let streamMeta = null

    try {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          content: '',
          isUser: false,
          timestamp: new Date().toISOString(),
          isTypingStream: true,
        },
      ])

      const streamResult = await APIService.sendChatMessage(
        sessionId,
        message,
        (fullText) => {
          setIsTyping(false)
          targetTextRef.current = fullText
          startReveal(assistantMessageId)
        },
        controller.signal,
        mode,
        {
          clientMessageId,
          attachments: attachmentsPayload,
          onMeta: (meta) => { streamMeta = meta },
        },
      )

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)

      await new Promise((resolve) => {
        const waitInterval = setInterval(() => {
          if (revealedLenRef.current >= targetTextRef.current.length) {
            clearInterval(waitInterval)
            resolve()
          }
        }, 30)
      })

      stopReveal()
      setIsTyping(false)

      // Detect "stream succeeded but produced nothing the user can see":
      // an HTTP 200 from /messages that emits no `delta.content` chunks, or
      // an explicit error event in the SSE body. Without this guard the
      // empty assistant placeholder gets filtered out of the render and the
      // UI looks frozen / unresponsive.
      const finalText = (targetTextRef.current || '').trim()
      const streamError = streamResult?.error
      const isEmpty = !finalText && !streamError

      if (streamError || isEmpty) {
        const errorBody = streamError
          ? `The model didn't finish the response.\n\n**Server said:** ${streamError}\n\nPlease try again — if it keeps failing, the prompt may be too long or the upstream provider is having issues.`
          : `The model returned an empty response.\n\nThis usually means the prompt was too long for the selected model's context window, an upstream provider hit a rate limit, or a tool call timed out on the backend.\n\nTry shortening your message, switching modes, or sending again.`

        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: errorBody,
                  isTypingStream: false,
                  responseTime: elapsed,
                  meta: streamMeta || undefined,
                  isError: true,
                }
              : msg,
          )
          saveMessages(sessionId, updated)
          return updated
        })

        if (typeof console !== 'undefined') {
          console.warn('[chat] empty/aborted stream from backend', {
            sessionId,
            streamError,
            elapsedSec: elapsed,
            meta: streamMeta,
          })
        }
      } else {
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: targetTextRef.current, isTypingStream: false, responseTime: elapsed, meta: streamMeta || undefined }
              : msg,
          )
          saveMessages(sessionId, updated)
          return updated
        })
      }
    } catch (error) {
      if (error.name === 'AbortError') return

      stopReveal()
      const errContent =
        error.status === 502
          ? 'AI service is currently unavailable. Please try again later.'
          : 'Error sending message. Please try again.'

      if (error.status === 502) {
        toast.error('AI service unavailable')
      }

      setMessages((prev) => {
        const updated = [
          ...prev.filter((m) => m.id !== assistantMessageId),
          {
            id: Date.now() + 2,
            content: errContent,
            isUser: false,
            timestamp: new Date().toISOString(),
            isTypingStream: false,
          },
        ]
        saveMessages(sessionId, updated)
        return updated
      })
    } finally {
      setIsTyping(false)
      setIsStreaming(false)
      abortControllerRef.current = null
      streamingSessionIdRef.current = null
    }
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

    setMessages((prev) => [...prev, userMessage])
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

    await callChatAPI(apiText, sessionId, chatMode, {
      clientMessageId,
      attachments: attachmentsPayload,
    })

    if (isNewSession) {
      window.history.replaceState({}, '', `/chat/${sessionId}`)
      window.dispatchEvent(new Event('chat-created'))
    }
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
          <div className="flex-1 overflow-y-auto px-2 py-3 sm:p-4 w-full flex flex-col items-center [scrollbar-gutter:stable]">
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

          <div className="w-full bg-background/95 backdrop-blur border-t px-2 py-3 sm:p-4 flex justify-center shrink-0">
            <div className="w-full max-w-4xl">{renderInputForm()}</div>
          </div>
        </>
      )}
    </div>
  )
}
