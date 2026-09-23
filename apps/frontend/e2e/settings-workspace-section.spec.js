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

async function inviteMember(page, workspaceId, role) {
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

function gear(page) {
  return page.locator('.floating-nav [data-label="Configurações"]');
}

async function openWorkspaceSection(page) {
  await gear(page).click();
  await page.locator('[data-section="workspace"]').click();
}

test.describe('Secao Workspace do painel de Configuracoes', () => {
  test('renomear envia PATCH e o nome novo aparece onde o workspace e mostrado apos reload', async ({
    page,
  }) => {
    const owner = newAccount('c4-rename');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C4 Original');
    await enterWorkspace(page);

    await openWorkspaceSection(page);

    const nameInput = page.locator('#workspace-name');
    await expect(nameInput).toHaveValue(workspace.name);
    await expect(nameInput).toBeEnabled();

    const renameButton = page.locator('#workspace-rename');
    await expect(renameButton).toBeVisible();

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/workspaces/${workspace.id}`) &&
        request.method() === 'PATCH',
    );

    await nameInput.fill('Workspace C4 Renomeado');
    await renameButton.click();

    const request = await requestPromise;
    expect(JSON.parse(request.postData())).toEqual({ name: 'Workspace C4 Renomeado' });

    await expect(renameButton).toBeEnabled();
    await expect(page.locator('#workspace-error')).toHaveText('');

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await expect(page.locator('.user-chip-text span')).toHaveText('Workspace C4 Renomeado');

    await openWorkspaceSection(page);
    await expect(page.locator('#workspace-name')).toHaveValue('Workspace C4 Renomeado');
  });

  test('excluir exige digitar o nome exatamente: quase-acerto nao habilita o botao nem envia DELETE', async ({
    page,
  }) => {
    const owner = newAccount('c4-delete-guard');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C4 Exclusao');
    await enterWorkspace(page);

    let deleteRequests = 0;
    await page.route(`**/api/workspaces/${workspace.id}`, async (route) => {
      if (route.request().method() === 'DELETE') deleteRequests += 1;
      await route.continue();
    });

    await openWorkspaceSection(page);

    await page.locator('#workspace-delete').click();

    const dialog = page.locator('.confirm-overlay');
    await expect(dialog).toBeVisible();

    const input = dialog.locator('input');
    const confirmButton = dialog.locator('[data-answer="yes"]');
    await expect(confirmButton).toBeDisabled();

    await input.fill(workspace.name.toLowerCase());
    await expect(confirmButton).toBeDisabled();

    await input.fill(`${workspace.name} `);
    await expect(confirmButton).toBeDisabled();

    await input.fill(workspace.name.toUpperCase());
    await expect(confirmButton).toBeDisabled();

    expect(deleteRequests).toBe(0);

    await dialog.locator('[data-answer="no"]').click();
    await expect(dialog).toHaveCount(0);
    expect(deleteRequests).toBe(0);
  });

  test('MEMBER nao ve nenhum controle; quem pode renomear mas nao excluir ve so o de renomear', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c4-roles-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C4 Papeis');

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');
    const superadminCode = await inviteMember(page, workspace.id, 'SUPERADMIN');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('c4-roles-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    await enterWorkspace(memberPage);
    await openWorkspaceSection(memberPage);

    await expect(memberPage.locator('#workspace-name')).toBeDisabled();
    await expect(memberPage.locator('#workspace-name')).toHaveValue(workspace.name);
    await expect(memberPage.locator('#workspace-rename')).toHaveCount(0);
    await expect(memberPage.locator('#workspace-delete')).toHaveCount(0);

    await memberContext.close();

    const superadminContext = await browser.newContext();
    const superadminPage = await superadminContext.newPage();
    const superadminAccount = newAccount('c4-roles-superadmin');
    await joinWorkspaceAsMember(superadminPage, superadminAccount, superadminCode, workspace.id);
    await enterWorkspace(superadminPage);
    await openWorkspaceSection(superadminPage);

    await expect(superadminPage.locator('#workspace-name')).toBeEnabled();
    await expect(superadminPage.locator('#workspace-rename')).toBeVisible();
    await expect(superadminPage.locator('#workspace-delete')).toHaveCount(0);

    await superadminContext.close();
  });

  test('renomear e excluir passam por PendingButton: desabilitado e aria-busy durante a chamada', async ({
    page,
  }) => {
    const owner = newAccount('c4-pending');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C4 Pendente');
    await enterWorkspace(page);

    await openWorkspaceSection(page);

    await page.route(`**/api/workspaces/${workspace.id}`, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    const nameInput = page.locator('#workspace-name');
    const renameButton = page.locator('#workspace-rename');

    await nameInput.fill('Workspace C4 Pendente Renomeado');
    await renameButton.click();

    await expect(renameButton).toBeDisabled();
    await expect(renameButton).toHaveAttribute('aria-busy', 'true');
    await expect(renameButton.locator('.btn-spinner')).toBeVisible();

    await expect(renameButton).toBeEnabled();
    await expect(renameButton).not.toHaveAttribute('aria-busy', 'true');

    await page.unroute(`**/api/workspaces/${workspace.id}`);

    let deleteResolved = false;
    await page.route(`**/api/workspaces/${workspace.id}`, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      deleteResolved = true;
      await route.continue();
    });

    const deleteButton = page.locator('#workspace-delete');
    await deleteButton.click();

    const dialog = page.locator('.confirm-overlay');
    await dialog.locator('input').fill('Workspace C4 Pendente Renomeado');
    await dialog.locator('[data-answer="yes"]').click();

    await expect(dialog).toHaveCount(0);
    await expect(deleteButton).toBeDisabled();
    await expect(deleteButton).toHaveAttribute('aria-busy', 'true');

    await page.waitForURL('**/workspace.html');
    expect(deleteResolved).toBe(true);

    const storage = await page.evaluate(() => ({
      workspace: sessionStorage.getItem('fluxo_active_workspace'),
      project: sessionStorage.getItem('fluxo_active_project'),
    }));
    expect(storage.workspace).toBeNull();
    expect(storage.project).toBeNull();
  });

  test('apos renomear, sem recarregar, o dialogo de exclusao passa a exigir o nome novo e nao mais o antigo', async ({
    page,
  }) => {
    const owner = newAccount('c4-delete-fresh-name');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C4 Nome Antigo');
    await enterWorkspace(page);

    await openWorkspaceSection(page);

    const nameInput = page.locator('#workspace-name');
    const renameButton = page.locator('#workspace-rename');

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/workspaces/${workspace.id}`) &&
        request.method() === 'PATCH',
    );

    await nameInput.fill('Workspace C4 Nome Novo');
    await renameButton.click();
    await requestPromise;
    await expect(renameButton).toBeEnabled();

    await page.locator('#workspace-delete').click();

    const dialog = page.locator('.confirm-overlay');
    const input = dialog.locator('input');
    const confirmButton = dialog.locator('[data-answer="yes"]');

    await input.fill(workspace.name);
    await expect(confirmButton).toBeDisabled();

    await input.fill('Workspace C4 Nome Novo');
    await expect(confirmButton).toBeEnabled();

    await dialog.locator('[data-answer="no"]').click();
    await expect(dialog).toHaveCount(0);
  });

  test('apos renomear, sem fechar o painel nem recarregar, o texto da zona de risco nomeia o workspace novo', async ({
    page,
  }) => {
    const owner = newAccount('c4-danger-zone-fresh-name');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C4 Zona Antiga');
    await enterWorkspace(page);

    await openWorkspaceSection(page);

    const nameInput = page.locator('#workspace-name');
    const renameButton = page.locator('#workspace-rename');

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/workspaces/${workspace.id}`) &&
        request.method() === 'PATCH',
    );

    await nameInput.fill('Workspace C4 Zona Nova');
    await renameButton.click();
    await requestPromise;
    await expect(renameButton).toBeEnabled();

    const dangerZoneText = page.locator('.settings-hint');
    await expect(dangerZoneText).toContainText('Workspace C4 Zona Nova');
    await expect(dangerZoneText).not.toContainText('Workspace C4 Zona Antiga');
  });

  test('apos renomear, o nome no chip da barra muda na hora, sem recarregar a pagina', async ({
    page,
  }) => {
    const owner = newAccount('c4-chip-live');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace C4 Chip Antigo');
    await enterWorkspace(page);

    await expect(page.locator('.user-chip-text span')).toHaveText(workspace.name);

    await openWorkspaceSection(page);

    const nameInput = page.locator('#workspace-name');
    const renameButton = page.locator('#workspace-rename');

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/api/workspaces/${workspace.id}`) &&
        request.method() === 'PATCH',
    );

    await nameInput.fill('Workspace C4 Chip Novo');
    await renameButton.click();
    await requestPromise;
    await expect(renameButton).toBeEnabled();

    await expect(page.locator('.user-chip-text span')).toHaveText('Workspace C4 Chip Novo');
    await expect(page.locator('.user-chip')).toHaveCount(1);
  });
});
