import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

async function apiRequest(page, method, path, body) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`${method} ${path} falhou: ${response.status} ${text}`);
      }

      return text === '' ? null : JSON.parse(text);
    },
    { method, path, body },
  );
}

async function createWorkspace(page, name) {
  const workspace = await apiRequest(page, 'POST', '/workspaces', { name });
  await page.evaluate((id) => sessionStorage.setItem('fluxo_active_workspace', id), workspace.id);
  return workspace;
}

async function enterWorkspace(page) {
  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();
}

async function createEvent(page, workspaceId, data) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/events`, data);
}

async function createHabit(page, workspaceId, data) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/habits`, data);
}

async function markHabit(page, workspaceId, habitId, date) {
  return apiRequest(page, 'PUT', `/workspaces/${workspaceId}/habits/${habitId}/logs/${date}`, {});
}

function isoInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString();
}

function localTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

test.describe('Dashboard - eventos e habitos', () => {
  test('a lista de proximos eventos mostra o que esta dentro dos sete dias e omite o que esta fora', async ({
    page,
  }) => {
    const account = newAccount('dg12-events');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG12 Eventos');

    await createEvent(page, workspace.id, { title: 'Reuniao Proxima', startsAt: isoInDays(2) });
    await createEvent(page, workspace.id, { title: 'Reuniao Distante', startsAt: isoInDays(20) });

    await enterWorkspace(page);

    const panel = page.locator('#dashboard-panel');
    await expect(panel).toBeVisible();

    const eventsList = panel.locator('.dashboard-events');

    await expect(
      eventsList.locator('.dashboard-event', { hasText: 'Reuniao Proxima' }),
    ).toBeVisible();
    await expect(
      eventsList.locator('.dashboard-event', { hasText: 'Reuniao Distante' }),
    ).toHaveCount(0);
  });

  test('habito ja concluido hoje nao aparece em Habitos de hoje; o pendente aparece', async ({
    page,
  }) => {
    const account = newAccount('dg12-habits');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG12 Habitos');

    const doneHabit = await createHabit(page, workspace.id, { name: 'Ja feito' });
    const pendingHabit = await createHabit(page, workspace.id, { name: 'Pendente' });

    await markHabit(page, workspace.id, doneHabit.id, localTodayIso());

    await enterWorkspace(page);

    const panel = page.locator('#dashboard-panel');
    const habitsList = panel.locator('.dashboard-habits');

    await expect(
      habitsList.locator(`.dashboard-habit[data-habit="${pendingHabit.id}"]`),
    ).toBeVisible();
    await expect(
      habitsList.locator(`.dashboard-habit[data-habit="${doneHabit.id}"]`),
    ).toHaveCount(0);
  });

  test('marcar um habito pelo dashboard envia a data local, remove o habito da lista e persiste apos reload', async ({
    page,
  }) => {
    const account = newAccount('dg12-mark');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG12 Marcar');

    const habit = await createHabit(page, workspace.id, { name: 'Beber agua' });

    await enterWorkspace(page);

    const panel = page.locator('#dashboard-panel');
    const habitRow = panel.locator(`.dashboard-habit[data-habit="${habit.id}"]`);
    await expect(habitRow).toBeVisible();

    const today = localTodayIso();
    const putRequest = page.waitForRequest(
      (request) =>
        request.url().includes(`/habits/${habit.id}/logs/`) && request.method() === 'PUT',
    );

    await habitRow.locator('.dashboard-habit-check').click();

    const request = await putRequest;
    expect(new URL(request.url()).pathname.endsWith(`/logs/${today}`)).toBe(true);

    await expect(panel.locator(`.dashboard-habit[data-habit="${habit.id}"]`)).toHaveCount(0);
    await expect(panel.locator('.dashboard-habits .empty')).toHaveText('Tudo em dia.');

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();

    const reloadedPanel = page.locator('#dashboard-panel');
    await expect(reloadedPanel).toBeVisible();
    await expect(
      reloadedPanel.locator(`.dashboard-habit[data-habit="${habit.id}"]`),
    ).toHaveCount(0);
    await expect(reloadedPanel.locator('.dashboard-habits .empty')).toHaveText('Tudo em dia.');
  });

  test('marcar habito pelo dashboard passa por PendingButton: desabilitado e aria-busy durante a chamada', async ({
    page,
  }) => {
    const account = newAccount('dg12-pending');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG12 Pendente');

    const habit = await createHabit(page, workspace.id, { name: 'Meditar' });

    await enterWorkspace(page);

    const panel = page.locator('#dashboard-panel');
    const habitRow = panel.locator(`.dashboard-habit[data-habit="${habit.id}"]`);
    await expect(habitRow).toBeVisible();

    await page.route(`**/api/workspaces/${workspace.id}/habits/${habit.id}/logs/*`, async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    const checkButton = habitRow.locator('.dashboard-habit-check');
    await checkButton.click();

    await expect(checkButton).toBeDisabled();
    await expect(checkButton).toHaveAttribute('aria-busy', 'true');
    await expect(checkButton.locator('.btn-spinner')).toBeVisible();

    await expect(panel.locator(`.dashboard-habit[data-habit="${habit.id}"]`)).toHaveCount(0);
    await expect(panel.locator('.dashboard-habits .empty')).toHaveText('Tudo em dia.');
  });
});
