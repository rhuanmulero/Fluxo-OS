import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createWorkspace, enterWorkspace, setNavigationPlacement } from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Rotulos da navegacao', () => {
  test('Tarefas, Kanban e Biblioteca substituem os nomes longos', async ({ page }) => {
    await seed(page, 'k01-labels');
    await enterWorkspace(page);

    await expect(page.locator('[data-route="tasks"]')).toHaveAttribute('data-label', 'Tarefas');
    await expect(page.locator('[data-route="kanban"]')).toHaveAttribute('data-label', 'Kanban');
    await expect(page.locator('[data-route="knowledge"]')).toHaveAttribute(
      'data-label',
      'Biblioteca',
    );
  });

  test('os atalhos continuam os mesmos depois da troca de nome', async ({ page }) => {
    await seed(page, 'k01-shortcuts');
    await enterWorkspace(page);

    await expect(page.locator('[data-route="tasks"]')).toHaveAttribute('data-shortcut', 'Alt+2');
    await expect(page.locator('[data-route="kanban"]')).toHaveAttribute('data-shortcut', 'Alt+3');
    await expect(page.locator('[data-route="knowledge"]')).toHaveAttribute(
      'data-shortcut',
      'Alt+5',
    );

    await page.keyboard.press('Alt+Digit5');
    await expect(page.locator('.knowledge-container')).toBeVisible();
  });
});
