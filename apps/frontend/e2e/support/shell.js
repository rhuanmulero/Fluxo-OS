import { expect } from '@playwright/test';

export async function apiRequest(page, method, path, body) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`${method} ${path} falhou: ${response.status} ${text}`);
      }

      return text === '' ? null : JSON.parse(text);
    },
    { method, path, body },
  );
}

export async function createWorkspace(page, name) {
  const workspace = await apiRequest(page, 'POST', '/workspaces', { name });

  await page.evaluate((id) => sessionStorage.setItem('fluxo_active_workspace', id), workspace.id);

  return workspace;
}

export async function createProject(page, workspaceId, name) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/projects`, {
    name,
    color: '#3b82f6',
  });
}

export async function inviteMember(page, workspaceId, role = 'MEMBER') {
  const invite = await apiRequest(page, 'POST', `/workspaces/${workspaceId}/invites`, { role });

  return invite.code;
}

export async function joinWorkspaceAsMember(page, code, workspaceId) {
  await apiRequest(page, 'POST', `/invites/${encodeURIComponent(code)}/accept`, {});
  await page.evaluate((id) => sessionStorage.setItem('fluxo_active_workspace', id), workspaceId);
}

export async function enterWorkspace(page) {
  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();
}

export async function gotoRoute(page, routeId) {
  await page.locator(`[data-route="${routeId}"]`).click();
}

export async function gotoKnowledgeTab(page, tab) {
  await gotoRoute(page, 'knowledge');
  await page.locator(`.knowledge-tab[data-tab="${tab}"]`).click();
}

export async function setNavigationPlacement(page, { mode = 'floating', dock = null } = {}) {
  await page.evaluate(
    ({ mode, dock }) => {
      localStorage.setItem('fluxo.nav.mode', mode);
      localStorage.removeItem('fluxo.nav.left');
      localStorage.removeItem('fluxo.nav.top');

      if (dock === null) {
        localStorage.removeItem('fluxo.nav.edge');
      } else {
        localStorage.setItem('fluxo.nav.edge', dock);
      }
    },
    { mode, dock },
  );
}

export async function zIndexOf(page, selector) {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);

    return Number.parseInt(window.getComputedStyle(element).zIndex, 10);
  }, selector);
}

export async function assertPendingWithSpinner(button) {
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('.btn-spinner')).toBeVisible();
}

export async function doubleClick(page, selector) {
  await page.evaluate((sel) => {
    const button = document.querySelector(sel);

    button.click();
    button.click();
  }, selector);
}

export function dropdownTrigger(scope, mountSelector) {
  return scope.locator(`${mountSelector} .dropdown-trigger`);
}

export async function chooseByValue(scope, mountSelector, value) {
  await scope.locator(`${mountSelector} .dropdown-trigger`).click();
  await scope.locator(`${mountSelector} .dropdown-option[data-value="${value}"]`).click();
}

export async function chooseByLabel(scope, mountSelector, label) {
  await scope.locator(`${mountSelector} .dropdown-trigger`).click();
  await scope
    .locator(`${mountSelector} .dropdown-option`)
    .filter({ hasText: label })
    .first()
    .click();
}
