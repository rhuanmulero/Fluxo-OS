import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
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

async function createSnippet(page, workspaceId, name, folder) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/snippets`, {
    name,
    folder,
    language: 'JavaScript',
    code: 'console.log(1);',
  });
}

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Pasta do snippet com criacao', () => {
  test('o campo lista as pastas existentes do workspace e nao usa datalist', async ({ page }) => {
    const workspace = await seed(page, 'j10-list');

    await createSnippet(page, workspace.id, 'Trecho Backend', 'Backend');
    await createSnippet(page, workspace.id, 'Trecho SQL', 'SQL');

    await enterWorkspace(page);
    await gotoSnippets(page);

    expect(await page.evaluate(() => document.querySelectorAll('datalist').length)).toBe(0);

    await page.locator('#btn-new-snippet').click();
    await page.locator('#snippet-folder .dropdown-trigger').click();

    const options = page.locator('#snippet-folder .dropdown-option:not(.is-create)');
    await expect(options).toHaveText(['Backend', 'SQL']);
    await expect(page.locator('#snippet-folder .dropdown-option.is-create')).toHaveText(
      'Criar nova pasta…',
    );
  });

  test('criar nova pasta abre o campo, Enter cria e ja seleciona, e o snippet nasce nela', async ({
    page,
  }) => {
    const workspace = await seed(page, 'j10-create');

    await createSnippet(page, workspace.id, 'Trecho Existente', 'Backend');

    await enterWorkspace(page);
    await gotoSnippets(page);

    await page.locator('#btn-new-snippet').click();
    await page.locator('#snippet-title').fill('Trecho Novo');
    await page.locator('#snippet-code-editor').fill('const x = 1;');

    await page.locator('#snippet-folder .dropdown-trigger').click();
    await page.locator('#snippet-folder .dropdown-option.is-create').click();
    await expect(page.locator('#snippet-folder .dropdown-create input')).toBeFocused();

    await page.keyboard.type('Infra');
    await page.keyboard.press('Enter');

    await expect(page.locator('#snippet-folder .dropdown-trigger')).toHaveText('Infra');

    await page.locator('#btn-save-drawer').click();

    await expect(page.locator('.snippet-card', { hasText: 'Trecho Novo' })).toBeVisible();
    await expect(page.locator('.filter-btn[data-folder="Infra"]')).toBeVisible();

    const saved = await apiRequest(page, 'GET', `/workspaces/${workspace.id}/snippets`);
    expect(saved.find((snippet) => snippet.name === 'Trecho Novo').folder).toBe('Infra');
  });

  test('salvar sem pasta mostra o erro sob o campo', async ({ page }) => {
    await seed(page, 'j10-empty');
    await enterWorkspace(page);
    await gotoSnippets(page);

    await page.locator('#btn-new-snippet').click();
    await page.locator('#snippet-title').fill('Sem pasta');
    await page.locator('#snippet-code-editor').fill('const y = 2;');
    await page.locator('#btn-save-drawer').click();

    await expect(page.locator('[data-field="folder"] .field-error')).toHaveText(
      'Informe a pasta do snippet.',
    );
    await expect(page.locator('[data-field="folder"] label .field-required')).toHaveText('*');
    await expect(page.locator('.page-feedback')).toBeHidden();
  });

  test('editar um snippet abre com a pasta dele ja escolhida', async ({ page }) => {
    const workspace = await seed(page, 'j10-edit');

    await createSnippet(page, workspace.id, 'Trecho Editavel', 'Frontend');

    await enterWorkspace(page);
    await gotoSnippets(page);

    await page.locator('.snippet-card', { hasText: 'Trecho Editavel' }).click();

    await expect(page.locator('#snippet-folder .dropdown-trigger')).toHaveText('Frontend');
  });
});
