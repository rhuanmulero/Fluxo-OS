import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

async function gotoSnippets(page) {
  await page.evaluate(() => {
    localStorage.setItem('fluxo.nav.edge', 'bottom');
    localStorage.removeItem('fluxo.nav.left');
    localStorage.removeItem('fluxo.nav.top');
  });
  await page.reload();
  await expect(page.locator('#global-bg')).toBeAttached();

  await page.locator('[data-route="knowledge"]').click();
  await page.locator('.knowledge-tab[data-tab="snippets"]').click();
  await expect(page.locator('.snippets-grid')).toBeVisible();
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

async function createWorkspace(page, name) {
  const workspace = await apiRequest(page, 'POST', '/workspaces', { name });
  await page.evaluate((id) => sessionStorage.setItem('fluxo_active_workspace', id), workspace.id);
  return workspace;
}

async function createProject(page, workspaceId, name) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/projects`, {
    name,
    color: '#3b82f6',
  });
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

async function assertPendingWithSpinner(button) {
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');

  const spinner = button.locator('.btn-spinner');
  await expect(spinner).toBeVisible();

  const box = await spinner.boundingBox();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
}

async function doubleClick(page, selector) {
  await page.evaluate((sel) => {
    const button = document.querySelector(sel);
    button.click();
    button.click();
  }, selector);
}

test.describe('login.js - PendingButton', () => {
  test('cadastro fica pendente com spinner de tamanho valido durante a requisicao', async ({
    page,
  }) => {
    const account = newAccount('login-pending');
    await page.goto('/login.html');
    await page.locator('[data-action="toggle-card"]').first().click();

    const registerForm = page.locator('#registerForm');
    await expect(registerForm.locator('input[name="name"]')).toBeVisible();
    await registerForm.locator('input[name="name"]').fill(account.name);
    await registerForm.locator('input[name="email"]').fill(account.email);
    await registerForm.locator('input[name="password"]').fill(account.password);

    await page.route('**/api/auth/sign-up/email', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    const button = registerForm.locator('.btn-primary');
    await button.click();

    await assertPendingWithSpinner(button);

    await page.waitForURL('**/workspace.html');
  });

  test('cadastro com e-mail ja usado restaura o botao e mostra o erro na tela', async ({
    page,
  }) => {
    const account = newAccount('login-fail');
    await signUp(page, account);

    await page.goto('/login.html');
    await page.locator('[data-action="toggle-card"]').first().click();

    const registerForm = page.locator('#registerForm');
    await expect(registerForm.locator('input[name="name"]')).toBeVisible();
    await registerForm.locator('input[name="name"]').fill(account.name);
    await registerForm.locator('input[name="email"]').fill(account.email);
    await registerForm.locator('input[name="password"]').fill(account.password);

    const button = registerForm.locator('.btn-primary');
    await button.click();

    await expect(registerForm.locator('.form-error')).not.toBeEmpty();
    await expect(button).not.toBeDisabled();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });

  test('dois cliques rapidos no login geram apenas uma requisicao de sign-in', async ({
    page,
  }) => {
    const account = newAccount('login-double');
    await signUp(page, account);
    await page.goto('/login.html');

    const loginForm = page.locator('#loginForm');
    await loginForm.locator('input[name="email"]').fill(account.email);
    await loginForm.locator('input[name="password"]').fill(account.password);

    const signInRequests = [];
    await page.route('**/api/auth/sign-in/email', async (route) => {
      signInRequests.push(route.request());
      await route.continue();
    });

    await doubleClick(page, '#loginForm .btn-primary');

    await page.waitForURL('**/workspace.html');
    expect(signInRequests).toHaveLength(1);
  });
});

test.describe('tasks.js - PendingButton', () => {
  test('#btn-save-proj fica pendente com spinner durante a criacao do projeto', async ({
    page,
  }) => {
    const account = newAccount('tasks-proj-pending');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Tasks Pending');
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-open-proj-modal').click();
    await page.locator('#input-proj-name').fill('Projeto Pendente');

    await page.route('**/api/workspaces/*/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-proj');
    await button.click();

    await assertPendingWithSpinner(button);

    await expect(page.locator('h1', { hasText: 'Projeto Pendente' })).toBeVisible();
  });

  test('#btn-save-proj com falha do servidor restaura o botao e mostra o erro', async ({
    page,
  }) => {
    const account = newAccount('tasks-proj-fail');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Tasks Fail');
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-open-proj-modal').click();
    await page.locator('#input-proj-name').fill('Projeto com Falha');

    await page.route('**/api/workspaces/*/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Erro forcado pelo teste E2E' }),
        });
        return;
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-proj');
    await button.click();

    await expect(page.locator('.page-feedback')).toHaveText('Erro forcado pelo teste E2E');
    await expect(button).not.toBeDisabled();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });

  test('#btn-save-drawer (tarefa) fica pendente com spinner durante a criacao', async ({
    page,
  }) => {
    const account = newAccount('tasks-drawer');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Tasks Drawer');
    await createProject(page, workspace.id, 'Projeto Drawer');
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title').fill('Tarefa pendente');

    await page.route('**/api/projects/*/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-drawer');
    await button.click();

    await assertPendingWithSpinner(button);

    await expect(page.locator('.task-row', { hasText: 'Tarefa pendente' })).toBeVisible();
  });

  test('#btn-save-drawer (tarefa) com falha do servidor restaura o botao e mostra o erro', async ({
    page,
  }) => {
    const account = newAccount('tasks-drawer-fail');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Tasks Drawer Fail');
    await createProject(page, workspace.id, 'Projeto Drawer Fail');
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title').fill('Tarefa que vai falhar');

    await page.route('**/api/projects/*/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha ao salvar tarefa' }),
        });
        return;
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-drawer');
    await button.click();

    await expect(page.locator('.page-feedback')).toHaveText('Falha ao salvar tarefa');
    await expect(button).not.toBeDisabled();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });

  test('dois cliques rapidos em #btn-save-drawer geram apenas uma requisicao', async ({
    page,
  }) => {
    const account = newAccount('tasks-double');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Tasks Double');
    await createProject(page, workspace.id, 'Projeto Double');
    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title').fill('Tarefa duplo clique');

    const createRequests = [];
    await page.route('**/api/projects/*/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        createRequests.push(route.request());
      }
      await route.continue();
    });

    await doubleClick(page, '#btn-save-drawer');

    await expect(page.locator('.task-row', { hasText: 'Tarefa duplo clique' })).toBeVisible();
    expect(createRequests).toHaveLength(1);
  });

  test('confirmacao de exclusao no modal generico passa pelo PendingButton e duplo clique gera uma unica requisicao', async ({
    page,
  }) => {
    const account = newAccount('tasks-delete');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Tasks Delete');
    const project = await createProject(page, workspace.id, 'Projeto Delete');
    const columns = await apiRequest(page, 'GET', `/projects/${project.id}/columns`);
    await apiRequest(page, 'POST', `/projects/${project.id}/tasks`, {
      title: 'Tarefa a excluir',
      kanbanColumnId: columns[0].id,
      priority: 'MEDIUM',
      type: 'FEATURE',
    });

    await enterWorkspace(page);
    await gotoRoute(page, 'tasks');

    await page.locator('.task-row .btn-delete').first().click();

    const confirmButton = page.locator('#btn-modal-confirm');
    await expect(confirmButton).toBeVisible();

    const deleteRequests = [];
    await page.route('**/api/projects/*/tasks/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequests.push(route.request());
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    });

    await doubleClick(page, '#btn-modal-confirm');

    await expect(page.locator('.task-row', { hasText: 'Tarefa a excluir' })).toHaveCount(0);
    expect(deleteRequests).toHaveLength(1);
  });
});

test.describe('kanban.js - PendingButton', () => {
  test('#btn-save-col fica pendente com spinner durante a criacao da coluna', async ({
    page,
  }) => {
    const account = newAccount('kanban-col-pending');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Kanban Pending');
    await createProject(page, workspace.id, 'Projeto Kanban Pending');
    await enterWorkspace(page);
    await gotoRoute(page, 'kanban');

    await page.locator('#btn-add-col-modal').click();
    await page.locator('#input-col-name').fill('Coluna pendente');

    await page.route('**/api/projects/*/columns', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-col');
    await button.click();

    await assertPendingWithSpinner(button);

    await expect(
      page.locator('.kanban-column .column-title', { hasText: 'Coluna pendente' }),
    ).toBeVisible();
  });

  test('dois cliques rapidos em #btn-save-col geram apenas uma requisicao', async ({ page }) => {
    const account = newAccount('kanban-col-double');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Kanban Double');
    await createProject(page, workspace.id, 'Projeto Kanban Double');
    await enterWorkspace(page);
    await gotoRoute(page, 'kanban');

    await page.locator('#btn-add-col-modal').click();
    await page.locator('#input-col-name').fill('Coluna duplo clique');

    const createRequests = [];
    await page.route('**/api/projects/*/columns', async (route) => {
      if (route.request().method() === 'POST') {
        createRequests.push(route.request());
      }
      await route.continue();
    });

    await doubleClick(page, '#btn-save-col');

    await expect(page.locator('.kanban-column .column-title', { hasText: 'Coluna duplo clique' })).toBeVisible();
    expect(createRequests).toHaveLength(1);
  });

  test('#btn-save-drawer (tarefa do kanban) com falha do servidor restaura o botao e mostra o erro', async ({
    page,
  }) => {
    const account = newAccount('kanban-drawer-fail');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Kanban Drawer');
    await createProject(page, workspace.id, 'Projeto Kanban Drawer');
    await enterWorkspace(page);
    await gotoRoute(page, 'kanban');

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title').fill('Tarefa kanban com falha');

    await page.route('**/api/projects/*/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha ao salvar tarefa do kanban' }),
        });
        return;
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-drawer');
    await button.click();

    await expect(page.locator('.page-feedback')).toHaveText('Falha ao salvar tarefa do kanban');
    await expect(button).not.toBeDisabled();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });
});

test.describe('notes.js - PendingButton', () => {
  test('#btn-save-drawer (nota) fica pendente com spinner durante a criacao', async ({
    page,
  }) => {
    const account = newAccount('notes-pending');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Notes Pending');
    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    await page.locator('#btn-new-note').click();
    await page.locator('#note-title').fill('Nota pendente');
    await page.locator('.rt-editor').click();
    await page.keyboard.type('Conteudo de teste');

    await page.route('**/api/workspaces/*/notes', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-drawer');
    await button.click();

    await assertPendingWithSpinner(button);

    await expect(page.locator('.note-card .note-title', { hasText: 'Nota pendente' })).toBeVisible();
  });

  test('publicar uma nota: dois cliques rapidos geram apenas uma requisicao', async ({
    page,
  }) => {
    const account = newAccount('notes-publish');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Notes Publish');
    const project = await createProject(page, workspace.id, 'Projeto Notes Publish');
    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
      title: 'Nota para publicar',
      body: 'conteudo',
      projectId: project.id,
    });

    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    const publishRequests = [];
    await page.route('**/api/workspaces/*/notes/*/visibility', async (route) => {
      if (route.request().method() === 'PATCH') {
        publishRequests.push(route.request());
      }
      await route.continue();
    });

    await doubleClick(page, '.btn-publish-note');

    await expect(page.locator('.note-link-badge', { hasText: 'Publicada' })).toBeVisible();
    expect(publishRequests).toHaveLength(1);
  });

  test('excluir nota com falha do servidor restaura o botao e mostra o erro', async ({
    page,
  }) => {
    const account = newAccount('notes-delete-fail');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Notes Delete');
    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
      title: 'Nota que nao sera excluida',
      body: 'conteudo',
    });

    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    await page.route('**/api/workspaces/*/notes/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha ao excluir nota' }),
        });
        return;
      }
      await route.continue();
    });

    const button = page.locator('.btn-delete-note').first();
    await button.click();

    await expect(page.locator('.page-feedback')).toHaveText('Falha ao excluir nota');
    await expect(button).not.toBeDisabled();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.note-card', { hasText: 'Nota que nao sera excluida' })).toBeVisible();
  });

  test('despublicar uma nota fica pendente com spinner durante a requisicao', async ({
    page,
  }) => {
    const account = newAccount('notes-unpublish');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Notes Unpublish');
    const project = await createProject(page, workspace.id, 'Projeto Notes Unpublish');
    const note = await apiRequest(page, 'POST', `/workspaces/${workspace.id}/notes`, {
      title: 'Nota publicada',
      body: 'conteudo',
      projectId: project.id,
    });
    await apiRequest(page, 'PATCH', `/workspaces/${workspace.id}/notes/${note.id}/visibility`, {
      visibility: 'PROJECT',
    });

    await enterWorkspace(page);
    await gotoRoute(page, 'notes');

    await page.route('**/api/workspaces/*/notes/*/visibility', async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    const button = page.locator('.btn-unpublish-note').first();
    await button.click();

    await assertPendingWithSpinner(button);

    await expect(page.locator('.note-link-badge', { hasText: 'Privada' })).toBeVisible();
  });
});

test.describe('snippets.js - PendingButton', () => {
  test('#btn-save-drawer (snippet) fica pendente com spinner durante a criacao', async ({
    page,
  }) => {
    const account = newAccount('snippets-pending');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Snippets Pending');
    await enterWorkspace(page);
    await gotoSnippets(page);

    await page.locator('#btn-new-snippet').click();
    await page.locator('#snippet-title').fill('Snippet pendente');
    await page.locator('#snippet-folder .dropdown-trigger').click();
    await page.locator('#snippet-folder .dropdown-option.is-create').click();
    await page.locator('#snippet-folder .dropdown-create input').fill('Geral');
    await page.locator('#snippet-folder .dropdown-create-confirm').click();
    await page.locator('#snippet-code-editor').fill('console.log(1);');

    await page.route('**/api/workspaces/*/snippets', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-drawer');
    await button.click();

    await assertPendingWithSpinner(button);

    await expect(
      page.locator('.snippet-card .snippet-title', { hasText: 'Snippet pendente' }),
    ).toBeVisible();
  });

  test('pedir publicacao de snippet: dois cliques rapidos geram apenas uma requisicao', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('snippets-request-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Snippets Request');
    const inviteCode = await inviteMember(page, workspace.id);

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const member = newAccount('snippets-request-member');
    await joinWorkspaceAsMember(memberPage, member, inviteCode, workspace.id);

    await apiRequest(memberPage, 'POST', `/workspaces/${workspace.id}/snippets`, {
      name: 'Snippet para publicar',
      folder: 'Geral',
      language: 'JavaScript',
      code: 'console.log(1);',
    });

    await enterWorkspace(memberPage);
    await gotoSnippets(memberPage);

    const requestRequests = [];
    await memberPage.route('**/api/workspaces/*/snippets/*/publish-request', async (route) => {
      requestRequests.push(route.request());
      await route.continue();
    });

    await doubleClick(memberPage, '.btn-request-publish');

    await expect(
      memberPage.locator('.snippet-status', { hasText: 'Aguardando aprovação' }),
    ).toBeVisible();
    expect(requestRequests).toHaveLength(1);

    await memberContext.close();
  });

  test('recusar snippet com falha do servidor restaura o botao e mostra o erro', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('snippets-reject-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Snippets Reject');
    const inviteCode = await inviteMember(page, workspace.id);

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const member = newAccount('snippets-reject-member');
    await joinWorkspaceAsMember(memberPage, member, inviteCode, workspace.id);

    const snippet = await apiRequest(memberPage, 'POST', `/workspaces/${workspace.id}/snippets`, {
      name: 'Snippet para recusar',
      folder: 'Geral',
      language: 'JavaScript',
      code: 'console.log(1);',
    });
    await apiRequest(
      memberPage,
      'POST',
      `/workspaces/${workspace.id}/snippets/${snippet.id}/publish-request`,
      {},
    );
    await memberContext.close();

    await enterWorkspace(page);
    await gotoSnippets(page);

    await page.route('**/api/workspaces/*/snippets/*/review', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Falha ao recusar snippet' }),
      });
    });

    const button = page.locator('.btn-reject-snippet').first();
    await button.click();

    await expect(page.locator('.page-feedback')).toHaveText('Falha ao recusar snippet');
    await expect(button).not.toBeDisabled();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });

  test('excluir snippet: dois cliques rapidos geram apenas uma requisicao', async ({ page }) => {
    const account = newAccount('snippets-delete-double');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace Snippets Delete');
    await apiRequest(page, 'POST', `/workspaces/${workspace.id}/snippets`, {
      name: 'Snippet para excluir',
      folder: 'Geral',
      language: 'JavaScript',
      code: 'console.log(1);',
    });

    await enterWorkspace(page);
    await gotoSnippets(page);

    const deleteRequests = [];
    await page.route('**/api/workspaces/*/snippets/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequests.push(route.request());
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    });

    await doubleClick(page, '.btn-delete-snippet');

    await expect(page.locator('.snippet-card', { hasText: 'Snippet para excluir' })).toHaveCount(0);
    expect(deleteRequests).toHaveLength(1);
  });
});

test.describe('team.js - PendingButton', () => {
  async function openOwnEditProfile(page) {
    await gotoRoute(page, 'team');
    await page.locator('.dev-card-mini').first().click();
    await page.locator('#btn-go-edit').click();
    await expect(page.locator('#btn-save-edit')).toBeVisible();
  }

  test('#btn-save-edit fica pendente com spinner durante o salvamento do perfil', async ({
    page,
  }) => {
    const account = newAccount('team-pending');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Team Pending');
    await enterWorkspace(page);
    await openOwnEditProfile(page);

    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-edit');
    await button.click();

    await assertPendingWithSpinner(button);

    await expect(page.locator('.steam-profile-modal')).not.toHaveClass(/active/);
  });

  test('#btn-save-edit com falha do servidor restaura o botao e mostra o erro', async ({
    page,
  }) => {
    const account = newAccount('team-fail');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Team Fail');
    await enterWorkspace(page);
    await openOwnEditProfile(page);

    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha ao salvar perfil' }),
        });
        return;
      }
      await route.continue();
    });

    const button = page.locator('#btn-save-edit');
    await button.click();

    await expect(page.locator('.page-feedback')).toHaveText('Falha ao salvar perfil');
    await expect(button).not.toBeDisabled();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });

  test('dois cliques rapidos em #btn-save-edit geram apenas uma requisicao', async ({ page }) => {
    const account = newAccount('team-double');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace Team Double');
    await enterWorkspace(page);
    await openOwnEditProfile(page);

    const updateRequests = [];
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() === 'PATCH') {
        updateRequests.push(route.request());
      }
      await route.continue();
    });

    await doubleClick(page, '#btn-save-edit');

    await expect(page.locator('.steam-profile-modal')).not.toHaveClass(/active/);
    expect(updateRequests).toHaveLength(1);
  });
});
