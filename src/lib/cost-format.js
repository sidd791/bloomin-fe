// Formatting helpers for the cost dashboard.

export function formatMoney(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1) {
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return `$${n.toFixed(4)}`;
}

export function formatMoneyCompact(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function formatTokens(tokens) {
  if (tokens === null || tokens === undefined || Number.isNaN(tokens)) return '—';
  const n = Number(tokens);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatRatio(ratio01, digits = 1) {
  if (ratio01 === null || ratio01 === undefined || Number.isNaN(ratio01)) return '—';
  const n = Number(ratio01);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatLatency(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const n = Number(ms);
  if (!Number.isFinite(n)) return '—';
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(1)} s`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function computeDelta(current, prior) {
  if (prior === null || prior === undefined || Number.isNaN(prior) || prior === 0) {
    if (!current) return { pct: null, direction: 'flat' };
    return { pct: null, direction: 'new' };
  }
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  if (!Number.isFinite(pct)) return { pct: null, direction: 'new' };
  let direction = 'flat';
  if (Math.abs(pct) >= 0.5) direction = pct > 0 ? 'up' : 'down';
  return { pct, direction };
}

export function formatDelta({ pct, direction }) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% ${direction === 'up' ? '▲' : direction === 'down' ? '▼' : '·'}`;
}

export function rangeDurationMs(range, fromISO, toISO) {
  if (range === '24h') return 24 * 60 * 60 * 1000;
  if (range === '7d') return 7 * 24 * 60 * 60 * 1000;
  if (range === '30d') return 30 * 24 * 60 * 60 * 1000;
  if (range === 'custom' && fromISO && toISO) {
    const from = new Date(fromISO).getTime();
    const to = new Date(toISO).getTime();
    return Math.max(0, to - from);
  }
  return 7 * 24 * 60 * 60 * 1000;
}

export function priorRangeParams(range, fromISO, toISO) {
  const dur = rangeDurationMs(range, fromISO, toISO);
  const to = new Date(fromISO || Date.now() - dur).toISOString();
  const from = new Date(new Date(to).getTime() - dur).toISOString();
  return { range: 'custom', from, to };
}

export function modelLabel(modelId) {
  if (!modelId) return '—';
  const slash = modelId.indexOf('/');
  return slash >= 0 ? modelId.slice(slash + 1) : modelId;
}

export function isSystemUser(user) {
  if (!user) return false;
  if (!user.user_id) return true;
  const n = (user.name || '').toLowerCase();
  return n.includes('system') || n.includes('autonomous');
}

export function isEmbeddingModel(key) {
  if (!key) return false;
  const k = key.toLowerCase();
  return k.includes('embed') || k === 'default' || k === 'unknown';
}

export function filterChatModels(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.filter((r) => !isEmbeddingModel(r.key));
}

export function providerOf(modelId) {
  if (!modelId) return 'unknown';
  const slash = modelId.indexOf('/');
  return slash >= 0 ? modelId.slice(0, slash) : 'unknown';
}

export function providerColor(provider) {
  switch ((provider || '').toLowerCase()) {
    case 'openai':
      return '#10a37f';
    case 'anthropic':
      return '#d97757';
    case 'google':
      return '#4285f4';
    default:
      return '#a78bfa';
  }
}

// Categorical palette for charts (cycles)
export const CHART_PALETTE = [
  '#FF3CA0',
  '#7C3AED',
  '#10a37f',
  '#d97757',
  '#4285f4',
  '#f59e0b',
  '#0ea5e9',
  '#ef4444',
  '#84cc16',
  '#06b6d4',
];

export function colorForKey(key, idx = 0) {
  if (!key) return CHART_PALETTE[idx % CHART_PALETTE.length];
  if (typeof key === 'string') {
    if (key.startsWith('openai/') || key === 'openai') return providerColor('openai');
    if (key.startsWith('anthropic/') || key === 'anthropic') return providerColor('anthropic');
    if (key.startsWith('google/') || key === 'google') return providerColor('google');
  }
  // Stable hash so the same key always gets the same colour
  let h = 0;
  for (let i = 0; i < String(key).length; i += 1) {
    h = (h * 31 + String(key).charCodeAt(i)) | 0;
  }
  return CHART_PALETTE[Math.abs(h) % CHART_PALETTE.length];
}

const FRIENDLY_CHANNEL = {
  web: 'Web chat',
  slack: 'Slack',
  autonomous: 'Automated',
};

export function friendlyChannel(ch) {
  if (!ch) return 'Unknown';
  return FRIENDLY_CHANNEL[ch] || ch;
}

const FRIENDLY_MODE = {
  auto: 'Auto',
  thinking: 'Deep thinking',
  balanced: 'Balanced',
};

export function friendlyMode(mode) {
  if (!mode || mode === '(none)' || mode === 'null' || mode === 'none')
    return 'Standard';
  return FRIENDLY_MODE[mode] || mode;
}

export function heatColor(value) {
  if (!value || value <= 0) return 'oklch(0.94 0.005 280)';
  const v = Math.min(1, value);
  // pink -> hot pink ramp
  const lightness = 0.94 - v * 0.55;
  const chroma = 0.02 + v * 0.22;
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} 350)`;
}
