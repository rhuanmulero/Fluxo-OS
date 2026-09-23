import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';
import { createWorkspace, enterWorkspace } from './support/shell.js';

const OPTIONS = [
  { value: 'a', label: 'Primeira' },
  { value: 'b', label: 'Segunda' },
  { value: 'c', label: 'Terceira' },
];

async function mountDropdown(page, extra = {}) {
  await page.evaluate(
    async ({ options, extra }) => {
      const { Dropdown } = await import('/src/components/dropdown.js');
      const host = document.createElement('div');

      host.id = 'dropdown-host';
      host.style.position = 'fixed';
      host.style.top = extra.nearBottom ? 'calc(100vh - 60px)' : '120px';
      host.style.left = '400px';
      host.style.width = '260px';
      host.style.zIndex = '50';
      document.querySelector('.main-wrapper').appendChild(host);

      window.__chosen = [];
      window.__dropdown = new Dropdown(host, {
        options,
        creatable: Boolean(extra.creatable),
        createLabel: 'Criar nova pasta…',
        onChange: (value) => {
          window.__chosen.push(value);

          if (extra.slow) {
            return new Promise((resolve) => setTimeout(resolve, 1200));
          }

          return undefined;
        },
      });
    },
    { options: OPTIONS, extra },
  );
}

async function openShell(page, label) {
  await signUp(page, newAccount(label));
  await createWorkspace(page, `Workspace ${label}`);
  await enterWorkspace(page);
}

test.describe('Componente Dropdown', () => {
  test('abre e fecha com clique no gatilho e com clique fora', async ({ page }) => {
    await openShell(page, 'j04-open');
    await mountDropdown(page);

    const trigger = page.locator('#dropdown-host .dropdown-trigger');
    const panel = page.locator('#dropdown-host .dropdown-panel');

    await expect(panel).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveAttribute('role', 'listbox');

    await trigger.click();
    await expect(panel).toBeHidden();

    await trigger.click();
    await expect(panel).toBeVisible();

    await page.locator('.main-wrapper').click({ position: { x: 5, y: 5 } });
    await expect(panel).toBeHidden();
  });

  test('setas, Home, End, Enter e Esc navegam e escolhem', async ({ page }) => {
    await openShell(page, 'j04-keys');
    await mountDropdown(page);

    const trigger = page.locator('#dropdown-host .dropdown-trigger');
    const panel = page.locator('#dropdown-host .dropdown-panel');

    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(panel).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(panel.locator('.dropdown-option.is-active')).toHaveText('Segunda');

    await page.keyboard.press('ArrowUp');
    await expect(panel.locator('.dropdown-option.is-active')).toHaveText('Primeira');

    await page.keyboard.press('End');
    await expect(panel.locator('.dropdown-option.is-active')).toHaveText('Terceira');

    await page.keyboard.press('Home');
    await expect(panel.locator('.dropdown-option.is-active')).toHaveText('Primeira');

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(panel).toBeHidden();
    await expect(trigger).toHaveText('Segunda');
    expect(await page.evaluate(() => window.__chosen)).toEqual(['b']);
  });

  test('digitar uma letra salta para a opcao correspondente', async ({ page }) => {
    await openShell(page, 'j04-type');
    await mountDropdown(page);

    const trigger = page.locator('#dropdown-host .dropdown-trigger');
    const panel = page.locator('#dropdown-host .dropdown-panel');

    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('t');

    await expect(panel.locator('.dropdown-option.is-active')).toHaveText('Terceira');
  });

  test('criar nova pasta revela o campo e Enter cria e ja seleciona', async ({ page }) => {
    await openShell(page, 'j04-create');
    await mountDropdown(page, { creatable: true });

    const trigger = page.locator('#dropdown-host .dropdown-trigger');
    const panel = page.locator('#dropdown-host .dropdown-panel');

    await trigger.click();
    await expect(panel.locator('.dropdown-option.is-create')).toHaveText('Criar nova pasta…');

    await panel.locator('.dropdown-option.is-create').click();
    await expect(panel.locator('.dropdown-create input')).toBeFocused();

    await page.keyboard.type('Utilitarios');
    await page.keyboard.press('Enter');

    await expect(panel).toBeHidden();
    await expect(trigger).toHaveText('Utilitarios');
    expect(await page.evaluate(() => window.__dropdown.value)).toBe('Utilitarios');

    await trigger.click();
    await expect(panel.locator('.dropdown-option')).toHaveCount(5);
    await expect(panel.locator('.dropdown-option[aria-selected="true"]')).toHaveText('Utilitarios');
  });

  test('o painel usa as cores do tema: claro no tema claro, escuro no escuro', async ({ page }) => {
    await openShell(page, 'j04-theme');
    await mountDropdown(page);

    await page.locator('#dropdown-host .dropdown-trigger').click();

    const dark = await page.evaluate(
      () => window.getComputedStyle(document.querySelector('.dropdown-panel')).backgroundColor,
    );

    await page.evaluate(() => document.body.classList.add('light-theme'));

    const light = await page.evaluate(
      () => window.getComputedStyle(document.querySelector('.dropdown-panel')).backgroundColor,
    );

    expect(light).not.toBe(dark);
    expect(light).toContain('245, 245, 245');
  });

  test('perto do rodape, o painel abre para cima', async ({ page }) => {
    await openShell(page, 'j04-up');
    await mountDropdown(page, { nearBottom: true });

    const trigger = page.locator('#dropdown-host .dropdown-trigger');
    await trigger.click();

    await expect(page.locator('#dropdown-host .dropdown')).toHaveClass(/opens-up/);

    const triggerBox = await trigger.boundingBox();
    const panelBox = await page.locator('#dropdown-host .dropdown-panel').boundingBox();

    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(triggerBox.y + 1);
  });

  test('enquanto onChange devolve promessa pendente, o gatilho fica ocupado', async ({ page }) => {
    await openShell(page, 'j04-busy');
    await mountDropdown(page, { slow: true });

    const trigger = page.locator('#dropdown-host .dropdown-trigger');
    const panel = page.locator('#dropdown-host .dropdown-panel');

    await trigger.click();
    await panel.locator('.dropdown-option', { hasText: 'Segunda' }).click();

    await expect(page.locator('#dropdown-host .dropdown')).toHaveClass(/is-busy/);
    await expect(trigger).toBeDisabled();

    await expect(page.locator('#dropdown-host .dropdown')).not.toHaveClass(/is-busy/, {
      timeout: 5000,
    });
    await expect(trigger).toBeEnabled();
  });

  test('destroy remove o componente da tela', async ({ page }) => {
    await openShell(page, 'j04-destroy');
    await mountDropdown(page);

    await expect(page.locator('#dropdown-host .dropdown')).toHaveCount(1);

    await page.evaluate(() => window.__dropdown.destroy());

    await expect(page.locator('#dropdown-host .dropdown')).toHaveCount(0);
  });
});
