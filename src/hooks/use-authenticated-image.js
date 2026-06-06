import { useState, useEffect } from 'react';
import { apiClient } from '../services/api-client';

/**
 * Loads an image URL, injecting the auth token for server-side URLs.
 * Blob/data URLs (local previews) are returned as-is without fetching.
 * Returns a stable objectURL string (or null while loading / on error).
 */
export function useAuthenticatedImage(url) {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      return;
    }

    // Local blob/data URLs don't need authentication — use them directly.
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setObjectUrl(url);
      return;
    }

    let cancelled = false;
    let created = null;

    const token = apiClient.getToken();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          created = URL.createObjectURL(blob);
          setObjectUrl(created);
        }
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  return objectUrl;
}
