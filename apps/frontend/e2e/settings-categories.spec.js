import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createWorkspace, enterWorkspace, setNavigationPlacement } from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Configuracoes por categoria', () => {
  test('a trilha tem os dois grupos, nesta ordem', async ({ page }) => {
    await seed(page, 'k12-grupos');
    await enterWorkspace(page);
    await page.locator('[data-label="Configurações"]').click();

    await expect(page.locator('.settings-rail-group')).toHaveText(['Sua conta', 'Workspace']);
  });

  test('cada secao cai no grupo certo', async ({ page }) => {
    await seed(page, 'k12-secoes');
    await enterWorkspace(page);
    await page.locator('[data-label="Configurações"]').click();

    const account = page.locator('.settings-rail-section[data-category="account"] .settings-rail-item');
    const workspace = page.locator('.settings-rail-section[data-category="workspace"] .settings-rail-item');

    await expect(account).toHaveText(['Conta', 'Nami', 'Aparência', 'Relógio e clima', 'Navegação', 'Pomodoro']);
    await expect(workspace).toHaveText(['Workspace', 'Membros', 'Convites', 'Regras dos módulos']);
  });

  test('o painel abre na secao Aparencia', async ({ page }) => {
    await seed(page, 'k12-abrir');
    await enterWorkspace(page);
    await page.locator('[data-label="Configurações"]').click();

    await expect(page.locator('.settings-rail-item[data-section="appearance"]')).toHaveClass(/active/);
    await expect(page.locator('.settings-rail-item[data-section="account"]')).not.toHaveClass(/active/);
    await expect(page.locator('.settings-content')).toContainText('Fundo');
  });

  test('trocar de secao continua funcionando', async ({ page }) => {
    await seed(page, 'k12-troca');
    await enterWorkspace(page);
    await page.locator('[data-label="Configurações"]').click();

    await page.locator('.settings-rail-item[data-section="pomodoro"]').click();

    await expect(page.locator('.settings-rail-item[data-section="pomodoro"]')).toHaveClass(/active/);
    await expect(page.locator('.settings-content')).toContainText('Duração dos ciclos');
  });
});
