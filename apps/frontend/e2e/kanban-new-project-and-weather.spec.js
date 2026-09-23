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

async function inviteMember(page, workspaceId, role = 'MEMBER') {
  const invite = await apiRequest(page, 'POST', `/workspaces/${workspaceId}/invites`, { role });
  return invite.code;
}

async function joinWorkspaceAsMember(memberPage, account, code, workspaceId) {
  await signUp(memberPage, account);
  await apiRequest(memberPage, 'POST', `/invites/${encodeURIComponent(code)}/accept`, {});
  await memberPage.evaluate(
    (id) => sessionStorage.setItem('fluxo_active_workspace', id),
    workspaceId,
  );
}

async function gotoRoute(page, routeId) {
  await page.locator(`[data-route="${routeId}"]`).click();
  await expect(page.locator(`[data-route="${routeId}"]`)).toHaveClass(/active/);
}

async function mockWeather(page, weathercode) {
  await page.route('https://get.geojs.io/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        city: 'Testópolis',
        region: 'Testland',
        country: 'Testlandia',
        latitude: -23.5,
        longitude: -46.6,
      }),
    });
  });

  await page.route('https://api.open-meteo.com/**', async (route) => {
    const currentWeather =
      weathercode === undefined
        ? { temperature: 21 }
        : { temperature: 21, weathercode };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ current_weather: currentWeather }),
    });
  });
}

test.describe('botao de novo projeto no Kanban', () => {
  test('clicar no + do Kanban leva a Tarefas, cria o projeto e ele aparece de volta no quadro', async ({
    page,
  }) => {
    const owner = newAccount('kanban-create-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Kanban Criar');
    await enterWorkspace(page);

    await gotoRoute(page, 'kanban');

    const kanbanOpenBtn = page.locator('.kanban-wrapper #btn-open-proj-modal');
    await expect(kanbanOpenBtn).toBeVisible();

    const createRequest = page.waitForRequest(
      (request) =>
        request.url().includes(`/api/workspaces/${workspace.id}/projects`) &&
        request.method() === 'POST',
    );

    await kanbanOpenBtn.click();

    await expect(page.locator('[data-route="tasks"]')).toHaveClass(/active/);

    const projectName = 'Projeto Criado via Kanban';
    await page.locator('.tasks-container #btn-open-proj-modal').click();
    await page.locator('#input-proj-name').fill(projectName);
    await page.locator('#btn-save-proj').click();

    const request = await createRequest;
    expect(JSON.parse(request.postData()).name).toBe(projectName);

    await gotoRoute(page, 'kanban');
    await expect(
      page.locator('.kanban-wrapper .project-btn', { hasText: projectName }),
    ).toBeVisible();
  });

  test('um MEMBER nao ve o botao de novo projeto no Kanban', async ({ page, browser }) => {
    const owner = newAccount('kanban-role-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Kanban Papel');
    const inviteCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const member = newAccount('kanban-role-member');
    await joinWorkspaceAsMember(memberPage, member, inviteCode, workspace.id);
    await enterWorkspace(memberPage);

    await gotoRoute(memberPage, 'kanban');

    await expect(memberPage.locator('.kanban-wrapper #btn-open-proj-modal')).toHaveCount(0);

    await memberContext.close();
  });
});

test.describe('icone do clima no Playground', () => {
  test('o icone muda de acordo com o weathercode retornado pela API', async ({ page }) => {
    let weathercode = 0;
    await page.route('https://get.geojs.io/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          city: 'Testópolis',
          region: 'Testland',
          country: 'Testlandia',
          latitude: -23.5,
          longitude: -46.6,
        }),
      });
    });
    await page.route('https://api.open-meteo.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ current_weather: { temperature: 21, weathercode } }),
      });
    });

    await signUp(page, newAccount('weather-icon-changes'));
    await createWorkspace(page, 'Workspace Clima Icone');
    await enterWorkspace(page);

    await expect(page.locator('#weather-icon')).toHaveAttribute('data-lucide', 'sun');

    weathercode = 95;
    await page.reload();

    await expect(page.locator('#weather-icon')).toHaveAttribute('data-lucide', 'cloud-lightning');

    await page.locator('#weather-widget').click();

    await expect(page.locator('#weather-icon')).toHaveAttribute('data-lucide', 'cloud-lightning');
    await expect(page.locator('#weather-icon')).toBeVisible();
  });

  test('um weathercode desconhecido ou ausente cai no icone padrao, sem travar nem ficar em branco', async ({
    page,
  }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await mockWeather(page, 12345);

    await signUp(page, newAccount('weather-icon-unknown'));
    await createWorkspace(page, 'Workspace Clima Desconhecido');
    await enterWorkspace(page);

    await expect(page.locator('#weather-icon')).toHaveAttribute('data-lucide', 'cloud');
    await expect(page.locator('#weather-icon')).toBeVisible();

    await page.unroute('https://api.open-meteo.com/**');
    await mockWeather(page, undefined);
    await page.reload();

    await expect(page.locator('#weather-icon')).toHaveAttribute('data-lucide', 'cloud');
    await expect(page.locator('#weather-icon')).toBeVisible();

    expect(pageErrors).toHaveLength(0);
  });
});
