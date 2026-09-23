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

async function openPomodoro(page) {
  await page.keyboard.press('Alt+Digit6');
  await expect(page.locator('#time-display')).toBeVisible();
  await expect(page.locator('.pomodoro-wrapper.is-loading')).toHaveCount(0);
}

async function reloadOnPomodoro(page) {
  await page.reload();
  await expect(page.locator('#global-bg')).toBeAttached();
  await openPomodoro(page);
}

async function readPomodoroTimes(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('fluxo.pomodoro.times');
    return raw ? JSON.parse(raw) : null;
  });
}

test.describe('Steppers do Pomodoro', () => {
  test('cada campo continua sendo input[type=number] dentro de um stepper com os botoes de menos e mais', async ({
    page,
  }) => {
    const account = newAccount('pomo-stepper-markup');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Stepper Markup');
    await openPomodoro(page);

    for (const target of ['focus', 'short', 'long']) {
      const input = page.locator(`#input-time-${target}`);
      await expect(input).toHaveAttribute('type', 'number');
      await expect(input.locator('xpath=ancestor::div[contains(@class,"stepper")]')).toHaveCount(1);

      const minus = page.locator(`.stepper-btn[data-target="${target}"][data-step="-1"]`);
      const plus = page.locator(`.stepper-btn[data-target="${target}"][data-step="1"]`);
      await expect(minus).toBeVisible();
      await expect(plus).toBeVisible();
    }
  });

  test('a setinha nativa do navegador fica escondida mas o teclado continua funcionando no input', async ({
    page,
  }) => {
    const account = newAccount('pomo-stepper-spinner');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Stepper Spinner');
    await openPomodoro(page);

    const input = page.locator('#input-time-focus');

    const appearance = await input.evaluate((el) => getComputedStyle(el).appearance);
    expect(appearance).toBe('textfield');

    await expect(input).toHaveValue('25');
    const box = await input.boundingBox();

    await page.mouse.click(box.x + box.width - 4, box.y + box.height * 0.25);
    await expect(input).toHaveValue('25');

    await page.mouse.click(box.x + box.width - 4, box.y + box.height * 0.75);
    await expect(input).toHaveValue('25');

    await input.fill('45');
    await expect(input).toHaveValue('45');
  });

  test('o botao + trava em 120 no Foco e o botao - trava em 1, gravando a cada clique', async ({
    page,
  }) => {
    const account = newAccount('pomo-stepper-focus-bounds');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Stepper Foco Limites');
    await openPomodoro(page);

    const input = page.locator('#input-time-focus');
    const plus = page.locator('.stepper-btn[data-target="focus"][data-step="1"]');
    const minus = page.locator('.stepper-btn[data-target="focus"][data-step="-1"]');

    await expect(input).toHaveValue('25');

    for (let i = 0; i < 95; i += 1) {
      await plus.click();
    }
    await expect(input).toHaveValue('120');

    let times = await readPomodoroTimes(page);
    expect(times.focus).toBe(120);

    await plus.click();
    await expect(input).toHaveValue('120');
    times = await readPomodoroTimes(page);
    expect(times.focus).toBe(120);

    await reloadOnPomodoro(page);
    await expect(page.locator('#input-time-focus')).toHaveValue('120');

    for (let i = 0; i < 130; i += 1) {
      await minus.click();
    }
    await expect(input).toHaveValue('1');
    times = await readPomodoroTimes(page);
    expect(times.focus).toBe(1);

    await minus.click();
    await expect(input).toHaveValue('1');
    times = await readPomodoroTimes(page);
    expect(times.focus).toBe(1);
  });

  test('o botao + trava em 60 nas pausas curta e longa', async ({ page }) => {
    const account = newAccount('pomo-stepper-break-bounds');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Stepper Pausas Limites');
    await openPomodoro(page);

    const shortInput = page.locator('#input-time-short');
    const shortPlus = page.locator('.stepper-btn[data-target="short"][data-step="1"]');
    const longInput = page.locator('#input-time-long');
    const longPlus = page.locator('.stepper-btn[data-target="long"][data-step="1"]');

    await expect(shortInput).toHaveValue('5');
    await expect(longInput).toHaveValue('15');

    for (let i = 0; i < 55; i += 1) {
      await shortPlus.click();
    }
    await expect(shortInput).toHaveValue('60');
    await shortPlus.click();
    await expect(shortInput).toHaveValue('60');

    for (let i = 0; i < 45; i += 1) {
      await longPlus.click();
    }
    await expect(longInput).toHaveValue('60');
    await longPlus.click();
    await expect(longInput).toHaveValue('60');

    const times = await readPomodoroTimes(page);
    expect(times.shortBreak).toBe(60);
    expect(times.longBreak).toBe(60);
  });

  test('digitar um valor pelo teclado e clicar fora grava o campo e sobrevive ao reload', async ({
    page,
  }) => {
    const account = newAccount('pomo-stepper-typed');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Stepper Digitado');
    await openPomodoro(page);

    const input = page.locator('#input-time-focus');
    await input.fill('45');
    await page.locator('.pomo-header h1').click();

    await expect(input).toHaveValue('45');
    const times = await readPomodoroTimes(page);
    expect(times.focus).toBe(45);

    await reloadOnPomodoro(page);
    await expect(page.locator('#input-time-focus')).toHaveValue('45');
  });

  test('as setas do teclado dentro do campo continuam funcionando e gravam ao sair do campo', async ({
    page,
  }) => {
    const account = newAccount('pomo-stepper-arrows');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Stepper Setas');
    await openPomodoro(page);

    const input = page.locator('#input-time-focus');
    await expect(input).toHaveValue('25');

    await input.click();
    await input.press('ArrowUp');
    await input.press('ArrowUp');
    await input.press('ArrowDown');

    await expect(input).toHaveValue('26');

    await page.locator('.pomo-header h1').click();

    const times = await readPomodoroTimes(page);
    expect(times.focus).toBe(26);
  });

  test('a capsula do stepper fica compacta e o input fica alinhado verticalmente com os botoes', async ({
    page,
  }) => {
    const account = newAccount('pomo-stepper-geometry');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Stepper Geometria');
    await openPomodoro(page);

    const input = page.locator('#input-time-focus');
    const capsule = input.locator('xpath=ancestor::div[contains(@class,"stepper")]');
    const plus = page.locator('.stepper-btn[data-target="focus"][data-step="1"]');
    const minus = page.locator('.stepper-btn[data-target="focus"][data-step="-1"]');

    const inputBox = await input.boundingBox();
    const capsuleBox = await capsule.boundingBox();
    const plusBox = await plus.boundingBox();
    const minusBox = await minus.boundingBox();

    expect(inputBox.height).toBeLessThanOrEqual(capsuleBox.height);
    expect(capsuleBox.height).toBeGreaterThanOrEqual(26);
    expect(capsuleBox.height).toBeLessThanOrEqual(34);

    const inputCenterY = inputBox.y + inputBox.height / 2;
    const plusCenterY = plusBox.y + plusBox.height / 2;
    const minusCenterY = minusBox.y + minusBox.height / 2;

    expect(Math.abs(inputCenterY - plusCenterY)).toBeLessThanOrEqual(2);
    expect(Math.abs(inputCenterY - minusCenterY)).toBeLessThanOrEqual(2);
  });
});
