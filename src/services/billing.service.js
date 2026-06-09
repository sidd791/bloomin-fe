import { apiClient } from './api-client';

function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const BillingService = {
  getProviders() {
    return apiClient.get('/billing/providers');
  },
  getUsage(params = {}) {
    return apiClient.get(`/billing/usage${buildQuery(params)}`);
  },
  getTimeseries(params = {}) {
    return apiClient.get(`/billing/timeseries${buildQuery(params)}`);
  },
};
