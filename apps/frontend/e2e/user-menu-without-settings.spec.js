import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createWorkspace, enterWorkspace, setNavigationPlacement } from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Menu do usuario sem Configuracoes', () => {
  test('o menu do perfil nao oferece mais Configuracoes', async ({ page }) => {
    await seed(page, 'k04-menu');
    await enterWorkspace(page);

    await page.locator('.user-chip-trigger').click();

    await expect(page.locator('.user-chip-menu')).toHaveClass(/open/);
    await expect(page.locator('.user-chip-item[data-action="settings"]')).toHaveCount(0);
    await expect(page.locator('.user-chip-item[data-action="profile"]')).toBeVisible();
    await expect(page.locator('.user-chip-item[data-action="switch"]')).toBeVisible();
    await expect(page.locator('.user-chip-item[data-action="signout"]')).toBeVisible();
  });

  test('Configuracoes continua acessivel pela engrenagem e pelo atalho', async ({ page }) => {
    await seed(page, 'k04-acesso');
    await enterWorkspace(page);

    await page.locator('[data-label="Configurações"]').click();
    await expect(page.locator('.settings-overlay')).toHaveClass(/active/);

    await page.locator('.settings-close').click();
    await expect(page.locator('.settings-overlay')).not.toHaveClass(/active/);

    await page.keyboard.press('Alt+Comma');
    await expect(page.locator('.settings-overlay')).toHaveClass(/active/);
  });
});
