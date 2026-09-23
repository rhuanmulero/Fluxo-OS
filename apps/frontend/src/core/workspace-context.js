import { projectApi } from '../api/project-api.js';
import { workspaceApi } from '../api/workspace-api.js';
import { session } from './session-store.js';

const ACTIVE_WORKSPACE = 'fluxo_active_workspace';
const ACTIVE_PROJECT = 'fluxo_active_project';

export class WorkspaceContext {
  #workspace = null;
  #projects = [];
  #projectId = null;
  #role = null;
  #listeners = new Set();

  get workspaceId() {
    return sessionStorage.getItem(ACTIVE_WORKSPACE);
  }

  get workspaceName() {
    return this.#workspace?.name ?? '';
  }

  get projects() {
    return this.#projects;
  }

  get role() {
    return this.#role;
  }

  get isAdmin() {
    return ['OWNER', 'SUPERADMIN', 'ADMIN'].includes(this.#role);
  }

  get isSuperadmin() {
    return ['OWNER', 'SUPERADMIN'].includes(this.#role);
  }

  get isOwner() {
    return this.#role === 'OWNER';
  }

  get projectId() {
    return this.#projectId;
  }

  get project() {
    return this.#projects.find((project) => project.id === this.#projectId) ?? null;
  }

  async load() {
    if (!this.workspaceId) {
      window.location.replace('/workspace.html');
      return;
    }

    const [workspace, projects, members] = await Promise.all([
      workspaceApi.find(this.workspaceId),
      projectApi.list(this.workspaceId),
      workspaceApi.members(this.workspaceId),
    ]);

    this.#workspace = workspace;
    this.#projects = projects;
    this.#role = members.find((member) => member.userId === session.user?.id)?.role ?? null;

    const remembered = sessionStorage.getItem(ACTIVE_PROJECT);
    const known = this.#projects.some((project) => project.id === remembered);

    this.#projectId = known ? remembered : (this.#projects[0]?.id ?? null);
    this.#notify();
  }

  reload() {
    return this.load();
  }

  selectProject(projectId) {
    if (projectId === this.#projectId) {
      return;
    }

    this.#projectId = projectId;
    sessionStorage.setItem(ACTIVE_PROJECT, projectId);
    this.#notify();
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  clearActive() {
    sessionStorage.removeItem(ACTIVE_WORKSPACE);
    sessionStorage.removeItem(ACTIVE_PROJECT);
  }

  #notify() {
    for (const listener of this.#listeners) {
      listener(this);
    }
  }
}

export const workspaceContext = new WorkspaceContext();
