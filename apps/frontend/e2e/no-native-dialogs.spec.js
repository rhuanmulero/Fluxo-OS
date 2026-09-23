import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import {
  apiRequest,
  createProject,
  createWorkspace,
  enterWorkspace,
  gotoRoute,
  setNavigationPlacement,
} from './support/shell.js';

async function seedProject(page, label) {
  await signUp(page, newAccount(label));
  const workspace = await createWorkspace(page, `Workspace ${label}`);
  const project = await createProject(page, workspace.id, `Projeto ${label}`);

  await page.evaluate((id) => sessionStorage.setItem('fluxo_active_project', id), project.id);
  await setNavigationPlacement(page, { dock: 'bottom' });
  await enterWorkspace(page);

  return project;
}

function trackNativeDialogs(page) {
  const seen = [];

  page.on('dialog', async (dialog) => {
    seen.push(dialog.type());
    await dialog.dismiss();
  });

  return seen;
}

test.describe('Fora os dialogos do navegador', () => {
  test('criar roadmap acontece pelo modal do produto, com asterisco no obrigatorio', async ({
    page,
  }) => {
    await seedProject(page, 'j08-roadmap');
    const dialogs = trackNativeDialogs(page);

    await gotoRoute(page, 'roadmap');
    await page.locator('#btn-new-roadmap').click();

    const dialog = page.locator('.confirm-overlay .confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h3')).toHaveText('Nova meta');
    await expect(dialog.locator('[data-field="title"] label .field-required')).toHaveText('*');
    await expect(dialog.locator('[data-field="description"] label .field-required')).toHaveCount(0);

    await dialog.locator('[data-answer="yes"]').click();
    await expect(dialog.locator('[data-field="title"] .field-error')).toHaveText(
      'Informe o título da meta.',
    );

    await dialog.locator('[data-field="title"] input').fill('Roadmap J08');
    await dialog.locator('[data-field="description"] textarea').fill('Feito pelo modal');
    await dialog.locator('[data-answer="yes"]').click();

    await expect(page.locator('.filter-btn', { hasText: 'Roadmap J08' })).toBeVisible();
    await expect(page.locator('.roadmap-main .tasks-header p')).toHaveText('Feito pelo modal');
    expect(dialogs).toEqual([]);
  });

  test('cancelar e Esc fecham o modal de roadmap sem criar nada', async ({ page }) => {
    const project = await seedProject(page, 'j08-cancel');

    await gotoRoute(page, 'roadmap');

    await page.locator('#btn-new-roadmap').click();
    await page.locator('.confirm-dialog [data-field="title"] input').fill('Nao deve nascer');
    await page.locator('.confirm-dialog [data-answer="no"]').click();
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);

    await page.locator('#btn-new-roadmap').click();
    await page.locator('.confirm-dialog [data-field="title"] input').fill('Nem esse');
    await page.keyboard.press('Escape');
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);

    const roadmaps = await apiRequest(page, 'GET', `/projects/${project.id}/roadmaps`);
    expect(roadmaps).toHaveLength(0);
  });

  test('criar etapa pelo modal grava titulo, meta e pontos', async ({ page }) => {
    const project = await seedProject(page, 'j08-stage');

    await apiRequest(page, 'POST', `/projects/${project.id}/roadmaps`, { title: 'Roadmap Base' });

    await gotoRoute(page, 'roadmap');
    await page.locator('#btn-new-stage').click();

    const dialog = page.locator('.confirm-overlay .confirm-dialog');
    await expect(dialog.locator('h3')).toHaveText('Nova etapa');
    await expect(dialog.locator('[data-field="title"] label .field-required')).toHaveText('*');
    await expect(dialog.locator('[data-field="points"] input')).toHaveValue('1');

    await dialog.locator('[data-field="title"] input').fill('Etapa J08');
    await dialog.locator('[data-field="goal"] input').fill('Entregar a sprint');
    await dialog.locator('[data-field="points"] input').fill('7');
    await dialog.locator('[data-answer="yes"]').click();

    const stage = page.locator('.stage-card', { hasText: 'Etapa J08' });
    await expect(stage).toBeVisible();
    await expect(stage.locator('.stage-body span')).toHaveText('Entregar a sprint');
    await expect(stage.locator('.stage-points')).toHaveText('7 pts');
  });

  test('a playlist sem nome e com link invalido mostra o erro sob o campo certo', async ({
    page,
  }) => {
    await signUp(page, newAccount('j08-playlist'));
    await createWorkspace(page, 'Workspace J08 Playlist');
    await setNavigationPlacement(page, { dock: 'bottom' });
    await enterWorkspace(page);

    const dialogs = trackNativeDialogs(page);

    await gotoRoute(page, 'pomodoro');

    await page.locator('#spotify-select .dropdown-trigger').click();
    await page.locator('#spotify-select .dropdown-option[data-value="add_new"]').click();

    const box = page.locator('#add-playlist-box');
    await expect(box).toBeVisible();
    await expect(box.locator('[data-field="name"] label .field-required')).toHaveText('*');
    await expect(box.locator('[data-field="url"] label .field-required')).toHaveText('*');

    await page.locator('#btn-save-playlist').click();
    await expect(box.locator('[data-field="name"] .field-error')).toHaveText(
      'Informe o nome da playlist.',
    );
    await expect(box.locator('[data-field="url"] .field-error')).toHaveText(
      'Cole o link da playlist.',
    );

    await page.locator('#new-playlist-name').fill('Minha playlist');
    await page.locator('#new-playlist-url').fill('nao-e-um-link');
    await page.locator('#btn-save-playlist').click();

    await expect(box.locator('[data-field="name"] .field-error')).toHaveCount(0);
    await expect(box.locator('[data-field="url"] .field-error')).toHaveText(
      'Link inválido. Copie o link de uma playlist ou álbum do Spotify.',
    );

    expect(dialogs).toEqual([]);
  });

  test('remover uma playlist favorita pede confirmacao no dialogo do produto', async ({ page }) => {
    await signUp(page, newAccount('j08-remove'));
    await createWorkspace(page, 'Workspace J08 Remover');
    await setNavigationPlacement(page, { dock: 'bottom' });

    await page.evaluate(() => {
      localStorage.setItem(
        'fluxo_custom_playlists',
        JSON.stringify([
          {
            id: 'custom_1',
            name: 'Playlist Salva',
            url: 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn',
          },
        ]),
      );
      localStorage.setItem('fluxo_pomo_spotify', 'custom_1');
    });

    await enterWorkspace(page);

    const dialogs = trackNativeDialogs(page);

    await gotoRoute(page, 'pomodoro');
    await expect(page.locator('#spotify-select .dropdown-trigger')).toHaveText('Playlist Salva');

    await page.locator('#btn-delete-playlist').click();

    const confirm = page.locator('.confirm-overlay .confirm-dialog');
    await expect(confirm.locator('h3')).toHaveText('Remover playlist');

    await confirm.locator('[data-answer="no"]').click();
    await expect(page.locator('#spotify-select .dropdown-trigger')).toHaveText('Playlist Salva');

    await page.locator('#btn-delete-playlist').click();
    await page.locator('.confirm-overlay [data-answer="yes"]').click();

    await expect(page.locator('#spotify-select .dropdown-trigger')).toHaveText('Lo-Fi Beats');
    expect(dialogs).toEqual([]);
  });

  test('a falha de registro de sessao do pomodoro vai para a barra de feedback', async ({
    page,
  }) => {
    await signUp(page, newAccount('j08-record'));
    await createWorkspace(page, 'Workspace J08 Registro');
    await setNavigationPlacement(page, { dock: 'bottom' });

    await page.evaluate(() => {
      localStorage.setItem(
        'fluxo.pomodoro.times',
        JSON.stringify({ focus: 1, shortBreak: 5, longBreak: 15 }),
      );
    });

    await page.clock.install();
    await enterWorkspace(page);

    const dialogs = trackNativeDialogs(page);

    await page.route('**/api/pomodoro/sessions', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Falha forcada' }),
      });
    });

    await gotoRoute(page, 'pomodoro');
    await expect(page.locator('#time-display')).toHaveText('01:00');

    await page.locator('#btn-toggle-timer').click();
    await page.clock.runFor('01:05');

    await expect(page.locator('.page-feedback')).toHaveText(
      'Não foi possível registrar essa sessão de pomodoro. Tente novamente.',
    );
    expect(dialogs).toEqual([]);
  });
});
