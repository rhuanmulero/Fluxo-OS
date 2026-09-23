import { expect, test } from '@playwright/test';

test.use({ colorScheme: 'dark' });

function luminance(color) {
  const [r, g, b] = color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);

  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

test.describe('Campos claros no Criar Conta', () => {
  test('a face de cadastro declara esquema de cor claro', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('.card-back')).toHaveCSS('color-scheme', 'light');

    const scheme = await page.evaluate(
      () => getComputedStyle(document.querySelector('.card-back')).colorScheme,
    );

    expect(scheme).toContain('light');
  });

  test('a face de login declara esquema de cor escuro', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('.card-front')).toHaveCSS('color-scheme', 'dark');

    const scheme = await page.evaluate(
      () => getComputedStyle(document.querySelector('.card-front')).colorScheme,
    );

    expect(scheme).toContain('dark');
  });

  test('os campos do cadastro sao claros com o navegador no escuro', async ({ page }) => {
    await page.goto('/login.html');
    await page.locator('.card-front [data-action="toggle-card"]').click();
    await expect(page.locator('#registerForm')).toBeVisible();
    await expect(page.locator('.card-back')).toHaveCSS('color-scheme', 'light');

    for (const name of ['name', 'email', 'password']) {
      const background = await page
        .locator(`#registerForm input[name="${name}"]`)
        .evaluate((input) => getComputedStyle(input).backgroundColor);

      expect(luminance(background), `campo ${name}`).toBeGreaterThan(0.7);
    }
  });

  test('a face de login continua escura', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('.card-front')).toHaveCSS('color-scheme', 'dark');

    // A regra da folha de estilo entra em vigor junto com o color-scheme acima,
    // mas o input tem "transition: all 0.2s ease" (auth.css), entao o
    // background-color ainda anima da cor padrao do navegador ate a cor autoral
    // por um instante. expect.poll reavalia ate a transicao terminar.
    await expect
      .poll(async () => {
        const background = await page
          .locator('#loginForm input[name="email"]')
          .evaluate((input) => getComputedStyle(input).backgroundColor);

        return luminance(background);
      })
      .toBeLessThan(0.3);
  });
});

test.describe('Tema claro do navegador', () => {
  test.use({ colorScheme: 'light' });

  test('o campo do cadastro continua branco com o navegador no claro', async ({ page }) => {
    await page.goto('/login.html');
    await page.locator('.card-front [data-action="toggle-card"]').click();
    await expect(page.locator('#registerForm')).toBeVisible();
    await expect(page.locator('.card-back')).toHaveCSS('color-scheme', 'light');

    const background = await page
      .locator('#registerForm input[name="email"]')
      .evaluate((input) => getComputedStyle(input).backgroundColor);

    expect(background).toBe('rgb(255, 255, 255)');
  });

  test('a face de login continua escura com o navegador no claro', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('.card-front')).toHaveCSS('color-scheme', 'dark');

    // Mesmo raciocinio do teste equivalente no describe escuro: o color-scheme
    // ja confirma que a folha de estilo carregou, mas o background-color do
    // input ainda pode estar no meio da transicao de 0.2s (auth.css) partindo
    // do branco padrao do navegador. expect.poll espera a transicao terminar.
    await expect
      .poll(async () => {
        return page
          .locator('#loginForm input[name="email"]')
          .evaluate((input) => getComputedStyle(input).backgroundColor);
      })
      .not.toBe('rgb(255, 255, 255)');
  });
});
