import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

const ROUTE_CHECKS = [
  { id: 'playground', code: 'Digit1', selector: '.playground-area' },
  { id: 'tasks', code: 'Digit2', selector: '.tasks-container' },
  { id: 'kanban', code: 'Digit3', selector: '.kanban-wrapper' },
  { id: 'notes', code: 'Digit4', selector: '#btn-new-note' },
  { id: 'knowledge', code: 'Digit5', selector: '.knowledge-tab[data-tab="snippets"]' },
  { id: 'pomodoro', code: 'Digit6', selector: '#time-display' },
  { id: 'team', code: 'Digit9', selector: '.team-container' },
];

async function apiPost(page, path, body) {
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(`/api${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Falha em POST ${path}: ${response.status} ${await response.text()}`);
      }

      return response.json();
    },
    { path, body },
  );
}

async function enterWorkspace(page, workspaceName) {
  const workspace = await apiPost(page, '/workspaces', { name: workspaceName });

  await page.evaluate((workspaceId) => {
    sessionStorage.setItem('fluxo_active_workspace', workspaceId);
  }, workspace.id);

  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();

  return workspace;
}

async function assertRoute(page, routeId, selector) {
  await expect(page.locator(`[data-route="${routeId}"]`)).toHaveClass(/active/);
  await expect(page.locator(selector)).toBeVisible();
}

async function enterWorkspaceWithProject(page, workspaceName, projectName) {
  const workspace = await apiPost(page, '/workspaces', { name: workspaceName });
  await apiPost(page, `/workspaces/${workspace.id}/projects`, { name: projectName });

  await page.evaluate((workspaceId) => {
    sessionStorage.setItem('fluxo_active_workspace', workspaceId);
  }, workspace.id);

  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();

  return workspace;
}

async function openTaskDrawer(page) {
  await page.keyboard.press('Alt+Digit2');
  await assertRoute(page, 'tasks', '.tasks-container');

  await expect(page.locator('#btn-new-task')).toBeEnabled();
  await page.locator('#btn-new-task').click();
  await expect(page.locator('#task-drawer')).toHaveClass(/active/);
}

test.describe('Atalhos de teclado', () => {
  test('Alt+1 ate Alt+6 navegam para as seis paginas e Alt+9 abre a Guilda', async ({ page }) => {
    const account = newAccount('shortcuts-happy');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Atalhos');

    await assertRoute(page, 'playground', '.playground-area');

    for (const route of ROUTE_CHECKS) {
      await page.keyboard.press(`Alt+${route.code}`);
      await assertRoute(page, route.id, route.selector);

      for (const other of ROUTE_CHECKS) {
        if (other.id === route.id) continue;
        await expect(page.locator(`[data-route="${other.id}"]`)).not.toHaveClass(/active/);
      }
    }
  });

  test('Alt+7 e Alt+8 navegam para Rotina e Metas e Alt+0 nao faz nada porque nao existe rota registrada para ele', async ({
    page,
  }) => {
    const account = newAccount('shortcuts-unbound');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Atalhos Sem Rota');

    await page.keyboard.press('Alt+Digit9');
    await assertRoute(page, 'team', '.team-container');

    await page.keyboard.press('Alt+Digit7');
    await assertRoute(page, 'routine', '.routine-container');

    await page.keyboard.press('Alt+Digit8');
    await assertRoute(page, 'roadmap', '.roadmap-container');

    await page.keyboard.press('Alt+Digit0');
    await assertRoute(page, 'roadmap', '.roadmap-container');
  });

  test('foco em campo de texto, select ou editor rich-text bloqueia os atalhos', async ({
    page,
  }) => {
    const account = newAccount('shortcuts-typing-guard');
    await signUp(page, account);
    await enterWorkspaceWithProject(page, 'Workspace Atalhos Digitando', 'Projeto Atalhos');

    await openTaskDrawer(page);

    const titleField = page.locator('#task-title');
    await expect(titleField).toBeFocused();

    await titleField.focus();
    await page.keyboard.press('Alt+Digit3');

    await assertRoute(page, 'tasks', '.tasks-container');
    await expect(page.locator('[data-route="kanban"]')).not.toHaveClass(/active/);
    await expect(titleField).toBeFocused();
    await expect(page.locator('#task-drawer')).toHaveClass(/active/);

    const priorityField = page.locator('#task-priority .dropdown-trigger');
    await priorityField.focus();
    await page.keyboard.press('Alt+Digit4');

    await assertRoute(page, 'tasks', '.tasks-container');
    await expect(page.locator('[data-route="notes"]')).not.toHaveClass(/active/);
    await expect(priorityField).toBeFocused();
    await expect(page.locator('#task-drawer')).toHaveClass(/active/);

    const editorField = page.locator('#task-editor-mount .rt-editor');
    await editorField.focus();
    await page.keyboard.press('Alt+Digit1');

    await assertRoute(page, 'tasks', '.tasks-container');
    await expect(page.locator('[data-route="playground"]')).not.toHaveClass(/active/);
    await expect(editorField).toBeFocused();
    await expect(page.locator('#task-drawer')).toHaveClass(/active/);
  });

  test('Ctrl+Alt+1 nao faz nada', async ({ page }) => {
    const account = newAccount('shortcuts-ctrl-alt');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Atalhos Ctrl');

    await page.keyboard.press('Alt+Digit3');
    await assertRoute(page, 'kanban', '.kanban-wrapper');

    await page.keyboard.press('Control+Alt+Digit1');

    await assertRoute(page, 'kanban', '.kanban-wrapper');
    await expect(page.locator('[data-route="playground"]')).not.toHaveClass(/active/);
    await expect(page.locator('.playground-area')).toBeHidden();
  });

  test('o atalho mostrado na tooltip do menu e exatamente o que navega', async ({ page }) => {
    const account = newAccount('shortcuts-tooltip-match');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Atalhos Tooltip');

    const button = page.locator('[data-route="pomodoro"]');
    const tooltip = page.locator('.nav-tooltip');

    await page.clock.install();
    await button.hover();
    await page.clock.runFor(500);

    await expect(tooltip).toHaveClass(/visible/);
    const badgeText = await tooltip.locator('kbd').textContent();
    expect(badgeText).toBe('Alt+6');

    const digit = badgeText.split('+')[1];
    await page.mouse.move(700, 700);

    await page.keyboard.press(`Alt+Digit${digit}`);

    await assertRoute(page, 'pomodoro', '#time-display');
  });
});
