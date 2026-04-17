import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, FileText, ArrowUp, Square, Zap, Scale, Brain, Clock } from 'lucide-react'
import { RotatingHeadlines } from './rotating-headlines'
import { APIService } from '../services/api.service'
import { toast } from 'sonner'

const CHAT_MODES = [
  { value: 'fast', label: 'Fast', icon: Zap, tooltip: 'Fastest response (~2s). Uses historical data only.' },
  { value: 'balanced', label: 'Balanced', icon: Scale, tooltip: 'Quick response (~5-8s). Live data accessible.' },
  { value: 'thinking', label: 'Thinking', icon: Brain, tooltip: 'Deep analysis (~10-15s). Full agent with all data sources.' },
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
  const serializable = messages.map(({ id, content, isUser, timestamp, attachedFile, responseTime }) => ({
    id, content, isUser, timestamp, attachedFile, responseTime,
  }))
  localStorage.setItem(`messages_${sessionId}`, JSON.stringify(serializable))
}

export function ChatArea({ conversationId }) {
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatMode, setChatMode] = useState('thinking')

  const sessionIdRef = useRef(
    conversationId && !String(conversationId).startsWith('new-') ? conversationId : null,
  )
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const targetTextRef = useRef('')
  const revealedLenRef = useRef(0)
  const revealTimerRef = useRef(null)
  const abortControllerRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!conversationId || String(conversationId).startsWith('new-')) {
      setMessages([])
      sessionIdRef.current = null
      return
    }
    sessionIdRef.current = conversationId
    const stored = loadMessages(conversationId)
    setMessages(
      stored.map((msg) => ({ ...msg, isTypingStream: false })),
    )
  }, [conversationId])

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file)
    }
  }

  const removeAttachment = () => {
    setUploadedFile(null)
  }

  useEffect(() => {
    return () => stopReveal()
  }, [])

  const handleStop = () => {
    abortControllerRef.current?.abort()
    stopReveal()
    setIsStreaming(false)
    setIsTyping(false)
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
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === msgId ? { ...msg, content: revealed } : msg,
          ),
        )
      }
    }, 30)
  }

  const stopReveal = () => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }

  const callChatAPI = async (message, sessionId, mode) => {
    setIsTyping(true)
    setIsStreaming(true)
    const assistantMessageId = Date.now() + 1
    const startTime = performance.now()
    targetTextRef.current = ''
    revealedLenRef.current = 0

    const controller = new AbortController()
    abortControllerRef.current = controller

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

      await APIService.sendChatMessage(
        sessionId,
        message,
        (fullText) => {
          setIsTyping(false)
          targetTextRef.current = fullText
          startReveal(assistantMessageId)
        },
        controller.signal,
        mode,
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
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: targetTextRef.current, isTypingStream: false, responseTime: elapsed }
            : msg,
        )
        saveMessages(sessionId, updated)
        return updated
      })
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
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    let text = inputValue.trim()
    const activeFile = uploadedFile
    let apiText = text

    if (activeFile) {
      apiText = `[Attached File: ${activeFile.name}] ${apiText}`.trim()
      setUploadedFile(null)
    }

    if (text || activeFile) {
      const userMessage = {
        id: Date.now(),
        content: text,
        isUser: true,
        timestamp: new Date().toISOString(),
        isTypingStream: false,
        attachedFile: activeFile ? { name: activeFile.name } : null,
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = '56px'
      }

      let sessionId = sessionIdRef.current
      let isNewSession = false

      if (!sessionId) {
        try {
          const label = text.length > 40 ? text.substring(0, 40) + '...' : text
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

      await callChatAPI(
        apiText || (activeFile ? `Please analyze this document: ${activeFile.name}` : ''),
        sessionId,
        chatMode,
      )

      if (isNewSession) {
        window.history.replaceState({}, '', `/chat/${sessionId}`)
        window.dispatchEvent(new Event('chat-created'))
      }
    }
  }

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

  const renderInputForm = () => (
    <form onSubmit={handleSubmit} className="w-full">
      {renderModeSelector()}
      <div className="flex flex-col bg-muted/30 border-2 border-pink-500 rounded-[28px] overflow-hidden focus-within:border-pink-600 focus-within:ring-2 focus-within:ring-pink-500/20 transition-all shadow-sm">
        {uploadedFile && (
          <div className="px-4 pt-4 pb-2">
            <div className="relative flex items-center gap-3 bg-background border rounded-xl p-2 pr-6 w-max max-w-[240px] shadow-sm group">
              <div className="h-10 w-10 bg-red-500 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col overflow-hidden text-left">
                <span className="text-sm font-medium truncate text-foreground">
                  {uploadedFile.name}
                </span>
                <span className="text-xs text-muted-foreground uppercase font-semibold">
                  PDF
                </span>
              </div>
              <button
                type="button"
                onClick={removeAttachment}
                className="absolute -top-2 -right-2 bg-muted text-foreground border rounded-full p-1 hover:bg-foreground hover:text-background transition-colors"
                title="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        <div className="relative flex items-end min-h-[56px]">
          <div className="absolute left-3 bottom-0 flex items-center gap-1 pb-2">
            <label className="cursor-pointer p-2 hover:bg-pink-500/10 rounded-full transition-colors flex items-center justify-center">
              <Plus className="h-5 w-5 text-pink-500 hover:text-pink-600 transition" />
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className={`h-9 w-9 rounded-full transition-colors ${
                  inputValue.trim() || uploadedFile
                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                    : 'bg-pink-500/10 text-pink-500 hover:bg-pink-500/20'
                }`}
                disabled={!inputValue.trim() && !uploadedFile}
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background relative">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-3xl flex flex-col items-center gap-8">
            <RotatingHeadlines />
            <div className="w-full">{renderInputForm()}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-2 py-3 sm:p-4 w-full flex flex-col items-center [scrollbar-gutter:stable]">
            <div className="w-full max-w-4xl space-y-4 sm:space-y-6 pb-4 sm:pb-6 mt-2 sm:mt-4">
              {messages.filter((msg) => msg.content?.trim()).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex w-full min-w-0 ${
                    msg.isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.isUser ? (
                    <div className="flex flex-col items-end gap-2 max-w-[92%] sm:max-w-[80%] min-w-0">
                      {msg.attachedFile && (
                        <div className="flex items-center gap-3 bg-muted/10 border rounded-xl p-2 pr-6 shadow-sm w-max max-w-full">
                          <div className="h-10 w-10 bg-red-500 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex flex-col overflow-hidden text-left">
                            <span className="text-sm font-medium truncate text-foreground">
                              {msg.attachedFile.name}
                            </span>
                            <span className="text-xs text-muted-foreground uppercase font-semibold">
                              PDF
                            </span>
                          </div>
                        </div>
                      )}
                      {msg.content && (
                        <div className="rounded-2xl px-4 sm:px-5 py-3 text-sm whitespace-pre-wrap break-words bg-pink-500 text-white shadow-md min-w-0 overflow-hidden">
                          {renderMessageContent(
                            msg.content.length > 200
                              ? msg.content.slice(0, 200) + '...'
                              : msg.content,
                          )}
                        </div>
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
                      {msg.responseTime && (
                        <div className="flex items-center gap-1 px-2 text-[11px] text-muted-foreground/60">
                          <Clock className="h-3 w-3" />
                          <span>{msg.responseTime}s</span>
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
