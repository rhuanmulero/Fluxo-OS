import { api } from '../core/api-client.js';

export const namiApi = {
  settings: () => api.get('/me/nami/settings'),
  saveSettings: data => api.put('/me/nami/settings', data),
  removeKey: () => api.delete('/me/nami/settings'),
  list: () => api.get('/me/nami/conversations'),
  conversation: id => api.get(`/me/nami/conversations/${encodeURIComponent(id)}`),
  remove: id => api.delete(`/me/nami/conversations/${encodeURIComponent(id)}`),
  send: data => api.post('/me/nami/messages', data),
};
