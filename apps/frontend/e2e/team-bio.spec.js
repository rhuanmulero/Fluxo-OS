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

test.describe('Bio na Guilda', () => {
  test('abrir o proprio perfil mostra a visao, com a bio, e nao o formulario', async ({ page }) => {
    await seed(page, 'k05-visao');
    await apiRequest(page, 'PATCH', '/me/profile', { bio: 'Gosto de Postgres.' });

    await enterWorkspace(page);
    await gotoRoute(page, 'team');
    await page.locator('.dev-card-mini').first().click();

    await expect(page.locator('#sp-right-panel')).toContainText('Detalhes do Perfil');
    await expect(page.locator('.sp-bio').first()).toHaveText('Gosto de Postgres.');
    await expect(page.locator('#edit-bio')).toHaveCount(0);
  });

  test('o botao Editar abre o formulario com a bio salva', async ({ page }) => {
    await seed(page, 'k05-editar');
    await apiRequest(page, 'PATCH', '/me/profile', { bio: 'Gosto de Postgres.' });

    await enterWorkspace(page);
    await gotoRoute(page, 'team');
    await page.locator('.dev-card-mini').first().click();
    await page.locator('#btn-go-edit').click();

    await expect(page.locator('#edit-bio')).toHaveValue('Gosto de Postgres.');
  });

  test('salvar sem bio nao grava a frase de placeholder', async ({ page }) => {
    await seed(page, 'k05-placeholder');

    await enterWorkspace(page);
    await gotoRoute(page, 'team');
    await page.locator('.dev-card-mini').first().click();
    await page.locator('#btn-go-edit').click();

    await expect(page.locator('#edit-bio')).toHaveValue('');

    await page.locator('#btn-save-edit').click();
    await expect(page.locator('.steam-profile-modal')).not.toHaveClass(/active/);

    const me = await apiRequest(page, 'GET', '/me');

    expect(me.profile.bio).toBeNull();
  });

  test('a bio aparece no card grande do perfil', async ({ page }) => {
    await seed(page, 'k05-card');
    await apiRequest(page, 'PATCH', '/me/profile', { bio: 'Cuido do backend.' });

    await enterWorkspace(page);
    await gotoRoute(page, 'team');
    await page.locator('.dev-card-mini').first().click();

    await expect(page.locator('#sp-left-card .sp-left-bio')).toHaveText('Cuido do backend.');
  });
});
