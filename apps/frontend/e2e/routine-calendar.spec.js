import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

function isoOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Agenda em calendario', () => {
  test('a aba Agenda mostra uma grade de mes com os dias da semana', async ({ page }) => {
    await seed(page, 'k17-grade');
    await enterWorkspace(page);
    await gotoRoute(page, 'routine');

    await expect(page.locator('.calendar-grid')).toBeVisible();
    await expect(page.locator('.calendar-weekday')).toHaveText([
      'dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb',
    ]);
    await expect(page.locator('.calendar-day')).toHaveCount(42);
    await expect(page.locator('.calendar-day.is-today')).toHaveCount(1);
  });

  test('o evento do dia aparece na celula e no painel do dia', async ({ page }) => {
    const workspace = await seed(page, 'k17-evento');

    const today = new Date();
    today.setHours(14, 0, 0, 0);

    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/events`, {
      title: 'Reunião de hoje',
      startsAt: today.toISOString(),
    });

    await enterWorkspace(page);
    await gotoRoute(page, 'routine');

    const cell = page.locator(`.calendar-day[data-date="${isoOf(today)}"]`);

    await expect(cell).toContainText('Reunião de hoje');

    await cell.click();

    await expect(page.locator('.agenda-row', { hasText: 'Reunião de hoje' })).toBeVisible();
  });

  test('navegar de mes pede so o intervalo daquele mes', async ({ page }) => {
    await seed(page, 'k17-navegacao');
    await enterWorkspace(page);
    await gotoRoute(page, 'routine');

    const label = await page.locator('#calendar-label').textContent();

    const request = page.waitForRequest(
      (candidate) => candidate.url().includes('/events?') && candidate.url().includes('from='),
    );

    await page.locator('#calendar-next').click();
    await request;

    await expect(page.locator('#calendar-label')).not.toHaveText(label);
  });

  test('clicar num dia vazio abre o drawer com a data preenchida', async ({ page }) => {
    await seed(page, 'k17-novo');
    await enterWorkspace(page);
    await gotoRoute(page, 'routine');

    const today = new Date();
    const cell = page.locator(`.calendar-day[data-date="${isoOf(today)}"]`);

    await cell.dblclick();

    await expect(page.locator('#event-drawer')).toHaveClass(/active/);
    await expect(page.locator('#event-start-date')).toHaveValue(isoOf(today));
  });
});
