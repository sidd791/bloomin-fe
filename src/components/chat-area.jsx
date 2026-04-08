import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, FileText, ArrowUp, Square } from 'lucide-react'
import { RotatingHeadlines } from './rotating-headlines'
import { APIService } from '../services/api.service'
import { gatewayWs } from '../services/gateway-ws'

export function ChatArea({ conversationId }) {
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)

  const [internalSessionKey, setInternalSessionKey] = useState(conversationId)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const targetTextRef = useRef('')
  const revealedLenRef = useRef(0)
  const revealTimerRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!conversationId || String(conversationId).startsWith('new-')) {
      return
    }

    setInternalSessionKey(conversationId)

    const fetchHistory = async () => {
      try {
        const fetchedMessages = await APIService.getConversationHistory(conversationId)

        if (fetchedMessages.length > 0) {
          const mappedMessages = fetchedMessages.map((msg, index) => ({
            id: msg.id || `${Date.now()}-${index}`,
            content: msg.content || '',
            isUser: msg.is_user || msg.role === 'user',
            timestamp: msg.timestamp || new Date(),
            isTypingStream: false,
          }))
          setMessages(mappedMessages)
        }
      } catch (err) {
        console.error('Failed to fetch conversation history:', err)
      }
    }

    fetchHistory()
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
    if (internalSessionKey) {
      APIService.abortChat(internalSessionKey)
    }
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
            msg.id === msgId ? { ...msg, content: revealed } : msg
          )
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

  const callChatAPI = async (message, sessionKey) => {
    setIsTyping(true)
    setIsStreaming(true)
    const assistantMessageId = Date.now() + 1
    targetTextRef.current = ''
    revealedLenRef.current = 0

    try {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          content: '',
          isUser: false,
          timestamp: new Date(),
          isTypingStream: true,
        },
      ])

      await APIService.sendChatMessage(message, sessionKey, (fullText) => {
        setIsTyping(false)
        targetTextRef.current = fullText
        startReveal(assistantMessageId)
      })

      await new Promise((resolve) => {
        const waitInterval = setInterval(() => {
          if (revealedLenRef.current >= targetTextRef.current.length) {
            clearInterval(waitInterval)
            resolve()
          }
        }, 30)
      })

      stopReveal()
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: targetTextRef.current, isTypingStream: false }
            : msg
        )
      )
    } catch (error) {
      console.error('Chat error:', error)
      stopReveal()
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          content: 'Error sending message. Please try again.',
          isUser: false,
          timestamp: new Date(),
          isTypingStream: false,
        },
      ])
    } finally {
      setIsTyping(false)
      setIsStreaming(false)
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
        timestamp: new Date(),
        isTypingStream: false,
        attachedFile: activeFile ? { name: activeFile.name } : null,
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = '56px'
      }

      let sessionKey = internalSessionKey

      if (!sessionKey || String(sessionKey).startsWith('new-')) {
        try {
          const label = text.length > 40 ? text.substring(0, 40) + '...' : text
          const result = await gatewayWs.createSession(label)
          sessionKey = result?.sessionKey || result?.key || `session-${Date.now()}`
          setInternalSessionKey(sessionKey)
          window.history.pushState({}, '', `/chat/${sessionKey}`)
          window.dispatchEvent(new Event('chat-created'))
        } catch {
          sessionKey = `session-${Date.now()}`
          setInternalSessionKey(sessionKey)
        }
      }

      await callChatAPI(
        apiText || (activeFile ? `Please analyze this document: ${activeFile.name}` : ''),
        sessionKey
      )
    }
  }

  const renderInputForm = () => (
    <form onSubmit={handleSubmit} className="w-full">
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

  console.log(messages,"messages")
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
                              : msg.content
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[92%] sm:max-w-[80%] rounded-2xl px-4 sm:px-5 py-3 text-sm whitespace-pre-wrap break-words bg-muted/50 text-foreground border shadow-sm min-w-0 overflow-hidden">
                      {renderMessageContent(msg.content)}
                      {msg.isTypingStream && (
                        <span className="animate-pulse opacity-70 ml-[2px]">|</span>
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
