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

async function legacyKeysAreNull(page) {
  return page.evaluate(() => ({
    edge: localStorage.getItem('fluxo_dock_edge'),
    left: localStorage.getItem('fluxo_dock_left'),
    top: localStorage.getItem('fluxo_dock_top'),
  }));
}

async function navKeys(page) {
  return page.evaluate(() => ({
    edge: localStorage.getItem('fluxo.nav.edge'),
    left: localStorage.getItem('fluxo.nav.left'),
    top: localStorage.getItem('fluxo.nav.top'),
    mode: localStorage.getItem('fluxo.nav.mode'),
  }));
}

test.describe('Navegacao com dois modos e tooltip', () => {
  test('a barra aparece flutuando por padrao, sem encaixe e sem chaves de posicao salvas', async ({
    page,
  }) => {
    const account = newAccount('nav-default');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Nav Padrao');

    await expect(page.locator('.app-container')).toHaveAttribute('data-nav', 'floating');
    await expect(page.locator('.floating-nav')).toHaveAttribute('data-mode', 'floating');
    await expect(page.locator('.floating-nav')).toBeVisible();
    expect(await page.locator('.floating-nav').getAttribute('data-dock')).toBeNull();

    const keys = await navKeys(page);
    expect(keys.edge).toBeNull();
    expect(keys.left).toBeNull();
    expect(keys.top).toBeNull();

    const legacy = await legacyKeysAreNull(page);
    expect(legacy.edge).toBeNull();
    expect(legacy.left).toBeNull();
    expect(legacy.top).toBeNull();
  });

  test('arrastar a barra ate a borda esquerda acende a zona de encaixe, encosta a barra e a posicao sobrevive ao reload', async ({
    page,
  }) => {
    const account = newAccount('nav-drag-left');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Nav Arraste');

    const handle = page.locator('.drag-handle');
    const handleBox = await handle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(15, 300, { steps: 12 });

    await expect(page.locator('.dock-drop-zone')).toHaveAttribute('data-zone', 'left');

    await page.mouse.up();

    await expect(page.locator('.floating-nav')).toHaveAttribute('data-dock', 'left');

    const keysAfterDrop = await navKeys(page);
    expect(keysAfterDrop.edge).toBe('left');
    expect(keysAfterDrop.left).toBeNull();
    expect(keysAfterDrop.top).toBeNull();

    const legacyAfterDrop = await legacyKeysAreNull(page);
    expect(legacyAfterDrop.edge).toBeNull();
    expect(legacyAfterDrop.left).toBeNull();
    expect(legacyAfterDrop.top).toBeNull();

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();

    await expect(page.locator('.floating-nav')).toHaveAttribute('data-dock', 'left');
    const keysAfterReload = await navKeys(page);
    expect(keysAfterReload.edge).toBe('left');
  });

  test('com a barra encostada a esquerda, passar o mouse sobre um icone mostra a tooltip com nome e atalho do lado direito apos o atraso', async ({
    page,
  }) => {
    const account = newAccount('nav-tooltip');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Nav Tooltip');

    const handle = page.locator('.drag-handle');
    const handleBox = await handle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(15, 300, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('.floating-nav')).toHaveAttribute('data-dock', 'left');

    const tasksButton = page.locator('[data-route="tasks"]');
    const buttonBox = await tasksButton.boundingBox();

    const tooltip = page.locator('.nav-tooltip');
    const tooltipDelay = 400;

    await page.clock.install();
    await tasksButton.hover();

    await page.clock.runFor(tooltipDelay - 150);
    await expect(tooltip).not.toHaveClass(/visible/);

    await page.clock.runFor(200);
    await expect(tooltip).toHaveClass(/visible/);

    await expect(tooltip.locator('span')).toHaveText('Tarefas e Projetos');
    await expect(tooltip.locator('kbd')).toHaveText('Alt+2');

    const tooltipBox = await tooltip.boundingBox();
    expect(tooltipBox.x).toBeGreaterThanOrEqual(buttonBox.x + buttonBox.width - 2);

    await page.mouse.move(700, 700);
    await expect(tooltip).not.toHaveClass(/visible/);
  });

  test('duplo clique no handle troca para o modo lateral, encolhendo o conteudo e desligando a tooltip, e duplo clique novamente restaura o flutuante na posicao anterior', async ({
    page,
  }) => {
    const account = newAccount('nav-mode-toggle');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Nav Modo');

    const container = page.locator('.app-container');
    const nav = page.locator('.floating-nav');
    const mainWrapper = page.locator('.main-wrapper');
    const handle = page.locator('.drag-handle');

    await expect(container).toHaveAttribute('data-nav', 'floating');
    await expect(container).toHaveCSS('display', 'flex');

    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(420, 420, { steps: 12 });
    await page.mouse.up();

    expect(await nav.getAttribute('data-dock')).toBeNull();
    const floatingPosition = await navKeys(page);
    expect(floatingPosition.edge).toBeNull();
    expect(floatingPosition.left).not.toBeNull();
    expect(floatingPosition.top).not.toBeNull();

    await handle.dblclick();

    await expect(container).toHaveAttribute('data-nav', 'sidebar');
    await expect(nav).toHaveAttribute('data-mode', 'sidebar');
    await expect(container).toHaveCSS('display', 'grid');

    const navBox = await nav.boundingBox();
    const mainWrapperBox = await mainWrapper.boundingBox();
    expect(mainWrapperBox.x).toBeGreaterThanOrEqual(navBox.x + navBox.width - 1);

    await expect(page.locator('[data-route="tasks"] .nav-shortcut')).toBeVisible();
    await expect(page.locator('[data-route="tasks"] .nav-shortcut')).toHaveText('Alt+2');

    await page.locator('[data-route="tasks"]').hover();
    await page.waitForTimeout(600);
    await expect(page.locator('.nav-tooltip')).not.toHaveClass(/visible/);

    const positionAfterFirstToggle = await navKeys(page);
    expect(positionAfterFirstToggle.left).toBe(floatingPosition.left);
    expect(positionAfterFirstToggle.top).toBe(floatingPosition.top);
    expect(positionAfterFirstToggle.edge).toBeNull();

    await handle.dblclick();

    await expect(container).toHaveAttribute('data-nav', 'floating');
    await expect(nav).toHaveAttribute('data-mode', 'floating');
    await expect(container).toHaveCSS('display', 'flex');

    const positionAfterSecondToggle = await navKeys(page);
    expect(positionAfterSecondToggle.left).toBe(floatingPosition.left);
    expect(positionAfterSecondToggle.top).toBe(floatingPosition.top);

    const finalStyle = await nav.evaluate((element) => ({
      left: element.style.left,
      top: element.style.top,
    }));
    expect(finalStyle.left).toBe(floatingPosition.left);
    expect(finalStyle.top).toBe(floatingPosition.top);

    const legacy = await legacyKeysAreNull(page);
    expect(legacy.edge).toBeNull();
    expect(legacy.left).toBeNull();
    expect(legacy.top).toBeNull();
  });

  test('encostar a barra na borda esquerda e depois ir e voltar do modo lateral mantem o mesmo encaixe', async ({
    page,
  }) => {
    const account = newAccount('nav-dock-survives-toggle');
    await signUp(page, account);
    await enterWorkspace(page, 'Workspace Nav Encaixe e Modo');

    const container = page.locator('.app-container');
    const nav = page.locator('.floating-nav');
    const handle = page.locator('.drag-handle');
    const handleBox = await handle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(15, 300, { steps: 12 });
    await page.mouse.up();

    await expect(nav).toHaveAttribute('data-dock', 'left');
    const keysAfterDock = await navKeys(page);
    expect(keysAfterDock.edge).toBe('left');

    await handle.dblclick();
    await expect(container).toHaveAttribute('data-nav', 'sidebar');

    await handle.dblclick();
    await expect(container).toHaveAttribute('data-nav', 'floating');

    await expect(nav).toHaveAttribute('data-dock', 'left');
    const keysAfterRoundTrip = await navKeys(page);
    expect(keysAfterRoundTrip.edge).toBe('left');
    expect(keysAfterRoundTrip.left).toBeNull();
    expect(keysAfterRoundTrip.top).toBeNull();

    const legacy = await legacyKeysAreNull(page);
    expect(legacy.edge).toBeNull();
    expect(legacy.left).toBeNull();
    expect(legacy.top).toBeNull();
  });
});
