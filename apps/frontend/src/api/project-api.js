import { api } from '../core/api-client.js';

export class ProjectApi {
  constructor(client = api) {
    this.client = client;
  }

  list(workspaceId) {
    return this.client.get(`/workspaces/${workspaceId}/projects`);
  }

  create(workspaceId, data) {
    return this.client.post(`/workspaces/${workspaceId}/projects`, data);
  }

  moduleSettings(projectId) {
    return this.client.get(`/projects/${projectId}/module-settings`);
  }

  members(projectId) {
    return this.client.get(`/projects/${projectId}/members`);
  }

  find(projectId) {
    return this.client.get(`/projects/${projectId}`);
  }

  update(projectId, data) {
    return this.client.patch(`/projects/${projectId}`, data);
  }

  remove(projectId) {
    return this.client.delete(`/projects/${projectId}`);
  }

  addMember(projectId, userId) {
    return this.client.post(`/projects/${projectId}/members`, { userId });
  }

  removeMember(projectId, userId) {
    return this.client.delete(`/projects/${projectId}/members/${userId}`);
  }

  setGovernance(projectId, module, governance) {
    return this.client.patch(`/projects/${projectId}/module-settings/${module}`, {
      governance,
    });
  }
}

export const projectApi = new ProjectApi();
