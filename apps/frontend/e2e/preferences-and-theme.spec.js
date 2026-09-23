import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '..', 'src');

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }

  return files;
}

function grepSrc(pattern) {
  const matches = [];

  for (const file of collectFiles(SRC_DIR)) {
    const content = fs.readFileSync(file, 'utf8');
    if (pattern.test(content)) {
      matches.push(file);
    }
  }

  return matches;
}

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

async function openThemeMenu(page) {
  const viewport = page.viewportSize();
  await page
    .locator('.playground-area')
    .click({ button: 'right', position: { x: 60, y: viewport.height - 60 } });
  await expect(page.locator('#vibe-context-menu')).toHaveClass(/active/);
}

test.describe('preferencias e tema como modulos', () => {
  test('nenhum arquivo em src referencia window.applyGlobalTheme', () => {
    const matches = grepSrc(/applyGlobalTheme/);
    expect(matches).toEqual([]);
  });

  test('nenhum arquivo em src referencia as chaves antigas de localStorage', () => {
    const matches = grepSrc(/fluxo_vibe|fluxo_clock|fluxo_weather|fluxo_widget|fluxo_sticky/);
    expect(matches).toEqual([]);
  });

  test('escolher Aurora aplica o fundo e sobrevive ao reload', async ({ page }) => {
    const account = newAccount('theme-aurora');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Aurora');

    await openThemeMenu(page);
    await page.locator('.menu-item[data-type="css"][data-value="aurora"]').click();

    await expect(page.locator('#global-bg')).toHaveClass(/bg-aurora/);
    await expect(page.locator('body')).toHaveClass(/aurora-theme/);

    expect(await page.evaluate(() => localStorage.getItem('fluxo.theme.type'))).toBe('css');
    expect(await page.evaluate(() => localStorage.getItem('fluxo.theme.value'))).toBe('aurora');
    expect(await page.evaluate(() => localStorage.getItem('fluxo_vibe_type'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('fluxo_vibe_value'))).toBeNull();

    await page.reload();

    await expect(page.locator('#global-bg')).toHaveClass(/bg-aurora/);
    await expect(page.locator('body')).toHaveClass(/aurora-theme/);
  });

  test('escolher Light Minimal aplica light-theme e escurece o texto', async ({ page }) => {
    const account = newAccount('theme-light');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Light');

    await openThemeMenu(page);
    await page.locator('.menu-item[data-type="color"][data-value="#F8F9FA"]').click();

    await expect(page.locator('body')).toHaveClass(/light-theme/);

    const textColor = await page.evaluate(() => getComputedStyle(document.body).color);
    expect(textColor).toBe('rgb(17, 17, 17)');

    expect(await page.evaluate(() => localStorage.getItem('fluxo.theme.type'))).toBe('color');
    expect(await page.evaluate(() => localStorage.getItem('fluxo.theme.value'))).toBe('#F8F9FA');
  });

  test('clicar no relogio alterna 12h/24h e o formato sobrevive ao recarregar', async ({
    page,
  }) => {
    const account = newAccount('clock-toggle');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Relogio');

    const clock = page.locator('#clock-display');

    await expect(clock).toHaveText(/^\d{1,2}:\d{2}$/);
    expect(await page.evaluate(() => localStorage.getItem('fluxo.clock.twelveHour'))).toBeNull();

    await clock.click();

    await expect(clock).toHaveText(/^\d{1,2}:\d{2} (AM|PM)$/);
    expect(await page.evaluate(() => localStorage.getItem('fluxo.clock.twelveHour'))).toBe('true');
    expect(await page.evaluate(() => localStorage.getItem('fluxo_clock_12h'))).toBeNull();

    await page.reload();

    await expect(page.locator('#clock-display')).toHaveText(/^\d{1,2}:\d{2} (AM|PM)$/);
  });
});
