import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

test('o empty state de workspaces tem altura confortavel com icone e texto', async ({ page }) => {
  await signUp(page, newAccount('empty-state'));
  await page.goto('/workspace.html');

  const empty = page.locator('#workspaceList .list-empty');
  await expect(empty).toBeVisible();
  await expect(empty.locator('svg')).toBeVisible();
  await expect(empty.locator('strong')).toHaveText('Nenhum workspace por aqui');
  await expect(empty.locator('span')).toHaveText(
    'Entre com um código de convite ou crie o seu primeiro espaço.',
  );

  const box = await empty.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(96);
});

test('o botao de criar workspace fica pendente enquanto a requisicao esta em voo', async ({
  page,
}) => {
  await signUp(page, newAccount('pending-create'));
  await page.goto('/workspace.html');

  await page.route('**/api/workspaces', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'Criar novo Workspace' }).click();
  await page.locator('#createForm input').fill('Workspace de teste');

  const button = page.locator('#createForm button[type="submit"]');
  await button.click();

  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('.btn-spinner')).toBeVisible();

  await page.waitForURL('**/index.html');
});

test('um codigo de convite invalido restaura o botao e mostra o erro', async ({ page }) => {
  await signUp(page, newAccount('invalid-code'));
  await page.goto('/workspace.html');

  await page.getByRole('button', { name: 'Entrar com Código' }).click();
  await page.locator('.code-input').fill('ZZZZZZZZ');

  const button = page.locator('#codeForm button[type="submit"]');
  await button.click();

  await expect(page.locator('#codeError')).not.toBeEmpty();
  await expect(button).not.toBeDisabled();
  await expect(button).not.toHaveAttribute('aria-busy', 'true');
});

test('dois cliques rapidos no botao de criar geram apenas uma requisicao', async ({ page }) => {
  await signUp(page, newAccount('double-click'));
  await page.goto('/workspace.html');

  const createRequests = [];
  await page.route('**/api/workspaces', async (route) => {
    if (route.request().method() === 'POST') {
      createRequests.push(route.request());
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'Criar novo Workspace' }).click();
  await page.locator('#createForm input').fill('Workspace duplo clique');

  await page.evaluate(() => {
    const button = document.querySelector('#createForm button[type="submit"]');
    button.click();
    button.click();
  });

  await page.waitForURL('**/index.html');

  expect(createRequests).toHaveLength(1);
});
