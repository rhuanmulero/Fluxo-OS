import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createWorkspace,
  enterWorkspace,
  gotoKnowledgeTab,
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Botao de novo snippet', () => {
  test('o botao aparece dentro da area visivel', async ({ page }) => {
    await seed(page, 'k06-visivel');
    await enterWorkspace(page);
    await gotoKnowledgeTab(page, 'snippets');

    const button = page.locator('#btn-new-snippet');

    await expect(button).toBeVisible();
    await expect(button).toBeInViewport();
  });

  test('o botao continua la quando a listagem falha', async ({ page }) => {
    await seed(page, 'k06-erro');
    await enterWorkspace(page);

    await page.route('**/api/workspaces/*/snippets*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"message":"falha proposital"}',
      }),
    );

    await gotoKnowledgeTab(page, 'snippets');

    await expect(page.locator('#btn-new-snippet')).toBeVisible();
    await expect(page.locator('.page-feedback')).toBeVisible();
  });

  test('o botao abre o drawer e cria o snippet', async ({ page }) => {
    await seed(page, 'k06-criar');
    await enterWorkspace(page);
    await gotoKnowledgeTab(page, 'snippets');

    await page.locator('#btn-new-snippet').click();
    await page.locator('#snippet-title').fill('Trecho novo');
    await page.locator('#snippet-code-editor').fill('const y = 2;');
    await page.locator('#snippet-folder .dropdown-trigger').click();
    await page.locator('#snippet-folder .dropdown-option.is-create').click();
    await page.keyboard.type('Geral');
    await page.keyboard.press('Enter');
    await page.locator('#btn-save-drawer').click();

    await expect(page.locator('.snippet-card', { hasText: 'Trecho novo' })).toBeVisible();
  });
});
