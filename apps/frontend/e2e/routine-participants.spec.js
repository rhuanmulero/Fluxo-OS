import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  inviteMember,
  joinWorkspaceAsMember,
  setNavigationPlacement,
} from './support/shell.js';

async function openRoutine(page) {
  await enterWorkspace(page);
  await gotoRoute(page, 'routine');
  await expect(page.locator('#routine-body')).toBeVisible();
}

async function fillEvent(page, title, date) {
  await page.locator('#event-title').fill(title);
  await page.locator('#event-start-date').fill(date);
  await page.locator('#event-start-time').fill('10:00');
}

async function selectCalendarDay(page, iso) {
  await page.locator(`.calendar-day[data-date="${iso}"]`).click();
}

async function withMember(page, browser, label) {
  await signUp(page, newAccount(`${label}-owner`));
  const workspace = await createWorkspace(page, `Workspace ${label}`);
  const code = await inviteMember(page, workspace.id, 'MEMBER');

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  const memberAccount = newAccount(`${label}-member`);

  await signUp(memberPage, memberAccount);
  await joinWorkspaceAsMember(memberPage, code, workspace.id);

  const memberId = (await apiRequest(memberPage, 'GET', '/me')).id;

  await setNavigationPlacement(page, { dock: 'bottom' });
  await setNavigationPlacement(memberPage, { dock: 'bottom' });

  return { workspace, memberContext, memberPage, memberAccount, memberId };
}

test.describe('Participantes na Rotina', () => {
  test('criar evento com participantes mostra os nomes no cartao', async ({ page, browser }) => {
    const { memberContext, memberAccount } = await withMember(page, browser, 'i11-create');

    await openRoutine(page);
    await selectCalendarDay(page, '2026-09-20');
    await page.locator('#btn-new-event').click();

    const list = page.locator('#event-participants');
    await expect(list.locator('.participant-option')).toHaveCount(2);

    await fillEvent(page, 'Alinhamento com participantes', '2026-09-20');
    await list
      .locator('.participant-option')
      .filter({ hasText: memberAccount.name })
      .locator('input')
      .check();

    await page.locator('#btn-save-event').click();

    const row = page.locator('.agenda-row', { hasText: 'Alinhamento com participantes' });
    await expect(row).toBeVisible();
    await expect(row.locator('.event-participants')).toHaveText(`Com ${memberAccount.name}`);

    await memberContext.close();
  });

  test('editar e remover um participante atualiza o cartao', async ({ page, browser }) => {
    const { memberContext, memberAccount } = await withMember(page, browser, 'i11-edit');

    await openRoutine(page);
    await selectCalendarDay(page, '2026-09-21');
    await page.locator('#btn-new-event').click();
    await fillEvent(page, 'Evento a editar', '2026-09-21');
    await page
      .locator('#event-participants .participant-option')
      .filter({ hasText: memberAccount.name })
      .locator('input')
      .check();
    await page.locator('#btn-save-event').click();

    const row = page.locator('.agenda-row', { hasText: 'Evento a editar' });
    await expect(row.locator('.event-participants')).toBeVisible();

    await row.locator('.btn-event-edit').click();

    const checkbox = page
      .locator('#event-participants .participant-option')
      .filter({ hasText: memberAccount.name })
      .locator('input');

    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await page.locator('#btn-save-event').click();

    await expect(page.locator('.agenda-row', { hasText: 'Evento a editar' })).toBeVisible();
    await expect(
      page.locator('.agenda-row', { hasText: 'Evento a editar' }).locator('.event-participants'),
    ).toHaveCount(0);

    await memberContext.close();
  });

  test('o participante enxerga na agenda dele o evento privado do outro', async ({
    page,
    browser,
  }) => {
    const { memberContext, memberPage, memberAccount } = await withMember(
      page,
      browser,
      'i11-visible',
    );

    await openRoutine(page);
    await selectCalendarDay(page, '2026-09-22');
    await page.locator('#btn-new-event').click();
    await fillEvent(page, 'Conversa reservada', '2026-09-22');
    await page
      .locator('#event-participants .participant-option')
      .filter({ hasText: memberAccount.name })
      .locator('input')
      .check();
    await page.locator('#btn-save-event').click();

    await expect(page.locator('.agenda-row', { hasText: 'Conversa reservada' })).toBeVisible();

    await openRoutine(memberPage);
    await selectCalendarDay(memberPage, '2026-09-22');

    await expect(
      memberPage.locator('.agenda-row', { hasText: 'Conversa reservada' }),
    ).toBeVisible();
    await expect(memberPage.locator('.agenda-row .btn-event-edit')).toHaveCount(0);

    await memberContext.close();
  });

  test('salvar o evento mostra o botao girando', async ({ page, browser }) => {
    const { memberContext } = await withMember(page, browser, 'i11-pending');

    await openRoutine(page);
    await selectCalendarDay(page, '2026-09-23');
    await page.locator('#btn-new-event').click();
    await fillEvent(page, 'Evento pendente', '2026-09-23');

    await page.route('**/api/workspaces/*/events', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      await route.continue();
    });

    const button = page.locator('#btn-save-event');
    await button.click();

    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button.locator('.btn-spinner')).toBeVisible();

    await expect(page.locator('.agenda-row', { hasText: 'Evento pendente' })).toBeVisible();

    await memberContext.close();
  });

  test('membro desligado nao pode ser selecionado como participante', async ({ page, browser }) => {
    const { memberContext, memberAccount, memberId, workspace } = await withMember(
      page,
      browser,
      'i11-desligado',
    );

    await apiRequest(page, 'PATCH', `/workspaces/${workspace.id}/members/${memberId}/status`, {
      active: false,
    });

    await openRoutine(page);
    await selectCalendarDay(page, '2026-09-24');
    await page.locator('#btn-new-event').click();

    const option = page
      .locator('#event-participants .participant-option')
      .filter({ hasText: memberAccount.name });

    await expect(option).toContainText('(desligado)');
    await expect(option.locator('input')).toBeDisabled();
    await expect(option.locator('input')).not.toBeChecked();

    await memberContext.close();
  });

  test('a lista de participantes usa os tokens do tema nos dois modos', async ({
    page,
    browser,
  }) => {
    const { memberContext } = await withMember(page, browser, 'i11-theme');

    await openRoutine(page);
    await page.locator('#btn-new-event').click();

    const list = page.locator('#event-participants');
    await expect(list).toBeVisible();

    const dark = await list.evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.evaluate(() => document.body.classList.add('light-theme'));

    const light = await list.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(light).not.toBe(dark);

    await memberContext.close();
  });
});
