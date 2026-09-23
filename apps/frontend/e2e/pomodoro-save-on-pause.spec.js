import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
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

test.describe('Pomodoro grava o tempo ao pausar', () => {
  test('pausar depois de dois minutos grava a sessao', async ({ page }) => {
    await seed(page, 'k14-pausa');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.clock.install();
    await page.locator('#btn-toggle-timer').click();
    await page.clock.runFor('02:00');
    await page.locator('#btn-toggle-timer').click();

    await expect
      .poll(async () => (await apiRequest(page, 'GET', '/pomodoro/sessions')).length, {
        timeout: 10_000,
      })
      .toBe(1);

    const [recorded] = await apiRequest(page, 'GET', '/pomodoro/sessions');

    expect(recorded.mode).toBe('FOCUS');
    expect(recorded.durationMinutes).toBe(2);
  });

  test('dois trechos curtos somam e viram um minuto gravado', async ({ page }) => {
    await seed(page, 'k14-resto');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.clock.install();

    for (let round = 0; round < 2; round += 1) {
      await page.locator('#btn-toggle-timer').click();
      await page.clock.runFor('00:40');
      await page.locator('#btn-toggle-timer').click();
    }

    await expect
      .poll(async () => (await apiRequest(page, 'GET', '/pomodoro/sessions')).length, {
        timeout: 10_000,
      })
      .toBe(1);
  });

  test('falha ao gravar nao perde o tempo, que soma no proximo trecho', async ({ page }) => {
    await seed(page, 'k14-falha');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.clock.install();

    let postCount = 0;

    await page.route('**/api/pomodoro/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        postCount += 1;

        if (postCount === 1) {
          await route.fulfill({ status: 500, body: 'erro forcado' });
          return;
        }
      }

      await route.continue();
    });

    await page.locator('#btn-toggle-timer').click();
    await page.clock.runFor('01:00');
    await page.locator('#btn-toggle-timer').click();

    await expect.poll(() => postCount).toBe(1);
    expect(await apiRequest(page, 'GET', '/pomodoro/sessions')).toHaveLength(0);

    await page.locator('#btn-toggle-timer').click();
    await page.clock.runFor('01:00');
    await page.locator('#btn-toggle-timer').click();

    await expect
      .poll(async () => (await apiRequest(page, 'GET', '/pomodoro/sessions')).length, {
        timeout: 10_000,
      })
      .toBe(1);

    const [recorded] = await apiRequest(page, 'GET', '/pomodoro/sessions');

    expect(recorded.durationMinutes).toBe(2);
  });

  test('pausar antes de qualquer segundo nao grava nada', async ({ page }) => {
    await seed(page, 'k14-zero');
    await enterWorkspace(page);
    await gotoRoute(page, 'pomodoro');

    await page.locator('#btn-toggle-timer').click();
    await page.locator('#btn-toggle-timer').click();

    await page.waitForTimeout(1000);

    expect(await apiRequest(page, 'GET', '/pomodoro/sessions')).toHaveLength(0);
  });
});
