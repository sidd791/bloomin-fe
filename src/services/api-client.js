const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function getToken() {
  return localStorage.getItem('access_token');
}

function clearAuth() {
  localStorage.removeItem('access_token');
  window.dispatchEvent(new Event('auth-expired'));
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    throw new ApiError('Session expired', 401);
  }

  if (res.status === 502) {
    throw new ApiError('AI service unavailable. Please try again later.', 502);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail || `Request failed (${res.status})`, res.status, body);
  }

  return res.json();
}

async function streamPost(path, body, onChunk, signal, { onMeta } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (res.status === 401) {
    clearAuth();
    throw new ApiError('Session expired', 401);
  }

  if (res.status === 502) {
    throw new ApiError('AI service unavailable. Please try again later.', 502);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(
      errBody.detail || `Request failed (${res.status})`,
      res.status,
      errBody,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let meta = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          if (meta && onMeta) onMeta(meta);
          return { content: fullContent, meta };
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'meta') {
            meta = parsed;
            continue;
          }
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) {
            fullContent += chunk;
            onChunk(fullContent);
          }
        } catch { continue; }
      }
    }
  }

  if (meta && onMeta) onMeta(meta);
  return { content: fullContent, meta };
}

async function uploadFile(path, file, onProgress) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 401) {
        clearAuth();
        reject(new ApiError('Session expired', 401));
        return;
      }
      let body;
      try { body = JSON.parse(xhr.responseText); } catch { body = {}; }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        const msg = body?.error?.message || body?.detail || `Upload failed (${xhr.status})`;
        reject(new ApiError(msg, xhr.status, body));
      }
    });

    xhr.addEventListener('error', () => reject(new ApiError('Network error during upload', 0)));
    xhr.addEventListener('abort', () => reject(new ApiError('Upload cancelled', 0)));

    xhr.send(formData);
  });
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  streamPost,
  uploadFile,
  getToken,
  clearAuth,
  ApiError,
};
