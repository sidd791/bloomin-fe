function resolveWsUrl(envUrl) {
  if (!envUrl) return 'ws://127.0.0.1:18789';
  if (envUrl.startsWith('ws://') || envUrl.startsWith('wss://')) return envUrl;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${envUrl}`;
}

export const GATEWAY_WS_URL = resolveWsUrl(import.meta.env.VITE_GATEWAY_WS_URL);
export const GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN || '';
