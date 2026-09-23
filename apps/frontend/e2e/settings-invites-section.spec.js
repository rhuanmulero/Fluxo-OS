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

async function openInvitesSection(page) {
  await gear(page).click();
  await page.locator('[data-section="invites"]').click();
  await expect(page.locator('#invite-list')).not.toHaveText('Carregando...');
}

test.describe('Secao Convites do painel de Configuracoes', () => {
  test('MEMBER nem ve o item Convites no trilho; ADMIN ve a lista sem formulario nem revogar', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c6-roles-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C6 Papeis');

    const adminCode = await inviteMember(page, workspace.id, 'ADMIN');
    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const adminAccount = newAccount('c6-roles-admin');
    await joinWorkspaceAsMember(adminPage, adminAccount, adminCode, workspace.id);

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c6-roles-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);

    await enterWorkspace(memberPage);
    await gear(memberPage).click();
    await expect(memberPage.locator('[data-section="invites"]')).toHaveCount(0);
    await memberPage.locator('.settings-close').click();

    await enterWorkspace(adminPage);
    await openInvitesSection(adminPage);
    await expect(adminPage.locator('#invite-create')).toHaveCount(0);
    await expect(adminPage.locator('.invite-revoke')).toHaveCount(0);

    await enterWorkspace(page);
    await openInvitesSection(page);
    await expect(page.locator('#invite-create')).toBeVisible();

    await adminContext.close();
    await memberContext.close();
  });

  test('gerar um convite pela UI produz um codigo que de fato funciona para outra conta entrar', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c6-accept-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C6 Aceite');
    await enterWorkspace(page);

    await openInvitesSection(page);

    await page.locator('#invite-role .dropdown-trigger').click();
    await page.locator('#invite-role .dropdown-option[data-value="MEMBER"]').click();

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/workspaces/${workspace.id}/invites`) &&
        request.method() === 'POST',
    );

    await page.locator('#invite-create').click();
    await requestPromise;

    const row = page.locator('.invite-row').first();
    await expect(row).toBeVisible();

    const code = await row.locator('.invite-code').textContent();
    expect(code.trim()).toMatch(/^[A-Z0-9]{8}$/);
    await expect(row.locator('.invite-meta strong')).toHaveText('Membro');

    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    const joinerAccount = newAccount('c6-accept-joiner');
    await signUp(joinerPage, joinerAccount);

    const accepted = await apiOk(
      joinerPage,
      'POST',
      `/invites/${encodeURIComponent(code.trim())}/accept`,
      {},
    );
    expect(accepted.usedAt).not.toBeNull();

    await joinerPage.evaluate(
      (id) => sessionStorage.setItem('fluxo_active_workspace', id),
      workspace.id,
    );
    const members = await apiOk(joinerPage, 'GET', `/workspaces/${workspace.id}/members`);
    const joinerId = (await apiOk(joinerPage, 'GET', '/me')).id;
    const joinerMembership = members.find((member) => member.userId === joinerId);
    expect(joinerMembership).toBeTruthy();
    expect(joinerMembership.role).toBe('MEMBER');

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await openInvitesSection(page);
    await expect(page.locator('.invite-row', { hasText: code.trim() })).toHaveCount(0);

    await joinerContext.close();
  });

  test('copiar coloca o codigo na area de transferencia e destaca o icone', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const owner = newAccount('c6-copy-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C6 Copiar');
    await enterWorkspace(page);

    await openInvitesSection(page);
    await page.locator('#invite-role .dropdown-trigger').click();
    await page.locator('#invite-role .dropdown-option[data-value="MEMBER"]').click();
    await page.locator('#invite-create').click();

    const row = page.locator('.invite-row').first();
    await expect(row).toBeVisible();
    const code = (await row.locator('.invite-code').textContent()).trim();

    const copyButton = row.locator('.invite-copy');
    await copyButton.click();

    await expect(copyButton).toHaveClass(/is-copied/);

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(code);
  });

  test('revogar um convite o tira da lista e o codigo deixa de funcionar para quem tenta usa-lo depois', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c6-revoke-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C6 Revogar');
    await enterWorkspace(page);

    await openInvitesSection(page);
    await page.locator('#invite-role .dropdown-trigger').click();
    await page.locator('#invite-role .dropdown-option[data-value="MEMBER"]').click();
    await page.locator('#invite-create').click();

    const row = page.locator('.invite-row').first();
    await expect(row).toBeVisible();
    const code = (await row.locator('.invite-code').textContent()).trim();

    await row.locator('.invite-revoke').click();

    const dialog = page.locator('.confirm-overlay');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-answer="yes"]').click();
    await expect(dialog).toHaveCount(0);

    await expect(page.locator('.invite-row')).toHaveCount(0);
    await expect(page.locator('.settings-hint')).toHaveText('Nenhum convite ativo.');

    const laterContext = await browser.newContext();
    const laterPage = await laterContext.newPage();
    const laterAccount = newAccount('c6-revoke-later');
    await signUp(laterPage, laterAccount);

    const result = await apiRequest(
      laterPage,
      'POST',
      `/invites/${encodeURIComponent(code)}/accept`,
      {},
    );
    expect(result.status).not.toBe(200);

    const members = await apiOk(page, 'GET', `/workspaces/${workspace.id}/members`);
    const laterId = (await apiOk(laterPage, 'GET', '/me')).id;
    expect(members.some((member) => member.userId === laterId)).toBe(false);

    await laterContext.close();
  });
});
