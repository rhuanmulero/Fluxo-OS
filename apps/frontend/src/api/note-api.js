import { api } from '../core/api-client.js';

export class NoteApi {
  constructor(client = api) {
    this.client = client;
  }

  list(workspaceId, filter = {}) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    }

    const suffix = query.toString() === '' ? '' : `?${query.toString()}`;

    return this.client.get(`/workspaces/${workspaceId}/notes${suffix}`);
  }

  create(workspaceId, data) {
    return this.client.post(`/workspaces/${workspaceId}/notes`, data);
  }

  update(workspaceId, noteId, data) {
    return this.client.patch(`/workspaces/${workspaceId}/notes/${noteId}`, data);
  }

  remove(workspaceId, noteId) {
    return this.client.delete(`/workspaces/${workspaceId}/notes/${noteId}`);
  }

  setVisibility(workspaceId, noteId, visibility) {
    return this.client.patch(`/workspaces/${workspaceId}/notes/${noteId}/visibility`, {
      visibility,
    });
  }
}

export const noteApi = new NoteApi();
