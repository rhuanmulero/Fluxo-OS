import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
  zIndexOf,
} from './support/shell.js';

const MESSAGE = 'Falha forcada ao listar notas';

async function failNotes(page) {
  await page.route('**/api/workspaces/*/notes*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: MESSAGE }),
    });
  });
}

async function provokeError(page) {
  await failNotes(page);
  await gotoRoute(page, 'notes');

  const feedback = page.locator('.page-feedback');
  await expect(feedback).toHaveText(MESSAGE);

  return feedback;
}

async function boxOf(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  return box;
}

test.describe('Barra de feedback unica', () => {
  test('a barra e uma so, mora no shell e nao dentro do container da pagina', async ({ page }) => {
    await signUp(page, newAccount('j01-single'));
    await createWorkspace(page, 'Workspace J01 Unica');
    await enterWorkspace(page);

    await expect(page.locator('.page-feedback')).toHaveCount(1);

    const parentClass = await page.evaluate(
      () => document.querySelector('.page-feedback').parentElement.className,
    );

    expect(parentClass).toBe('app-container');
  });

  test('com o dock no topo, a barra aparece abaixo dele e inteira', async ({ page }) => {
    await signUp(page, newAccount('j01-top'));
    await createWorkspace(page, 'Workspace J01 Topo');
    await setNavigationPlacement(page, { dock: 'top' });
    await enterWorkspace(page);

    const feedback = await provokeError(page);

    await expect(feedback).toHaveAttribute('data-placement', 'top');

    const nav = await boxOf(page.locator('.floating-nav'));
    const bar = await boxOf(feedback);

    expect(bar.y).toBeGreaterThanOrEqual(nav.y + nav.height);
    expect(bar.height).toBeGreaterThan(0);
  });

  test('com o dock embaixo, a barra aparece acima dele', async ({ page }) => {
    await signUp(page, newAccount('j01-bottom'));
    await createWorkspace(page, 'Workspace J01 Rodape');
    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);

    const feedback = await provokeError(page);

    await expect(feedback).toHaveAttribute('data-placement', 'bottom');

    const nav = await boxOf(page.locator('.floating-nav'));
    const bar = await boxOf(feedback);

    expect(bar.y + bar.height).toBeLessThanOrEqual(nav.y);
  });

  test('no modo barra lateral, a barra fica no topo e fora da barra lateral', async ({ page }) => {
    await signUp(page, newAccount('j01-sidebar'));
    await createWorkspace(page, 'Workspace J01 Lateral');
    await setNavigationPlacement(page, { mode: 'sidebar' });
    await enterWorkspace(page);

    const feedback = await provokeError(page);

    await expect(feedback).toHaveAttribute('data-placement', 'sidebar');

    const nav = await boxOf(page.locator('.floating-nav'));
    const bar = await boxOf(feedback);

    expect(bar.y).toBeLessThan(100);
    expect(bar.x).toBeGreaterThanOrEqual(nav.x + nav.width);
  });

  test('a barra fica acima do dock, do menu de usuario, das Configuracoes e do dialogo', async ({
    page,
  }) => {
    await signUp(page, newAccount('j01-layer'));
    await createWorkspace(page, 'Workspace J01 Camada');
    await enterWorkspace(page);

    const feedback = await zIndexOf(page, '.page-feedback');

    expect(feedback).toBeGreaterThan(await zIndexOf(page, '.floating-nav'));
    expect(feedback).toBeGreaterThan(await zIndexOf(page, '.user-chip-menu'));
    expect(feedback).toBeGreaterThan(await zIndexOf(page, '.settings-overlay'));
    expect(feedback).toBeGreaterThan(10003);
  });

  test('a barra some sozinha depois de cinco segundos', async ({ page }) => {
    await signUp(page, newAccount('j01-timeout'));
    await createWorkspace(page, 'Workspace J01 Tempo');
    await enterWorkspace(page);

    const feedback = await provokeError(page);

    await expect(feedback).toBeHidden({ timeout: 8000 });
  });
});
