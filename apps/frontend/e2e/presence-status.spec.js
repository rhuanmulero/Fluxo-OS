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
}

async function meProfile(page) {
  const me = await apiRequest(page, 'GET', '/me');
  return me.profile;
}

async function manualKey(page) {
  return page.evaluate(() => localStorage.getItem('fluxo.presence.manual'));
}

async function openEditProfile(page, userId) {
  await gotoRoute(page, 'team');
  await page.locator(`.dev-card-mini[data-id="${userId}"]`).click();
  await page.locator('#btn-go-edit').click();
  await expect(page.locator('#btn-save-edit')).toBeVisible();
}

async function chooseStatus(page, value) {
  await page.locator('#edit-status .dropdown-trigger').click();
  await page.locator(`#edit-status .dropdown-option[data-value="${value}"]`).click();
  await page.locator('#btn-save-edit').click();
  await expect(page.locator('.steam-profile-modal')).not.toHaveClass(/active/);
}

async function startTimer(page) {
  await gotoRoute(page, 'pomodoro');
  await page.locator('#btn-toggle-timer').click();
}

async function stopTimer(page) {
  await page.locator('#btn-toggle-timer').click();
}

function statusPatchBodies(requests) {
  return requests
    .map((request) => JSON.parse(request.postData() ?? '{}'))
    .filter((body) => 'status' in body);
}

test.describe('presence-service.js - status pela atividade', () => {
  test('iniciar o Pomodoro muda o proprio status para Em Foco e um segundo membro do workspace ve a mudanca', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('presence-two-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Presence Two');
    const inviteCode = await inviteMember(page, workspace.id);
    const ownerId = (await apiRequest(page, 'GET', '/me')).id;

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const member = newAccount('presence-two-member');
    await joinWorkspaceAsMember(memberPage, member, inviteCode, workspace.id);

    await enterWorkspace(page);
    await startTimer(page);

    await expect
      .poll(async () => (await apiRequest(page, 'GET', '/me')).profile.status)
      .toBe('DEEP_WORK');

    await enterWorkspace(memberPage);
    await gotoRoute(memberPage, 'team');

    const ownerCard = memberPage.locator(`.dev-card-mini[data-id="${ownerId}"]`);
    await expect(ownerCard.locator('.status-indicator')).toHaveClass(/status-deepwork/);
    await expect(ownerCard.locator('.status-indicator')).toContainText('Em Foco');

    await memberContext.close();
  });

  test('parar o Pomodoro sem escolha manual devolve o status para Disponivel, nao um valor fixo esquecido em foco', async ({
    page,
  }) => {
    const account = newAccount('presence-stop');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Presence Stop');
    await enterWorkspace(page);

    await startTimer(page);
    await expect
      .poll(async () => (await apiRequest(page, 'GET', '/me')).profile.status)
      .toBe('DEEP_WORK');

    await stopTimer(page);
    await expect
      .poll(async () => (await apiRequest(page, 'GET', '/me')).profile.status)
      .toBe('ONLINE');
  });

  test('escolha manual de status sobrevive ao Pomodoro iniciar e parar, sem PATCH de status redundante', async ({
    page,
  }) => {
    const account = newAccount('presence-manual');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Presence Manual');
    await enterWorkspace(page);

    const userId = (await apiRequest(page, 'GET', '/me')).id;
    await openEditProfile(page, userId);
    await chooseStatus(page, 'AWAY');

    expect(await manualKey(page)).toBe('AWAY');
    expect((await meProfile(page)).status).toBe('AWAY');

    const statusPatches = [];
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() === 'PATCH') {
        statusPatches.push(route.request());
      }
      await route.continue();
    });

    await startTimer(page);
    await page.waitForTimeout(500);
    expect((await meProfile(page)).status).toBe('AWAY');

    await stopTimer(page);
    await page.waitForTimeout(500);
    expect((await meProfile(page)).status).toBe('AWAY');

    expect(statusPatchBodies(statusPatches)).toHaveLength(0);
  });

  test('selecionar Automatico apaga a chave manual, retoma o status pelo timer e nunca envia "AUTO" ao backend', async ({
    page,
  }) => {
    const account = newAccount('presence-auto');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Presence Auto');
    await enterWorkspace(page);

    const userId = (await apiRequest(page, 'GET', '/me')).id;
    await openEditProfile(page, userId);
    await chooseStatus(page, 'AWAY');
    expect(await manualKey(page)).toBe('AWAY');

    const patches = [];
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() === 'PATCH') {
        patches.push(route.request());
      }
      await route.continue();
    });

    await openEditProfile(page, userId);
    await expect(page.locator('#edit-status .dropdown-trigger')).toHaveText('Ausente');
    await chooseStatus(page, 'AUTO');

    expect(await manualKey(page)).toBeNull();

    const autoPatchBodies = statusPatchBodies(patches);
    for (const body of autoPatchBodies) {
      expect(body.status).not.toBe('AUTO');
    }

    await startTimer(page);
    await expect
      .poll(async () => (await apiRequest(page, 'GET', '/me')).profile.status)
      .toBe('DEEP_WORK');
  });

  test('um PATCH de status que falha nao e esquecido: a proxima sincronizacao para o mesmo alvo tenta de novo', async ({
    page,
  }) => {
    const account = newAccount('presence-retry');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Presence Retry');
    await enterWorkspace(page);

    const userId = (await apiRequest(page, 'GET', '/me')).id;

    let failNextStatusPatch = true;
    const statusAttempts = [];
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }

      const body = JSON.parse(route.request().postData() ?? '{}');
      if (!('status' in body)) {
        await route.continue();
        return;
      }

      statusAttempts.push(body.status);

      if (failNextStatusPatch) {
        failNextStatusPatch = false;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha forcada pelo teste E2E' }),
        });
        return;
      }

      await route.continue();
    });

    await openEditProfile(page, userId);
    await page.locator('#edit-status .dropdown-trigger').click();
    await page.locator('#edit-status .dropdown-option[data-value="AWAY"]').click();
    await page.locator('#btn-save-edit').click();

    await expect.poll(() => statusAttempts.length).toBe(1);

    await page.locator('.btn-close-modal').first().click();
    await expect(page.locator('.steam-profile-modal')).not.toHaveClass(/active/);

    expect(await manualKey(page)).toBe('AWAY');
    expect((await meProfile(page)).status).toBe('ONLINE');

    await startTimer(page);

    await expect.poll(() => statusAttempts.length).toBe(2);
    expect(statusAttempts).toEqual(['AWAY', 'AWAY']);

    await expect
      .poll(async () => (await meProfile(page)).status)
      .toBe('AWAY');
  });

  test('PATCH de status so ocorre na mudanca real de estado: nem a cada segundo, nem em toggles que nao mudam nada', async ({
    page,
  }) => {
    const account = newAccount('presence-throttle');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Presence Throttle');
    await enterWorkspace(page);

    const requests = [];
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() === 'PATCH') {
        requests.push(route.request());
      }
      await route.continue();
    });

    await gotoRoute(page, 'pomodoro');

    await page.locator('.pomo-mode-btn[data-mode="shortBreak"]').click();
    await page.locator('.pomo-mode-btn[data-mode="longBreak"]').click();
    await page.locator('.pomo-mode-btn[data-mode="focus"]').click();

    expect(statusPatchBodies(requests)).toHaveLength(0);

    await page.locator('#btn-toggle-timer').click();
    await expect
      .poll(() => statusPatchBodies(requests).length)
      .toBe(1);
    expect(statusPatchBodies(requests).at(-1).status).toBe('DEEP_WORK');

    await page.waitForTimeout(3000);
    expect(statusPatchBodies(requests)).toHaveLength(1);

    await page.locator('#btn-toggle-timer').click();
    await expect
      .poll(() => statusPatchBodies(requests).length)
      .toBe(2);
    expect(statusPatchBodies(requests).at(-1).status).toBe('ONLINE');
  });

  test('Ausente e Offline sao exibidos em cores proprias, e nao mais em verde de "online"', async ({
    page,
  }) => {
    const account = newAccount('presence-colors');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Presence Colors');
    await enterWorkspace(page);

    const userId = (await apiRequest(page, 'GET', '/me')).id;
    const card = page.locator(`.dev-card-mini[data-id="${userId}"]`);

    await openEditProfile(page, userId);
    await chooseStatus(page, 'AWAY');

    await expect(card.locator('.status-indicator')).toHaveClass(/status-away/);
    await expect(card.locator('.status-indicator')).not.toHaveClass(/status-online/);
    await expect(card.locator('.status-dot')).toHaveCSS('background-color', 'rgb(245, 158, 11)');

    await openEditProfile(page, userId);
    await chooseStatus(page, 'OFFLINE');

    await expect(card.locator('.status-indicator')).toHaveClass(/status-offline/);
    await expect(card.locator('.status-indicator')).not.toHaveClass(/status-online/);
    await expect(card.locator('.status-dot')).toHaveCSS('background-color', 'rgb(107, 114, 128)');
    await expect(card.locator('.status-dot')).toHaveCSS('box-shadow', 'none');
  });

  test('o perfil real de um segundo membro (cargo, cor, vibe e status) e exibido, sem valores padrao', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('presence-f5-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Presence F5');
    const inviteCode = await inviteMember(page, workspace.id);

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const member = newAccount('presence-f5-member');
    await joinWorkspaceAsMember(memberPage, member, inviteCode, workspace.id);

    const memberId = (await apiRequest(memberPage, 'GET', '/me')).id;
    await apiRequest(memberPage, 'PATCH', '/me/profile', {
      jobTitle: 'Engenheira de Dados',
      vibe: 'Ouvindo Lo-Fi',
      themeColor: '#10b981',
      bio: 'Trabalha com pipelines.',
      stack: ['SQL'],
    });
    await enterWorkspace(memberPage);
    await openEditProfile(memberPage, memberId);
    await chooseStatus(memberPage, 'AWAY');
    await memberContext.close();

    await enterWorkspace(page);
    await gotoRoute(page, 'team');

    const memberCard = page.locator(`.dev-card-mini[data-id="${memberId}"]`);
    await expect(memberCard.locator('.dev-role')).toHaveText('Engenheira de Dados');
    await expect(memberCard.locator('.status-indicator')).toHaveClass(/status-away/);
    await expect(memberCard.locator('.status-indicator')).toContainText('Ausente');

    await memberCard.click();
    await expect(page.locator('.sp-left-role')).toHaveText('Engenheira de Dados');
    await expect(page.locator('.sp-vibe-bubble')).toContainText('Ouvindo Lo-Fi');
    const userColor = await page
      .locator('.sp-left-card')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--user-color').trim());
    expect(userColor).toBe('#10b981');
  });
});
