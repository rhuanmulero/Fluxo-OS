import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createWorkspace, enterWorkspace, setNavigationPlacement } from './support/shell.js';

const MARGIN = 8;

async function openMenu(page) {
  await page.locator('.user-chip-trigger').click();

  const panel = page.locator('.user-chip-menu');
  await expect(panel).toHaveClass(/open/);

  return panel;
}

async function assertInsideViewport(page, panel) {
  const box = await panel.boundingBox();
  const size = page.viewportSize();

  expect(box.x).toBeGreaterThanOrEqual(MARGIN - 1);
  expect(box.y).toBeGreaterThanOrEqual(MARGIN - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width - MARGIN + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height - MARGIN + 1);

  return box;
}

async function seed(page, label, placement) {
  await signUp(page, newAccount(label));
  await createWorkspace(page, `Workspace ${label}`);
  await setNavigationPlacement(page, placement);
  await enterWorkspace(page);
}

test.describe('Menu de perfil que cabe na tela', () => {
  test('o painel e posicionado por medida, nao por seletor de ancoragem', async ({ page }) => {
    await seed(page, 'j07-fixed', { dock: 'top' });

    const panel = await openMenu(page);

    const position = await panel.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('fixed');

    const inline = await panel.evaluate((el) => ({ left: el.style.left, top: el.style.top }));
    expect(inline.left).not.toBe('');
    expect(inline.top).not.toBe('');
  });

  test('com o dock a esquerda, o menu abre para a direita e nao ultrapassa a borda', async ({
    page,
  }) => {
    await seed(page, 'j07-left', { dock: 'left' });

    const panel = await openMenu(page);
    const box = await assertInsideViewport(page, panel);
    const nav = await page.locator('.floating-nav').boundingBox();

    expect(box.x).toBeGreaterThanOrEqual(nav.x);
  });

  test('com o dock a direita, o menu abre para a esquerda e continua na tela', async ({ page }) => {
    await seed(page, 'j07-right', { dock: 'right' });

    const panel = await openMenu(page);
    const box = await assertInsideViewport(page, panel);
    const nav = await page.locator('.floating-nav').boundingBox();

    expect(box.x + box.width).toBeLessThanOrEqual(nav.x + nav.width + 1);
  });

  test('com o dock no topo, o menu abre abaixo do gatilho', async ({ page }) => {
    await seed(page, 'j07-top', { dock: 'top' });

    const panel = await openMenu(page);
    const box = await assertInsideViewport(page, panel);
    const trigger = await page.locator('.user-chip-trigger').boundingBox();

    expect(box.y).toBeGreaterThanOrEqual(trigger.y + trigger.height);
  });

  test('com o dock embaixo, o menu abre acima do gatilho', async ({ page }) => {
    await seed(page, 'j07-bottom', { dock: 'bottom' });

    const panel = await openMenu(page);
    const box = await assertInsideViewport(page, panel);
    const trigger = await page.locator('.user-chip-trigger').boundingBox();

    expect(box.y + box.height).toBeLessThanOrEqual(trigger.y + 1);
  });

  test('no modo barra lateral, o menu abre a direita da barra e dentro da tela', async ({
    page,
  }) => {
    await seed(page, 'j07-sidebar', { mode: 'sidebar' });

    const panel = await openMenu(page);
    const box = await assertInsideViewport(page, panel);
    const trigger = await page.locator('.user-chip-trigger').boundingBox();

    expect(box.x).toBeGreaterThanOrEqual(trigger.x - 1);
  });

  test('com o dock solto no canto inferior direito, o menu continua inteiro na tela', async ({
    page,
  }) => {
    await signUp(page, newAccount('j07-loose'));
    await createWorkspace(page, 'Workspace J07 Solto');

    const size = page.viewportSize();

    await page.evaluate(
      ({ width, height }) => {
        localStorage.setItem('fluxo.nav.mode', 'floating');
        localStorage.removeItem('fluxo.nav.edge');
        localStorage.setItem('fluxo.nav.left', `${width - 700}px`);
        localStorage.setItem('fluxo.nav.top', `${height - 120}px`);
      },
      { width: size.width, height: size.height },
    );

    await enterWorkspace(page);

    const panel = await openMenu(page);
    await assertInsideViewport(page, panel);
  });

  test('as regras de ancoragem por seletor sairam do CSS', async ({ page }) => {
    await seed(page, 'j07-css', { dock: 'bottom' });

    const rules = await page.evaluate(() =>
      [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules];
          } catch {
            return [];
          }
        })
        .map((rule) => rule.selectorText ?? '')
        .filter((selector) => selector.includes('.user-chip-menu')),
    );

    expect(rules.some((selector) => selector.includes('data-dock'))).toBe(false);
    expect(rules.some((selector) => selector.includes('data-mode'))).toBe(false);
  });
});
