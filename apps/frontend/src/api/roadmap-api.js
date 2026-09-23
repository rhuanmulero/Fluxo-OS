import { api } from '../core/api-client.js';

export class RoadmapApi {
  constructor(client = api) {
    this.client = client;
  }

  list(projectId) {
    return this.client.get(`/projects/${projectId}/roadmaps`);
  }

  create(projectId, data) {
    return this.client.post(`/projects/${projectId}/roadmaps`, data);
  }

  update(projectId, roadmapId, data) {
    return this.client.patch(`/projects/${projectId}/roadmaps/${roadmapId}`, data);
  }

  remove(projectId, roadmapId) {
    return this.client.delete(`/projects/${projectId}/roadmaps/${roadmapId}`);
  }

  addStage(projectId, roadmapId, data) {
    return this.client.post(`/projects/${projectId}/roadmaps/${roadmapId}/stages`, data);
  }

  updateStage(projectId, roadmapId, stageId, data) {
    return this.client.patch(
      `/projects/${projectId}/roadmaps/${roadmapId}/stages/${stageId}`,
      data,
    );
  }

  removeStage(projectId, roadmapId, stageId) {
    return this.client.delete(
      `/projects/${projectId}/roadmaps/${roadmapId}/stages/${stageId}`,
    );
  }

  reorderStages(projectId, roadmapId, orderedIds) {
    return this.client.patch(
      `/projects/${projectId}/roadmaps/${roadmapId}/stages/order`,
      { orderedIds },
    );
  }
}

export const roadmapApi = new RoadmapApi();
