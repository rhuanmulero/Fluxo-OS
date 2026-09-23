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

async function createProject(page, workspaceId, name) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/projects`, { name });
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

async function addProjectMember(page, workspaceId, projectId, email) {
  const members = await apiRequest(page, 'GET', `/workspaces/${workspaceId}/members`);
  const target = members.find((member) => member.email === email);

  await apiRequest(page, 'POST', `/projects/${projectId}/members`, { userId: target.userId });
}

async function enterWorkspace(page) {
  await page.goto('/index.html');
  await expect(page.locator('#global-bg')).toBeAttached();
}

async function openRoadmap(page) {
  await page.locator('[data-route="roadmap"]').click();
  await expect(page.locator('.roadmap-container')).toBeVisible();
}

async function createRoadmap(page, projectId, title) {
  return apiRequest(page, 'POST', `/projects/${projectId}/roadmaps`, { title });
}

async function createStage(page, projectId, roadmapId, data) {
  return apiRequest(page, 'POST', `/projects/${projectId}/roadmaps/${roadmapId}/stages`, data);
}

test.describe('Pagina Metas', () => {
  test('a barra de progresso pondera pelos pontos das etapas, nao pela contagem', async ({
    page,
  }) => {
    const owner = newAccount('dg11-weighted');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Metas Peso');
    const project = await createProject(page, workspace.id, 'Projeto Metas Peso');
    await enterWorkspace(page);

    const roadmap = await createRoadmap(page, project.id, 'MVP do Fluxo');
    const heavy = await createStage(page, project.id, roadmap.id, {
      title: 'Etapa Pesada',
      points: 8,
    });
    await createStage(page, project.id, roadmap.id, { title: 'Etapa Leve A', points: 1 });
    await createStage(page, project.id, roadmap.id, { title: 'Etapa Leve B', points: 1 });

    await openRoadmap(page);

    const progressFill = page.locator('.roadmap-progress-fill');
    const progressBar = page.locator('.roadmap-progress-bar');
    await expect(progressBar).toHaveAttribute('aria-valuenow', '0');

    const heavyRow = page.locator(`[data-stage="${heavy.id}"]`);
    await heavyRow.locator('.stage-status .dropdown-trigger').click();
    await heavyRow.locator('.stage-status .dropdown-option[data-value="DONE"]').click();

    await expect(progressBar).toHaveAttribute('aria-valuenow', '80');
    await expect(page.locator('.roadmap-progress strong')).toHaveText('80%');
    await expect(progressFill).toHaveCSS('width', /.+/);
    const fillWidth = await progressFill.evaluate((el) => el.style.width);
    expect(fillWidth).toBe('80%');
  });

  test('MEMBER sob paradigma hierarquico nao ve criar/excluir mas pode atualizar o status da etapa', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('dg11-role-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Metas Papeis');
    const project = await createProject(page, workspace.id, 'Projeto Metas Papeis');

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('dg11-role-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    await addProjectMember(page, workspace.id, project.id, memberAccount.email);

    const roadmap = await createRoadmap(page, project.id, 'Metas da Guilda');
    const stage = await createStage(page, project.id, roadmap.id, {
      title: 'Etapa Compartilhada',
      points: 5,
    });

    await enterWorkspace(memberPage);
    await openRoadmap(memberPage);

    await expect(memberPage.locator('#btn-new-roadmap')).toHaveCount(0);
    await expect(memberPage.locator('#btn-new-stage')).toHaveCount(0);
    await expect(memberPage.locator('.btn-stage-delete')).toHaveCount(0);

    const statusSelect = memberPage.locator(`[data-stage="${stage.id}"] .stage-status`);
    await expect(statusSelect).toBeVisible();

    const requestPromise = memberPage.waitForRequest(
      (request) =>
        request
          .url()
          .endsWith(`/api/projects/${project.id}/roadmaps/${roadmap.id}/stages/${stage.id}`) &&
        request.method() === 'PATCH',
    );

    await statusSelect.locator('.dropdown-trigger').click();
    await statusSelect.locator('.dropdown-option[data-value="DONE"]').click();

    const request = await requestPromise;
    expect(JSON.parse(request.postData())).toEqual({ status: 'DONE' });

    await expect(memberPage.locator('.page-feedback')).toBeHidden();
    await expect(memberPage.locator('.roadmap-progress strong')).toHaveText('100%');

    await memberContext.close();
  });

  test('arrastar uma etapa para o topo persiste a ordem apos recarregar', async ({ page }) => {
    const owner = newAccount('dg11-reorder');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Metas Ordem');
    const project = await createProject(page, workspace.id, 'Projeto Metas Ordem');
    await enterWorkspace(page);

    const roadmap = await createRoadmap(page, project.id, 'Roteiro');
    const first = await createStage(page, project.id, roadmap.id, { title: 'Primeira' });
    const second = await createStage(page, project.id, roadmap.id, { title: 'Segunda' });
    const third = await createStage(page, project.id, roadmap.id, { title: 'Terceira' });

    await openRoadmap(page);

    await expect(page.locator('.stage-card')).toHaveCount(3);
    const idsBefore = await page.locator('.stage-card').evaluateAll((cards) =>
      cards.map((card) => card.dataset.stage),
    );
    expect(idsBefore).toEqual([first.id, second.id, third.id]);

    const orderRequestPromise = page.waitForRequest(
      (request) =>
        request
          .url()
          .endsWith(`/api/projects/${project.id}/roadmaps/${roadmap.id}/stages/order`) &&
        request.method() === 'PATCH',
    );

    await page.evaluate((thirdId) => {
      const list = document.querySelector('#stage-list');
      const source = list.querySelector(`[data-stage="${thirdId}"]`);
      const target = [...list.querySelectorAll('.stage-card')][0];
      const dataTransfer = new DataTransfer();

      const fire = (type, element, clientY) => {
        element.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer, clientY }),
        );
      };

      const targetBox = target.getBoundingClientRect();
      const clientY = targetBox.top + 1;

      fire('dragstart', source, 0);
      fire('dragover', target, clientY);
      fire('drop', target, clientY);
      fire('dragend', source, 0);
    }, third.id);

    const orderRequest = await orderRequestPromise;
    expect(JSON.parse(orderRequest.postData())).toEqual({
      orderedIds: [third.id, first.id, second.id],
    });

    const idsAfterDrop = await page.locator('.stage-card').evaluateAll((cards) =>
      cards.map((card) => card.dataset.stage),
    );
    expect(idsAfterDrop).toEqual([third.id, first.id, second.id]);

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await openRoadmap(page);
    await expect(page.locator('.stage-card')).toHaveCount(3);

    const idsAfterReload = await page.locator('.stage-card').evaluateAll((cards) =>
      cards.map((card) => card.dataset.stage),
    );
    expect(idsAfterReload).toEqual([third.id, first.id, second.id]);
  });

  test('excluir uma etapa pede confirmacao antes; dispensar o dialogo nao envia DELETE', async ({
    page,
  }) => {
    const owner = newAccount('dg11-delete-confirm');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Metas Exclusao');
    const project = await createProject(page, workspace.id, 'Projeto Metas Exclusao');
    await enterWorkspace(page);

    const roadmap = await createRoadmap(page, project.id, 'Roteiro Exclusao');
    const stage = await createStage(page, project.id, roadmap.id, { title: 'Descartavel' });

    let deleteRequests = 0;
    await page.route(
      `**/api/projects/${project.id}/roadmaps/${roadmap.id}/stages/${stage.id}`,
      async (route) => {
        if (route.request().method() === 'DELETE') deleteRequests += 1;
        await route.continue();
      },
    );

    await openRoadmap(page);

    const stageCard = page.locator(`[data-stage="${stage.id}"]`);
    await stageCard.locator('.btn-stage-delete').click();

    const dialog = page.locator('.confirm-overlay');
    await expect(dialog).toBeVisible();

    await dialog.locator('[data-answer="no"]').click();
    await expect(dialog).toHaveCount(0);

    expect(deleteRequests).toBe(0);
    await expect(stageCard).toBeVisible();

    await stageCard.locator('.btn-stage-delete').click();
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-answer="yes"]').click();
    await expect(dialog).toHaveCount(0);

    await expect(stageCard).toHaveCount(0);
    expect(deleteRequests).toBe(1);
  });

  test('excluir etapa passa por PendingButton: fica desabilitado durante a chamada e um segundo clique nao dispara uma segunda exclusao', async ({
    page,
  }) => {
    const owner = newAccount('dg11-delete-pending');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Metas Pendente');
    const project = await createProject(page, workspace.id, 'Projeto Metas Pendente');
    await enterWorkspace(page);

    const roadmap = await createRoadmap(page, project.id, 'Roteiro Pendente');
    const stage = await createStage(page, project.id, roadmap.id, { title: 'Etapa Lenta' });

    let deleteRequests = 0;
    await page.route(
      `**/api/projects/${project.id}/roadmaps/${roadmap.id}/stages/${stage.id}`,
      async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteRequests += 1;
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
        await route.continue();
      },
    );

    await openRoadmap(page);

    const stageCard = page.locator(`[data-stage="${stage.id}"]`);
    const deleteButton = stageCard.locator('.btn-stage-delete');
    const dialog = page.locator('.confirm-overlay');

    await deleteButton.click();
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-answer="yes"]').click();
    await expect(dialog).toHaveCount(0);

    await expect(deleteButton).toBeDisabled();
    await expect(deleteButton).toHaveAttribute('aria-busy', 'true');

    await page.evaluate(() => {
      const button = document.querySelector('.btn-stage-delete');
      if (button) button.click();
    });

    await expect(dialog).toHaveCount(0);

    await expect(stageCard).toHaveCount(0, { timeout: 5000 });
    expect(deleteRequests).toBe(1);
  });

  test('MEMBER sob paradigma micromanagement ve os controles de criar e excluir', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('dg11-micro-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace Metas Micro');
    const project = await createProject(page, workspace.id, 'Projeto Metas Micro');

    await apiRequest(page, 'PATCH', `/projects/${project.id}/module-settings/ROADMAP`, {
      governance: 'MICROMANAGEMENT',
    });

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('dg11-micro-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    await addProjectMember(page, workspace.id, project.id, memberAccount.email);

    const roadmap = await createRoadmap(page, project.id, 'Metas Micro');
    const stage = await createStage(page, project.id, roadmap.id, { title: 'Etapa Micro' });

    await enterWorkspace(memberPage);
    await openRoadmap(memberPage);

    await expect(memberPage.locator('#btn-new-roadmap')).toBeVisible();
    await expect(memberPage.locator('#btn-new-stage')).toBeVisible();
    await expect(memberPage.locator(`[data-stage="${stage.id}"] .btn-stage-delete`)).toBeVisible();

    await memberContext.close();
  });
});
