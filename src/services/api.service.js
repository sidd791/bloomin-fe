import { gatewayWs } from './gateway-ws';

export const APIService = {

  async getConversationsList() {
    const sessions = await gatewayWs.listSessions();

    const mapped = sessions.map(s => ({
      id: s.sessionKey || s.key,
      title: s.label || s.title || '',
      created_at: s.createdAt || s.startedAt,
      updated_at: s.updatedAt || s.lastActivityAt,
    }));

    const needTitle = mapped.filter(c => !c.title);
    await Promise.all(
      needTitle.map(async (conv) => {
        try {
          const msgs = await gatewayWs.getChatHistory(conv.id);
          const firstUser = msgs.find(m => m.is_user);
          if (firstUser?.content) {
            const text = firstUser.content.trim();
            conv.title = text.length > 50 ? text.slice(0, 50) + '…' : text;
          }
        } catch { /* keep empty */ }
      })
    );

    for (const c of mapped) {
      if (!c.title) c.title = 'New conversation';
    }

    return mapped;
  },

  async getConversationHistory(sessionKey) {
    return await gatewayWs.getChatHistory(sessionKey);
  },

  async deleteConversation(sessionKey) {
    await gatewayWs.deleteSession(sessionKey);
  },

  /**
   * Send a chat message via WebSocket chat.send.
   * `onDelta` is called with each streamed content chunk.
   * Returns a promise that resolves with the full response text.
   */
  sendChatMessage(message, sessionKey, onDelta) {
    return gatewayWs.sendChat(sessionKey, message, onDelta);
  },

  async abortChat(sessionKey) {
    await gatewayWs.abortChat(sessionKey);
  },
};
