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

      return {
        status: response.status,
        body: text === '' ? null : JSON.parse(text),
      };
    },
    { method, path, body },
  );
}

async function apiOk(page, method, path, body) {
  const result = await apiRequest(page, method, path, body);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${method} ${path} falhou: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return result.body;
}

async function createWorkspace(page, name) {
  const workspace = await apiOk(page, 'POST', '/workspaces', { name });
  await page.evaluate((id) => sessionStorage.setItem('fluxo_active_workspace', id), workspace.id);
  return workspace;
}

async function enterWorkspace(page) {
  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();
}

async function inviteMember(page, workspaceId, role) {
  const invite = await apiOk(page, 'POST', `/workspaces/${workspaceId}/invites`, { role });
  return invite.code;
}

async function joinWorkspaceAsMember(memberPage, account, code, workspaceId) {
  await signUp(memberPage, account);
  await apiOk(memberPage, 'POST', `/invites/${encodeURIComponent(code)}/accept`, {});
  await memberPage.evaluate(
    (id) => sessionStorage.setItem('fluxo_active_workspace', id),
    workspaceId,
  );
}

function gear(page) {
  return page.locator('.floating-nav [data-label="Configurações"]');
}

async function openMembersSection(page) {
  await gear(page).click();
  await page.locator('[data-section="members"]').click();
  await expect(page.locator('#member-list')).not.toHaveText('Carregando...');
}

async function me(page) {
  return apiOk(page, 'GET', '/me');
}

test.describe('Secao Membros do painel de Configuracoes', () => {
  test('papeis sao mostrados conforme o ponto de vista de quem olha, e MEMBER nao ve nenhum controle', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c5-roles-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C5 Papeis');
    const ownerId = (await me(page)).id;

    const superadminCode = await inviteMember(page, workspace.id, 'SUPERADMIN');
    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const superadminContext = await browser.newContext();
    const superadminPage = await superadminContext.newPage();
    const superadminAccount = newAccount('c5-roles-superadmin');
    await joinWorkspaceAsMember(superadminPage, superadminAccount, superadminCode, workspace.id);
    const superadminId = (await me(superadminPage)).id;

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c5-roles-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);

    await enterWorkspace(page);
    await openMembersSection(page);

    const ownerRow = page.locator(`.member-row[data-user="${ownerId}"]`);
    await expect(ownerRow.locator('strong')).toContainText('(você)');
    await expect(ownerRow.locator('.member-role-fixed')).toHaveText('Dono');
    await expect(ownerRow.locator('.member-role')).toHaveCount(0);
    await expect(ownerRow.locator('.member-remove')).toHaveCount(0);

    const superadminRowFromOwner = page.locator(`.member-row[data-user="${superadminId}"]`);
    await expect(superadminRowFromOwner.locator('.member-role')).toHaveCount(1);
    await expect(superadminRowFromOwner.locator('.member-remove')).toHaveCount(1);

    await enterWorkspace(superadminPage);
    await openMembersSection(superadminPage);

    const ownerRowFromSuperadmin = superadminPage.locator(`.member-row[data-user="${ownerId}"]`);
    await expect(ownerRowFromSuperadmin.locator('.member-role-fixed')).toHaveText('Dono');
    await expect(ownerRowFromSuperadmin.locator('.member-role')).toHaveCount(0);
    await expect(ownerRowFromSuperadmin.locator('.member-remove')).toHaveCount(0);

    const ownRowFromSuperadmin = superadminPage.locator(
      `.member-row[data-user="${superadminId}"]`,
    );
    await expect(ownRowFromSuperadmin.locator('strong')).toContainText('(você)');
    await expect(ownRowFromSuperadmin.locator('.member-role')).toHaveCount(0);
    await expect(ownRowFromSuperadmin.locator('.member-remove')).toHaveCount(0);

    await enterWorkspace(memberPage);
    await openMembersSection(memberPage);

    await expect(memberPage.locator('.member-row')).toHaveCount(3);
    await expect(memberPage.locator('.member-role')).toHaveCount(0);
    await expect(memberPage.locator('.member-remove')).toHaveCount(0);
    await expect(memberPage.locator('.member-role-fixed')).toHaveCount(3);

    await superadminContext.close();
    await memberContext.close();
  });

  test('promover a Administrador muda de verdade o que a conta promovida consegue fazer', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c5-promote-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C5 Promocao');

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c5-promote-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    const memberId = (await me(memberPage)).id;

    const before = await apiRequest(memberPage, 'GET', `/workspaces/${workspace.id}/invites`);
    expect(before.status).toBe(403);

    await enterWorkspace(page);
    await openMembersSection(page);

    const row = page.locator(`.member-row[data-user="${memberId}"]`);
    const select = row.locator('.member-role');
    await expect(select.locator('.dropdown-trigger')).toHaveText('Membro');

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/workspaces/${workspace.id}/members/${memberId}`) &&
        response.request().method() === 'PATCH',
    );

    await select.locator('.dropdown-trigger').click();
    await select.locator('.dropdown-option[data-value="ADMIN"]').click();

    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    expect(JSON.parse(response.request().postData())).toEqual({ role: 'ADMIN' });
    await expect(page.locator('#members-error')).toHaveText('');

    const after = await apiOk(memberPage, 'GET', `/workspaces/${workspace.id}/invites`);
    expect(Array.isArray(after)).toBe(true);

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await openMembersSection(page);
    await expect(
      page.locator(`.member-row[data-user="${memberId}"] .member-role .dropdown-trigger`),
    ).toHaveText('Administrador');

    await memberContext.close();
  });

  test('remover um membro tira o acesso dele ao workspace', async ({ page, browser }) => {
    const owner = newAccount('c5-remove-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C5 Remocao');

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c5-remove-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    const memberId = (await me(memberPage)).id;

    const beforeRemoval = await apiRequest(
      memberPage,
      'GET',
      `/workspaces/${workspace.id}/members`,
    );
    expect(beforeRemoval.status).toBe(200);

    await enterWorkspace(page);
    await openMembersSection(page);

    const row = page.locator(`.member-row[data-user="${memberId}"]`);
    await row.locator('.member-remove').click();

    const dialog = page.locator('.confirm-overlay');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(memberAccount.name);
    await expect(dialog).toContainText('use Desligar');

    await dialog.locator('[data-answer="yes"]').click();
    await expect(dialog).toHaveCount(0);

    await expect(page.locator(`.member-row[data-user="${memberId}"]`)).toHaveCount(0);

    const afterRemoval = await apiRequest(
      memberPage,
      'GET',
      `/workspaces/${workspace.id}/members`,
    );
    expect(afterRemoval.status).not.toBe(200);

    await memberContext.close();
  });

  test('quando a troca de papel falha, o erro aparece e o seletor volta ao valor real do servidor', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c5-role-fail-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C5 Falha');

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c5-role-fail-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    const memberId = (await me(memberPage)).id;
    await memberContext.close();

    await enterWorkspace(page);

    await page.route(`**/api/workspaces/${workspace.id}/members/${memberId}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha simulada' }),
        });
        return;
      }
      await route.continue();
    });

    await openMembersSection(page);

    const select = page.locator(`.member-row[data-user="${memberId}"] .member-role`);
    await expect(select.locator('.dropdown-trigger')).toHaveText('Membro');

    await select.locator('.dropdown-trigger').click();
    await select.locator('.dropdown-option[data-value="SUPERADMIN"]').click();

    await expect(page.locator('#members-error')).not.toHaveText('');
    await expect(
      page.locator(`.member-row[data-user="${memberId}"] .member-role .dropdown-trigger`),
    ).toHaveText('Membro');
  });
});
