import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
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

async function createHabit(page, name) {
  await page.locator('.routine-tab[data-tab="habits"]').click();
  await page.locator('#habit-name').fill(name);
  await page.locator('#btn-new-habit').click();
  await expect(page.locator('.habit-row', { hasText: name })).toBeVisible();
}

test.describe('Desarquivar habitos', () => {
  test('arquivar tira de Ativos e coloca em Arquivados', async ({ page }) => {
    await seed(page, 'k18-arquivar');
    await enterWorkspace(page);
    await gotoRoute(page, 'routine');
    await createHabit(page, 'Correr');

    await page.locator('.habit-row', { hasText: 'Correr' }).locator('.btn-habit-archive').click();

    await expect(page.locator('.habit-row', { hasText: 'Correr' })).toHaveCount(0);

    await page.locator('.habit-view[data-view="archived"]').click();

    await expect(page.locator('.habit-row', { hasText: 'Correr' })).toBeVisible();
  });

  test('desarquivar devolve para Ativos', async ({ page }) => {
    await seed(page, 'k18-desarquivar');
    await enterWorkspace(page);
    await gotoRoute(page, 'routine');
    await createHabit(page, 'Ler');

    await page.locator('.habit-row', { hasText: 'Ler' }).locator('.btn-habit-archive').click();
    await page.locator('.habit-view[data-view="archived"]').click();
    await page.locator('.habit-row', { hasText: 'Ler' }).locator('.btn-habit-unarchive').click();

    await expect(page.locator('.habit-row', { hasText: 'Ler' })).toHaveCount(0);

    await page.locator('.habit-view[data-view="active"]').click();

    await expect(page.locator('.habit-row', { hasText: 'Ler' })).toBeVisible();
  });

  test('a lista de arquivados nao oferece excluir', async ({ page }) => {
    await seed(page, 'k18-sem-excluir');
    await enterWorkspace(page);
    await gotoRoute(page, 'routine');
    await createHabit(page, 'Meditar');

    await page.locator('.habit-row', { hasText: 'Meditar' }).locator('.btn-habit-archive').click();
    await page.locator('.habit-view[data-view="archived"]').click();

    const row = page.locator('.habit-row', { hasText: 'Meditar' });

    await expect(row.locator('.btn-habit-unarchive')).toBeVisible();
    await expect(row.locator('.btn-habit-delete')).toHaveCount(0);
  });
});
