import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

async function apiGet(page, path) {
  return page.evaluate(async (path) => {
    const response = await fetch(`/api${path}`, { credentials: 'include' });

    if (!response.ok) {
      throw new Error(`Falha em GET ${path}: ${response.status} ${await response.text()}`);
    }

    return response.json();
  }, path);
}

async function apiPost(page, path, body) {
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(`/api${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Falha em POST ${path}: ${response.status} ${await response.text()}`);
      }

      return response.json();
    },
    { path, body },
  );
}

async function enterWorkspace(page, workspaceId) {
  await page.evaluate((workspaceId) => {
    sessionStorage.setItem('fluxo_active_workspace', workspaceId);
  }, workspaceId);

  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();
}

async function openPomodoro(page) {
  await page.locator('[data-route="pomodoro"]').click();
  await expect(page.locator('#time-display')).toBeVisible();
}

function secondsFrom(text) {
  const [minutes, seconds] = text.split(':').map(Number);
  return minutes * 60 + seconds;
}

function cyclesFrom(text) {
  return Number(text.match(/^(\d+) ciclos/)[1]);
}

test.describe('FocusTimer como modulo', () => {
  test('window.FluxoTimer nao existe mais e window.FluxoAmbient continua existindo', async ({
    page,
  }) => {
    const account = newAccount('no-global-timer');
    await signUp(page, account);
    const workspace = await apiPost(page, '/workspaces', { name: 'Workspace Sem Global' });
    await enterWorkspace(page, workspace.id);

    expect(await page.evaluate(() => window.FluxoTimer)).toBeUndefined();
    expect(await page.evaluate(() => typeof window.FluxoAmbient)).toBe('object');
  });

  test('ajustar o foco para 1 minuto e completar o ciclo grava a sessao e sobe o contador', async ({
    page,
  }) => {
    const account = newAccount('cycle-complete');
    await signUp(page, account);
    const workspace = await apiPost(page, '/workspaces', { name: 'Workspace Ciclo' });
    await enterWorkspace(page, workspace.id);
    await openPomodoro(page);

    const summary = page.locator('#stat-summary');
    const cyclesBefore = cyclesFrom(await summary.textContent());

    await page.clock.install();

    const focusInput = page.locator('#input-time-focus');
    await focusInput.fill('1');
    await focusInput.press('Tab');
    await expect(page.locator('#time-display')).toHaveText('01:00');

    await page.locator('#btn-toggle-timer').click();
    await page.clock.runFor(61_000);

    await expect(page.locator('#btn-toggle-timer')).toContainText('Concluído');
    await expect(summary).toHaveText(new RegExp(`^${cyclesBefore + 1} ciclos`));
  });

  test('o timer continua contando ao navegar para outra rota e voltar ao Pomodoro', async ({
    page,
  }) => {
    const account = newAccount('survives-navigation');
    await signUp(page, account);
    const workspace = await apiPost(page, '/workspaces', { name: 'Workspace Navegacao' });
    await enterWorkspace(page, workspace.id);
    await openPomodoro(page);

    const display = page.locator('#time-display');
    const fullTime = secondsFrom(await display.textContent());

    await page.locator('#btn-toggle-timer').click();
    await page.waitForTimeout(2_100);

    const beforeNavigation = secondsFrom(await display.textContent());
    expect(beforeNavigation).toBeLessThan(fullTime);

    await page.locator('[data-route="tasks"]').click();
    await expect(page.locator('[data-route="tasks"]')).toHaveClass(/active/);
    await page.waitForTimeout(2_100);

    await page.locator('[data-route="pomodoro"]').click();
    await expect(page.locator('[data-route="pomodoro"]')).toHaveClass(/active/);

    const afterReturn = secondsFrom(await display.textContent());
    expect(afterReturn).toBeLessThan(beforeNavigation);
  });

  test('selecionar uma demanda no Pomodoro e abrir o proprio card na Guilda mostra a demanda vinculada', async ({
    page,
  }) => {
    const account = newAccount('quest-link');
    await signUp(page, account);
    const me = await apiGet(page, '/me');
    const workspace = await apiPost(page, '/workspaces', { name: 'Workspace Guilda' });
    const project = await apiPost(page, `/workspaces/${workspace.id}/projects`, {
      name: 'Projeto Guilda',
    });
    const columns = await apiGet(page, `/projects/${project.id}/columns`);
    const task = await apiPost(page, `/projects/${project.id}/tasks`, {
      kanbanColumnId: columns[0].id,
      title: 'Investigar FocusTimer',
      priority: 'MEDIUM',
      type: 'FEATURE',
      assigneeId: me.id,
    });

    await enterWorkspace(page, workspace.id);
    await openPomodoro(page);

    await page.locator('#task-select .dropdown-trigger').click();

    const taskOption = page.locator(`#task-select .dropdown-option[data-value="${task.id}"]`);
    await expect(taskOption).toBeVisible();
    await taskOption.click();

    await page.locator('[data-route="team"]').click();
    await expect(page.locator('.dev-card-mini').first()).toBeVisible();

    await page.locator(`.dev-card-mini[data-id="${me.id}"]`).click();
    await expect(page.locator('#steam-modal')).toHaveClass(/active/);

    await page.locator('#btn-cancel-edit').click();
    await expect(page.locator('.quest-info h4')).toHaveText('Demanda vinculada ao Pomodoro');
  });
});
