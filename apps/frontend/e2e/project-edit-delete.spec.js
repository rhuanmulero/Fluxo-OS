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

async function createProject(page, workspaceId, name, color) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/projects`, { name, color });
}

test.describe('Editar e excluir projeto', () => {
  test('lapis edita sem selecionar o projeto, e a mudanca de nome e cor persiste apos reload', async ({
    page,
  }) => {
    const owner = newAccount('c8-edit-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C8 Editar');
    const projectA = await createProject(page, workspace.id, 'Projeto A', '#3b82f6');
    const projectB = await createProject(page, workspace.id, 'Projeto B', '#3b82f6');

    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await expect(page.locator(`.project-btn[data-id="${projectA.id}"]`)).toHaveClass(/active/);

    const editButtonB = page.locator(`.project-edit[data-id="${projectB.id}"]`);
    await expect(editButtonB).toHaveCSS('opacity', '0');
    await page.locator(`.project-item:has(.project-btn[data-id="${projectB.id}"])`).hover();
    await expect(editButtonB).toHaveCSS('opacity', '1');

    await editButtonB.click();

    const modal = page.locator('#modal-new-project');
    await expect(modal).toHaveClass(/active/);
    await expect(modal.locator('.modal-title')).toHaveText('Editar Projeto');
    await expect(page.locator('#btn-save-proj')).toHaveText('Salvar');
    await expect(page.locator('#input-proj-name')).toHaveValue('Projeto B');
    await expect(page.locator('.color-option[data-color="#3b82f6"]')).toHaveClass(/selected/);
    await expect(page.locator('#btn-delete-proj')).toBeVisible();

    await expect(page.locator(`.project-btn[data-id="${projectA.id}"]`)).toHaveClass(/active/);
    await expect(page.locator(`.project-btn[data-id="${projectB.id}"]`)).not.toHaveClass(/active/);

    await page.locator('#input-proj-name').fill('Projeto B Renomeado');
    await page.locator('.color-option[data-color="#ec4899"]').click();

    const patchRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/projects/${projectB.id}`) && request.method() === 'PATCH',
    );

    await page.locator('#btn-save-proj').click();

    const request = await patchRequest;
    expect(JSON.parse(request.postData())).toEqual({
      name: 'Projeto B Renomeado',
      color: '#ec4899',
    });

    await expect(modal).not.toHaveClass(/active/);
    await expect(page.locator(`.project-btn[data-id="${projectB.id}"]`)).toContainText(
      'Projeto B Renomeado',
    );

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await gotoRoute(page, 'tasks');

    await expect(page.locator(`.project-btn[data-id="${projectB.id}"]`)).toContainText(
      'Projeto B Renomeado',
    );
    await expect(
      page.locator(`.project-btn[data-id="${projectB.id}"] .project-color`),
    ).toHaveCSS('background-color', 'rgb(236, 72, 153)');
  });

  test('excluir exige confirmacao: dispensar nao envia DELETE; confirmar remove definitivamente e ativa outro projeto', async ({
    page,
  }) => {
    const owner = newAccount('c8-delete-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C8 Excluir');
    const projectA = await createProject(page, workspace.id, 'Projeto Fica', '#3b82f6');
    const projectB = await createProject(page, workspace.id, 'Projeto Vai Sumir', '#3b82f6');

    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator(`.project-btn[data-id="${projectB.id}"]`).click();
    await expect(page.locator(`.project-btn[data-id="${projectB.id}"]`)).toHaveClass(/active/);

    let deleteRequests = 0;
    await page.route(`**/api/projects/${projectB.id}`, async (route) => {
      if (route.request().method() === 'DELETE') deleteRequests += 1;
      await route.continue();
    });

    await page.locator(`.project-edit[data-id="${projectB.id}"]`).click();

    const modal = page.locator('#modal-new-project');
    await expect(modal).toHaveClass(/active/);

    await page.locator('#btn-delete-proj').click();

    const dialog = page.locator('.confirm-overlay');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h3')).toHaveText('Excluir projeto');
    await expect(dialog.locator('p')).toContainText('Projeto Vai Sumir');
    await expect(dialog.locator('p')).toContainText('Notas e snippets');

    await dialog.locator('[data-answer="no"]').click();
    await expect(dialog).toHaveCount(0);
    expect(deleteRequests).toBe(0);
    await expect(modal).toHaveClass(/active/);

    await page.locator('#btn-delete-proj').click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();

    await expect(page.locator('.confirm-overlay')).toHaveCount(0);
    await expect(modal).not.toHaveClass(/active/);

    await expect
      .poll(() => deleteRequests)
      .toBe(1);

    await expect(page.locator(`.project-btn[data-id="${projectB.id}"]`)).toHaveCount(0);
    await expect(page.locator(`.project-btn[data-id="${projectA.id}"]`)).toHaveClass(/active/);

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await gotoRoute(page, 'tasks');

    await expect(page.locator(`.project-btn[data-id="${projectB.id}"]`)).toHaveCount(0);
    await expect(page.locator(`.project-btn[data-id="${projectA.id}"]`)).toBeVisible();
  });

  test('MEMBER nao ve o botao de novo projeto em Tarefas: ausente do DOM, nao apenas escondido', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c8-role-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C8 Papel');
    await createProject(page, workspace.id, 'Projeto Existente', '#3b82f6');
    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c8-role-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    await enterWorkspace(memberPage);
    await gotoRoute(memberPage, 'tasks');

    await expect(memberPage.locator('.tasks-container #btn-open-proj-modal')).toHaveCount(0);

    await memberContext.close();

    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');
    await expect(page.locator('.tasks-container #btn-open-proj-modal')).toBeVisible();
  });

  test('ADMIN abre o modal de edicao pelo lapis mas nao ve o botao Excluir: exclusao e checagem estatica de papel', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c8-delete-role-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C8 Papel Excluir');
    const project = await createProject(page, workspace.id, 'Projeto Sob Gestao', '#3b82f6');
    const adminCode = await inviteMember(page, workspace.id, 'ADMIN');

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const adminAccount = newAccount('c8-delete-role-admin');
    await joinWorkspaceAsMember(adminPage, adminAccount, adminCode, workspace.id);
    await enterWorkspace(adminPage);
    await gotoRoute(adminPage, 'tasks');

    await adminPage.locator(`.project-edit[data-id="${project.id}"]`).click();

    const modal = adminPage.locator('#modal-new-project');
    await expect(modal).toHaveClass(/active/);
    await expect(modal.locator('.modal-title')).toHaveText('Editar Projeto');
    await expect(adminPage.locator('#input-proj-name')).toHaveValue('Projeto Sob Gestao');

    await expect(adminPage.locator('#btn-delete-proj')).toHaveCount(0);

    await adminContext.close();
  });
});
