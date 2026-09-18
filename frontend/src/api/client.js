const BASE = import.meta.env.VITE_API_URL ?? '/api';

export const apiBase = BASE;

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
    ...(body ? { body } : {}),
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? `Permintaan gagal (${response.status}).`);
  }
  return data;
}

export const api = {
  getMeta: () => request('/meta/fields'),

  listSales: () => request('/sales'),

  runReport: (config) => request('/reports', { method: 'POST', body: JSON.stringify(config) }),

  exportCsv: async (config) => {
    const response = await fetch(`${BASE}/reports/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? 'Export CSV gagal.');
    }
    return response.blob();
  },

  saved: {
    list: () => request('/reports/saved'),
    create: (payload) => request('/reports/saved', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/reports/saved/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    remove: (id) => request(`/reports/saved/${id}`, { method: 'DELETE' }),
  },

  colors: {
    list: () => request('/colors'),
    save: (colors) => request('/colors', { method: 'PUT', body: JSON.stringify({ colors }) }),
  },

  tableStyles: {
    list: () => request('/table-styles'),
    save: (styles) => request('/table-styles', { method: 'PUT', body: JSON.stringify({ styles }) }),
  },
};
