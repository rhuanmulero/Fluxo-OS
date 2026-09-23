import { api } from '../core/api-client.js';

export class WorkspaceApi {
  constructor(client = api) {
    this.client = client;
  }

  list() {
    return this.client.get('/workspaces');
  }

  find(workspaceId) {
    return this.client.get(`/workspaces/${workspaceId}`);
  }

  create(name) {
    return this.client.post('/workspaces', { name });
  }

  acceptInvite(code) {
    return this.client.post(`/invites/${encodeURIComponent(code)}/accept`, {});
  }

  members(workspaceId) {
    return this.client.get(`/workspaces/${workspaceId}/members`);
  }

  me() {
    return this.client.get('/me');
  }

  stats() {
    return this.client.get('/me/stats');
  }

  updateProfile(data) {
    return this.client.patch('/me/profile', data);
  }

  rename(workspaceId, name) {
    return this.client.patch(`/workspaces/${workspaceId}`, { name });
  }

  remove(workspaceId) {
    return this.client.delete(`/workspaces/${workspaceId}`);
  }

  invites(workspaceId) {
    return this.client.get(`/workspaces/${workspaceId}/invites`);
  }

  createInvite(workspaceId, data) {
    return this.client.post(`/workspaces/${workspaceId}/invites`, data);
  }

  revokeInvite(workspaceId, inviteId) {
    return this.client.delete(`/workspaces/${workspaceId}/invites/${inviteId}`);
  }

  changeRole(workspaceId, userId, role) {
    return this.client.patch(`/workspaces/${workspaceId}/members/${userId}`, { role });
  }

  removeMember(workspaceId, userId) {
    return this.client.delete(`/workspaces/${workspaceId}/members/${userId}`);
  }

  setMemberActive(workspaceId, userId, active) {
    return this.client.patch(`/workspaces/${workspaceId}/members/${userId}/status`, { active });
  }
}

export const workspaceApi = new WorkspaceApi();
