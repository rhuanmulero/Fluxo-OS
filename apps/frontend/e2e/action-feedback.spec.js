import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  inviteMember,
  joinWorkspaceAsMember,
  setNavigationPlacement,
} from './support/shell.js';

const DELAY_MS = 900;

async function slowDown(page, pattern, method) {
  await page.route(pattern, async (route) => {
    if (route.request().method() === method) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }

    await route.continue();
  });
}

async function seedProject(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);
  const project = await createProject(page, workspace.id, `Projeto ${label}`);

  await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
  await setNavigationPlacement(page, { dock: 'bottom' });
  await enterWorkspace(page);

  return { workspace, project };
}

async function createTask(page, projectId, title) {
  const columns = await apiRequest(page, 'GET', `/projects/${projectId}/columns`);

  return apiRequest(page, 'POST', `/projects/${projectId}/tasks`, {
    title,
    kanbanColumnId: columns[0].id,
    priority: 'MEDIUM',
    type: 'FEATURE',
  });
}

async function assertPending(control) {
  await expect(control).toHaveAttribute('aria-busy', 'true');
  await expect(control.locator('.btn-spinner')).toBeVisible();
}

test.describe('Varredura de feedback de acao', () => {
  test('em Tarefas, concluir e fixar mostram o botao pendente', async ({ page }) => {
    const { project } = await seedProject(page, 'j12-task-actions');
    await createTask(page, project.id, 'Demanda J12');

    await gotoRoute(page, 'tasks');
    await expect(page.locator('.task-row')).toHaveCount(1);

    await slowDown(page, '**/api/projects/*/tasks/*/move', 'PATCH');
    await page.locator('.btn-toggle-status').first().click();
    await assertPending(page.locator('.btn-toggle-status').first());
    await expect(page.locator('.task-row.is-done')).toHaveCount(1);

    await slowDown(page, '**/api/projects/*/tasks/*', 'PATCH');
    await page.locator('.btn-pin').first().click();
    await assertPending(page.locator('.btn-pin').first());
    await expect(page.locator('.btn-pin.pinned')).toHaveCount(1);
  });

  test('a aba Membros do projeto mostra o giro enquanto busca a lista', async ({ page }) => {
    const { project } = await seedProject(page, 'j12-members');

    await gotoRoute(page, 'tasks');
    await slowDown(page, `**/api/projects/${project.id}/members`, 'GET');

    await page.locator('.project-edit').first().click();
    await expect(page.locator('#modal-new-project')).toHaveClass(/active/);

    await page.locator('.modal-tab[data-tab="members"]').click();

    await expect(page.locator('#project-member-list > .region-loader')).toBeVisible();
    await expect(page.locator('#project-member-list.is-loading')).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.locator('.project-member-row')).toHaveCount(1);
  });

  test('no Kanban, fixar e excluir coluna mostram o botao pendente', async ({ page }) => {
    const { project } = await seedProject(page, 'j12-kanban');
    await createTask(page, project.id, 'Card J12');

    await gotoRoute(page, 'kanban');
    await expect(page.locator('.kanban-card')).toHaveCount(1);

    await slowDown(page, '**/api/projects/*/tasks/*', 'PATCH');
    await page.locator('.btn-pin-task').first().click();
    await assertPending(page.locator('.btn-pin-task').first());
    await expect(page.locator('.btn-pin-task.pinned')).toHaveCount(1);

    await slowDown(page, '**/api/projects/*/columns/*', 'DELETE');
    const deleteColumn = page.locator('.btn-delete-col').last();
    await deleteColumn.click();
    await assertPending(page.locator('.btn-delete-col').last());
  });

  test('arrastar um card mostra que ele esta indo e recarrega o quadro', async ({ page }) => {
    const { project } = await seedProject(page, 'j12-drag');
    const task = await createTask(page, project.id, 'Card Arrastado');

    await gotoRoute(page, 'kanban');

    const card = page.locator(`.kanban-card[data-id="${task.id}"]`);
    await expect(card).toBeVisible();

    await slowDown(page, '**/api/projects/*/tasks/*/move', 'PATCH');

    const columns = await apiRequest(page, 'GET', `/projects/${project.id}/columns`);
    const targetId = columns[1].id;

    await page.evaluate(
      ({ taskId, columnId }) => {
        const source = document.querySelector(`.kanban-card[data-id="${taskId}"]`);
        const zone = document.querySelector(`.drop-zone[data-column-id="${columnId}"]`);
        const transfer = new DataTransfer();

        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
        transfer.setData('text/plain', taskId);
        zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
      },
      { taskId: task.id, columnId: targetId },
    );

    await expect(page.locator(`.kanban-card[data-id="${task.id}"]`)).toHaveClass(/is-saving/);

    await expect(
      page.locator(`.drop-zone[data-column-id="${targetId}"] .kanban-card[data-id="${task.id}"]`),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('em Notas, fixar mostra o botao pendente', async ({ page }) => {
    await signUp(page, newAccount('j12-notes'));
    const workspace = await createWorkspace(page, 'Workspace J12 Notas');

    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
      title: 'Nota J12',
      body: 'corpo',
    });

    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    await slowDown(page, '**/api/workspaces/*/notes/*', 'PATCH');

    await page.locator('.btn-pin-note').first().click();
    await assertPending(page.locator('.btn-pin-note').first());
    await expect(page.locator('.btn-pin-note.pinned')).toHaveCount(1);
  });

  test('marcar um dia de habito mostra que a marcacao esta indo', async ({ page }) => {
    await signUp(page, newAccount('j12-habit'));
    const workspace = await createWorkspace(page, 'Workspace J12 Habito');

    const habit = await apiRequest(page, 'POST', `/workspaces/${workspace.id}/habits`, {
      name: 'Habito J12',
    });

    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);
    await gotoRoute(page, 'routine');
    await page.locator('.routine-tab[data-tab="habits"]').click();

    const day = page.locator(`.habit-row[data-id="${habit.id}"] .habit-day`).last();
    await expect(day).toBeVisible();

    await slowDown(page, '**/api/workspaces/*/habits/*/logs/*', 'PUT');
    await day.click();

    await expect(day).toHaveClass(/is-saving/);
    await expect(day).not.toHaveClass(/is-saving/, { timeout: 15_000 });
    await expect(day).toHaveClass(/is-done/);
  });

  test('as secoes de Configuracoes mostram o giro enquanto carregam a lista', async ({
    page,
    browser,
  }) => {
    await signUp(page, newAccount('j12-settings'));
    const workspace = await createWorkspace(page, 'Workspace J12 Config');
    const project = await createProject(page, workspace.id, 'Projeto J12 Config');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signUp(memberPage, newAccount('j12-settings-member'));
    await joinWorkspaceAsMember(memberPage, code, workspace.id);
    await memberContext.close();

    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);

    await slowDown(page, '**/api/workspaces/*/members', 'GET');
    await slowDown(page, '**/api/workspaces/*/invites', 'GET');
    await slowDown(page, '**/api/projects/*/module-settings', 'GET');

    await page.keyboard.press('Alt+Comma');
    await expect(page.locator('.settings-overlay')).toHaveClass(/active/);

    await page.locator('.settings-rail-item[data-section="members"]').click();
    await expect(page.locator('#member-list > .region-loader')).toBeVisible();
    await expect(page.locator('#member-list.is-loading')).toHaveCount(0, { timeout: 15_000 });

    await page.locator('.settings-rail-item[data-section="invites"]').click();
    await expect(page.locator('#invite-list > .region-loader')).toBeVisible();
    await expect(page.locator('#invite-list.is-loading')).toHaveCount(0, { timeout: 15_000 });

    await page.locator('.settings-rail-item[data-section="governance"]').click();
    await expect(page.locator('#governance-list > .region-loader')).toBeVisible();
    await expect(page.locator('#governance-list.is-loading')).toHaveCount(0, { timeout: 15_000 });
  });

  test('nenhuma pagina fica sem PendingButton ou RegionLoader nas acoes de API', async ({
    page,
  }) => {
    await signUp(page, newAccount('j12-audit'));
    await createWorkspace(page, 'Workspace J12 Auditoria');
    await enterWorkspace(page);

    const sources = await page.evaluate(async () => {
      const files = [
        'tasks.js',
        'kanban.js',
        'notes.js',
        'roadmap.js',
        'routine.js',
        'team.js',
        'playground.js',
        'pomodoro.js',
        'knowledge/snippets-panel.js',
        'knowledge/documents-panel.js',
        'knowledge/bookmarks-panel.js',
      ];

      const result = {};

      for (const file of files) {
        const response = await fetch(`/src/pages/${file}`);

        result[file] = await response.text();
      }

      return result;
    });

    for (const [file, source] of Object.entries(sources)) {
      expect(source, `${file} usa PendingButton ou regionLoader`).toMatch(
        /new PendingButton|regionLoader\.during/,
      );
    }
  });
});
