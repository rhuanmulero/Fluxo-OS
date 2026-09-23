import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function gotoSnippets(page) {
  await page.evaluate(() => {
    localStorage.setItem('fluxo.nav.edge', 'bottom');
    localStorage.removeItem('fluxo.nav.left');
    localStorage.removeItem('fluxo.nav.top');
  });
  await page.reload();
  await expect(page.locator('#global-bg')).toBeAttached();

  await page.locator('[data-route="knowledge"]').click();
  await page.locator('.knowledge-tab[data-tab="snippets"]').click();
  await expect(page.locator('.snippets-grid')).toBeVisible();
}

const DELAY_MS = 1200;

async function slowDown(page, pattern) {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    await route.continue();
  });
}

async function seed(page, label, name) {
  await signUp(page, newAccount(label));

  const workspace = await createWorkspace(page, name);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Carregamento visivel', () => {
  test('o Playground mostra o giro no painel enquanto o dashboard carrega', async ({ page }) => {
    await seed(page, 'j03-playground', 'Workspace J03 Playground');
    await slowDown(page, '**/api/workspaces/*/dashboard*');
    await enterWorkspace(page);

    await expect(page.locator('#dashboard-panel .region-loader')).toBeVisible();
    await expect(page.locator('#dashboard-panel .region-spinner')).toBeVisible();
    await expect(page.locator('#dashboard-panel .region-loader')).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  for (const scenario of [
    { route: 'tasks', container: '.tasks-container', pattern: '**/api/projects/*/tasks*' },
    { route: 'kanban', container: '.kanban-wrapper', pattern: '**/api/projects/*/tasks*' },
    { route: 'notes', container: '.notes-container', pattern: '**/api/workspaces/*/notes*' },
    {
      route: 'knowledge',
      container: '.knowledge-body',
      pattern: '**/api/workspaces/*/documents*',
    },
    { route: 'roadmap', container: '.roadmap-container', pattern: '**/api/projects/*/roadmaps*' },
    { route: 'team', container: '.team-container', pattern: '**/api/workspaces/*/members*' },
    { route: 'pomodoro', container: '.pomodoro-wrapper', pattern: '**/api/pomodoro/summary*' },
  ]) {
    test(`a pagina ${scenario.route} mostra o giro na primeira carga`, async ({ page }) => {
      const workspace = await seed(page, `j03-${scenario.route}`, `Workspace J03 ${scenario.route}`);
      const project = await createProject(page, workspace.id, 'Projeto J03');

      await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
      await slowDown(page, scenario.pattern);
      await enterWorkspace(page);
      await gotoRoute(page, scenario.route);

      const loader = page.locator(`${scenario.container} > .region-loader`);
      await expect(loader).toBeVisible();
      await expect(loader.locator('.region-spinner')).toBeVisible();
      await expect(page.locator(`${scenario.container}.is-loading`)).toHaveCount(0, {
        timeout: 15_000,
      });
    });
  }

  test('a Rotina mostra o giro sobre o corpo, nao sobre o cabecalho', async ({ page }) => {
    await seed(page, 'j03-routine', 'Workspace J03 Rotina');
    await slowDown(page, '**/api/workspaces/*/events*');
    await enterWorkspace(page);
    await gotoRoute(page, 'routine');

    await expect(page.locator('#routine-body > .region-loader')).toBeVisible();
    await expect(page.locator('.routine-header')).toBeVisible();
    await expect(page.locator('#routine-body.is-loading')).toHaveCount(0, { timeout: 15_000 });
  });

  test('trocar o projeto em Tarefas gira so na lista; a barra lateral continua visivel', async ({
    page,
  }) => {
    const workspace = await seed(page, 'j03-switch', 'Workspace J03 Troca');
    await createProject(page, workspace.id, 'Projeto Um');
    const second = await createProject(page, workspace.id, 'Projeto Dois');

    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await expect(page.locator('.tasks-list-container')).toBeVisible();

    await slowDown(page, '**/api/projects/*/tasks*');
    await page.locator(`.project-btn[data-id="${second.id}"]`).click();

    await expect(page.locator('.tasks-list-container > .region-loader')).toBeVisible();
    await expect(page.locator('.tasks-container > .region-loader')).toHaveCount(0);
    await expect(page.locator('.tasks-sidebar')).toBeVisible();
  });

  test('filtrar snippets por pasta gira so na grade', async ({ page }) => {
    const workspace = await seed(page, 'j03-folder', 'Workspace J03 Pasta');

    await page.evaluate(async (workspaceId) => {
      await fetch(`/api/workspaces/${workspaceId}/snippets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Trecho J03',
          folder: 'Utilitarios',
          language: 'JavaScript',
          code: 'console.log(1);',
        }),
      });
    }, workspace.id);

    await enterWorkspace(page);
    await gotoSnippets(page);

    await expect(page.locator('.snippet-card')).toHaveCount(1);

    await slowDown(page, '**/api/workspaces/*/snippets*');
    await page.locator('.filter-btn[data-folder="Utilitarios"]').click();

    await expect(page.locator('.snippets-grid > .region-loader')).toBeVisible();
    await expect(page.locator('.notes-container > .region-loader')).toHaveCount(0);
    await expect(page.locator('.tasks-sidebar')).toBeVisible();
  });
});
