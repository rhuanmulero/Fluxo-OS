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

async function createProject(page, workspaceId, name, color) {
  return apiRequest(page, 'POST', `/workspaces/${workspaceId}/projects`, { name, color });
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

async function currentUserId(page) {
  const me = await apiRequest(page, 'GET', '/me');
  return me.id;
}

async function gotoRoute(page, routeId) {
  await page.locator(`[data-route="${routeId}"]`).click();
  await expect(page.locator(`[data-route="${routeId}"]`)).toHaveClass(/active/);
}

async function gotoRoutineAgenda(page) {
  await gotoRoute(page, 'routine');
  await expect(page.locator('.routine-tab[data-tab="agenda"]')).toHaveClass(/active/);
}

async function selectCalendarDay(page, iso) {
  await page.locator(`.calendar-day[data-date="${iso}"]`).click();
}

function tomorrowLocalIso() {
  const day = new Date();
  day.setDate(day.getDate() + 1);

  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

async function openEventDrawer(page) {
  await page.locator('#btn-new-event').click();
  await expect(page.locator('#event-drawer')).toHaveClass(/active/);
}

async function fillEvent(page, { title, description, startDate, startTime, endDate, endTime, projectLabel }) {
  await page.locator('#event-title').fill(title);

  if (description !== undefined) {
    await page.locator('#event-description').fill(description);
  }

  await page.locator('#event-start-date').fill(startDate);
  await page.locator('#event-start-time').fill(startTime);

  if (endDate !== undefined) {
    await page.locator('#event-end-date').fill(endDate);
  }

  if (endTime !== undefined) {
    await page.locator('#event-end-time').fill(endTime);
  }

  if (projectLabel !== undefined) {
    await page.locator('#event-project .dropdown-trigger').click();
    await page
      .locator('#event-project .dropdown-option')
      .filter({ hasText: projectLabel })
      .first()
      .click();
  }
}

function agendaRow(page, title) {
  return page.locator('.agenda-row', { hasText: title });
}

test.describe('Rotina - aba Agenda', () => {
  test('Alt+7 abre a Rotina, a tooltip mostra rotulo e atalho, e a secao Navegacao das Configuracoes lista Rotina', async ({
    page,
  }) => {
    const account = newAccount('dg6-nav');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace DG6 Navegacao');
    await enterWorkspace(page);

    await page.keyboard.down('Alt');
    await page.keyboard.press('Digit7');
    await page.keyboard.up('Alt');

    await expect(page.locator('.routine-container h1')).toHaveText('Rotina');
    await expect(page.locator('[data-route="routine"]')).toHaveClass(/active/);

    const navButton = page.locator('[data-route="routine"]');
    await navButton.hover();

    const tooltip = page.locator('.nav-tooltip');
    await expect(tooltip).toHaveClass(/visible/);
    await expect(tooltip.locator('span')).toHaveText('Rotina');
    await expect(tooltip.locator('kbd')).toHaveText('Alt+7');

    await page.locator('.floating-nav [data-label="Configurações"]').click();
    await page.locator('[data-section="navigation"]').click();

    const shortcutItem = page.locator('.settings-shortcuts li', { hasText: 'Rotina' });
    await expect(shortcutItem).toBeVisible();
    await expect(shortcutItem.locator('kbd')).toHaveText('Alt+7');
  });

  test('sem eventos aparece o empty state com icone', async ({ page }) => {
    const account = newAccount('dg6-empty');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace DG6 Vazio');
    await enterWorkspace(page);
    await gotoRoutineAgenda(page);

    const empty = page.locator('#agenda-list .empty-state');
    await expect(empty).toBeVisible();
    await expect(empty.locator('svg')).toBeVisible();
    await expect(empty.locator('p')).toHaveText('Nada marcado neste dia.');
  });

  test('criar evento privado e evento de projeto: agrupamento por dia, horario e selo de visibilidade', async ({
    page,
  }) => {
    const account = newAccount('dg6-create');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG6 Criar');
    const project = await createProject(page, workspace.id, 'Projeto DG6', '#3b82f6');
    await enterWorkspace(page);
    await gotoRoutineAgenda(page);

    const tomorrow = tomorrowLocalIso();

    await selectCalendarDay(page, tomorrow);

    await openEventDrawer(page);
    await fillEvent(page, { title: 'Dentista', startDate: tomorrow, startTime: '14:00' });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    const dentistaRow = agendaRow(page, 'Dentista');
    await expect(dentistaRow).toBeVisible();
    await expect(dentistaRow.locator('.agenda-time')).toHaveText('14:00');
    await expect(dentistaRow.locator('.agenda-visibility')).toHaveText('Privado');

    await openEventDrawer(page);
    await fillEvent(page, {
      title: 'Planning',
      startDate: tomorrow,
      startTime: '09:00',
      projectLabel: 'Projeto DG6',
    });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    const planningRow = agendaRow(page, 'Planning');
    await expect(planningRow).toBeVisible();
    await expect(planningRow.locator('.agenda-visibility')).toHaveText('Privado');

    await planningRow.locator('.btn-event-share').click();
    await expect(planningRow.locator('.agenda-visibility')).toHaveText('Equipe');

    const markStyle = await planningRow.locator('.agenda-mark').getAttribute('style');
    expect(markStyle).toContain(project.color);

    const dayCell = page.locator(`.calendar-day[data-date="${tomorrow}"]`);
    await expect(dayCell).toContainText('Dentista');
    await expect(dayCell).toContainText('Planning');
  });

  test('visibilidade determina quem ve: evento de projeto publicado aparece para membro do projeto, o privado nao aparece a ninguem alem do autor, e alternar a visibilidade muda o acesso', async ({
    page,
    browser,
  }) => {
    const owner = newAccount('dg6-visibility-owner');
    await signUp(page, owner);
    const workspace = await createWorkspace(page, 'Workspace DG6 Visibilidade');
    const project = await createProject(page, workspace.id, 'Projeto Visibilidade', '#22c55e');

    const memberCode = await inviteMember(page, workspace.id, 'MEMBER');
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberAccount = newAccount('dg6-visibility-member');
    await joinWorkspaceAsMember(memberPage, memberAccount, memberCode, workspace.id);
    const memberId = await currentUserId(memberPage);
    await apiRequest(page, 'POST', `/projects/${project.id}/members`, { userId: memberId });

    await enterWorkspace(page);
    await gotoRoutineAgenda(page);

    const tomorrow = tomorrowLocalIso();

    await selectCalendarDay(page, tomorrow);

    await openEventDrawer(page);
    await fillEvent(page, { title: 'Dentista Privado', startDate: tomorrow, startTime: '10:00' });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    await openEventDrawer(page);
    await fillEvent(page, {
      title: 'Planning Equipe',
      startDate: tomorrow,
      startTime: '11:00',
      projectLabel: 'Projeto Visibilidade',
    });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    const planningRow = agendaRow(page, 'Planning Equipe');
    await planningRow.locator('.btn-event-share').click();
    await expect(planningRow.locator('.agenda-visibility')).toHaveText('Equipe');

    await memberPage.goto('/index.html');
    await expect(memberPage.locator('#global-bg')).toBeAttached();
    await gotoRoutineAgenda(memberPage);
    await selectCalendarDay(memberPage, tomorrow);

    await expect(agendaRow(memberPage, 'Planning Equipe')).toBeVisible();
    await expect(agendaRow(memberPage, 'Dentista Privado')).toHaveCount(0);
    await expect(memberPage.locator('.agenda-row')).toHaveCount(1);

    await planningRow.locator('.btn-event-share').click();
    await expect(planningRow.locator('.agenda-visibility')).toHaveText('Privado');

    await memberPage.reload();
    await expect(memberPage.locator('#global-bg')).toBeAttached();
    await gotoRoutineAgenda(memberPage);
    await selectCalendarDay(memberPage, tomorrow);
    await expect(memberPage.locator('.agenda-row')).toHaveCount(0);

    await planningRow.locator('.btn-event-share').click();
    await expect(planningRow.locator('.agenda-visibility')).toHaveText('Equipe');

    await memberPage.reload();
    await expect(memberPage.locator('#global-bg')).toBeAttached();
    await gotoRoutineAgenda(memberPage);
    await selectCalendarDay(memberPage, tomorrow);
    await expect(agendaRow(memberPage, 'Planning Equipe')).toBeVisible();
    await expect(memberPage.locator('.agenda-row')).toHaveCount(1);

    await memberContext.close();
  });

  test('publicar evento sem projeto mostra o erro do backend e o selo continua Privado', async ({
    page,
  }) => {
    const account = newAccount('dg6-no-project');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace DG6 Sem Projeto');
    await enterWorkspace(page);
    await gotoRoutineAgenda(page);

    const tomorrow = tomorrowLocalIso();

    await selectCalendarDay(page, tomorrow);

    await openEventDrawer(page);
    await fillEvent(page, { title: 'Reuniao Solta', startDate: tomorrow, startTime: '08:00' });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    const row = agendaRow(page, 'Reuniao Solta');
    await row.locator('.btn-event-share').click();

    await expect(page.locator('.page-feedback')).toContainText(
      'Vincule o evento a um projeto antes de publicá-lo para a equipe.',
    );
    await expect(row.locator('.agenda-visibility')).toHaveText('Privado');
  });

  test('evento com fim antes do inicio gera erro em portugues e nada e criado', async ({ page }) => {
    const account = newAccount('dg6-bad-interval');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace DG6 Intervalo');
    await enterWorkspace(page);
    await gotoRoutineAgenda(page);

    const tomorrow = tomorrowLocalIso();

    await openEventDrawer(page);
    await fillEvent(page, {
      title: 'Evento Invertido',
      startDate: tomorrow,
      startTime: '15:00',
      endDate: tomorrow,
      endTime: '10:00',
    });
    await page.locator('#btn-save-event').click();

    await expect(page.locator('.page-feedback')).toContainText(
      'O término do evento não pode ser antes do início.',
    );
    await expect(page.locator('#event-drawer')).toHaveClass(/active/);
    await expect(page.locator('.agenda-row')).toHaveCount(0);
  });

  test('excluir evento exige confirmacao: dispensar o dialogo nao envia DELETE, confirmar remove da lista', async ({
    page,
  }) => {
    const account = newAccount('dg6-delete');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace DG6 Excluir');
    await enterWorkspace(page);
    await gotoRoutineAgenda(page);

    const tomorrow = tomorrowLocalIso();

    await selectCalendarDay(page, tomorrow);

    await openEventDrawer(page);
    await fillEvent(page, { title: 'Evento Descartavel', startDate: tomorrow, startTime: '12:00' });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    const row = agendaRow(page, 'Evento Descartavel');
    const eventId = await row.getAttribute('data-id');

    let deleteRequests = 0;
    await page.route(`**/api/workspaces/*/events/${eventId}`, async (route) => {
      if (route.request().method() === 'DELETE') deleteRequests += 1;
      await route.continue();
    });

    await row.locator('.btn-event-delete').click();

    const dialog = page.locator('.confirm-overlay');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h3')).toHaveText('Excluir evento');

    await dialog.locator('[data-answer="no"]').click();
    await expect(dialog).toHaveCount(0);
    expect(deleteRequests).toBe(0);
    await expect(row).toBeVisible();

    await row.locator('.btn-event-delete').click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();

    await expect(page.locator('.confirm-overlay')).toHaveCount(0);
    expect(deleteRequests).toBe(1);
    await expect(agendaRow(page, 'Evento Descartavel')).toHaveCount(0);
  });

  test('excluir e publicar/despublicar passam por PendingButton: desabilitado e aria-busy durante a chamada', async ({
    page,
  }) => {
    const account = newAccount('dg6-pending');
    await signUp(page, account);
    const workspace = await createWorkspace(page, 'Workspace DG6 Pendente');
    const project = await createProject(page, workspace.id, 'Projeto Pendente', '#f97316');
    await enterWorkspace(page);
    await gotoRoutineAgenda(page);

    const tomorrow = tomorrowLocalIso();

    await selectCalendarDay(page, tomorrow);

    await openEventDrawer(page);
    await fillEvent(page, {
      title: 'Evento Pendente',
      startDate: tomorrow,
      startTime: '09:00',
      projectLabel: 'Projeto Pendente',
    });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    const row = agendaRow(page, 'Evento Pendente');
    const eventId = await row.getAttribute('data-id');

    await page.route(`**/api/workspaces/${workspace.id}/events/${eventId}/visibility`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    const shareButton = row.locator('.btn-event-share');
    await shareButton.click();

    await expect(shareButton).toBeDisabled();
    await expect(shareButton).toHaveAttribute('aria-busy', 'true');
    await expect(row.locator('.agenda-visibility')).toHaveText('Equipe');
    await expect(shareButton).toBeEnabled();
    await expect(shareButton).not.toHaveAttribute('aria-busy', 'true');

    await page.route(`**/api/workspaces/${workspace.id}/events/${eventId}`, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    const deleteButton = row.locator('.btn-event-delete');
    await deleteButton.click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();

    await expect(deleteButton).toBeDisabled();
    await expect(deleteButton).toHaveAttribute('aria-busy', 'true');
    await expect(agendaRow(page, 'Evento Pendente')).toHaveCount(0);
  });

  test('em um fuso muito atrasado em relacao ao UTC, editar um evento noturno mostra o dia e a hora escolhidos, e o evento e agrupado no dia local, nao no dia UTC', async ({
    browser,
  }) => {
    const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo' });
    const page = await context.newPage();

    const account = newAccount('dg6-tz-edit');
    await signUp(page, account);
    await createWorkspace(page, 'Workspace DG6 Fuso');
    await enterWorkspace(page);
    await gotoRoutineAgenda(page);

    const tomorrow = await page.evaluate(() => {
      const day = new Date();
      day.setDate(day.getDate() + 1);

      const year = day.getFullYear();
      const month = String(day.getMonth() + 1).padStart(2, '0');
      const date = String(day.getDate()).padStart(2, '0');

      return `${year}-${month}-${date}`;
    });

    await openEventDrawer(page);
    await fillEvent(page, { title: 'Evento Meio-dia', startDate: tomorrow, startTime: '12:00' });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    await openEventDrawer(page);
    await fillEvent(page, { title: 'Evento Noite', startDate: tomorrow, startTime: '22:00' });
    await page.locator('#btn-save-event').click();
    await expect(page.locator('#event-drawer')).not.toHaveClass(/active/);

    const dayAfterTomorrow = await page.evaluate((iso) => {
      const [year, month, date] = iso.split('-').map(Number);
      const day = new Date(year, month - 1, date + 1);

      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    }, tomorrow);

    const dayCell = page.locator(`.calendar-day[data-date="${tomorrow}"]`);
    await expect(dayCell).toContainText('Evento Meio-dia');
    await expect(dayCell).toContainText('Evento Noite');
    await expect(page.locator(`.calendar-day[data-date="${dayAfterTomorrow}"]`)).not.toContainText(
      'Evento Noite',
    );

    await selectCalendarDay(page, tomorrow);

    const nightRow = agendaRow(page, 'Evento Noite');
    await nightRow.locator('.btn-event-edit').click();
    await expect(page.locator('#event-drawer')).toHaveClass(/active/);

    await expect(page.locator('#event-start-date')).toHaveValue(tomorrow);
    await expect(page.locator('#event-start-time')).toHaveValue('22:00');

    await context.close();
  });
});
