import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createWorkspace, enterWorkspace, setNavigationPlacement } from './support/shell.js';

async function seed(page, label, collapsed) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { mode: 'sidebar' });
  await page.evaluate(
    (value) => localStorage.setItem('fluxo.nav.collapsed', String(value)),
    collapsed,
  );

  return workspace;
}

async function navWidth(page) {
  return page.locator('.floating-nav').evaluate((nav) => nav.getBoundingClientRect().width);
}

test.describe('Barra lateral reduzida', () => {
  test('reduzida fica estreita e esconde os rotulos', async ({ page }) => {
    await seed(page, 'k11-reduzida', true);
    await enterWorkspace(page);

    await expect(page.locator('.app-container')).toHaveAttribute('data-collapsed', 'true');
    expect(await navWidth(page)).toBeLessThan(90);
    await expect(page.locator('.floating-nav .nav-label').first()).toBeHidden();
  });

  test('o mouse em cima expande e ao sair volta a reduzir', async ({ page }) => {
    await seed(page, 'k11-hover', true);
    await enterWorkspace(page);

    await page.locator('.floating-nav').hover();
    await expect
      .poll(() => navWidth(page), { timeout: 5000 })
      .toBeGreaterThan(200);

    await page.mouse.move(600, 400);
    await expect
      .poll(() => navWidth(page), { timeout: 5000 })
      .toBeLessThan(90);
  });

  test('expandida, a barra nao empurra o conteudo', async ({ page }) => {
    await seed(page, 'k11-overlay', true);
    await enterWorkspace(page);

    const before = await page
      .locator('.main-wrapper')
      .evaluate((main) => main.getBoundingClientRect().left);

    await page.locator('.floating-nav').hover();
    await expect.poll(() => navWidth(page), { timeout: 5000 }).toBeGreaterThan(200);

    const after = await page
      .locator('.main-wrapper')
      .evaluate((main) => main.getBoundingClientRect().left);

    expect(after).toBe(before);
  });

  test('desligada a opcao, a barra continua larga o tempo todo', async ({ page }) => {
    await seed(page, 'k11-normal', false);
    await enterWorkspace(page);

    await expect(page.locator('.app-container')).not.toHaveAttribute('data-collapsed', 'true');
    expect(await navWidth(page)).toBeGreaterThan(200);
  });

  test('reduzida, o conteudo ocupa a largura restante e nao e esmagado', async ({ page }) => {
    await seed(page, 'k11-largura', true);
    await enterWorkspace(page);

    const viewport = page.viewportSize().width;
    const mainWidth = await page
      .locator('.main-wrapper')
      .evaluate((main) => main.getBoundingClientRect().width);

    expect(mainWidth).toBeGreaterThan(viewport - 100);
  });

  test('no modo flutuante os botoes nao tem title nativo', async ({ page }) => {
    await signUp(page, newAccount('k11-title'));
    await createWorkspace(page, 'Workspace k11-title');
    await setNavigationPlacement(page, { mode: 'floating', dock: 'bottom' });
    await enterWorkspace(page);

    await expect(page.locator('[data-route="tasks"]')).not.toHaveAttribute('title', /./);
  });

  test('reduzida, os botoes tem title nativo', async ({ page }) => {
    await seed(page, 'k11-title-sidebar', true);
    await enterWorkspace(page);

    await expect(page.locator('[data-route="tasks"]')).toHaveAttribute('title', /Tarefas/);
  });
});
