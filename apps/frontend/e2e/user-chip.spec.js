import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

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

async function createWorkspace(page, name) {
  return apiPost(page, '/workspaces', { name });
}

async function enterWorkspace(page, workspace) {
  await page.evaluate((workspaceId) => {
    sessionStorage.setItem('fluxo_active_workspace', workspaceId);
  }, workspace.id);

  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();
}

function initialsOf(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

async function meStatus(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/me', { credentials: 'include' });
    return response.status;
  });
}

test.describe('Chip de usuario, trocar workspace e sair', () => {
  test('o chip mostra as iniciais do usuario e o nome do workspace ativo', async ({ page }) => {
    const account = newAccount('chip-basics');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Chip Basico');
    await enterWorkspace(page, workspace);

    const chip = page.locator('.user-chip');
    await expect(chip).toBeVisible();
    await expect(chip.locator('.user-chip-avatar')).toHaveText(initialsOf(account.name));
    await expect(chip.locator('.user-chip-text strong')).toHaveText(account.name);
    await expect(chip.locator('.user-chip-text span')).toHaveText(workspace.name);
  });

  test('no modo lateral o chip mostra nome e workspace por extenso e fica no rodape da barra', async ({
    page,
  }) => {
    const account = newAccount('chip-sidebar');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Chip Lateral');
    await enterWorkspace(page, workspace);

    await page.locator('.drag-handle').dblclick();
    await expect(page.locator('.app-container')).toHaveAttribute('data-nav', 'sidebar');

    const chipText = page.locator('.user-chip-text');
    await expect(chipText).toBeVisible();
    await expect(chipText.locator('strong')).toHaveText(account.name);
    await expect(chipText.locator('span')).toHaveText(workspace.name);

    const navBox = await page.locator('.floating-nav').boundingBox();
    const chipBox = await page.locator('.user-chip').boundingBox();
    expect(chipBox.y + chipBox.height).toBeLessThanOrEqual(navBox.y + navBox.height + 1);
    expect(chipBox.y + chipBox.height).toBeGreaterThan(navBox.y + navBox.height - 60);
  });

  test('clicar no chip abre o menu e clicar fora fecha', async ({ page }) => {
    const account = newAccount('chip-toggle');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Chip Menu');
    await enterWorkspace(page, workspace);

    const menu = page.locator('.user-chip-menu');
    await expect(menu).not.toHaveClass(/open/);

    await page.locator('.user-chip-trigger').click();
    await expect(menu).toHaveClass(/open/);

    await page.mouse.click(10, 10);
    await expect(menu).not.toHaveClass(/open/);
  });

  test('trocar workspace leva para workspace.html, limpa o workspace ativo e permite escolher outro', async ({
    page,
  }) => {
    const account = newAccount('chip-switch');
    await signUp(page, account);
    const first = await createWorkspace(page, 'Workspace Um');
    const second = await createWorkspace(page, 'Workspace Dois');
    await enterWorkspace(page, first);

    await expect(page.locator('.user-chip-text span')).toHaveText(first.name);

    await page.evaluate(() => sessionStorage.setItem('fluxo_active_project', 'algum-projeto'));

    await page.locator('.user-chip-trigger').click();
    await page.locator('[data-action="switch"]').click();

    await page.waitForURL('**/workspace.html');

    const storage = await page.evaluate(() => ({
      workspace: sessionStorage.getItem('fluxo_active_workspace'),
      project: sessionStorage.getItem('fluxo_active_project'),
    }));
    expect(storage.workspace).toBeNull();
    expect(storage.project).toBeNull();

    const items = page.locator('#workspaceList .list-item');
    await expect(items).toHaveCount(2);
    await expect(page.locator('#workspaceList')).toContainText(second.name);

    await page.getByRole('button', { name: second.name }).click();
    await page.waitForURL('**/index.html');
    await expect(page.locator('.user-chip-text span')).toHaveText(second.name);
  });

  test('meu perfil abre a Guilda ja com o proprio card em modo edicao', async ({ page }) => {
    const account = newAccount('chip-profile');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Chip Perfil');
    await enterWorkspace(page, workspace);

    await page.locator('.user-chip-trigger').click();
    await page.locator('[data-action="profile"]').click();

    await expect(page.locator('[data-route="team"]')).toHaveClass(/active/);
    await expect(page.locator('#steam-modal')).toHaveClass(/active/);
    await expect(page.locator('.sp-left-name')).toHaveText(account.name);
    await expect(page.locator('#btn-save-edit')).toBeVisible();
  });

  test('uma falha ao carregar a Guilda apos abrir Meu perfil nao deixa o card abrir sozinho num reload seguinte e nao relacionado', async ({
    page,
  }) => {
    const account = newAccount('chip-profile-race');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Chip Corrida');
    await apiPost(page, `/workspaces/${workspace.id}/projects`, { name: 'Projeto A' });
    const projectB = await apiPost(page, `/workspaces/${workspace.id}/projects`, {
      name: 'Projeto B',
    });
    await enterWorkspace(page, workspace);

    let statsCalls = 0;
    await page.route('**/api/me/stats', async (route) => {
      statsCalls += 1;
      if (statsCalls === 1) {
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await page.locator('.user-chip-trigger').click();
    await page.locator('[data-action="profile"]').click();

    await expect(page.locator('[data-route="team"]')).toHaveClass(/active/);
    await expect(page.locator('.page-feedback')).toBeVisible();
    await expect(page.locator('#steam-modal')).not.toHaveClass(/active/);

    await page.keyboard.press('Alt+Digit2');
    await expect(page.locator('[data-route="tasks"]')).toHaveClass(/active/);

    await page.locator(`.project-btn[data-id="${projectB.id}"]`).click();
    await page.waitForLoadState('networkidle');

    expect(statsCalls).toBeGreaterThanOrEqual(2);
    await expect(page.locator(`.project-btn[data-id="${projectB.id}"]`)).toHaveClass(/active/);
    await expect(page.locator('#steam-modal')).not.toHaveClass(/active/);
  });

  test('sair mostra o botao pendente, encerra a sessao de verdade e leva ao login', async ({
    page,
  }) => {
    const account = newAccount('chip-signout');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Chip Sair');
    await enterWorkspace(page, workspace);

    await page.route('**/api/auth/sign-out', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.locator('.user-chip-trigger').click();
    const signOutButton = page.locator('[data-action="signout"]');
    await signOutButton.click();

    await expect(signOutButton).toBeDisabled();
    await expect(signOutButton).toHaveAttribute('aria-busy', 'true');
    await expect(signOutButton.locator('.btn-spinner')).toBeVisible();

    await page.waitForURL('**/login.html');

    expect(await meStatus(page)).toBe(401);

    await page.goto('/index.html');
    await page.waitForURL('**/login.html');
  });

  test('sair leva ao login mesmo se a chamada de logout falhar no servidor', async ({ page }) => {
    const account = newAccount('chip-signout-fails');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Chip Sair Falha');
    await enterWorkspace(page, workspace);

    await page.route('**/api/auth/sign-out', async (route) => {
      await route.fulfill({ status: 500, body: 'erro forcado pelo teste' });
    });

    await page.locator('.user-chip-trigger').click();
    await page.locator('[data-action="signout"]').click();

    await page.waitForURL('**/login.html');
  });
});
