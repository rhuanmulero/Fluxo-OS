import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);
  const project = await createProject(page, workspace.id, 'Projeto do foco');

  await setNavigationPlacement(page, { dock: 'bottom' });

  return { workspace, project };
}

test.describe('Anel e tempo por demanda', () => {
  test('o anel existe e tem punho acessivel por teclado', async ({ page }) => {
    await seed(page, 'k16-anel');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    const handle = page.locator('#ring-handle');

    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute('role', 'slider');
    await expect(handle).toHaveAttribute('aria-valuenow', '25');
    await expect(handle).toHaveAttribute('aria-valuemin', '1');
    await expect(handle).toHaveAttribute('aria-valuemax', '120');
  });

  test('seta para cima aumenta um minuto e reflete no mostrador', async ({ page }) => {
    await seed(page, 'k16-teclado');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.locator('#ring-handle').focus();
    await page.keyboard.press('ArrowUp');

    await expect(page.locator('#time-display')).toHaveText('26:00');
    await expect(page.locator('#input-time-focus')).toHaveValue('26');
    await expect(page.locator('#ring-handle')).toHaveAttribute('aria-valuenow', '26');
  });

  test('com o timer rodando o punho nao aceita mudanca', async ({ page }) => {
    await seed(page, 'k16-travado');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.locator('#btn-toggle-timer').click();
    await page.locator('#ring-handle').focus();
    await page.keyboard.press('ArrowUp');

    await expect(page.locator('#ring-handle')).toHaveAttribute('aria-valuenow', '25');
    await expect(page.locator('#ring-handle')).toHaveAttribute('aria-disabled', 'true');
  });

  test('o tempo por demanda aparece em barras', async ({ page }) => {
    const { workspace, project } = await seed(page, 'k16-demanda');

    const columns = await apiRequest(page, 'GET', `/projects/${project.id}/columns`);
    const me = await apiRequest(page, 'GET', '/me');
    const task = await apiRequest(page, 'POST', `/projects/${project.id}/tasks`, {
      title: 'Demanda medida',
      kanbanColumnId: columns[0].id,
      assigneeId: me.id,
      priority: 'MEDIUM',
      type: 'FEATURE',
    });

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - 30 * 60_000);

    await apiRequest(page, 'POST', '/pomodoro/sessions', {
      mode: 'FOCUS',
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes: 30,
      projectId: project.id,
      taskId: task.id,
    });

    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    const row = page.locator('.pomo-task-time-row', { hasText: 'Demanda medida' });

    await expect(row).toBeVisible();
    await expect(row).toContainText('30m');
    await expect(row.locator('.pomo-task-time-fill')).toHaveCSS('width', /\d/);
  });
});
