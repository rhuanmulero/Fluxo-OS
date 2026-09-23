import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createWorkspace, enterWorkspace, setNavigationPlacement } from './support/shell.js';

const MARGIN = 8;

function notification(id, readAt = null) {
  return {
    id,
    type: 'TASK_DUE_SOON',
    title: 'Prazo próximo',
    body: `A tarefa "Demanda ${id}", do projeto Fluxo, vence em 10/09/2026.`,
    taskId: `task-${id}`,
    readAt,
    createdAt: '2026-09-09T11:00:00.000Z',
  };
}

async function serveNotifications(page, items) {
  const state = { items: [...items], markedAll: 0, delayMs: 0 };

  await page.route(/\/api\/me\/notifications/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET') {
      if (state.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.delayMs));
      }

      const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          unreadOnly ? state.items.filter((item) => item.readAt === null) : state.items,
        ),
      });
      return;
    }

    if (url.pathname.endsWith('/read-all')) {
      state.markedAll += 1;
      state.items = state.items.map((item) => ({
        ...item,
        readAt: item.readAt ?? '2026-09-09T12:00:00.000Z',
      }));

      await route.fulfill({ status: 200, contentType: 'application/json', body: '' });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  return state;
}

async function seed(page, label, placement = { dock: 'bottom' }) {
  await signUp(page, newAccount(label));
  await createWorkspace(page, `Workspace ${label}`);
  await setNavigationPlacement(page, placement);
}

test.describe('Sino de notificacoes no shell', () => {
  test('o sino conta as nao lidas e some quando nao ha nenhuma', async ({ page }) => {
    await seed(page, 'i08-count');
    await serveNotifications(page, [notification('a'), notification('b')]);
    await enterWorkspace(page);

    const badge = page.locator('.notification-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('2');

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
  });

  test('sem avisos, o sino nao mostra contador', async ({ page }) => {
    await seed(page, 'i08-empty-count');
    await serveNotifications(page, []);
    await enterWorkspace(page);

    await expect(page.locator('.notification-bell .icon-btn')).toBeVisible();
    await expect(page.locator('.notification-badge')).toBeHidden();
  });

  test('abrir o painel lista titulo, corpo e data de cada aviso', async ({ page }) => {
    await seed(page, 'i08-list');
    await serveNotifications(page, [notification('a'), notification('b', '2026-09-09T12:00:00.000Z')]);
    await enterWorkspace(page);

    await page.locator('.notification-bell .icon-btn').click();

    const panel = page.locator('.notification-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.notification-item')).toHaveCount(2);

    const first = panel.locator('.notification-item').first();
    await expect(first.locator('strong')).toHaveText('Prazo próximo');
    await expect(first.locator('span')).toContainText('Demanda a');
    await expect(first.locator('time')).toHaveText('09/09, 08:00');
    await expect(first).toHaveClass(/is-unread/);
    await expect(panel.locator('.notification-item').nth(1)).not.toHaveClass(/is-unread/);
  });

  test('o painel mostra o giro enquanto busca a lista', async ({ page }) => {
    await seed(page, 'i08-loading');
    const state = await serveNotifications(page, [notification('a')]);
    await enterWorkspace(page);

    await expect(page.locator('.notification-badge')).toHaveText('1');

    state.delayMs = 1200;
    await page.locator('.notification-bell .icon-btn').click();

    await expect(page.locator('.notification-panel > .region-loader')).toBeVisible();
    await expect(page.locator('.notification-panel.is-loading')).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test('fechar o painel marca tudo como lido e zera o contador', async ({ page }) => {
    await seed(page, 'i08-mark');
    const state = await serveNotifications(page, [notification('a'), notification('b')]);
    await enterWorkspace(page);

    await expect(page.locator('.notification-badge')).toHaveText('2');

    await page.locator('.notification-bell .icon-btn').click();
    await expect(page.locator('.notification-panel')).toBeVisible();

    await page.locator('.notification-bell .icon-btn').click();

    await expect(page.locator('.notification-panel')).toBeHidden();
    await expect(page.locator('.notification-badge')).toBeHidden();
    expect(state.markedAll).toBe(1);

    await page.reload();
    await expect(page.locator('#global-bg')).toBeAttached();
    await expect(page.locator('.notification-badge')).toBeHidden();
  });

  test('sem avisos, o painel mostra a tela vazia', async ({ page }) => {
    await seed(page, 'i08-empty');
    await serveNotifications(page, []);
    await enterWorkspace(page);

    await page.locator('.notification-bell .icon-btn').click();

    const panel = page.locator('.notification-panel');
    await expect(panel.locator('.page-empty')).toBeVisible();
    await expect(panel.locator('.empty-state p')).toHaveText('Nada por aqui. Você está em dia.');
  });

  test('clicar num aviso leva para Tarefas e fecha o painel', async ({ page }) => {
    await seed(page, 'i08-navigate');
    await serveNotifications(page, [notification('a')]);
    await enterWorkspace(page);

    await page.locator('.notification-bell .icon-btn').click();
    await page.locator('.notification-item').first().click();

    await expect(page.locator('.notification-panel')).toBeHidden();
    await expect(page.locator('[data-route="tasks"]')).toHaveClass(/active/);
    await expect(page.locator('.tasks-container')).toBeVisible();
  });

  for (const placement of [
    { label: 'topo', value: { dock: 'top' } },
    { label: 'rodape', value: { dock: 'bottom' } },
    { label: 'esquerda', value: { dock: 'left' } },
    { label: 'direita', value: { dock: 'right' } },
    { label: 'barra lateral', value: { mode: 'sidebar' } },
  ]) {
    test(`com o dock em ${placement.label}, o painel abre inteiro dentro da tela`, async ({
      page,
    }) => {
      await seed(page, `i08-place-${placement.label.replace(' ', '-')}`, placement.value);
      await serveNotifications(page, [notification('a'), notification('b')]);
      await enterWorkspace(page);

      await page.locator('.notification-bell .icon-btn').click();

      const panel = page.locator('.notification-panel');
      await expect(panel).toBeVisible();

      const box = await panel.boundingBox();
      const size = page.viewportSize();

      expect(box.x).toBeGreaterThanOrEqual(MARGIN - 1);
      expect(box.y).toBeGreaterThanOrEqual(MARGIN - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width - MARGIN + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height - MARGIN + 1);
    });
  }
});
