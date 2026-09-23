import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

async function enterWorkspace(page, workspaceName) {
  const workspace = await page.evaluate(async (name) => {
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao criar workspace de teste: ${response.status}`);
    }

    return response.json();
  }, workspaceName);

  await page.evaluate((workspaceId) => {
    sessionStorage.setItem('fluxo_active_workspace', workspaceId);
  }, workspace.id);

  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();

  return workspace;
}

async function readKeys(page, keys) {
  return page.evaluate((keyList) => {
    const result = {};
    for (const key of keyList) result[key] = localStorage.getItem(key);
    return result;
  }, keys);
}

function gear(page) {
  return page.locator('.floating-nav [data-label="Configurações"]');
}

function overlay(page) {
  return page.locator('.settings-overlay');
}

test.describe('Painel de Configurações', () => {
  test('abre pela engrenagem, pelo menu do usuário e por Alt+, e fecha clicando fora e no X', async ({
    page,
  }) => {
    const account = newAccount('settings-entry-points');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Configurações Entrada');

    await expect(overlay(page)).not.toHaveClass(/active/);

    await gear(page).click();
    await expect(overlay(page)).toHaveClass(/active/);

    await page.locator('.settings-close').click();
    await expect(overlay(page)).not.toHaveClass(/active/);

    await page.keyboard.press('Alt+Comma');
    await expect(overlay(page)).toHaveClass(/active/);

    await page.mouse.click(5, 5);
    await expect(overlay(page)).not.toHaveClass(/active/);

    await page.locator('.user-chip-trigger').click();
    await page.locator('[data-action="settings"]').click();
    await expect(overlay(page)).toHaveClass(/active/);
    await expect(page.locator('.user-chip-menu')).not.toHaveClass(/open/);
  });

  test('Aparência: Aurora reaplica o tema e marca a opção; uma URL de imagem troca o fundo; ambos sobrevivem a reload', async ({
    page,
  }) => {
    const account = newAccount('settings-appearance');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Configurações Aparência');

    await gear(page).click();

    const auroraOption = page.locator('.settings-choice[data-value="aurora"]');
    await expect(auroraOption).toBeVisible();
    await auroraOption.click();

    await expect(page.locator('#global-bg')).toHaveClass(/bg-aurora/);
    await expect(page.locator('body')).toHaveClass(/aurora-theme/);
    await expect(auroraOption).toHaveClass(/active/);

    let keys = await readKeys(page, ['fluxo.theme.type', 'fluxo.theme.value']);
    expect(keys['fluxo.theme.type']).toBe('css');
    expect(keys['fluxo.theme.value']).toBe('aurora');

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await expect(page.locator('#global-bg')).toHaveClass(/bg-aurora/);
    await expect(page.locator('body')).toHaveClass(/aurora-theme/);

    await gear(page).click();
    const imageUrl = 'https://exemplo.com/fundo-teste-ab07.jpg';
    await page.locator('#settings-bg-url').fill(imageUrl);
    await page.locator('#settings-bg-apply').click();

    const backgroundStyle = await page
      .locator('#global-bg')
      .evaluate((element) => element.style.background);
    expect(backgroundStyle).toContain(imageUrl);
    await expect(page.locator('body')).not.toHaveClass(/aurora-theme/);

    keys = await readKeys(page, ['fluxo.theme.type', 'fluxo.theme.value']);
    expect(keys['fluxo.theme.type']).toBe('image');
    expect(keys['fluxo.theme.value']).toBe(`url('${imageUrl}')`);

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    const backgroundAfterReload = await page
      .locator('#global-bg')
      .evaluate((element) => element.style.background);
    expect(backgroundAfterReload).toContain(imageUrl);
  });

  test('Navegação: barra lateral fixa move a barra na hora com o painel aberto e o lado direito troca o layout; ambos sobrevivem a reload', async ({
    page,
  }) => {
    const account = newAccount('settings-navigation');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Configurações Navegação');

    const container = page.locator('.app-container');
    const nav = page.locator('.floating-nav');
    const mainWrapper = page.locator('.main-wrapper');

    await gear(page).click();
    await page.locator('[data-section="navigation"]').click();

    await expect(container).toHaveAttribute('data-nav', 'floating');

    const routeButtonCount = await page.locator('.floating-nav [data-route]').count();
    const shortcutItems = page.locator('.settings-shortcuts li');
    await expect(shortcutItems).toHaveCount(routeButtonCount + 1);
    await expect(shortcutItems.last()).toContainText('Configurações');
    await expect(shortcutItems.last().locator('kbd')).toHaveText('Alt+,');

    const settingsContent = page.locator('.settings-content');

    await settingsContent.locator('[data-mode="sidebar"]').click();

    await expect(container).toHaveAttribute('data-nav', 'sidebar');
    await expect(nav).toHaveAttribute('data-mode', 'sidebar');
    await expect(container).toHaveCSS('display', 'grid');
    await expect(overlay(page)).toHaveClass(/active/);
    await expect(settingsContent.locator('[data-mode="sidebar"]')).toHaveClass(/active/);

    function navXMinusMainX() {
      return page.evaluate(() => {
        const navX = document.querySelector('.floating-nav').getBoundingClientRect().x;
        const mainX = document.querySelector('.main-wrapper').getBoundingClientRect().x;
        return navX - mainX;
      });
    }

    await expect.poll(navXMinusMainX).toBeLessThan(0);

    await settingsContent.locator('[data-side="right"]').click();
    await expect(container).toHaveAttribute('data-nav-side', 'right');
    await expect(settingsContent.locator('[data-side="right"]')).toHaveClass(/active/);

    await expect.poll(navXMinusMainX).toBeGreaterThan(0);

    const keys = await readKeys(page, ['fluxo.nav.mode', 'fluxo.nav.side']);
    expect(keys['fluxo.nav.mode']).toBe('sidebar');
    expect(keys['fluxo.nav.side']).toBe('right');

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await expect(container).toHaveAttribute('data-nav', 'sidebar');
    await expect(container).toHaveAttribute('data-nav-side', 'right');
    await expect(container).toHaveCSS('display', 'grid');
  });

  test('Pomodoro: a duração de Foco persiste e o próximo ciclo já nasce com o valor novo após reload', async ({
    page,
  }) => {
    const account = newAccount('settings-pomodoro');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Configurações Pomodoro');

    await gear(page).click();
    await page.locator('[data-section="pomodoro"]').click();

    const focusInput = page.locator('[data-time="focus"]');
    await focusInput.fill('30');
    await focusInput.blur();

    const keys = await readKeys(page, ['fluxo.pomodoro.times']);
    const storedTimes = JSON.parse(keys['fluxo.pomodoro.times']);
    expect(Number(storedTimes.focus)).toBe(30);

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();

    const keysAfterReload = await readKeys(page, ['fluxo.pomodoro.times']);
    expect(Number(JSON.parse(keysAfterReload['fluxo.pomodoro.times']).focus)).toBe(30);

    await page.keyboard.press('Alt+Digit6');
    await expect(page.locator('#time-display')).toHaveText('30:00');
  });

  test('Relógio e clima: 12 horas e Fahrenheit persistem e sobrevivem a reload, e o Playground mostra AM/PM depois', async ({
    page,
  }) => {
    const account = newAccount('settings-clock');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Configurações Relógio');

    await gear(page).click();
    await page.locator('[data-section="clock"]').click();

    await expect(page.locator('[data-clock="24"]')).toHaveClass(/active/);
    await expect(page.locator('[data-unit="c"]')).toHaveClass(/active/);

    await page.locator('[data-clock="12"]').click();
    await expect(page.locator('[data-clock="12"]')).toHaveClass(/active/);
    await expect(page.locator('[data-clock="24"]')).not.toHaveClass(/active/);

    await page.locator('[data-unit="f"]').click();
    await expect(page.locator('[data-unit="f"]')).toHaveClass(/active/);
    await expect(page.locator('[data-unit="c"]')).not.toHaveClass(/active/);

    const keys = await readKeys(page, ['fluxo.clock.twelveHour', 'fluxo.weather.fahrenheit']);
    expect(keys['fluxo.clock.twelveHour']).toBe('true');
    expect(keys['fluxo.weather.fahrenheit']).toBe('true');

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();

    const keysAfterReload = await readKeys(page, [
      'fluxo.clock.twelveHour',
      'fluxo.weather.fahrenheit',
    ]);
    expect(keysAfterReload['fluxo.clock.twelveHour']).toBe('true');
    expect(keysAfterReload['fluxo.weather.fahrenheit']).toBe('true');

    await expect(page.locator('#clock-display')).toHaveText(/AM|PM/);
  });
});
