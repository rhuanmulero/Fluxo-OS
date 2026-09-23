import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await createProject(page, workspace.id, 'Projeto das metas');
  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Terminologia de Metas', () => {
  test('a pagina fala em metas, nao em roadmap', async ({ page }) => {
    await seed(page, 'k02-termo');
    await enterWorkspace(page);
    await gotoRoute(page, 'roadmap');

    const main = page.locator('.roadmap-container');

    await expect(main).toContainText('Metas');
    await expect(main).not.toContainText(/roadmap/i);
  });

  test('o estado vazio e o botao de criar tambem falam em meta', async ({ page }) => {
    await seed(page, 'k02-vazio');
    await enterWorkspace(page);
    await gotoRoute(page, 'roadmap');

    await expect(page.locator('.roadmap-container')).toContainText('Crie uma meta para começar.');
    await expect(page.locator('#btn-new-roadmap')).toHaveAttribute('title', 'Nova meta');
  });
});
