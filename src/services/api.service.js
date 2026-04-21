import { apiClient } from './api-client';

// Backend only accepts 'balanced' | 'thinking'. Silently migrate any stale
// 'fast' value (e.g. cached component state from an older build) to
// 'balanced' so existing sessions don't hit a 422 on next send.
function normalizeMode(mode) {
  if (mode === 'balanced' || mode === 'thinking') return mode;
  if (mode === 'fast') return 'balanced';
  return 'thinking';
}

export const APIService = {
  async getConversationsList() {
    const sessions = await apiClient.get('/chat/sessions');
    return sessions.map((s) => ({
      id: s.id,
      title: s.title || 'New conversation',
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  },

  async createSession(title) {
    return await apiClient.post('/chat/sessions', { title: title || null });
  },

  async deleteConversation(sessionId) {
    return await apiClient.delete(`/chat/sessions/${sessionId}`);
  },

  sendChatMessage(sessionId, content, onDelta, signal, mode = 'thinking') {
    return apiClient.streamPost(
      `/chat/sessions/${sessionId}/messages`,
      { content, stream: true, mode: normalizeMode(mode) },
      onDelta,
      signal,
    );
  },
};
