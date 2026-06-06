import { apiClient } from './api-client';

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

  sendChatMessage(sessionId, content, onDelta, signal, mode = 'thinking', { clientMessageId, attachments, onMeta } = {}) {
    const body = { content, stream: true, mode: normalizeMode(mode) };
    if (clientMessageId) body.client_message_id = clientMessageId;
    if (attachments?.length) body.attachments = attachments;
    return apiClient.streamPost(
      `/chat/sessions/${sessionId}/messages`,
      body,
      onDelta,
      signal,
      { onMeta },
    );
  },

  uploadFile(file, onProgress) {
    return apiClient.uploadFile('/chat/upload', file, onProgress);
  },

  getUploadStatus(fileId) {
    return apiClient.get(`/chat/upload/${fileId}/status`);
  },

  deleteUpload(fileId) {
    return apiClient.delete(`/chat/upload/${fileId}`);
  },

  getSessionAttachments(sessionId) {
    return apiClient.get(`/chat/sessions/${sessionId}/attachments`);
  },

  getMyUsage(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/usage/me${query ? `?${query}` : ''}`);
  },

  getSessionUsage(sessionId) {
    return apiClient.get(`/usage/me/sessions/${sessionId}`);
  },

  getUsageSummary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/usage/summary${query ? `?${query}` : ''}`);
  },
};
