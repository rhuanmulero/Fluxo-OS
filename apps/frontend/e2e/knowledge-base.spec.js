import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Tela Base de Conhecimento', () => {
  test('Alt+5 abre a Base de Conhecimento e a rota antiga de Snippets nao existe mais', async ({
    page,
  }) => {
    await seed(page, 'h09-route');
    await enterWorkspace(page);

    await expect(page.locator('[data-route="snippets"]')).toHaveCount(0);

    const entry = page.locator('[data-route="knowledge"]');
    await expect(entry).toHaveAttribute('data-label', 'Biblioteca');
    await expect(entry).toHaveAttribute('data-shortcut', 'Alt+5');

    await page.keyboard.press('Alt+Digit5');

    await expect(page.locator('.knowledge-container')).toBeVisible();
    await expect(entry).toHaveClass(/active/);
  });

  test('as tres abas existem e Documentos comeca ativa', async ({ page }) => {
    await seed(page, 'h09-tabs');
    await enterWorkspace(page);
    await gotoRoute(page, 'knowledge');

    const tabs = page.locator('.knowledge-tab');
    await expect(tabs).toHaveText(['Documentos', 'Links', 'Snippets']);

    await expect(page.locator('.knowledge-tab[data-tab="documents"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#document-list')).toBeVisible();
  });

  test('trocar de aba mostra o carregamento na area do painel, nao na pagina toda', async ({
    page,
  }) => {
    await seed(page, 'h09-switch');
    await enterWorkspace(page);
    await gotoRoute(page, 'knowledge');

    await expect(page.locator('#document-list')).toBeVisible();

    await page.route('**/api/workspaces/*/bookmarks*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    await page.locator('.knowledge-tab[data-tab="bookmarks"]').click();

    await expect(page.locator('.knowledge-body > .region-loader')).toBeVisible();
    await expect(page.locator('.knowledge-header')).toBeVisible();
    await expect(page.locator('.knowledge-container > .region-loader')).toHaveCount(0);

    await expect(page.locator('#bookmark-list')).toBeVisible({ timeout: 15_000 });
  });

  test('a busca do cabecalho muda de alvo conforme a aba e vai ao servidor como q', async ({
    page,
  }) => {
    const workspace = await seed(page, 'h09-search');

    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/snippets`, {
      name: 'Trecho encontrado',
      folder: 'Geral',
      language: 'JavaScript',
      code: 'console.log(1);',
    });

    await enterWorkspace(page);
    await gotoRoute(page, 'knowledge');

    const search = page.locator('.knowledge-search');
    await expect(search).toHaveAttribute('placeholder', 'Buscar em Documentos...');

    await page.locator('.knowledge-tab[data-tab="snippets"]').click();
    await expect(search).toHaveAttribute('placeholder', 'Buscar em Snippets...');

    const request = page.waitForRequest(
      (candidate) =>
        candidate.url().includes('/snippets') && candidate.url().includes('q=encontrado'),
    );

    await search.fill('encontrado');
    await search.press('Enter');

    await request;
    await expect(page.locator('.snippet-card')).toHaveCount(1);
  });

  test('a aba Snippets continua criando, editando e excluindo como a pagina antiga', async ({
    page,
  }) => {
    await seed(page, 'h09-snippets');
    await enterWorkspace(page);
    await gotoRoute(page, 'knowledge');
    await page.locator('.knowledge-tab[data-tab="snippets"]').click();

    await page.locator('#btn-new-snippet').click();
    await page.locator('#snippet-title').fill('Trecho da aba');
    await page.locator('#snippet-code-editor').fill('const x = 1;');
    await page.locator('#snippet-folder .dropdown-trigger').click();
    await page.locator('#snippet-folder .dropdown-option.is-create').click();
    await page.keyboard.type('Geral');
    await page.keyboard.press('Enter');
    await page.locator('#btn-save-drawer').click();

    const card = page.locator('.snippet-card', { hasText: 'Trecho da aba' });
    await expect(card).toBeVisible();

    await card.click();
    await page.locator('#snippet-title').fill('Trecho renomeado');
    await page.locator('#btn-save-drawer').click();

    await expect(page.locator('.snippet-card', { hasText: 'Trecho renomeado' })).toBeVisible();

    await page.locator('.btn-delete-snippet').first().click();

    await expect(page.locator('.snippet-card')).toHaveCount(0);
  });
});
