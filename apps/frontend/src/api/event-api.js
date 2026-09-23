import { api } from '../core/api-client.js';

export class EventApi {
  constructor(client = api) {
    this.client = client;
  }

  list(workspaceId, filter = {}) {
    const query = new URLSearchParams(filter).toString();
    const suffix = query ? `?${query}` : '';

    return this.client.get(`/workspaces/${workspaceId}/events${suffix}`);
  }

  create(workspaceId, data) {
    return this.client.post(`/workspaces/${workspaceId}/events`, data);
  }

  update(workspaceId, eventId, data) {
    return this.client.patch(`/workspaces/${workspaceId}/events/${eventId}`, data);
  }

  setVisibility(workspaceId, eventId, visibility) {
    return this.client.patch(`/workspaces/${workspaceId}/events/${eventId}/visibility`, {
      visibility,
    });
  }

  remove(workspaceId, eventId) {
    return this.client.delete(`/workspaces/${workspaceId}/events/${eventId}`);
  }
}

export const eventApi = new EventApi();
