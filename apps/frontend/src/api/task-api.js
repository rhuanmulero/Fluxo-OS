import { api } from '../core/api-client.js';

export class TaskApi {
  constructor(client = api) {
    this.client = client;
  }

  columns(projectId) {
    return this.client.get(`/projects/${projectId}/columns`);
  }

  list(projectId, filter = {}) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    }

    const suffix = query.toString() === '' ? '' : `?${query.toString()}`;

    return this.client.get(`/projects/${projectId}/tasks${suffix}`);
  }

  create(projectId, data) {
    return this.client.post(`/projects/${projectId}/tasks`, data);
  }

  update(projectId, taskId, data) {
    return this.client.patch(`/projects/${projectId}/tasks/${taskId}`, data);
  }

  remove(projectId, taskId) {
    return this.client.delete(`/projects/${projectId}/tasks/${taskId}`);
  }

  move(projectId, taskId, columnId, position) {
    return this.client.patch(`/projects/${projectId}/tasks/${taskId}/move`, {
      columnId,
      position,
    });
  }

  createColumn(projectId, data) {
    return this.client.post(`/projects/${projectId}/columns`, data);
  }

  updateColumn(projectId, columnId, data) {
    return this.client.patch(`/projects/${projectId}/columns/${columnId}`, data);
  }

  removeColumn(projectId, columnId) {
    return this.client.delete(`/projects/${projectId}/columns/${columnId}`);
  }

  reorderColumns(projectId, orderedIds) {
    return this.client.patch(`/projects/${projectId}/columns/order`, { orderedIds });
  }
}

export const taskApi = new TaskApi();
