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

async function apiStatus(page, method, path, body) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      return response.status;
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

async function gotoRoute(page, routeId) {
  await page.locator(`[data-route="${routeId}"]`).click();
  await expect(page.locator(`[data-route="${routeId}"]`)).toHaveClass(/active/);
}

async function gotoHabits(page) {
  await gotoRoute(page, 'routine');
  await page.locator('.routine-tab[data-tab="habits"]').click();
  await expect(page.locator('.routine-tab[data-tab="habits"]')).toHaveClass(/active/);
}

async function createHabit(page, name) {
  await page.locator('#habit-name').fill(name);
  await page.locator('#btn-new-habit').click();
  await expect(page.locator('.habit-row', { hasText: name })).toBeVisible();
}

async function callHabitApi(page, methodName, args) {
  return page.evaluate(
    async ({ methodName, args }) => {
      const { habitApi } = await import('/src/api/habit-api.js');
      return habitApi[methodName](...args);
    },
    { methodName, args },
  );
}

function localTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function localIsoOffsetDays(offset) {
  const day = new Date();
  day.setDate(day.getDate() - offset);

  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

test.describe('Rotina - aba Habitos', () => {
  test('criar habito mostra sete dias da semana; marcar hoje envia PUT com a data local e persiste apos reload; marcar duas vezes nao duplica o log; desmarcar remove', async ({
    page,
  }) => {
    const account = newAccount('dg7-mark');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG7 Marcar');
    await enterWorkspace(page);
    await gotoHabits(page);

    await createHabit(page, 'Ler 20 paginas');

    const row = page.locator('.habit-row', { hasText: 'Ler 20 paginas' });
    await expect(row.locator('.habit-day')).toHaveCount(7);

    const habitId = await row.getAttribute('data-id');
    const today = localTodayIso();
    const todayButton = row.locator('.habit-day').last();
    await expect(todayButton).toHaveAttribute('data-date', today);

    const putRequest = page.waitForRequest(
      (request) =>
        request.url().includes(`/habits/${habitId}/logs/`) && request.method() === 'PUT',
    );
    await todayButton.click();
    const request = await putRequest;
    expect(new URL(request.url()).pathname.endsWith(`/logs/${today}`)).toBe(true);

    await expect(todayButton).toHaveClass(/is-done/);

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await gotoHabits(page);

    const reloadedRow = page.locator('.habit-row', { hasText: 'Ler 20 paginas' });
    await expect(reloadedRow.locator('.habit-day').last()).toHaveClass(/is-done/);

    await callHabitApi(page, 'mark', [workspace.id, habitId, today]);
    await callHabitApi(page, 'mark', [workspace.id, habitId, today]);

    const logs = await callHabitApi(page, 'logs', [workspace.id, habitId, today, today]);
    expect(logs).toHaveLength(1);

    const deleteRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/habits/${habitId}/logs/${today}`) &&
        request.method() === 'DELETE',
    );
    await reloadedRow.locator('.habit-day').last().click();
    await deleteRequest;
    await expect(reloadedRow.locator('.habit-day').last()).not.toHaveClass(/is-done/);

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await gotoHabits(page);
    await expect(
      page.locator('.habit-row', { hasText: 'Ler 20 paginas' }).locator('.habit-day').last(),
    ).not.toHaveClass(/is-done/);
  });

  test('quando o PUT de marcar falha, o quadrado volta ao estado anterior e a faixa de erro aparece', async ({
    page,
  }) => {
    const account = newAccount('dg7-fail');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace DG7 Falha');
    await enterWorkspace(page);
    await gotoHabits(page);

    await createHabit(page, 'Meditar');

    const row = page.locator('.habit-row', { hasText: 'Meditar' });
    const todayButton = row.locator('.habit-day').last();

    await page.route('**/habits/*/logs/*', async (route) => {
      if (route.request().method() === 'PUT') {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha simulada ao marcar hábito.' }),
        });
        return;
      }
      await route.continue();
    });

    await todayButton.click();
    await expect(todayButton).toHaveClass(/is-done/);
    await expect(todayButton).not.toHaveClass(/is-done/);
    await expect(page.locator('.page-feedback')).toContainText(
      'Falha simulada ao marcar hábito.',
    );
  });

  test('perto da virada do dia em um fuso muito atrasado em relacao ao UTC, a marcacao ainda usa a data local do navegador, nao a UTC', async ({
    browser,
  }) => {
    const context = await browser.newContext({ timezoneId: 'Etc/GMT+12' });
    const page = await context.newPage();

    await page.clock.install({ time: new Date('2026-09-10T08:00:00.000Z') });

    const account = newAccount('dg7-utc-trap');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG7 Fuso');
    await enterWorkspace(page);
    await gotoHabits(page);

    await createHabit(page, 'Beber agua');

    const row = page.locator('.habit-row', { hasText: 'Beber agua' });
    const todayButton = row.locator('.habit-day').last();

    await expect(todayButton).toHaveAttribute('data-date', '2026-09-09');

    const putRequest = page.waitForRequest(
      (request) => request.url().includes('/logs/') && request.method() === 'PUT',
    );
    await todayButton.click();
    const request = await putRequest;

    expect(new URL(request.url()).pathname.endsWith('/logs/2026-09-09')).toBe(true);
    expect(new URL(request.url()).pathname.endsWith('/logs/2026-09-10')).toBe(false);

    await context.close();
  });

  test('arquivar mantem o habito e seu historico alcancaveis; excluir exige confirmacao e depois remove o habito e os logs', async ({
    page,
  }) => {
    const account = newAccount('dg7-archive-delete');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG7 Arquivar');
    await enterWorkspace(page);
    await gotoHabits(page);

    await createHabit(page, 'Correr');
    const runRow = page.locator('.habit-row', { hasText: 'Correr' });
    const runId = await runRow.getAttribute('data-id');
    const today = localTodayIso();

    await callHabitApi(page, 'mark', [workspace.id, runId, today]);

    await runRow.locator('.btn-habit-archive').click();
    await expect(page.locator('.habit-row', { hasText: 'Correr' })).toHaveCount(0);

    const archivedList = await callHabitApi(page, 'list', [workspace.id, true]);
    const archivedHabit = archivedList.find((habit) => habit.id === runId);
    expect(archivedHabit).toBeTruthy();
    expect(archivedHabit.archived).toBe(true);

    const archivedLogs = await callHabitApi(page, 'logs', [workspace.id, runId, today, today]);
    expect(archivedLogs).toHaveLength(1);

    await createHabit(page, 'Alongar');
    const stretchRow = page.locator('.habit-row', { hasText: 'Alongar' });
    const stretchId = await stretchRow.getAttribute('data-id');
    await callHabitApi(page, 'mark', [workspace.id, stretchId, today]);

    let deleteRequests = 0;
    await page.route(`**/api/workspaces/*/habits/${stretchId}`, async (route) => {
      if (route.request().method() === 'DELETE') deleteRequests += 1;
      await route.continue();
    });

    await stretchRow.locator('.btn-habit-delete').click();
    const dialog = page.locator('.confirm-overlay');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h3')).toHaveText('Excluir hábito');

    await dialog.locator('[data-answer="no"]').click();
    await expect(dialog).toHaveCount(0);
    expect(deleteRequests).toBe(0);
    await expect(page.locator('.habit-row', { hasText: 'Alongar' })).toBeVisible();

    await stretchRow.locator('.btn-habit-delete').click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);

    expect(deleteRequests).toBe(1);
    await expect(page.locator('.habit-row', { hasText: 'Alongar' })).toHaveCount(0);

    const status = await apiStatus(
      page,
      'GET',
      `/workspaces/${workspace.id}/habits/${stretchId}/logs?from=${today}&to=${today}`,
    );
    expect(status).toBe(404);
  });

  test('a faixa de 30 dias reflete exatamente as marcacoes feitas', async ({ page }) => {
    const account = newAccount('dg7-history');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG7 Historico');
    await enterWorkspace(page);
    await gotoHabits(page);

    await createHabit(page, 'Escrever diario');
    const row = page.locator('.habit-row', { hasText: 'Escrever diario' });
    const habitId = await row.getAttribute('data-id');

    const markedOffsets = [0, 3, 10, 29];
    for (const offset of markedOffsets) {
      await callHabitApi(page, 'mark', [workspace.id, habitId, localIsoOffsetDays(offset)]);
    }

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await gotoHabits(page);

    const reloadedRow = page.locator('.habit-row', { hasText: 'Escrever diario' });
    await expect(reloadedRow.locator('.habit-history .habit-tick')).toHaveCount(30);
    await expect(reloadedRow.locator('.habit-history .habit-tick.is-done')).toHaveCount(
      markedOffsets.length,
    );

    const ticks = reloadedRow.locator('.habit-history .habit-tick');
    for (let index = 0; index < 30; index += 1) {
      const offsetFromToday = 29 - index;
      const shouldBeDone = markedOffsets.includes(offsetFromToday);
      if (shouldBeDone) {
        await expect(ticks.nth(index)).toHaveClass(/is-done/);
      } else {
        await expect(ticks.nth(index)).not.toHaveClass(/is-done/);
      }
    }
  });

  test('cliques rapidos e alternados no mesmo dia terminam com o visual igual ao estado real do servidor', async ({
    page,
  }) => {
    const account = newAccount('dg7-race');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG7 Corrida');
    await enterWorkspace(page);
    await gotoHabits(page);

    await createHabit(page, 'Beber agua rapido');
    const row = page.locator('.habit-row', { hasText: 'Beber agua rapido' });
    const habitId = await row.getAttribute('data-id');
    const today = localTodayIso();
    const dayButton = row.locator('.habit-day').last();

    await page.route(`**/habits/${habitId}/logs/${today}`, async (route) => {
      const delay = route.request().method() === 'PUT' ? 600 : 50;

      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.continue();
    });

    const putResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/logs/${today}`) && response.request().method() === 'PUT',
    );

    await dayButton.click();
    await dayButton.click();
    await putResponse;
    await page.waitForTimeout(100);

    const logs = await callHabitApi(page, 'logs', [workspace.id, habitId, today, today]);
    const serverDone = logs.length === 1;
    const visualDone = (await dayButton.getAttribute('class')).includes('is-done');

    expect(visualDone).toBe(serverDone);
  });

  test('arquivar e excluir passam por PendingButton: desabilitado e aria-busy durante a chamada', async ({
    page,
  }) => {
    const account = newAccount('dg7-pending');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG7 Pendente');
    await enterWorkspace(page);
    await gotoHabits(page);

    await createHabit(page, 'Anotar gastos');
    const row = page.locator('.habit-row', { hasText: 'Anotar gastos' });
    const habitId = await row.getAttribute('data-id');

    await page.route(`**/api/workspaces/${workspace.id}/habits/${habitId}`, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    const archiveButton = row.locator('.btn-habit-archive');
    await archiveButton.click();

    await expect(archiveButton).toBeDisabled();
    await expect(archiveButton).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.habit-row', { hasText: 'Anotar gastos' })).toHaveCount(0);

    await createHabit(page, 'Guardar dinheiro');
    const secondRow = page.locator('.habit-row', { hasText: 'Guardar dinheiro' });
    const secondId = await secondRow.getAttribute('data-id');

    await page.route(`**/api/workspaces/${workspace.id}/habits/${secondId}`, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    const deleteButton = secondRow.locator('.btn-habit-delete');
    await deleteButton.click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();

    await expect(deleteButton).toBeDisabled();
    await expect(deleteButton).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.habit-row', { hasText: 'Guardar dinheiro' })).toHaveCount(0);
  });
});
