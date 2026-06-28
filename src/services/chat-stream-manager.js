import { APIService } from './api.service';

const STREAM_SAVE_THROTTLE_MS = 800;
const REVEAL_INTERVAL_MS = 30;

function loadMessages(sessionId) {
  if (!sessionId) return [];
  try {
    const raw = localStorage.getItem(`messages_${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(sessionId, messages) {
  if (!sessionId) return;
  const serializable = messages.map(
    ({ id, content, isUser, timestamp, attachments, responseTime, clientMessageId, meta, isError }) => ({
      id,
      content,
      isUser,
      timestamp,
      attachments,
      responseTime,
      clientMessageId,
      meta,
      isError,
    }),
  );
  localStorage.setItem(`messages_${sessionId}`, JSON.stringify(serializable));
}

class ChatStreamManager {
  constructor() {
    this._streams = new Map();
    this._listeners = new Map();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        for (const sessionId of this._streams.keys()) {
          this._catchUpReveal(sessionId, true);
        }
      });
    }
  }

  isActive(sessionId) {
    return this._streams.has(sessionId);
  }

  getState(sessionId) {
    const stream = this._streams.get(sessionId);
    if (!stream) return null;
    return {
      isTyping: stream.isTyping,
      isStreaming: stream.isStreaming,
      assistantMessageId: stream.assistantMessageId,
      messages: stream.messages,
      targetText: stream.targetText,
      revealedLen: stream.revealedLen,
    };
  }

  subscribe(sessionId, listener) {
    if (!sessionId) return () => {};
    if (!this._listeners.has(sessionId)) {
      this._listeners.set(sessionId, new Set());
    }
    this._listeners.get(sessionId).add(listener);
    return () => this._listeners.get(sessionId)?.delete(listener);
  }

  _notify(sessionId, event, payload) {
    const listeners = this._listeners.get(sessionId);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(event, payload);
      } catch (err) {
        console.error('[ChatStreamManager] listener error:', err);
      }
    }
  }

  _persist(sessionId, force = false) {
    const stream = this._streams.get(sessionId);
    if (!stream) return;
    const now = Date.now();
    if (!force && now - stream.lastSaveAt < STREAM_SAVE_THROTTLE_MS) return;
    stream.lastSaveAt = now;
    try {
      saveMessages(sessionId, stream.messages);
    } catch {
      // localStorage quota errors are non-fatal
    }
  }

  _updateAssistantMessage(sessionId, updater) {
    const stream = this._streams.get(sessionId);
    if (!stream) return;
    stream.messages = stream.messages.map((msg) =>
      msg.id === stream.assistantMessageId ? { ...msg, ...updater(msg) } : msg,
    );
  }

  _catchUpReveal(sessionId, forcePersist = false) {
    const stream = this._streams.get(sessionId);
    if (!stream || !stream.targetText) return;
    if (stream.revealedLen >= stream.targetText.length) return;

    stream.revealedLen = stream.targetText.length;
    this._updateAssistantMessage(sessionId, () => ({
      content: stream.targetText,
    }));
    this._persist(sessionId, forcePersist);
    this._notify(sessionId, 'state', this.getState(sessionId));
  }

  _startReveal(sessionId) {
    const stream = this._streams.get(sessionId);
    if (!stream || stream.revealTimer) return;

    stream.revealTimer = setInterval(() => {
      const active = this._streams.get(sessionId);
      if (!active) return;

      const target = active.targetText;
      if (active.revealedLen >= target.length) return;

      // Background tabs throttle timers; write full text immediately instead.
      if (typeof document !== 'undefined' && document.hidden) {
        this._catchUpReveal(sessionId);
        return;
      }

      const remaining = target.length - active.revealedLen;
      const speed = remaining > 300 ? 3 : remaining > 100 ? 2 : 1;
      active.revealedLen = Math.min(active.revealedLen + speed, target.length);
      const revealed = target.slice(0, active.revealedLen);

      this._updateAssistantMessage(sessionId, () => ({ content: revealed }));
      this._persist(sessionId);
      this._notify(sessionId, 'state', this.getState(sessionId));
    }, REVEAL_INTERVAL_MS);
  }

  _stopReveal(sessionId) {
    const stream = this._streams.get(sessionId);
    if (!stream?.revealTimer) return;
    clearInterval(stream.revealTimer);
    stream.revealTimer = null;
  }

  _waitForReveal(sessionId) {
    return new Promise((resolve) => {
      const check = () => {
        const stream = this._streams.get(sessionId);
        if (!stream || stream.revealedLen >= stream.targetText.length) {
          clearInterval(timer);
          resolve();
        }
      };
      const timer = setInterval(check, REVEAL_INTERVAL_MS);
      check();
    });
  }

  _finalizeStream(sessionId) {
    const stream = this._streams.get(sessionId);
    if (!stream) return;
    this._stopReveal(sessionId);
    stream.isTyping = false;
    stream.isStreaming = false;
    this._streams.delete(sessionId);
    this._notify(sessionId, 'state', null);
  }

  abortStream(sessionId) {
    const stream = this._streams.get(sessionId);
    if (!stream) return;
    stream.abortController.abort();
    this._stopReveal(sessionId);
    this._persist(sessionId, true);
  }

  async startStream({
    sessionId,
    message,
    mode,
    clientMessageId,
    attachments,
    initialMessages,
    assistantMessageId,
  }) {
    if (!sessionId) return;

    // Only one in-flight stream per session.
    if (this.isActive(sessionId)) {
      this.abortStream(sessionId);
    }

    const assistantMessage = {
      id: assistantMessageId,
      content: '',
      isUser: false,
      timestamp: new Date().toISOString(),
      isTypingStream: true,
    };

    const stream = {
      sessionId,
      assistantMessageId,
      abortController: new AbortController(),
      targetText: '',
      revealedLen: 0,
      isTyping: true,
      isStreaming: true,
      messages: [...initialMessages, assistantMessage],
      revealTimer: null,
      lastSaveAt: 0,
      startTime: performance.now(),
      meta: null,
    };

    this._streams.set(sessionId, stream);
    this._persist(sessionId, true);
    this._notify(sessionId, 'state', this.getState(sessionId));
    this._startReveal(sessionId);

    try {
      const streamResult = await APIService.sendChatMessage(
        sessionId,
        message,
        (fullText) => {
          const active = this._streams.get(sessionId);
          if (!active) return;
          active.isTyping = false;
          active.targetText = fullText;
          if (typeof document !== 'undefined' && document.hidden) {
            this._catchUpReveal(sessionId);
          }
          this._notify(sessionId, 'state', this.getState(sessionId));
        },
        stream.abortController.signal,
        mode,
        {
          clientMessageId,
          attachments,
          onMeta: (meta) => {
            const active = this._streams.get(sessionId);
            if (active) active.meta = meta;
          },
        },
      );

      await this._waitForReveal(sessionId);

      const active = this._streams.get(sessionId);
      if (!active) return;

      const elapsed = ((performance.now() - active.startTime) / 1000).toFixed(1);
      const finalText = (active.targetText || '').trim();
      const streamError = streamResult?.error;
      const isEmpty = !finalText && !streamError;

      if (streamError || isEmpty) {
        const errorBody = streamError
          ? `The model didn't finish the response.\n\n**Server said:** ${streamError}\n\nPlease try again — if it keeps failing, the prompt may be too long or the upstream provider is having issues.`
          : `The model returned an empty response.\n\nThis usually means the prompt was too long for the selected model's context window, an upstream provider hit a rate limit, or a tool call timed out on the backend.\n\nTry shortening your message, switching modes, or sending again.`;

        active.messages = active.messages.map((msg) =>
          msg.id === active.assistantMessageId
            ? {
                ...msg,
                content: errorBody,
                isTypingStream: false,
                responseTime: elapsed,
                meta: active.meta || undefined,
                isError: true,
              }
            : msg,
        );
      } else {
        active.messages = active.messages.map((msg) =>
          msg.id === active.assistantMessageId
            ? {
                ...msg,
                content: active.targetText,
                isTypingStream: false,
                responseTime: elapsed,
                meta: active.meta || undefined,
              }
            : msg,
        );
      }

      saveMessages(sessionId, active.messages);
      this._notify(sessionId, 'complete', { messages: active.messages, sessionId });
    } catch (error) {
      const active = this._streams.get(sessionId);
      if (!active) return;

      if (error.name === 'AbortError') {
        active.messages = active.messages.map((msg) =>
          msg.id === active.assistantMessageId
            ? {
                ...msg,
                content: active.targetText || msg.content || '',
                isTypingStream: false,
              }
            : msg,
        );
        saveMessages(sessionId, active.messages);
        this._notify(sessionId, 'complete', { messages: active.messages, sessionId, aborted: true });
        return;
      }

      const errContent =
        error.status === 502
          ? 'AI service is currently unavailable. Please try again later.'
          : 'Error sending message. Please try again.';

      active.messages = [
        ...active.messages.filter((m) => m.id !== active.assistantMessageId),
        {
          id: Date.now() + 2,
          content: errContent,
          isUser: false,
          timestamp: new Date().toISOString(),
          isTypingStream: false,
        },
      ];
      saveMessages(sessionId, active.messages);
      this._notify(sessionId, 'error', { error, messages: active.messages, sessionId });
    } finally {
      this._finalizeStream(sessionId);
    }
  }
}

export const chatStreamManager = new ChatStreamManager();
export { loadMessages, saveMessages };
