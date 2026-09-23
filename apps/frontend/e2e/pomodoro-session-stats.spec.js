import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function seed(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);

  await createProject(page, workspace.id, 'Projeto do foco');
  await setNavigationPlacement(page, { dock: 'bottom' });

  return workspace;
}

test.describe('Estatisticas da sessao de Pomodoro', () => {
  test('conta quantas vezes entrou em foco e em pausa nesta sentada', async ({ page }) => {
    await seed(page, 'k15-contagem');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.clock.install();

    await page.locator('#btn-toggle-timer').click();
    await page.clock.runFor('01:00');
    await page.locator('#btn-toggle-timer').click();

    await page.locator('.pomo-mode-btn[data-mode="shortBreak"]').click();
    await page.locator('#btn-toggle-timer').click();
    await page.clock.runFor('01:00');
    await page.locator('#btn-toggle-timer').click();

    await expect(page.locator('#session-focus-count')).toHaveText('1');
    await expect(page.locator('#session-break-count')).toHaveText('1');
    await expect(page.locator('#session-focus-time')).toContainText('1');
  });

  test('zerar a sessao limpa as contagens sem mexer no historico', async ({ page }) => {
    await seed(page, 'k15-zerar');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.clock.install();
    await page.locator('#btn-toggle-timer').click();
    await page.clock.runFor('01:00');
    await page.locator('#btn-toggle-timer').click();

    await expect(page.locator('#session-focus-count')).toHaveText('1');

    await page.locator('#btn-clear-session').click();

    await expect(page.locator('#session-focus-count')).toHaveText('0');
    await expect(page.locator('#stat-summary')).toContainText('1 ciclos');
  });

  test('mudar o tempo de foco com o timer parado atualiza o mostrador', async ({ page }) => {
    await seed(page, 'k15-tempo');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await expect(page.locator('#time-display')).toHaveText('25:00');

    await page.locator('#input-time-focus').fill('30');
    await page.locator('#input-time-focus').blur();

    await expect(page.locator('#time-display')).toHaveText('30:00');
  });

  test('mudar o tempo de foco estando em pausa nao perde o valor', async ({ page }) => {
    await seed(page, 'k15-pausa');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.locator('.pomo-mode-btn[data-mode="shortBreak"]').click();
    await page.locator('#input-time-focus').fill('45');
    await page.locator('#input-time-focus').blur();

    await page.locator('.pomo-mode-btn[data-mode="focus"]').click();

    await expect(page.locator('#time-display')).toHaveText('45:00');
  });
});
