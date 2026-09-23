import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await createProject(page, workspace.id, 'Projeto do status');
  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Campo Status no formulario de tarefa', () => {
  test('em Tarefas o campo se chama Status', async ({ page }) => {
    await seed(page, 'k03-tarefas');
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-new-task').click();

    const group = page.locator('.task-drawer .form-group', { has: page.locator('#task-column') });

    await expect(group.locator('label')).toHaveText('Status');
  });

  test('em Kanban o campo se chama Status', async ({ page }) => {
    await seed(page, 'k03-kanban');
    await enterWorkspace(page);
    await gotoRoute(page, 'kanban');

    await page.locator('#btn-new-task').click();

    const group = page.locator('.task-drawer .form-group', {
      has: page.locator('#task-column-select'),
    });

    await expect(group.locator('label')).toHaveText('Status');
  });

  test('a administracao do quadro continua falando em coluna', async ({ page }) => {
    await seed(page, 'k03-quadro');
    await enterWorkspace(page);
    await gotoRoute(page, 'kanban');

    await expect(page.locator('#btn-add-column-card')).toContainText('Nova Coluna');
  });
});
