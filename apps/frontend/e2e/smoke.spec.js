import { expect, test } from '@playwright/test';
import { newAccount, signUp } from './support/account.js';

test('a tela de workspace responde para uma conta recem-criada', async ({ page }) => {
  await signUp(page, newAccount('smoke'));

  await page.goto('/workspace.html');

  await expect(page.locator('#createForm')).toBeVisible();
});
