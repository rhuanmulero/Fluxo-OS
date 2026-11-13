import { session } from './session-store.js';

function preferenceKey(projectId) {
  return projectId && session.user?.id
    ? `fluxo_nami_project_context:${session.user.id}:${projectId}`
    : null;
}

export function includesProjectContext(projectId) {
  const key = preferenceKey(projectId);
  return key !== null && localStorage.getItem(key) === 'true';
}

export function setProjectContextPreference(projectId, enabled) {
  const key = preferenceKey(projectId);
  if (!key) return;
  if (enabled) localStorage.setItem(key, 'true');
  else localStorage.removeItem(key);
}
