import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createProject, createWorkspace, enterWorkspace, gotoRoute } from './support/shell.js';

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

async function assertCentered(page, regionSelector) {
  const region = await page.locator(regionSelector).boundingBox();
  const empty = await page.locator(`${regionSelector} .page-empty .empty-state`).boundingBox();

  expect(region).not.toBeNull();
  expect(empty).not.toBeNull();

  const regionCenter = region.x + region.width / 2;
  const emptyCenter = empty.x + empty.width / 2;

  expect(Math.abs(regionCenter - emptyCenter)).toBeLessThanOrEqual(2);
  expect(empty.x - region.x).toBeGreaterThan(24);
}

test.describe('Tela vazia que ocupa o espaco', () => {
  test('em Metas sem projeto, o texto fica centralizado e nao colado a esquerda', async ({
    page,
  }) => {
    await signUp(page, newAccount('j02-roadmap'));
    await createWorkspace(page, 'Workspace J02 Metas');
    await enterWorkspace(page);
    await gotoRoute(page, 'roadmap');

    await expect(page.locator('.roadmap-container .page-empty')).toBeVisible();
    await assertCentered(page, '.roadmap-container');
  });

  test('em Metas com projeto e sem roadmap, o texto tambem fica centralizado', async ({ page }) => {
    await signUp(page, newAccount('j02-roadmap-sem'));
    const workspace = await createWorkspace(page, 'Workspace J02 Sem Roadmap');
    const project = await createProject(page, workspace.id, 'Projeto J02');

    await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
    await enterWorkspace(page);
    await gotoRoute(page, 'roadmap');

    await expect(page.locator('.roadmap-main .page-empty')).toBeVisible();
    await assertCentered(page, '.roadmap-main');
  });

  test('em Tarefas sem projeto, o texto fica centralizado', async ({ page }) => {
    await signUp(page, newAccount('j02-tasks'));
    await createWorkspace(page, 'Workspace J02 Tarefas');
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await expect(page.locator('.tasks-list-container .page-empty')).toBeVisible();
    await assertCentered(page, '.tasks-list-container');
  });

  test('no Kanban sem projeto, o texto fica centralizado dentro do quadro', async ({ page }) => {
    await signUp(page, newAccount('j02-kanban'));
    await createWorkspace(page, 'Workspace J02 Kanban');
    await enterWorkspace(page);
    await gotoRoute(page, 'kanban');

    await expect(page.locator('#kanban-board .page-empty')).toBeVisible();
    await assertCentered(page, '#kanban-board');
  });

  test('em Snippets sem nenhum snippet, o bloco vazio ocupa a grade inteira', async ({ page }) => {
    await signUp(page, newAccount('j02-snippets'));
    await createWorkspace(page, 'Workspace J02 Snippets');
    await enterWorkspace(page);
    await gotoSnippets(page);

    await expect(page.locator('.snippets-grid .page-empty')).toBeVisible();
    await assertCentered(page, '.snippets-grid');
  });

  test('em Notas sem nenhuma nota, o bloco vazio ocupa a grade inteira', async ({ page }) => {
    await signUp(page, newAccount('j02-notes'));
    await createWorkspace(page, 'Workspace J02 Notas');
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    await expect(page.locator('.notes-grid-scroll .page-empty')).toBeVisible();
    await assertCentered(page, '.notes-grid-scroll');
  });

  test('o icone da tela vazia continua desenhado em 48 pixels', async ({ page }) => {
    await signUp(page, newAccount('j02-icon'));
    await createWorkspace(page, 'Workspace J02 Icone');
    await enterWorkspace(page);
    await gotoRoute(page, 'roadmap');

    const icon = page.locator('.roadmap-container .page-empty .empty-state svg');
    await expect(icon).toBeVisible();

    const box = await icon.boundingBox();
    expect(Math.round(box.width)).toBe(48);
    expect(Math.round(box.height)).toBe(48);
  });
});
