import { api } from '../core/api-client.js';

export class BookmarkApi {
  constructor(client = api) {
    this.client = client;
  }

  list(workspaceId, filter = {}) {
    return this.client.get(`/workspaces/${workspaceId}/bookmarks${this.#query(filter)}`);
  }

  create(workspaceId, data) {
    return this.client.post(`/workspaces/${workspaceId}/bookmarks`, data);
  }

  update(workspaceId, bookmarkId, data) {
    return this.client.patch(`/workspaces/${workspaceId}/bookmarks/${bookmarkId}`, data);
  }

  remove(workspaceId, bookmarkId) {
    return this.client.delete(`/workspaces/${workspaceId}/bookmarks/${bookmarkId}`);
  }

  #query(filter) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    }

    return query.toString() === '' ? '' : `?${query.toString()}`;
  }
}

export const bookmarkApi = new BookmarkApi();
