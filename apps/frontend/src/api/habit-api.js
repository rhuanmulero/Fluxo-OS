import { api } from '../core/api-client.js';

export class HabitApi {
  constructor(client = api) {
    this.client = client;
  }

  list(workspaceId, includeArchived = false) {
    const suffix = includeArchived ? '?includeArchived=true' : '';

    return this.client.get(`/workspaces/${workspaceId}/habits${suffix}`);
  }

  create(workspaceId, data) {
    return this.client.post(`/workspaces/${workspaceId}/habits`, data);
  }

  update(workspaceId, habitId, data) {
    return this.client.patch(`/workspaces/${workspaceId}/habits/${habitId}`, data);
  }

  remove(workspaceId, habitId) {
    return this.client.delete(`/workspaces/${workspaceId}/habits/${habitId}`);
  }

  logs(workspaceId, habitId, from, to) {
    return this.client.get(
      `/workspaces/${workspaceId}/habits/${habitId}/logs?from=${from}&to=${to}`,
    );
  }

  mark(workspaceId, habitId, date) {
    return this.client.put(`/workspaces/${workspaceId}/habits/${habitId}/logs/${date}`, {});
  }

  unmark(workspaceId, habitId, date) {
    return this.client.delete(`/workspaces/${workspaceId}/habits/${habitId}/logs/${date}`);
  }
}

export const habitApi = new HabitApi();
