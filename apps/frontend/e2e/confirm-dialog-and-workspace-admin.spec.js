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

async function contextInfo(page) {
  return page.evaluate(async () => {
    const { workspaceContext } = await import('/src/core/workspace-context.js');
    return {
      role: workspaceContext.role,
      isOwner: workspaceContext.isOwner,
      isSuperadmin: workspaceContext.isSuperadmin,
    };
  });
}

async function openDialog(page, kind, options) {
  await page.evaluate(
    async ({ kind, options }) => {
      const { confirmDialog } = await import('/src/components/confirm-dialog.js');
      window.__confirmDone = false;
      window.__confirmValue = undefined;
      confirmDialog[kind](options).then((value) => {
        window.__confirmValue = value;
        window.__confirmDone = true;
      });
    },
    { kind, options },
  );
  await expect(page.locator('.confirm-overlay')).toBeVisible();
}

async function resolvedValue(page) {
  await page.waitForFunction(() => window.__confirmDone === true);
  const value = await page.evaluate(() => window.__confirmValue);
  await expect(page.locator('.confirm-overlay')).toHaveCount(0);
  return value;
}

async function callWorkspaceApi(page, methodName, args) {
  return page.evaluate(
    async ({ methodName, args }) => {
      const { workspaceApi } = await import('/src/api/workspace-api.js');
      return workspaceApi[methodName](...args);
    },
    { methodName, args },
  );
}

async function callProjectApi(page, methodName, args) {
  return page.evaluate(
    async ({ methodName, args }) => {
      const { projectApi } = await import('/src/api/project-api.js');
      return projectApi[methodName](...args);
    },
    { methodName, args },
  );
}

async function captureRequest(page, pattern) {
  let request = null;
  await page.route(pattern, async (route) => {
    request = route.request();
    await route.fulfill({ status: 204, body: '' });
  });
  return () => request;
}

test.describe('ConfirmDialog - ask', () => {
  test('resolve true quando o botao de confirmar e clicado', async ({ page }) => {
    await page.goto('/login.html');
    await openDialog(page, 'ask', { title: 'Teste', message: 'Confirma?' });

    await page.locator('.confirm-dialog [data-answer="yes"]').click();

    expect(await resolvedValue(page)).toBe(true);
  });

  test('resolve false quando o botao de cancelar e clicado', async ({ page }) => {
    await page.goto('/login.html');
    await openDialog(page, 'ask', { title: 'Teste', message: 'Confirma?' });

    await page.locator('.confirm-dialog [data-answer="no"]').click();

    expect(await resolvedValue(page)).toBe(false);
  });

  test('resolve false quando o clique acontece fora do dialogo', async ({ page }) => {
    await page.goto('/login.html');
    await openDialog(page, 'ask', { title: 'Teste', message: 'Confirma?' });

    await page.locator('.confirm-overlay').click({ position: { x: 5, y: 5 } });

    expect(await resolvedValue(page)).toBe(false);
  });

  test('usa os rotulos e a marcacao de perigo informados', async ({ page }) => {
    await page.goto('/login.html');
    await openDialog(page, 'ask', {
      title: 'Remover convite',
      message: 'Deseja mesmo remover?',
      confirmLabel: 'Remover',
      danger: true,
    });

    await expect(page.locator('.confirm-dialog h3')).toHaveText('Remover convite');
    await expect(page.locator('.confirm-dialog p')).toHaveText('Deseja mesmo remover?');
    const confirmButton = page.locator('.confirm-dialog [data-answer="yes"]');
    await expect(confirmButton).toHaveText('Remover');
    await expect(confirmButton).toHaveClass(/is-danger/);
    await expect(confirmButton).toBeEnabled();

    await confirmButton.click();
    expect(await resolvedValue(page)).toBe(true);
  });
});

test.describe('ConfirmDialog - Escape', () => {
  test('Escape resolve false, nunca true, no dialogo padrao', async ({ page }) => {
    await page.goto('/login.html');
    await openDialog(page, 'ask', { title: 'Teste', message: 'Confirma?' });

    await page.keyboard.press('Escape');

    expect(await resolvedValue(page)).toBe(false);
  });

  test('Escape resolve false na variante askTyped mesmo com o texto exato ja digitado', async ({
    page,
  }) => {
    await page.goto('/login.html');
    await openDialog(page, 'askTyped', {
      title: 'Excluir workspace',
      message: 'Digite ACME para confirmar',
      expected: 'ACME',
    });

    await page.locator('.confirm-dialog input').fill('ACME');
    await expect(page.locator('.confirm-dialog [data-answer="yes"]')).toBeEnabled();

    await page.keyboard.press('Escape');

    expect(await resolvedValue(page)).toBe(false);
  });

  test('abrir e fechar repetidamente nao acumula listeners de keydown no document, e o Escape continua resolvendo uma unica vez depois disso', async ({
    page,
  }) => {
    await page.goto('/login.html');

    await page.evaluate(() => {
      window.__keydownAdded = 0;
      window.__keydownRemoved = 0;
      const originalAdd = document.addEventListener.bind(document);
      const originalRemove = document.removeEventListener.bind(document);
      document.addEventListener = (type, listener, options) => {
        if (type === 'keydown') window.__keydownAdded += 1;
        return originalAdd(type, listener, options);
      };
      document.removeEventListener = (type, listener, options) => {
        if (type === 'keydown') window.__keydownRemoved += 1;
        return originalRemove(type, listener, options);
      };
    });

    for (let i = 0; i < 4; i += 1) {
      await openDialog(page, 'ask', { title: 'Teste', message: 'Confirma?' });
      await page.locator('.confirm-dialog [data-answer="no"]').click();
      expect(await resolvedValue(page)).toBe(false);
    }

    const afterCycles = await page.evaluate(() => ({
      added: window.__keydownAdded,
      removed: window.__keydownRemoved,
    }));
    expect(afterCycles.added).toBe(4);
    expect(afterCycles.removed).toBe(4);

    await openDialog(page, 'ask', { title: 'Teste', message: 'Confirma?' });

    await page.keyboard.press('Escape');
    expect(await resolvedValue(page)).toBe(false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    const final = await page.evaluate(() => ({
      added: window.__keydownAdded,
      removed: window.__keydownRemoved,
    }));
    expect(final.added).toBe(5);
    expect(final.removed).toBe(5);
  });
});

test.describe('ConfirmDialog - askTyped', () => {
  test('o botao de confirmar so habilita quando o texto digitado bate exatamente', async ({
    page,
  }) => {
    await page.goto('/login.html');
    await openDialog(page, 'askTyped', {
      title: 'Excluir workspace',
      message: 'Digite ACME para confirmar',
      expected: 'ACME',
    });

    const confirmButton = page.locator('.confirm-dialog [data-answer="yes"]');
    const input = page.locator('.confirm-dialog input');

    await expect(confirmButton).toBeDisabled();

    await input.fill('ACME ');
    await expect(confirmButton).toBeDisabled();

    await input.fill('acme');
    await expect(confirmButton).toBeDisabled();

    await input.fill('AC');
    await expect(confirmButton).toBeDisabled();

    await input.fill('ACME');
    await expect(confirmButton).toBeEnabled();

    await confirmButton.click();
    expect(await resolvedValue(page)).toBe(true);
  });

  test('digitar o valor certo e depois apagar volta a desabilitar o botao', async ({ page }) => {
    await page.goto('/login.html');
    await openDialog(page, 'askTyped', {
      title: 'Excluir workspace',
      message: 'Digite ACME para confirmar',
      expected: 'ACME',
    });

    const confirmButton = page.locator('.confirm-dialog [data-answer="yes"]');
    const input = page.locator('.confirm-dialog input');

    await input.fill('ACME');
    await expect(confirmButton).toBeEnabled();

    await input.fill('ACM');
    await expect(confirmButton).toBeDisabled();
  });

  test('resolve false ao cancelar mesmo com o texto certo digitado', async ({ page }) => {
    await page.goto('/login.html');
    await openDialog(page, 'askTyped', {
      title: 'Excluir workspace',
      message: 'Digite ACME para confirmar',
      expected: 'ACME',
    });

    await page.locator('.confirm-dialog input').fill('ACME');
    await page.locator('.confirm-dialog [data-answer="no"]').click();

    expect(await resolvedValue(page)).toBe(false);
  });

  test('resolve false quando o clique acontece fora do dialogo, mesmo com o texto certo', async ({
    page,
  }) => {
    await page.goto('/login.html');
    await openDialog(page, 'askTyped', {
      title: 'Excluir workspace',
      message: 'Digite ACME para confirmar',
      expected: 'ACME',
    });

    await page.locator('.confirm-dialog input').fill('ACME');
    await page.locator('.confirm-overlay').click({ position: { x: 5, y: 5 } });

    expect(await resolvedValue(page)).toBe(false);
  });

  test('usa o rotulo padrao Excluir e chega desabilitado quando ha um valor esperado', async ({
    page,
  }) => {
    await page.goto('/login.html');
    await openDialog(page, 'askTyped', {
      title: 'Excluir workspace',
      message: 'Digite ACME para confirmar',
      expected: 'ACME',
    });

    const confirmButton = page.locator('.confirm-dialog [data-answer="yes"]');
    await expect(confirmButton).toHaveText('Excluir');
    await expect(confirmButton).toHaveClass(/is-danger/);
    await expect(confirmButton).toBeDisabled();

    await page.locator('.confirm-dialog [data-answer="no"]').click();
    await resolvedValue(page);
  });

  test('Enter no campo nao confirma com um quase-acerto, e tambem nao confirma com o texto exato', async ({
    page,
  }) => {
    await page.goto('/login.html');
    await openDialog(page, 'askTyped', {
      title: 'Excluir workspace',
      message: 'Digite ACME para confirmar',
      expected: 'ACME',
    });

    const confirmButton = page.locator('.confirm-dialog [data-answer="yes"]');
    const input = page.locator('.confirm-dialog input');

    await input.fill('ACM');
    await input.press('Enter');
    await expect(page.locator('.confirm-overlay')).toBeVisible();
    await expect(confirmButton).toBeDisabled();
    expect(await page.evaluate(() => window.__confirmDone)).toBe(false);

    await input.fill('ACME');
    await input.press('Enter');
    await page.waitForTimeout(200);
    await expect(page.locator('.confirm-overlay')).toBeVisible();
    expect(await page.evaluate(() => window.__confirmDone)).toBe(false);

    await confirmButton.click();
    expect(await resolvedValue(page)).toBe(true);
  });
});

test.describe('workspaceApi - metodos de administracao', () => {
  test('rename envia PATCH /workspaces/:id com o nome novo', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/workspaces/ws-1');

    await callWorkspaceApi(page, 'rename', ['ws-1', 'Novo Nome']);

    const request = getRequest();
    expect(request.method()).toBe('PATCH');
    expect(new URL(request.url()).pathname).toBe('/api/workspaces/ws-1');
    expect(JSON.parse(request.postData())).toEqual({ name: 'Novo Nome' });
  });

  test('remove envia DELETE /workspaces/:id', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/workspaces/ws-1');

    await callWorkspaceApi(page, 'remove', ['ws-1']);

    const request = getRequest();
    expect(request.method()).toBe('DELETE');
    expect(new URL(request.url()).pathname).toBe('/api/workspaces/ws-1');
    expect(request.postData()).toBeNull();
  });

  test('invites envia GET /workspaces/:id/invites', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/workspaces/ws-1/invites');

    await callWorkspaceApi(page, 'invites', ['ws-1']);

    const request = getRequest();
    expect(request.method()).toBe('GET');
    expect(new URL(request.url()).pathname).toBe('/api/workspaces/ws-1/invites');
  });

  test('createInvite envia POST /workspaces/:id/invites com o corpo informado', async ({
    page,
  }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/workspaces/ws-1/invites');

    await callWorkspaceApi(page, 'createInvite', ['ws-1', { role: 'ADMIN' }]);

    const request = getRequest();
    expect(request.method()).toBe('POST');
    expect(new URL(request.url()).pathname).toBe('/api/workspaces/ws-1/invites');
    expect(JSON.parse(request.postData())).toEqual({ role: 'ADMIN' });
  });

  test('revokeInvite envia DELETE /workspaces/:id/invites/:inviteId', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/workspaces/ws-1/invites/invite-1');

    await callWorkspaceApi(page, 'revokeInvite', ['ws-1', 'invite-1']);

    const request = getRequest();
    expect(request.method()).toBe('DELETE');
    expect(new URL(request.url()).pathname).toBe('/api/workspaces/ws-1/invites/invite-1');
  });

  test('changeRole envia PATCH /workspaces/:id/members/:userId com o papel novo', async ({
    page,
  }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/workspaces/ws-1/members/user-1');

    await callWorkspaceApi(page, 'changeRole', ['ws-1', 'user-1', 'SUPERADMIN']);

    const request = getRequest();
    expect(request.method()).toBe('PATCH');
    expect(new URL(request.url()).pathname).toBe('/api/workspaces/ws-1/members/user-1');
    expect(JSON.parse(request.postData())).toEqual({ role: 'SUPERADMIN' });
  });

  test('removeMember envia DELETE /workspaces/:id/members/:userId', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/workspaces/ws-1/members/user-1');

    await callWorkspaceApi(page, 'removeMember', ['ws-1', 'user-1']);

    const request = getRequest();
    expect(request.method()).toBe('DELETE');
    expect(new URL(request.url()).pathname).toBe('/api/workspaces/ws-1/members/user-1');
  });
});

test.describe('projectApi - metodos de administracao', () => {
  test('find envia GET /projects/:id', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/projects/proj-1');

    await callProjectApi(page, 'find', ['proj-1']);

    const request = getRequest();
    expect(request.method()).toBe('GET');
    expect(new URL(request.url()).pathname).toBe('/api/projects/proj-1');
  });

  test('update envia PATCH /projects/:id com os dados informados', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/projects/proj-1');

    await callProjectApi(page, 'update', ['proj-1', { name: 'Projeto renomeado' }]);

    const request = getRequest();
    expect(request.method()).toBe('PATCH');
    expect(new URL(request.url()).pathname).toBe('/api/projects/proj-1');
    expect(JSON.parse(request.postData())).toEqual({ name: 'Projeto renomeado' });
  });

  test('remove envia DELETE /projects/:id', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/projects/proj-1');

    await callProjectApi(page, 'remove', ['proj-1']);

    const request = getRequest();
    expect(request.method()).toBe('DELETE');
    expect(new URL(request.url()).pathname).toBe('/api/projects/proj-1');
  });

  test('addMember envia POST /projects/:id/members com o userId', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/projects/proj-1/members');

    await callProjectApi(page, 'addMember', ['proj-1', 'user-1']);

    const request = getRequest();
    expect(request.method()).toBe('POST');
    expect(new URL(request.url()).pathname).toBe('/api/projects/proj-1/members');
    expect(JSON.parse(request.postData())).toEqual({ userId: 'user-1' });
  });

  test('removeMember envia DELETE /projects/:id/members/:userId', async ({ page }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(page, '**/api/projects/proj-1/members/user-1');

    await callProjectApi(page, 'removeMember', ['proj-1', 'user-1']);

    const request = getRequest();
    expect(request.method()).toBe('DELETE');
    expect(new URL(request.url()).pathname).toBe('/api/projects/proj-1/members/user-1');
  });

  test('setGovernance envia PATCH /projects/:id/module-settings/:module com a governanca', async ({
    page,
  }) => {
    await page.goto('/login.html');
    const getRequest = await captureRequest(
      page,
      '**/api/projects/proj-1/module-settings/KANBAN',
    );

    await callProjectApi(page, 'setGovernance', ['proj-1', 'KANBAN', 'HIERARCHICAL']);

    const request = getRequest();
    expect(request.method()).toBe('PATCH');
    expect(new URL(request.url()).pathname).toBe('/api/projects/proj-1/module-settings/KANBAN');
    expect(JSON.parse(request.postData())).toEqual({ governance: 'HIERARCHICAL' });
  });
});

test.describe('workspaceContext - papel do usuario', () => {
  test('quem cria o workspace tem role OWNER, isOwner e isSuperadmin verdadeiros', async ({
    page,
  }) => {
    const owner = newAccount('c1-ctx-owner');
    await signUp(page, owner);
    await createWorkspace(page, 'Workspace Papeis Owner');
    await enterWorkspace(page);

    const info = await contextInfo(page);

    expect(info.role).toBe('OWNER');
    expect(info.isOwner).toBe(true);
    expect(info.isSuperadmin).toBe(true);
  });

  test('um membro convidado como MEMBER tem isOwner e isSuperadmin falsos', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c1-ctx-member-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Papeis Membro');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const member = newAccount('c1-ctx-member');
    await joinWorkspaceAsMember(memberPage, member, code, workspace.id);
    await enterWorkspace(memberPage);

    const info = await contextInfo(memberPage);

    expect(info.role).toBe('MEMBER');
    expect(info.isOwner).toBe(false);
    expect(info.isSuperadmin).toBe(false);

    await memberContext.close();
  });

  test('um membro convidado como ADMIN tem isSuperadmin falso mas nao e MEMBER', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c1-ctx-admin-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Papeis Admin');
    const code = await inviteMember(page, workspace.id, 'ADMIN');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const member = newAccount('c1-ctx-admin');
    await joinWorkspaceAsMember(memberPage, member, code, workspace.id);
    await enterWorkspace(memberPage);

    const info = await contextInfo(memberPage);

    expect(info.role).toBe('ADMIN');
    expect(info.isOwner).toBe(false);
    expect(info.isSuperadmin).toBe(false);

    await memberContext.close();
  });

  test('reload() refaz a carga e passa a refletir uma promocao de papel feita pelo dono, sem recarregar a pagina', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('c1-ctx-reload-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Papeis Reload');
    const code = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const member = newAccount('c1-ctx-reload-member');
    await joinWorkspaceAsMember(memberPage, member, code, workspace.id);
    await enterWorkspace(memberPage);

    const before = await contextInfo(memberPage);
    expect(before.role).toBe('MEMBER');
    expect(before.isSuperadmin).toBe(false);

    const memberId = (await apiRequest(memberPage, 'GET', '/me')).id;

    await page.evaluate(
      async ({ workspaceId, memberId }) => {
        const { workspaceApi } = await import('/src/api/workspace-api.js');
        await workspaceApi.changeRole(workspaceId, memberId, 'SUPERADMIN');
      },
      { workspaceId: workspace.id, memberId },
    );

    const stillBefore = await contextInfo(memberPage);
    expect(stillBefore.role).toBe('MEMBER');

    const result = await memberPage.evaluate(async () => {
      const { workspaceContext } = await import('/src/core/workspace-context.js');
      let calls = 0;
      const unsubscribe = workspaceContext.onChange(() => {
        calls += 1;
      });

      await workspaceContext.reload();
      unsubscribe();

      return {
        calls,
        role: workspaceContext.role,
        isSuperadmin: workspaceContext.isSuperadmin,
      };
    });

    expect(result.calls).toBe(1);
    expect(result.role).toBe('SUPERADMIN');
    expect(result.isSuperadmin).toBe(true);

    await memberContext.close();
  });
});
