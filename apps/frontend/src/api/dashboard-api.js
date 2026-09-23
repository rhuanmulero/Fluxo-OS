import { api } from '../core/api-client.js';

export class DashboardApi {
  constructor(client = api) {
    this.client = client;
  }

  of(workspaceId, projectId) {
    const suffix = projectId ? `?projectId=${projectId}` : '';
    return this.client.get(`/workspaces/${workspaceId}/dashboard${suffix}`);
  }
}

export const dashboardApi = new DashboardApi();
