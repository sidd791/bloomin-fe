const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const headers = {
  'Accept': 'application/json',
  ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
};

async function request(path) {
  const resp = await fetch(`${API_BASE}${path}`, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  return resp.json();
}

export const HostingerService = {
  async listVMs() {
    return request('/hostinger/vms');
  },

  async getVM(vmId) {
    return request(`/hostinger/vms/${vmId}`);
  },

  async getMetrics(vmId, hours = 24) {
    return request(`/hostinger/vms/${vmId}/metrics?hours=${hours}`);
  },

  async listDockerProjects(vmId) {
    return request(`/hostinger/vms/${vmId}/docker`);
  },

  async getDockerContainers(vmId, projectName) {
    return request(`/hostinger/vms/${vmId}/docker/${encodeURIComponent(projectName)}/containers`);
  },

  async getDockerLogs(vmId, projectName) {
    return request(`/hostinger/vms/${vmId}/docker/${encodeURIComponent(projectName)}/logs`);
  },

  async getActions(vmId, page = 1) {
    return request(`/hostinger/vms/${vmId}/actions?page=${page}`);
  },
};
