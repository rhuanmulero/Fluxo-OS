import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

async function chooseMember(page, name) {
  await page.locator('#project-member-pick .dropdown-trigger').click();
  await page
    .locator('#project-member-pick .dropdown-option')
    .filter({ hasText: name })
    .first()
    .click();
}

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

async function apiStatus(page, method, path, body) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      return response.status;
    },
    { method, path, body },
  );
}

async function currentUserId(page) {
  const me = await apiRequest(page, 'GET', '/me');
  return me.id;
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

async function createProject(page, workspaceId, name, color) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/projects`, { name, color });
}

async function openEditModal(page, projectId) {
  await page.locator(`.project-edit[data-id="${projectId}"]`).click();
  await expect(page.locator('#modal-new-project')).toHaveClass(/active/);
}

test.describe('Membros de projeto', () => {
  test('aba Membros so existe em edicao; adicionar concede acesso real da segunda conta, remover revoga', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c9-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C9 Membros');
    const project = await createProject(page, workspace.id, 'Projeto Compartilhado', '#3b82f6');
    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c9-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    const memberId = await currentUserId(memberPage);

    const statusBeforeAdd = await apiStatus(memberPage, 'GET', `/projects/${project.id}/members`);
    expect(statusBeforeAdd).toBe(404);

    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-open-proj-modal').click();
    await expect(page.locator('.modal-tab[data-tab="members"]')).toBeHidden();
    await page.locator('#btn-cancel-proj').click();

    await openEditModal(page, project.id);
    await expect(page.locator('.modal-tab[data-tab="members"]')).toBeVisible();

    const membersRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/projects/${project.id}/members`) &&
        request.method() === 'GET',
    );
    await page.locator('.modal-tab[data-tab="members"]').click();
    await membersRequest;

    await expect(page.locator('.project-member-row')).toHaveCount(1);
    await expect(page.locator('.project-member-row')).toContainText(owner.name);
    await expect(page.locator('#project-member-pick')).toContainText(memberAccount.name);
    await expect(page.locator('#project-member-pick')).not.toContainText(owner.name);

    await chooseMember(page, memberAccount.name);

    const addRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/projects/${project.id}/members`) &&
        request.method() === 'POST',
    );
    await page.locator('#project-member-add').click();
    const addReq = await addRequest;
    expect(JSON.parse(addReq.postData())).toEqual({ userId: memberId });

    await expect(page.locator('.project-member-row')).toHaveCount(2);
    const memberRow = page.locator(`.project-member-row[data-user="${memberId}"]`);
    await expect(memberRow).toContainText(memberAccount.name);
    await expect(page.locator('#project-member-pick')).not.toContainText(memberAccount.name);

    await expect
      .poll(() => apiStatus(memberPage, 'GET', `/projects/${project.id}/members`))
      .toBe(200);

    const removeButton = memberRow.locator('.project-member-remove');
    await removeButton.click();

    const removeDialog = page.locator('.confirm-overlay');
    await expect(removeDialog).toBeVisible();
    await expect(removeDialog.locator('h3')).toHaveText('Tirar do projeto');

    await removeDialog.locator('[data-answer="no"]').click();
    await expect(removeDialog).toHaveCount(0);
    await expect(page.locator('.project-member-row')).toHaveCount(2);

    const deleteRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/projects/${project.id}/members/${memberId}`) &&
        request.method() === 'DELETE',
    );
    await removeButton.click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();
    await deleteRequest;

    await expect(page.locator('.project-member-row')).toHaveCount(1);
    await expect(page.locator(`.project-member-row[data-user="${memberId}"]`)).toHaveCount(0);
    await expect(page.locator('#project-member-pick')).toContainText(memberAccount.name);

    await expect
      .poll(() => apiStatus(memberPage, 'GET', `/projects/${project.id}/members`))
      .toBe(404);

    await memberContext.close();
  });

  test('clicar em adicionar tres vezes seguidas sem fechar o modal nunca adiciona duas pessoas de uma vez', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c9-stack-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C9 Empilhar');
    const project = await createProject(page, workspace.id, 'Projeto Empilhar', '#3b82f6');

    const accounts = ['a', 'b', 'c'].map((letter) => newAccount(`c9-stack-${letter}`));
    const contexts = [];

    for (const account of accounts) {
      const context = await browser.newContext();
      const memberPage = await context.newPage();
      const code = await inviteMember(page, workspace.id, 'MEMBER');
      await joinWorkspaceAsMember(memberPage, account, code, workspace.id);
      contexts.push(context);
    }

    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await openEditModal(page, project.id);

    let addCount = 0;
    await page.route(`**/api/projects/${project.id}/members`, async (route) => {
      if (route.request().method() === 'POST') addCount += 1;
      await route.continue();
    });

    await page.locator('.modal-tab[data-tab="members"]').click();
    await expect(page.locator('.project-member-row')).toHaveCount(1);
    await expect(page.locator('.project-member-row')).toContainText(owner.name);

    for (const account of accounts) {
      const before = addCount;
      const addRequest = page.waitForRequest(
        (request) =>
          request.url().endsWith(`/api/projects/${project.id}/members`) &&
          request.method() === 'POST',
      );
      await chooseMember(page, account.name);
      await page.locator('#project-member-add').click();
      await addRequest;
      await expect(page.locator('.project-member-row', { hasText: account.name })).toHaveCount(1);
      expect(addCount).toBe(before + 1);
    }

    expect(addCount).toBe(3);
    await expect(page.locator('.project-member-row')).toHaveCount(4);
    await expect(page.locator('#project-member-pick')).toContainText('Todos já estão no projeto');

    for (const context of contexts) await context.close();
  });

  test('sob paradigma hierarquico, um MEMBER que tenta adicionar recebe o erro do backend em portugues', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c9-hier-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C9 Hierarquico');
    const project = await createProject(page, workspace.id, 'Projeto Hierarquico', '#3b82f6');
    await apiRequest(page, 'PATCH', `/projects/${project.id}/module-settings/TASKS`, {
      governance: 'HIERARCHICAL',
    });

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c9-hier-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    const memberId = await currentUserId(memberPage);
    await apiRequest(page, 'POST', `/projects/${project.id}/members`, { userId: memberId });

    const otherCode = await inviteMember(page, workspace.id, 'MEMBER');
    const otherAccount = newAccount('c9-hier-other');
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await joinWorkspaceAsMember(otherPage, otherAccount, otherCode, workspace.id);

    await memberPage.goto('/index.html');
    await expect(memberPage.locator('#global-bg')).toBeAttached();
    await gotoRoute(memberPage, 'tasks');

    await openEditModal(memberPage, project.id);
    await memberPage.locator('.modal-tab[data-tab="members"]').click();
    await expect(memberPage.locator('#project-member-pick')).toContainText(otherAccount.name);

    await chooseMember(memberPage, otherAccount.name);
    await memberPage.locator('#project-member-add').click();

    await expect(memberPage.locator('.page-feedback')).toContainText(
      'A regra de negócio deste módulo não permite esta ação.',
    );
    await expect(
      memberPage.locator('.project-member-row', { hasText: otherAccount.name }),
    ).toHaveCount(0);

    await memberContext.close();
    await otherContext.close();
  });

  test('quando o carregamento dos membros falha, o erro aparece na tela em vez de ficar mudo', async ({
    page,
  }) => {
    const owner = newAccount('c9-load-fail-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C9 Falha Carregar');
    const project = await createProject(page, workspace.id, 'Projeto Falha Carregar', '#3b82f6');

    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await openEditModal(page, project.id);

    await page.route(`**/api/projects/${project.id}/members`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Falha ao carregar membros (simulada pelo teste).' }),
      });
    });

    await page.locator('.modal-tab[data-tab="members"]').click();

    await expect(page.locator('.page-feedback')).toContainText(
      'Falha ao carregar membros (simulada pelo teste).',
    );
  });
});
