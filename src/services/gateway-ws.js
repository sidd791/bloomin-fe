import { GATEWAY_WS_URL, GATEWAY_TOKEN } from '../api';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const TICK_INTERVAL_MS = 15000;

class GatewayWsClient {
  constructor() {
    this._ws = null;
    this._connected = false;
    this._connecting = false;
    this._pendingRequests = new Map();
    this._reqCounter = 0;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._tickTimer = null;
    this._eventListeners = new Map();
  }

  get connected() {
    return this._connected;
  }

  connect() {
    if (this._connected || this._connecting) return;
    this._connecting = true;

    try {
      this._ws = new WebSocket(GATEWAY_WS_URL);
    } catch (err) {
      console.error('[GatewayWS] Failed to create WebSocket:', err);
      this._connecting = false;
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      // Gateway may send a connect.challenge first; we handle it in onmessage.
      // Some gateways accept connect without challenge on loopback.
    };

    this._ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        this._sendConnect(msg.payload?.nonce);
        return;
      }

      if (msg.type === 'res') {
        const pending = this._pendingRequests.get(msg.id);
        if (pending) {
          this._pendingRequests.delete(msg.id);
          if (msg.ok) {
            pending.resolve(msg.payload);
          } else {
            pending.reject(new Error(msg.error?.message || 'RPC error'));
          }
        }

        if (msg.payload?.type === 'hello-ok') {
          this._onConnected(msg.payload);
        }
        return;
      }

      if (msg.type === 'event') {
        this._dispatchEvent(msg.event, msg.payload);
      }
    };

    this._ws.onclose = () => {
      this._onDisconnected();
    };

    this._ws.onerror = (err) => {
      console.error('[GatewayWS] WebSocket error:', err);
    };

    // If no challenge arrives within 2s, try sending connect directly (loopback mode)
    setTimeout(() => {
      if (this._connecting && !this._connected) {
        this._sendConnect();
      }
    }, 2000);
  }

  _sendConnect(nonce) {
    const connectReq = {
      type: 'req',
      id: this._nextId(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control-ui',
          version: '2026.3.28',
          platform: 'web',
          mode: 'webchat',
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: GATEWAY_TOKEN },
        locale: navigator.language || 'en-US',
        userAgent: 'openclaw-control-ui/2026.3.28',
      },
    };

    this._pendingRequests.set(connectReq.id, {
      resolve: (payload) => {
        if (payload?.type === 'hello-ok') {
          this._onConnected(payload);
        }
      },
      reject: (err) => {
        console.error('[GatewayWS] Connect rejected:', err);
        this._connecting = false;
        this._scheduleReconnect();
      },
    });

    this._wsSend(connectReq);
  }

  _onConnected(payload) {
    this._connected = true;
    this._connecting = false;
    this._reconnectAttempt = 0;
    console.log('[GatewayWS] Connected to OpenClaw Gateway');

    const tickMs = payload?.policy?.tickIntervalMs || TICK_INTERVAL_MS;
    this._startTick(tickMs);
    this._dispatchEvent('_connected', payload);
  }

  _onDisconnected() {
    const wasConnected = this._connected;
    this._connected = false;
    this._connecting = false;
    this._stopTick();

    for (const [, pending] of this._pendingRequests) {
      pending.reject(new Error('WebSocket disconnected'));
    }
    this._pendingRequests.clear();

    if (wasConnected) {
      console.log('[GatewayWS] Disconnected, scheduling reconnect');
    }
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this._reconnectAttempt, RECONNECT_MAX_MS);
    this._reconnectAttempt++;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, delay);
  }

  _startTick(intervalMs) {
    this._stopTick();
    this._tickTimer = setInterval(() => {
      if (this._connected) {
        this._wsSend({ type: 'event', event: 'tick', payload: {} });
      }
    }, intervalMs);
  }

  _stopTick() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
  }

  _nextId() {
    return `bloomin-${++this._reqCounter}-${Date.now()}`;
  }

  _wsSend(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
  }

  /**
   * Send an RPC request and return a promise for the response payload.
   */
  rpc(method, params = {}, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      if (!this._connected) {
        reject(new Error('Not connected to gateway'));
        return;
      }

      const id = this._nextId();
      const timer = setTimeout(() => {
        this._pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      this._pendingRequests.set(id, {
        resolve: (payload) => {
          clearTimeout(timer);
          resolve(payload);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this._wsSend({ type: 'req', id, method, params });
    });
  }

  on(event, listener) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event).add(listener);
    return () => this._eventListeners.get(event)?.delete(listener);
  }

  _dispatchEvent(event, payload) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      for (const fn of listeners) {
        try { fn(payload); } catch (e) { console.error('[GatewayWS] Event handler error:', e); }
      }
    }
  }

  // ─── Helpers ───

  _extractText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    const parts = Array.isArray(content) ? content : [content];
    return parts.map(p => (typeof p === 'string' ? p : p?.text || '')).join('');
  }

  // ─── Session & Chat RPCs ───

  async listSessions() {
    try {
      const result = await this.rpc('sessions.list');
      return result?.sessions || result || [];
    } catch (err) {
      console.error('[GatewayWS] sessions.list failed:', err);
      return [];
    }
  }

  async getChatHistory(sessionKey) {
    try {
      const result = await this.rpc('chat.history', { sessionKey });
      const entries = result?.messages || result?.history || result || [];
      return entries
        .filter(e => e.role === 'user' || e.role === 'assistant')
        .map((e, i) => ({
          id: e.id || `${sessionKey}-${i}`,
          content: this._extractText(e.content) || e.text || '',
          role: e.role,
          is_user: e.role === 'user',
          timestamp: e.timestamp || e.createdAt,
        }));
    } catch (err) {
      console.error('[GatewayWS] chat.history failed:', err);
      return [];
    }
  }

  async createSession(label) {
    try {
      const result = await this.rpc('sessions.create', { label });
      return result;
    } catch (err) {
      console.error('[GatewayWS] sessions.create failed:', err);
      return null;
    }
  }

  async deleteSession(sessionKey) {
    try {
      await this.rpc('sessions.delete', { sessionKey });
    } catch (err) {
      console.error('[GatewayWS] sessions.delete failed:', err);
      throw err;
    }
  }

  /**
   * Send a chat message via WS and stream back content via a callback.
   * `onDelta(text)` is called for each content chunk.
   * Returns a promise that resolves with the full response text when done.
   */
  sendChat(sessionKey, message, onDelta) {
    return new Promise((resolve, reject) => {
      if (!this._connected) {
        reject(new Error('Not connected to gateway'));
        return;
      }

      let fullContent = '';
      let runId = null;
      let settled = false;

      const cleanup = () => {
        unsubAgent?.();
        unsubChat?.();
        clearTimeout(timer);
      };

      const finish = (text) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(text);
      };

      const fail = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const timer = setTimeout(() => fail(new Error('chat.send timeout')), 120000);

      const extractText = (msg) => this._extractText(msg?.content);

      const unsubAgent = this.on('agent', (payload) => {
        if (runId && payload?.runId && payload.runId !== runId) return;

        if (payload?.stream === 'assistant') {
          const text = payload?.data?.text || '';
          if (text) {
            fullContent = text;
            onDelta?.(fullContent);
          }
        }

        if (payload?.stream === 'lifecycle' && payload?.data?.phase === 'end') {
          finish(fullContent);
        }
      });

      const unsubChat = this.on('chat', (payload) => {
        if (runId && payload?.runId && payload.runId !== runId) return;

        if (payload?.state === 'delta') {
          const text = extractText(payload?.message);
          if (text) {
            fullContent = text;
            onDelta?.(fullContent);
          }
        }

        if (payload?.state === 'final') {
          const text = extractText(payload?.message);
          if (text) {
            fullContent = text;
            onDelta?.(fullContent);
          }
          finish(fullContent);
        }
      });

      const idempotencyKey = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      this.rpc('chat.send', {
        sessionKey,
        message,
        idempotencyKey,
      }, 120000).then((ack) => {
        runId = ack?.runId;
        if (ack?.status === 'ok' && !fullContent) {
          // Non-streaming immediate response
          const text = ack?.content || ack?.text || '';
          if (text) {
            fullContent = text;
            onDelta?.(text);
          }
          finish(fullContent);
        }
      }).catch(fail);
    });
  }

  async abortChat(sessionKey) {
    try {
      await this.rpc('chat.abort', { sessionKey });
    } catch (err) {
      console.error('[GatewayWS] chat.abort failed:', err);
    }
  }

  disconnect() {
    this._stopTick();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
    this._connecting = false;
  }
}

export const gatewayWs = new GatewayWsClient();
