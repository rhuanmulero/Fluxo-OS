import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { apiRequest, createWorkspace, enterWorkspace } from './support/shell.js';

function isoInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString();
}

test.describe('Blocos do dashboard', () => {
  test('os tres blocos ficam separados por um filete e a contagem bate com a lista', async ({
    page,
  }) => {
    await signUp(page, newAccount('j11-blocks'));
    const workspace = await createWorkspace(page, 'Workspace J11 Blocos');

    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/events`, {
      title: 'Reuniao J11',
      startsAt: isoInDays(2),
    });
    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/habits`, { name: 'Ler J11' });
    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/habits`, { name: 'Correr J11' });

    await enterWorkspace(page);

    const panel = page.locator('#dashboard-panel');
    await expect(panel).toBeVisible();

    const blocks = panel.locator('.dashboard-block');
    await expect(blocks).toHaveCount(3);

    await expect(blocks.nth(0).locator('h3')).toHaveText('Para hoje');
    await expect(blocks.nth(1).locator('h3')).toHaveText('Próximos eventos');
    await expect(blocks.nth(2).locator('h3')).toHaveText('Hábitos de hoje');

    await expect(blocks.nth(1).locator('.dashboard-count')).toHaveText('1');
    await expect(blocks.nth(1).locator('.dashboard-event')).toHaveCount(1);
    await expect(blocks.nth(2).locator('.dashboard-count')).toHaveText('2');
    await expect(blocks.nth(2).locator('.dashboard-habit')).toHaveCount(2);

    const borders = await blocks.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).borderTopWidth),
    );

    expect(borders[0]).toBe('0px');
    expect(borders[1]).not.toBe('0px');
    expect(borders[2]).not.toBe('0px');
  });

  test('com as tres listas vazias, os textos continuam legiveis e separados', async ({ page }) => {
    await signUp(page, newAccount('j11-empty'));
    await createWorkspace(page, 'Workspace J11 Vazio');
    await enterWorkspace(page);

    const panel = page.locator('#dashboard-panel');
    const blocks = panel.locator('.dashboard-block');

    await expect(blocks).toHaveCount(3);
    await expect(blocks.nth(0).locator('.dashboard-count')).toHaveText('0');
    await expect(blocks.nth(1).locator('.dashboard-count')).toHaveText('0');
    await expect(blocks.nth(2).locator('.dashboard-count')).toHaveText('0');

    await expect(panel.locator('.dashboard-today .empty')).toHaveText('Nada com prazo para hoje.');
    await expect(panel.locator('.dashboard-events .empty')).toHaveText(
      'Nada nos próximos sete dias.',
    );
    await expect(panel.locator('.dashboard-habits .empty')).toHaveText('Tudo em dia.');

    const first = await blocks.nth(0).boundingBox();
    const second = await blocks.nth(1).boundingBox();

    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
  });

  test('a contagem e as cores do bloco seguem os tokens nos dois temas', async ({ page }) => {
    await signUp(page, newAccount('j11-theme'));
    await createWorkspace(page, 'Workspace J11 Tema');
    await enterWorkspace(page);

    const count = page.locator('#dashboard-panel .dashboard-count').first();
    await expect(count).toBeVisible();

    const dark = await count.evaluate((el) => getComputedStyle(el).color);

    await page.evaluate(() => document.body.classList.add('light-theme'));

    const light = await count.evaluate((el) => getComputedStyle(el).color);

    expect(light).not.toBe(dark);
  });
});
