import { api } from '../core/api-client.js';

export class SnippetApi {
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

    return this.client.get(`/workspaces/${workspaceId}/snippets${suffix}`);
  }

  create(workspaceId, data) {
    return this.client.post(`/workspaces/${workspaceId}/snippets`, data);
  }

  update(workspaceId, snippetId, data) {
    return this.client.patch(`/workspaces/${workspaceId}/snippets/${snippetId}`, data);
  }

  remove(workspaceId, snippetId) {
    return this.client.delete(`/workspaces/${workspaceId}/snippets/${snippetId}`);
  }

  requestPublication(workspaceId, snippetId) {
    return this.client.post(
      `/workspaces/${workspaceId}/snippets/${snippetId}/publish-request`,
      {},
    );
  }

  review(workspaceId, snippetId, approve) {
    return this.client.post(`/workspaces/${workspaceId}/snippets/${snippetId}/review`, {
      approve,
    });
  }
}

export const snippetApi = new SnippetApi();
