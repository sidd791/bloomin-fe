import { apiClient } from './api-client';

function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) {
      v.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== '') {
          usp.append(k, String(entry));
        }
      });
    } else {
      usp.set(k, String(v));
    }
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const CostService = {
  // Self (any logged-in user)
  getMySummary(params = {}) {
    return apiClient.get(`/cost/me/summary${buildQuery(params)}`);
  },
  getMyEvents(params = {}) {
    return apiClient.get(`/cost/me/events${buildQuery(params)}`);
  },
  getMyTurn(turnId) {
    return apiClient.get(`/cost/me/turns/${turnId}`);
  },
  getModels() {
    return apiClient.get('/cost/models');
  },

  // Admin only
  getSummary(params = {}) {
    return apiClient.get(`/cost/summary${buildQuery(params)}`);
  },
  getTimeseries(params = {}) {
    return apiClient.get(`/cost/timeseries${buildQuery(params)}`);
  },
  getEvents(params = {}) {
    return apiClient.get(`/cost/events${buildQuery(params)}`);
  },
  getUsers(params = {}) {
    return apiClient.get(`/cost/users${buildQuery(params)}`);
  },
  getUserSummary(userId, params = {}) {
    return apiClient.get(`/cost/users/${userId}/summary${buildQuery(params)}`);
  },
  getUserSessions(userId, params = {}) {
    return apiClient.get(`/cost/users/${userId}/sessions${buildQuery(params)}`);
  },
  getReconciliation(params = {}) {
    return apiClient.get(`/cost/reconciliation${buildQuery(params)}`);
  },
  syncSlackUsers() {
    return apiClient.post('/cost/sync-slack-users', {});
  },
};
