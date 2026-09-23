import { api } from '../core/api-client.js';

export class DocumentApi {
  constructor(client = api) {
    this.client = client;
  }

  list(workspaceId, filter = {}) {
    return this.client.get(`/workspaces/${workspaceId}/documents${this.#query(filter)}`);
  }

  create(workspaceId, formData) {
    return this.client.postForm(`/workspaces/${workspaceId}/documents`, formData);
  }

  downloadUrl(workspaceId, documentId) {
    return `/api/workspaces/${workspaceId}/documents/${documentId}/download`;
  }

  update(workspaceId, documentId, data) {
    return this.client.patch(`/workspaces/${workspaceId}/documents/${documentId}`, data);
  }

  remove(workspaceId, documentId) {
    return this.client.delete(`/workspaces/${workspaceId}/documents/${documentId}`);
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

export const documentApi = new DocumentApi();
